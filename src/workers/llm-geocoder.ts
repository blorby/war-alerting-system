import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, isNull, desc, and, inArray } from 'drizzle-orm';
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';
import { events } from '../lib/db/schema';

// --- Database setup ---

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { events } });

// --- AWS Bedrock setup ---

const anthropic = new AnthropicBedrock({
  awsRegion: process.env.AWS_REGION || 'us-east-1',
});
const MODEL = process.env.BEDROCK_MODEL || 'us.anthropic.claude-opus-4-6-v1';

// --- Configuration ---

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 20; // events per batch
const MAX_PER_CYCLE = 40; // max events to geocode per cycle

// Sources that require LLM relevance filtering before being shown on map
const LLM_FILTERED_SOURCES = new Set([
  'telegram-global-moked',
  'telegram-before-red-alert',
  'rotter',
  'ynet-news',
]);

// --- Prompt ---

const SYSTEM_PROMPT = `You are a geographic intelligence analyst specializing in Middle East security events. Given a list of news/social media events, you must:

1. Determine if each event is RELEVANT to security, military, terrorism, missiles, rockets, alerts, war, conflict, or civil defense. General news, sports, weather, politics without security implications, and entertainment are NOT relevant.
2. For relevant events, extract the most specific geographic location (lat/lng coordinates and location name).
3. For relevant events, extract or estimate the actual time of the event described (not the publication time).

Output ONLY a JSON array with one object per event:
[
  {
    "id": "<event id>",
    "relevant": true|false,
    "lat": <number or null>,
    "lng": <number or null>,
    "locationName": "<city/area name or null>",
    "country": "<2-letter ISO code or null>",
    "eventTime": "<ISO 8601 timestamp or null>",
    "severity": "<critical|moderate|info>"
  }
]

Severity guide:
- "critical": active attacks, missile strikes, active alerts, terror attacks, casualties
- "moderate": military movements, escalations, threats, incidents without confirmed casualties
- "info": reports, analysis, diplomatic events, minor incidents

Location rules:
- If you cannot determine any location, set lat/lng/locationName to null
- Be precise: prefer city-level coords over country-level
- For Israeli alerts mentioning Hebrew district names, use the district center
- Common coords: Gaza 31.5/34.47, Tel Aviv 32.08/34.78, Tehran 35.69/51.39, Beirut 33.89/35.50, Damascus 33.51/36.28, Sana'a 15.35/44.21

Output ONLY the JSON array, no markdown fences, no commentary.`;

// --- Functions ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GeoResult {
  id: string;
  relevant?: boolean;
  lat: number | null;
  lng: number | null;
  locationName: string | null;
  country: string | null;
  eventTime?: string | null;
  severity?: string;
}

async function geocodeBatch(
  batch: { id: string; title: string; description: string | null; source: string; timestamp: Date }[],
): Promise<GeoResult[]> {
  const needsFiltering = batch.some((e) => LLM_FILTERED_SOURCES.has(e.source));

  const eventList = batch
    .map(
      (e, i) =>
        `${i + 1}. [id=${e.id}] [source=${e.source}] [published=${e.timestamp.toISOString()}] ${e.title}${e.description ? ' — ' + e.description.slice(0, 200) : ''}`,
    )
    .join('\n');

  const userContent = needsFiltering
    ? `Analyze these ${batch.length} events for relevance, location, and event time:\n\n${eventList}`
    : `Geocode these ${batch.length} events:\n\n${eventList}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    console.error('[llm-geocoder] no text block in response');
    return [];
  }

  try {
    // Strip markdown code fences that the LLM occasionally wraps around JSON
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    const results = JSON.parse(jsonText) as GeoResult[];
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
      timestamp: events.timestamp,
      locationName: events.locationName,
    })
    .from(events)
    .where(and(isNull(events.lat), isNull(events.lng), eq(events.isActive, true)))
    .orderBy(desc(events.timestamp))
    .limit(MAX_PER_CYCLE);

  if (ungeocodedEvents.length === 0) {
    console.log('[llm-geocoder] no ungeolocated events found');
    return;
  }

  console.log(`[llm-geocoder] found ${ungeocodedEvents.length} events to geocode`);

  let totalUpdated = 0;
  let totalFiltered = 0;

  // Process in batches
  for (let i = 0; i < ungeocodedEvents.length; i += BATCH_SIZE) {
    const batch = ungeocodedEvents.slice(i, i + BATCH_SIZE);
    const results = await geocodeBatch(batch);

    const idsToDeactivate: string[] = [];

    for (const result of results) {
      const isFiltered = LLM_FILTERED_SOURCES.has(
        batch.find((b) => b.id === result.id)?.source ?? '',
      );

      // If this is a filtered source and LLM says not relevant, deactivate
      if (isFiltered && result.relevant === false) {
        idsToDeactivate.push(result.id);
        totalFiltered++;
        continue;
      }

      if (!result.lat || !result.lng) continue;

      try {
        // Only set locationName if the event didn't already have one
        // (preserves original Hebrew names from OREF which are needed for polygon matching)
        const originalEvent = batch.find((b) => b.id === result.id);
        const updateData: Record<string, unknown> = {
          lat: result.lat,
          lng: result.lng,
          country: result.country,
        };
        if (!originalEvent?.locationName && result.locationName) {
          updateData.locationName = result.locationName;
        }

        // Update severity if LLM provided one
        if (result.severity) {
          updateData.severity = result.severity;
        }

        // Update timestamp if LLM extracted a more accurate event time
        if (result.eventTime) {
          const eventDate = new Date(result.eventTime);
          if (!isNaN(eventDate.getTime())) {
            updateData.timestamp = eventDate;
          }
        }

        await db
          .update(events)
          .set(updateData)
          .where(eq(events.id, result.id));
        totalUpdated++;
      } catch (err) {
        console.warn(
          `[llm-geocoder] failed to update event ${result.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    // Batch deactivate irrelevant events
    if (idsToDeactivate.length > 0) {
      await db
        .update(events)
        .set({ isActive: false })
        .where(inArray(events.id, idsToDeactivate));
    }

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < ungeocodedEvents.length) {
      await sleep(2000);
    }
  }

  console.log(
    `[llm-geocoder] cycle complete: processed=${ungeocodedEvents.length} updated=${totalUpdated} filtered_irrelevant=${totalFiltered}`,
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
