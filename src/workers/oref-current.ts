import { runCollector, NewEvent } from './lib/base-collector';
import { mapTitle } from './lib/normalize';
import { orefCurrentHash } from './lib/dedup';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load districts once at startup.
// At runtime __dirname is dist/workers/, districts.json compiles to dist/lib/geo/districts.json
const districtsPath = join(__dirname, '../lib/geo/districts.json');
const districts: Record<string, { lat: number; lng: number; areaname: string; migun_time: number; areaid?: number }> =
  JSON.parse(readFileSync(districtsPath, 'utf-8'));

interface OrefCurrentAlert {
  title: string;
  data: string[] | string;
  desc?: string;
}

const OREF_BASE_URL = process.env.OREF_BASE_URL || 'https://www.oref.org.il';

async function fetchAlerts(): Promise<OrefCurrentAlert[]> {
  const url = `${OREF_BASE_URL}/WarningMessages/alert/alerts.json`;

  const res = await fetch(url, {
    headers: {
      'Referer': 'https://www.oref.org.il/',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
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

  // Normalize single object to array
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function collect(): Promise<NewEvent[]> {
  const alerts = await fetchAlerts();
  const now = new Date();
  const events: NewEvent[] = [];

  for (const alert of alerts) {
    const { type, severity } = mapTitle(alert.title);

    // Defensive: data could be a string instead of array
    const cities: string[] = Array.isArray(alert.data)
      ? alert.data
      : typeof alert.data === 'string'
        ? [alert.data]
        : [];

    for (const city of cities) {
      const geo = districts[city];

      events.push({
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
      });
    }
  }

  return events;
}

runCollector({
  name: 'oref-current',
  intervalMs: 30_000,
  collect,
});
