import Parser from 'rss-parser';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { events } from '../lib/db/schema';
import { RSS_FEEDS, RssFeedConfig } from './lib/rss-config';
import { rssDedupHash } from './lib/rss-dedup';
import { NewEvent } from './lib/base-collector';
import { geocodeText } from './lib/geocode';

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const FEED_TIMEOUT_MS = 15_000;

const parser = new Parser({
  timeout: FEED_TIMEOUT_MS,
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { events } });

let running = true;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseItemDate(item: Parser.Item): Date {
  if (item.isoDate) {
    const d = new Date(item.isoDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (item.pubDate) {
    const d = new Date(item.pubDate);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

function itemToEvent(item: Parser.Item, feedConfig: RssFeedConfig): NewEvent {
  const sourceId = item.guid || item.link || '';
  const description = (item.contentSnippet || item.content || '').slice(0, 500) || null;
  const geo = geocodeText(item.title || '') || geocodeText(description || '');

  return {
    timestamp: parseItemDate(item),
    type: 'news',
    severity: 'info',
    title: item.title || '(untitled)',
    description,
    locationName: geo?.locationName ?? null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    source: feedConfig.source,
    sourceId,
    country: null,
    dedupHash: rssDedupHash(feedConfig.source, sourceId),
    metadata: {
      category: feedConfig.category,
      feedUrl: feedConfig.url,
      link: item.link,
    },
  };
}

async function processFeed(feedConfig: RssFeedConfig): Promise<{ fetched: number; inserted: number }> {
  const feed = await parser.parseURL(feedConfig.url);
  let inserted = 0;

  for (const item of feed.items) {
    const event = itemToEvent(item, feedConfig);
    const result = await db
      .insert(events)
      .values({
        timestamp: event.timestamp,
        type: event.type,
        severity: event.severity,
        title: event.title,
        description: event.description,
        locationName: event.locationName,
        lat: event.lat,
        lng: event.lng,
        source: event.source,
        sourceId: event.sourceId,
        metadata: event.metadata,
        country: event.country,
        dedupHash: event.dedupHash,
      })
      .onConflictDoNothing({ target: events.dedupHash })
      .returning({ id: events.id });

    if (result.length > 0) {
      inserted++;
    }
  }

  return { fetched: feed.items.length, inserted };
}

async function runCycle(): Promise<void> {
  let totalFeeds = 0;
  let totalFetched = 0;
  let totalInserted = 0;

  for (const feedConfig of RSS_FEEDS) {
    try {
      const { fetched, inserted } = await processFeed(feedConfig);
      totalFeeds++;
      totalFetched += fetched;
      totalInserted += inserted;
    } catch (err) {
      console.warn(
        `[rss-feeds] warning: failed to process feed "${feedConfig.name}" (${feedConfig.url}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `[rss-feeds] cycle complete: feeds=${totalFeeds}/${RSS_FEEDS.length} items_fetched=${totalFetched} items_inserted=${totalInserted}`,
  );
}

async function main(): Promise<void> {
  console.log(`[rss-feeds] starting (interval=${INTERVAL_MS}ms, feeds=${RSS_FEEDS.length})`);

  while (running) {
    await runCycle();

    if (running) {
      await sleep(INTERVAL_MS);
    }
  }
}

const shutdown = async () => {
  console.log('[rss-feeds] shutting down...');
  running = false;
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((err) => {
  console.error('[rss-feeds] fatal error:', err);
  process.exit(1);
});
