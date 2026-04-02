import Parser from 'rss-parser';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as iconv from 'iconv-lite';
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

// Encodings that need iconv-lite conversion (not natively supported by Node)
const NON_UTF8_PATTERN = /windows-1255|windows-1256|iso-8859-8|iso-8859-6/i;

/**
 * Fetch an RSS feed as a UTF-8 string, handling non-UTF-8 encodings like Windows-1255.
 * Returns the XML string ready for parser.parseString().
 */
async function fetchFeedAsUtf8(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    headers: { 'User-Agent': 'war-alerting-system/0.1 (rss-feeds)' },
  });
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);

  const contentType = res.headers.get('content-type') || '';
  const charsetMatch = contentType.match(/charset=([\w-]+)/i);
  const charset = charsetMatch?.[1] || '';

  if (NON_UTF8_PATTERN.test(charset)) {
    const buf = Buffer.from(await res.arrayBuffer());
    return iconv.decode(buf, charset);
  }

  // Check the XML declaration for encoding as fallback
  const text = await res.text();
  const xmlEncodingMatch = text.match(/<\?xml[^?]*encoding=["']([\w-]+)["']/i);
  const xmlEncoding = xmlEncodingMatch?.[1] || '';

  if (NON_UTF8_PATTERN.test(xmlEncoding)) {
    // Re-fetch as buffer since we already consumed the response as text (corrupted)
    const res2 = await fetch(url, {
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      headers: { 'User-Agent': 'war-alerting-system/0.1 (rss-feeds)' },
    });
    const buf = Buffer.from(await res2.arrayBuffer());
    return iconv.decode(buf, xmlEncoding);
  }

  return text;
}

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
  // Use manual fetch + iconv for Hebrew feeds that may use Windows-1255
  const needsEncoding = feedConfig.language === 'he';
  const feed = needsEncoding
    ? await parser.parseString(await fetchFeedAsUtf8(feedConfig.url))
    : await parser.parseURL(feedConfig.url);
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
