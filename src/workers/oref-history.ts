import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';

import { runCollector, NewEvent } from './lib/base-collector';
import { mapCategory, parseAsJerusalem } from './lib/normalize';
import { orefHistoryHash } from './lib/dedup';
import { events } from '../lib/db/schema';
import districts from '../lib/geo/districts.json';
import { proxyFetch } from './lib/ssh-fetch';

const BASE_URL = process.env.OREF_BASE_URL || 'https://www.oref.org.il';
const HISTORY_URL = `${BASE_URL}/WarningMessages/alert/History/AlertsHistory.json`;

const HEADERS = {
  Referer: `${BASE_URL}/`,
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

interface OrefHistoryRecord {
  alertDate: string;
  title: string;
  data: string;
  category: number;
}

const districtsMap = districts as Record<
  string,
  { lat: number; lng: number; areaname: string; migun_time: number }
>;

/** Strip UTF-8 BOM if present. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

// Separate DB connection for clearance updates (category 13),
// since base-collector owns its own insert connection internally.
const clearancePool = new Pool({ connectionString: process.env.DATABASE_URL });
const clearanceDb = drizzle(clearancePool, { schema: { events } });

async function collect(): Promise<NewEvent[]> {
  const raw = await proxyFetch(HISTORY_URL, HEADERS);
  const cleaned = stripBom(raw);

  // Empty response means no history records
  if (!cleaned.trim() || cleaned.trim() === '[]') {
    return [];
  }

  const records: OrefHistoryRecord[] = JSON.parse(cleaned);
  const newEvents: NewEvent[] = [];

  for (const record of records) {
    const { type, severity } = mapCategory(record.category);
    const geo = districtsMap[record.data];

    const event: NewEvent = {
      timestamp: parseAsJerusalem(record.alertDate),
      type,
      severity,
      title: record.title,
      description: null,
      locationName: record.data,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      source: 'oref-history',
      sourceId: `oref-hist:${record.alertDate}:${record.data}`,
      country: 'IL',
      dedupHash: orefHistoryHash(record.alertDate, record.data),
      metadata: { category: record.category },
    };

    newEvents.push(event);

    // Category 13 = "event ended" — deactivate matching prior events
    if (record.category === 13) {
      try {
        await clearanceDb
          .update(events)
          .set({ isActive: false })
          .where(
            and(
              eq(events.isActive, true),
              eq(events.locationName, record.data),
              eq(events.country, 'IL'),
            ),
          );
      } catch (err) {
        console.error(
          `[oref-history] failed to clear events for ${record.data}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return newEvents;
}

runCollector({
  name: 'oref-history',
  intervalMs: 5 * 60 * 1000, // 5 minutes
  collect,
});
