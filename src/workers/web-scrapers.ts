import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { events } from '../lib/db/schema';
import { SCRAPER_SITES, INTERVAL_MS, ScraperSiteConfig } from './lib/scraper-config';
import { parseSite, ScrapedItem } from './lib/scraper-parser';
import { scraperDedupHash } from './lib/scraper-dedup';
import { NewEvent } from './lib/base-collector';
import { geocodeText } from './lib/geocode';
import { needsProxy, proxyFetch } from './lib/ssh-fetch';

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { events } });

let running = true;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function itemToEvent(item: ScrapedItem, site: ScraperSiteConfig): NewEvent {
  const geo = geocodeText(item.title || '') || geocodeText(item.snippet || '');
  return {
    timestamp: item.date || new Date(),
    type: 'news',
    severity: 'info',
    title: item.title,
    description: item.snippet?.slice(0, 500) || null,
    locationName: geo?.locationName ?? null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    source: site.source,
    sourceId: `scraper:${site.source}:${item.url}`,
    country: site.country,
    dedupHash: scraperDedupHash(site.source, item.url),
    metadata: {
      category: site.category,
      siteUrl: site.url,
      itemUrl: item.url,
    },
  };
}

async function fetchHtml(url: string): Promise<string> {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'en',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  if (needsProxy(url)) {
    return proxyFetch(url, headers, FETCH_TIMEOUT_MS);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function processSite(
  site: ScraperSiteConfig,
): Promise<{ fetched: number; inserted: number }> {
  const html = await fetchHtml(site.url);
  const baseUrl = new URL(site.url).origin;
  const items = parseSite(html, site.source, baseUrl);

  let inserted = 0;
  for (const item of items) {
    const event = itemToEvent(item, site);
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

  return { fetched: items.length, inserted };
}

async function runCycle(): Promise<void> {
  let totalSites = 0;
  let totalFetched = 0;
  let totalInserted = 0;

  for (const site of SCRAPER_SITES) {
    try {
      const { fetched, inserted } = await processSite(site);
      totalSites++;
      totalFetched += fetched;
      totalInserted += inserted;
    } catch (err) {
      console.warn(
        `[web-scrapers] warning: failed to process site "${site.name}" (${site.url}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `[web-scrapers] cycle complete: sites=${totalSites}/${SCRAPER_SITES.length} items_fetched=${totalFetched} items_inserted=${totalInserted}`,
  );
}

async function main(): Promise<void> {
  console.log(`[web-scrapers] starting (interval=${INTERVAL_MS}ms, sites=${SCRAPER_SITES.length})`);

  while (running) {
    await runCycle();

    if (running) {
      await sleep(INTERVAL_MS);
    }
  }
}

const shutdown = async () => {
  console.log('[web-scrapers] shutting down...');
  running = false;
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((err) => {
  console.error('[web-scrapers] fatal error:', err);
  process.exit(1);
});
