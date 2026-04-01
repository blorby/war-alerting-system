import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { events } from '../../lib/db/schema';

export interface NewEvent {
  timestamp: Date;
  type: string;
  severity: string;
  title: string;
  description: string | null;
  locationName: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  sourceId: string | null;
  metadata: Record<string, unknown>;
  country: string | null;
  dedupHash: string;
}

export interface CollectorConfig {
  name: string;
  intervalMs: number;
  timeoutMs?: number;
  collect: () => Promise<NewEvent[]>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runCollector(config: CollectorConfig): Promise<void> {
  const { name, intervalMs, timeoutMs = 30_000, collect } = config;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema: { events } });

  let running = true;

  const shutdown = async () => {
    console.log(`[${name}] shutting down...`);
    running = false;
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log(`[${name}] starting (interval=${intervalMs}ms, timeout=${timeoutMs}ms)`);

  while (running) {
    try {
      // Run collect with a timeout
      const collected = await Promise.race([
        collect(),
        sleep(timeoutMs).then(() => {
          throw new Error(`[${name}] collect timed out after ${timeoutMs}ms`);
        }),
      ]);

      let inserted = 0;
      for (const event of collected) {
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

      console.log(`[${name}] collected=${collected.length} inserted=${inserted}`);
    } catch (err) {
      console.error(`[${name}] error:`, err instanceof Error ? err.message : err);
    }

    if (running) {
      await sleep(intervalMs);
    }
  }
}
