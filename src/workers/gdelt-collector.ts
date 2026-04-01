import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { events } from '../lib/db/schema';
import { GDELT_API_URL, GDELT_QUERY, GDELT_MAX_RECORDS, INTERVAL_MS } from './lib/gdelt-config';
import { sha256 } from './lib/normalize';
import { NewEvent } from './lib/base-collector';

const FETCH_TIMEOUT_MS = 15_000;

interface GdeltArticle {
  url: string;
  url_mobile: string;
  title: string;
  seendate: string;
  socialimage: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

interface GdeltResponse {
  articles: GdeltArticle[];
}

function buildUrl(): string {
  const params = new URLSearchParams({
    query: GDELT_QUERY,
    mode: 'artlist',
    maxrecords: String(GDELT_MAX_RECORDS),
    format: 'json',
    sort: 'DateDesc',
  });
  return `${GDELT_API_URL}?${params.toString()}`;
}

/**
 * Parse GDELT seendate format "20260401T120000Z" to a Date object.
 */
function parseSeenDate(seendate: string): Date {
  // Format: "20260401T120000Z"
  const match = seendate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  }
  // Fallback: try direct parsing
  const d = new Date(seendate);
  if (!isNaN(d.getTime())) return d;
  return new Date();
}

function articleToEvent(article: GdeltArticle): NewEvent {
  const sourceId = `gdelt:${article.url}`;
  return {
    timestamp: parseSeenDate(article.seendate),
    type: 'news',
    severity: 'info',
    title: article.title || '(untitled)',
    description: article.domain ? `Source: ${article.domain}` : null,
    locationName: null,
    lat: null,
    lng: null,
    source: 'gdelt',
    sourceId,
    country: null,
    dedupHash: sha256(sourceId),
    metadata: {
      url: article.url,
      domain: article.domain,
      language: article.language,
      sourcecountry: article.sourcecountry,
    },
  };
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { events } });

let running = true;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCycle(): Promise<void> {
  const url = buildUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let articles: GdeltArticle[];
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`GDELT API returned ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as GdeltResponse;
    articles = data.articles ?? [];
  } finally {
    clearTimeout(timeout);
  }

  let inserted = 0;
  for (const article of articles) {
    const event = articleToEvent(article);
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

  console.log(`[gdelt-collector] fetched=${articles.length} inserted=${inserted}`);
}

async function main(): Promise<void> {
  console.log(`[gdelt-collector] starting (interval=${INTERVAL_MS}ms)`);

  while (running) {
    try {
      await runCycle();
    } catch (err) {
      console.error('[gdelt-collector] error:', err instanceof Error ? err.message : err);
    }

    if (running) {
      await sleep(INTERVAL_MS);
    }
  }
}

const shutdown = async () => {
  console.log('[gdelt-collector] shutting down...');
  running = false;
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((err) => {
  console.error('[gdelt-collector] fatal error:', err);
  process.exit(1);
});
