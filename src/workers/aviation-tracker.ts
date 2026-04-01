import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { events } from '../lib/db/schema';
import { NewEvent } from './lib/base-collector';
import { sha256 } from './lib/normalize';
import {
  ADSB_LOL_URL,
  OPENSKY_URL,
  OPENSKY_BOUNDS,
  INTERVAL_MS,
} from './lib/aviation-config';

const FETCH_TIMEOUT_MS = 15_000;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { events } });

let running = true;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface AircraftData {
  hex: string;
  callsign: string | null;
  lat: number | null;
  lng: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  squawk: string | null;
  onGround: boolean | null;
  originCountry: string | null;
  aircraftType: string | null;
  registration: string | null;
  source: 'adsb-lol' | 'opensky';
}

function roundToInterval(date: Date): string {
  const ms = date.getTime();
  const rounded = Math.floor(ms / INTERVAL_MS) * INTERVAL_MS;
  return new Date(rounded).toISOString();
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAdsbLol(): Promise<AircraftData[]> {
  const response = await fetchWithTimeout(ADSB_LOL_URL, FETCH_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`ADSB.lol returned HTTP ${response.status}`);
  }

  const data = await response.json() as { ac?: Array<Record<string, unknown>> };
  const aircraft: AircraftData[] = [];

  if (!Array.isArray(data.ac)) {
    return aircraft;
  }

  for (const ac of data.ac) {
    const hex = typeof ac.hex === 'string' ? ac.hex.toLowerCase().trim() : null;
    if (!hex) continue;

    aircraft.push({
      hex,
      callsign: typeof ac.flight === 'string' ? ac.flight.trim() || null : null,
      lat: typeof ac.lat === 'number' ? ac.lat : null,
      lng: typeof ac.lon === 'number' ? ac.lon : null,
      altitude: typeof ac.alt_baro === 'number' ? ac.alt_baro : null,
      speed: typeof ac.gs === 'number' ? ac.gs : null,
      heading: typeof ac.track === 'number' ? ac.track : null,
      squawk: typeof ac.squawk === 'string' ? ac.squawk : null,
      onGround: null,
      originCountry: null,
      aircraftType: typeof ac.t === 'string' ? ac.t : null,
      registration: typeof ac.r === 'string' ? ac.r : null,
      source: 'adsb-lol',
    });
  }

  return aircraft;
}

async function fetchOpenSky(): Promise<AircraftData[]> {
  const params = new URLSearchParams({
    lamin: String(OPENSKY_BOUNDS.lamin),
    lomin: String(OPENSKY_BOUNDS.lomin),
    lamax: String(OPENSKY_BOUNDS.lamax),
    lomax: String(OPENSKY_BOUNDS.lomax),
  });
  const url = `${OPENSKY_URL}?${params.toString()}`;

  const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`OpenSky returned HTTP ${response.status}`);
  }

  const data = await response.json() as { states?: Array<Array<unknown>> };
  const aircraft: AircraftData[] = [];

  if (!Array.isArray(data.states)) {
    return aircraft;
  }

  for (const state of data.states) {
    const hex = typeof state[0] === 'string' ? state[0].toLowerCase().trim() : null;
    if (!hex) continue;

    aircraft.push({
      hex,
      callsign: typeof state[1] === 'string' ? state[1].trim() || null : null,
      lat: typeof state[6] === 'number' ? state[6] : null,
      lng: typeof state[5] === 'number' ? state[5] : null,
      altitude: typeof state[7] === 'number' ? state[7] : null,
      speed: typeof state[9] === 'number' ? state[9] : null,
      heading: typeof state[10] === 'number' ? state[10] : null,
      squawk: typeof state[14] === 'string' ? state[14] : null,
      onGround: typeof state[8] === 'boolean' ? state[8] : null,
      originCountry: typeof state[2] === 'string' ? state[2] : null,
      aircraftType: null,
      registration: null,
      source: 'opensky',
    });
  }

  return aircraft;
}

function mergeAircraft(adsbData: AircraftData[], openskyData: AircraftData[]): AircraftData[] {
  const merged = new Map<string, AircraftData>();

  // Add OpenSky first so ADSB.lol can override
  for (const ac of openskyData) {
    merged.set(ac.hex, ac);
  }

  // ADSB.lol takes priority
  for (const ac of adsbData) {
    merged.set(ac.hex, ac);
  }

  return Array.from(merged.values());
}

function aircraftToEvent(ac: AircraftData, roundedTime: string): NewEvent {
  const callsign = ac.callsign;
  const title = callsign ? `${callsign} (${ac.hex})` : `Unknown (${ac.hex})`;

  const altStr = ac.altitude != null ? `${Math.round(ac.altitude)}` : '?';
  const speedStr = ac.speed != null ? `${Math.round(ac.speed)}` : '?';
  const headingStr = ac.heading != null ? `${Math.round(ac.heading)}` : '?';
  const description = `Alt: ${altStr}ft, Speed: ${speedStr}kts, Heading: ${headingStr}\u00B0`;

  const sourceId = `aviation:${ac.hex}:${roundedTime}`;

  return {
    timestamp: new Date(),
    type: 'flight',
    severity: 'info',
    title,
    description,
    locationName: null,
    lat: ac.lat,
    lng: ac.lng,
    source: ac.source,
    sourceId,
    country: ac.originCountry ?? null,
    dedupHash: sha256(sourceId),
    metadata: {
      hex: ac.hex,
      callsign: ac.callsign,
      altitude: ac.altitude,
      speed: ac.speed,
      heading: ac.heading,
      squawk: ac.squawk,
      onGround: ac.onGround,
      originCountry: ac.originCountry,
      aircraftType: ac.aircraftType,
      registration: ac.registration,
    },
  };
}

async function runCycle(): Promise<void> {
  const now = new Date();
  const roundedTime = roundToInterval(now);

  let adsbAircraft: AircraftData[] = [];
  let openskyAircraft: AircraftData[] = [];

  // Fetch ADSB.lol
  try {
    adsbAircraft = await fetchAdsbLol();
    console.log(`[aviation-tracker] ADSB.lol: fetched ${adsbAircraft.length} aircraft`);
  } catch (err) {
    console.error(
      '[aviation-tracker] ADSB.lol error:',
      err instanceof Error ? err.message : err,
    );
  }

  // Fetch OpenSky
  try {
    openskyAircraft = await fetchOpenSky();
    console.log(`[aviation-tracker] OpenSky: fetched ${openskyAircraft.length} aircraft`);
  } catch (err) {
    console.error(
      '[aviation-tracker] OpenSky error:',
      err instanceof Error ? err.message : err,
    );
  }

  const merged = mergeAircraft(adsbAircraft, openskyAircraft);

  let inserted = 0;
  for (const ac of merged) {
    const event = aircraftToEvent(ac, roundedTime);
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

  console.log(
    `[aviation-tracker] cycle complete: adsb=${adsbAircraft.length} opensky=${openskyAircraft.length} merged=${merged.length} inserted=${inserted}`,
  );
}

async function main(): Promise<void> {
  console.log(`[aviation-tracker] starting (interval=${INTERVAL_MS}ms)`);

  while (running) {
    await runCycle();

    if (running) {
      await sleep(INTERVAL_MS);
    }
  }
}

const shutdown = async () => {
  console.log('[aviation-tracker] shutting down...');
  running = false;
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((err) => {
  console.error('[aviation-tracker] fatal error:', err);
  process.exit(1);
});
