import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, isNull, desc, and } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { events } from '../lib/db/schema';

// --- Database setup ---

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { events } });

// --- Anthropic setup ---

const anthropic = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

// --- Configuration ---

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 20; // events per batch
const MAX_PER_CYCLE = 40; // max events to geocode per cycle

// --- Prompt ---

const SYSTEM_PROMPT = `You are a geographic intelligence analyst. Given a list of news events about the Middle East/Israel conflict, determine the most specific geographic location for each event.

For each event, output the best lat/lng coordinates and a location name. Focus on:
- City or district names mentioned in the title/description
- Known military bases, borders, or landmarks
- Country-level coordinates as a last resort

Output ONLY a JSON array with one object per event:
[
  {
    "id": "<event id>",
    "lat": <number or null>,
    "lng": <number or null>,
    "locationName": "<city/area name or null>",
    "country": "<2-letter ISO code or null>"
  }
]

Rules:
- If you cannot determine any location, set lat/lng/locationName to null
- Be precise: prefer city-level coords over country-level
- For Israeli alerts mentioning Hebrew district names, use the district center
- For "Gaza" use 31.5, 34.47; "Tel Aviv" 32.08, 34.78; "Tehran" 35.69, 51.39
- Output ONLY the JSON array, no markdown fences, no commentary`;

// --- Functions ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GeoResult {
  id: string;
  lat: number | null;
  lng: number | null;
  locationName: string | null;
  country: string | null;
}

async function geocodeBatch(
  batch: { id: string; title: string; description: string | null; source: string }[],
): Promise<GeoResult[]> {
  const eventList = batch
    .map(
      (e, i) =>
        `${i + 1}. [id=${e.id}] [source=${e.source}] ${e.title}${e.description ? ' — ' + e.description.slice(0, 200) : ''}`,
    )
    .join('\n');

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Geocode these ${batch.length} events:\n\n${eventList}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    console.error('[llm-geocoder] no text block in response');
    return [];
  }

  try {
    const results = JSON.parse(textBlock.text.trim()) as GeoResult[];
    return results;
  } catch (err) {
    console.error(
      '[llm-geocoder] failed to parse JSON:',
      textBlock.text.slice(0, 200),
    );
    return [];
  }
}

async function runCycle(): Promise<void> {
  // Find events with no lat/lng from recent ingestion
  const ungeocodedEvents = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      source: events.source,
    })
    .from(events)
    .where(and(isNull(events.lat), isNull(events.lng)))
    .orderBy(desc(events.timestamp))
    .limit(MAX_PER_CYCLE);

  if (ungeocodedEvents.length === 0) {
    console.log('[llm-geocoder] no ungeolocated events found');
    return;
  }

  console.log(`[llm-geocoder] found ${ungeocodedEvents.length} events to geocode`);

  let totalUpdated = 0;

  // Process in batches
  for (let i = 0; i < ungeocodedEvents.length; i += BATCH_SIZE) {
    const batch = ungeocodedEvents.slice(i, i + BATCH_SIZE);
    const results = await geocodeBatch(batch);

    for (const result of results) {
      if (!result.lat || !result.lng) continue;

      try {
        await db
          .update(events)
          .set({
            lat: result.lat,
            lng: result.lng,
            locationName: result.locationName,
            country: result.country,
          })
          .where(eq(events.id, result.id));
        totalUpdated++;
      } catch (err) {
        console.warn(
          `[llm-geocoder] failed to update event ${result.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < ungeocodedEvents.length) {
      await sleep(2000);
    }
  }

  console.log(
    `[llm-geocoder] cycle complete: processed=${ungeocodedEvents.length} updated=${totalUpdated}`,
  );
}

// --- Main loop ---

let running = true;

const shutdown = async () => {
  console.log('[llm-geocoder] shutting down...');
  running = false;
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function main(): Promise<void> {
  console.log(`[llm-geocoder] starting (interval=${INTERVAL_MS}ms, model=${MODEL}, batch=${BATCH_SIZE})`);

  while (running) {
    try {
      await runCycle();
    } catch (err) {
      console.error('[llm-geocoder] error:', err instanceof Error ? err.message : err);
    }

    if (running) {
      await sleep(INTERVAL_MS);
    }
  }
}

main().catch((err) => {
  console.error('[llm-geocoder] fatal error:', err);
  process.exit(1);
});
