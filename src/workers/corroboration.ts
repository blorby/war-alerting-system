import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, gte, inArray } from 'drizzle-orm';
import { events } from '../lib/db/schema';
import {
  SOURCE_CATEGORIES,
  INTERVAL_MS,
  TIME_WINDOW_MS,
  LOOKBACK_MS,
} from './lib/corroboration-config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { events } });

let running = true;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractKeywords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function titlesOverlap(a: string, b: string): boolean {
  const kw1 = extractKeywords(a);
  const kw2 = extractKeywords(b);
  let matches = 0;
  for (const w of kw1) {
    if (kw2.has(w)) matches++;
  }
  return matches >= 2;
}

async function runCycle(): Promise<void> {
  const cutoff = new Date(Date.now() - LOOKBACK_MS);

  // 1. Query uncorroborated events from last 2 hours
  const uncorroborated = await db
    .select()
    .from(events)
    .where(and(eq(events.corroborated, false), gte(events.timestamp, cutoff)));

  // 2. Query ALL events from last 2 hours (for matching against)
  const allRecent = await db
    .select()
    .from(events)
    .where(gte(events.timestamp, cutoff));

  const idsToMark: string[] = [];

  for (const event of uncorroborated) {
    const category = SOURCE_CATEGORIES[event.source] ?? 'unknown';

    // 3b. Official sources are trusted alone
    if (category === 'official') {
      idsToMark.push(event.id);
      continue;
    }

    // 3c. Find matching events within the time window
    const eventTime = new Date(event.timestamp).getTime();
    const matchingCategories = new Set<string>([category]);

    for (const other of allRecent) {
      if (other.id === event.id) continue;

      const otherTime = new Date(other.timestamp).getTime();
      if (Math.abs(otherTime - eventTime) > TIME_WINDOW_MS) continue;

      // Check location match or title keyword overlap
      const locationMatch =
        event.locationName != null &&
        other.locationName != null &&
        event.locationName === other.locationName;

      const titleMatch = titlesOverlap(event.title, other.title);

      if (locationMatch || titleMatch) {
        const otherCategory = SOURCE_CATEGORIES[other.source] ?? 'unknown';
        matchingCategories.add(otherCategory);
      }
    }

    // 3e. If 2+ different categories confirm, mark as corroborated
    if (matchingCategories.size >= 2) {
      idsToMark.push(event.id);
    }
  }

  // 4. Batch update
  if (idsToMark.length > 0) {
    await db
      .update(events)
      .set({ corroborated: true })
      .where(inArray(events.id, idsToMark));
  }

  // 5. Log
  console.log(
    `[corroboration] cycle complete: scanned=${uncorroborated.length} newly_corroborated=${idsToMark.length}`
  );
}

async function main(): Promise<void> {
  console.log(`[corroboration] starting (interval=${INTERVAL_MS}ms)`);

  while (running) {
    try {
      await runCycle();
    } catch (err) {
      console.error(
        '[corroboration] error:',
        err instanceof Error ? err.message : err
      );
    }

    if (running) {
      await sleep(INTERVAL_MS);
    }
  }
}

const shutdown = async () => {
  console.log('[corroboration] shutting down...');
  running = false;
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((err) => {
  console.error('[corroboration] fatal error:', err);
  process.exit(1);
});
