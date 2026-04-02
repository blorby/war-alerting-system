import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { events } from '../lib/db/schema';
import { mapTitle } from './lib/normalize';
import { orefCurrentHash } from './lib/dedup';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load districts once at startup.
const districtsPath = join(__dirname, '../lib/geo/districts.json');
const districts: Record<string, { lat: number; lng: number; areaname: string; migun_time: number; areaid?: number }> =
  JSON.parse(readFileSync(districtsPath, 'utf-8'));

interface OrefCurrentAlert {
  title: string;
  data: string[] | string;
  desc?: string;
}

const OREF_BASE_URL = process.env.OREF_BASE_URL || 'https://www.oref.org.il';
const INTERVAL_MS = 30_000; // 30 seconds
const ALERT_EXPIRY_MS = 30 * 60_000; // 30 minutes — auto-expire stale alerts

// "Event ended" titles that signal clearance
const CLEARED_TITLES = ['האירוע הסתיים', 'הסתיים אירוע חדירת מחבלים - ניתן לצאת מהבתים'];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { events } });

let running = true;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAlerts(): Promise<OrefCurrentAlert[]> {
  const url = `${OREF_BASE_URL}/WarningMessages/alert/alerts.json`;

  const res = await fetch(url, {
    headers: {
      'Referer': 'https://www.oref.org.il/',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Oref current alerts returned ${res.status}`);
  }

  let text = await res.text();

  // Strip UTF-8 BOM if present
  if (text.startsWith('\uFEFF')) {
    text = text.slice(1);
  }

  text = text.trim();

  // Empty body means no active alerts
  if (text === '') {
    return [];
  }

  const parsed: OrefCurrentAlert | OrefCurrentAlert[] = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function deactivateCities(cities: string[]): Promise<number> {
  if (cities.length === 0) return 0;

  const result = await db
    .update(events)
    .set({ isActive: false })
    .where(
      and(
        eq(events.isActive, true),
        eq(events.type, 'alert'),
        eq(events.source, 'oref-current'),
        inArray(events.locationName, cities),
      ),
    )
    .returning({ id: events.id });

  return result.length;
}

async function expireStaleAlerts(): Promise<number> {
  const cutoff = new Date(Date.now() - ALERT_EXPIRY_MS);

  const result = await db
    .update(events)
    .set({ isActive: false })
    .where(
      and(
        eq(events.isActive, true),
        eq(events.type, 'alert'),
        lt(events.timestamp, cutoff),
      ),
    )
    .returning({ id: events.id });

  return result.length;
}

async function runCycle(): Promise<void> {
  const alerts = await fetchAlerts();
  const now = new Date();
  let inserted = 0;
  let deactivated = 0;

  for (const alert of alerts) {
    const { type, severity } = mapTitle(alert.title);
    const isCleared = CLEARED_TITLES.includes(alert.title);

    const cities: string[] = Array.isArray(alert.data)
      ? alert.data
      : typeof alert.data === 'string'
        ? [alert.data]
        : [];

    // If this is an "event ended" alert, deactivate all active alerts for these cities
    if (isCleared) {
      const cleared = await deactivateCities(cities);
      deactivated += cleared;
    }

    // Insert the event records
    for (const city of cities) {
      const geo = districts[city];

      const result = await db
        .insert(events)
        .values({
          timestamp: now,
          type,
          severity,
          title: alert.title,
          description: alert.desc || null,
          locationName: city,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
          source: 'oref-current',
          sourceId: `oref:${alert.title}:${city}`,
          metadata: {},
          country: 'IL',
          dedupHash: orefCurrentHash(alert.title, city, now),
          // "event ended" events are born inactive
          isActive: !isCleared,
        })
        .onConflictDoNothing({ target: events.dedupHash })
        .returning({ id: events.id });

      if (result.length > 0) {
        inserted++;
      }
    }
  }

  // If OREF returns empty (no active alerts at all), deactivate all stale oref-current alerts
  if (alerts.length === 0) {
    const expired = await expireStaleAlerts();
    if (expired > 0) {
      deactivated += expired;
    }
  }

  // Always expire alerts older than 30 minutes
  const expiredOld = await expireStaleAlerts();

  const totalDeactivated = deactivated + expiredOld;
  console.log(
    `[oref-current] collected=${alerts.length} inserted=${inserted} deactivated=${totalDeactivated}`,
  );
}

async function main(): Promise<void> {
  console.log(`[oref-current] starting (interval=${INTERVAL_MS}ms)`);

  while (running) {
    try {
      await runCycle();
    } catch (err) {
      console.error('[oref-current] error:', err instanceof Error ? err.message : err);
    }

    if (running) {
      await sleep(INTERVAL_MS);
    }
  }
}

const shutdown = async () => {
  console.log('[oref-current] shutting down...');
  running = false;
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((err) => {
  console.error('[oref-current] fatal error:', err);
  process.exit(1);
});
