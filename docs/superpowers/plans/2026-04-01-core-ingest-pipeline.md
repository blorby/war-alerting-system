# Core Ingest Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full data pipeline from Oref alert endpoints through Postgres to a live dashboard, with AI-powered threat assessment.

**Architecture:** Separate-process-per-collector workers (Docker containers), Next.js 16 API route handlers, Zustand-powered frontend wiring, Anthropic-powered threat analysis cron. All workers share a Postgres database via Drizzle ORM.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, PostgreSQL, Zustand, node-cron, @anthropic-ai/sdk, maplibre-gl, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-04-01-core-ingest-pipeline-design.md`

**IMPORTANT:** Before writing ANY Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. The installed Next.js 16 may differ from training data.

---

## Execution Structure

7 tasks across 2 waves. Wave 1 tasks have no dependencies and run in parallel. Wave 2 tasks depend on Wave 1 and run in parallel with each other.

```
Wave 1 (parallel):  Task 1 (Agent A), Task 2 (Agent B), Task 3 (Agent C)
Wave 2 (parallel):  Task 4 (Agent D), Task 5 (Agent E), Task 6 (Agent F), Task 7 (Agent G)
```

---

## File Structure

```
src/workers/
  lib/
    base-collector.ts        — shared collector loop + DB insert
    normalize.ts             — title/category mappings, timezone parsing, sha256
    dedup.ts                 — dedup hash functions per source
  oref-current.ts            — 30s poll of alerts.json
  oref-history.ts            — 5min poll of AlertsHistory.json
  ai-assessment.ts           — 10min AI threat assessment

src/app/api/
  events/route.ts            — GET paginated events
  events/stream/route.ts     — SSE real-time stream
  threat/route.ts            — GET latest threat assessment
  ticker/route.ts            — GET ticker items
  status/route.ts            — GET health check

src/lib/
  store.ts                   — Zustand store
  geo/
    districts.json           — generated city->coords lookup

scripts/
  generate-districts.ts      — one-time geocoding script

tsconfig.worker.json         — worker TypeScript config
vitest.config.ts             — test config
```

---

## Task 1: Base Collector Infrastructure (Agent A — Wave 1)

**Files:**
- Create: `src/workers/lib/normalize.ts`
- Create: `src/workers/lib/dedup.ts`
- Create: `src/workers/lib/base-collector.ts`
- Create: `src/workers/lib/normalize.test.ts`
- Create: `src/workers/lib/dedup.test.ts`

**Context:** These are shared utilities that all collectors import. Workers use relative imports (not `@/` aliases) since they compile with a separate tsconfig targeting Node.js. Read the existing schema at `src/lib/db/schema.ts` and types at `src/types/event.ts` before starting.

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

Add test script to `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 3: Create `src/workers/lib/normalize.ts`**

```typescript
import { createHash } from 'crypto';

// --- SHA-256 utility ---

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

// --- Oref title -> type/severity mapping ---

const TITLE_MAP: Record<string, { type: string; severity: string }> = {
  'ירי רקטות וטילים': { type: 'alert', severity: 'critical' },
  'חדירת כלי טיס עוין': { type: 'alert', severity: 'critical' },
  'חדירת מחבלים': { type: 'alert', severity: 'critical' },
  'רעידת אדמה': { type: 'seismic', severity: 'moderate' },
  'צונאמי': { type: 'alert', severity: 'critical' },
  'חומרים מסוכנים': { type: 'alert', severity: 'moderate' },
  'האירוע הסתיים': { type: 'alert', severity: 'cleared' },
};

export function mapTitle(title: string): { type: string; severity: string } {
  return TITLE_MAP[title] ?? { type: 'alert', severity: 'moderate' };
}

// --- Oref category number -> type/severity mapping ---

const CATEGORY_MAP: Record<number, { type: string; severity: string }> = {
  1: { type: 'alert', severity: 'critical' },
  2: { type: 'seismic', severity: 'moderate' },
  3: { type: 'alert', severity: 'critical' },
  13: { type: 'alert', severity: 'cleared' },
};

export function mapCategory(category: number): { type: string; severity: string } {
  return CATEGORY_MAP[category] ?? { type: 'alert', severity: 'moderate' };
}

// --- Timezone parsing ---

/**
 * Parse "YYYY-MM-DD HH:MM:SS" as Asia/Jerusalem local time -> UTC Date.
 * Handles DST transitions correctly via Intl API.
 */
export function parseAsJerusalem(dateStr: string): Date {
  const [datePart, timePart] = dateStr.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min, s] = timePart.split(':').map(Number);

  // Build a UTC timestamp from the same numeric components
  const utcGuess = Date.UTC(y, m - 1, d, h, min, s);

  // Determine what that UTC timestamp looks like in Jerusalem
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(utcGuess));
  const get = (type: string) => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Missing Intl part: ${type}`);
    return parseInt(part.value);
  };
  const jerusalemOfUtc = Date.UTC(
    get('year'), get('month') - 1, get('day'),
    get('hour'), get('minute'), get('second'),
  );

  // offset = how Jerusalem differs from UTC at this point
  const offsetMs = jerusalemOfUtc - utcGuess;
  // The input IS Jerusalem local time, so UTC = components - offset
  return new Date(utcGuess - offsetMs);
}
```

- [ ] **Step 4: Create `src/workers/lib/normalize.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { sha256, mapTitle, mapCategory, parseAsJerusalem } from './normalize';

describe('sha256', () => {
  it('produces consistent hex hash', () => {
    const h = sha256('test-input');
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256('test-input')).toBe(h);
  });

  it('produces different hashes for different inputs', () => {
    expect(sha256('a')).not.toBe(sha256('b'));
  });
});

describe('mapTitle', () => {
  it('maps rockets to critical alert', () => {
    expect(mapTitle('ירי רקטות וטילים')).toEqual({ type: 'alert', severity: 'critical' });
  });

  it('maps event ended to cleared', () => {
    expect(mapTitle('האירוע הסתיים')).toEqual({ type: 'alert', severity: 'cleared' });
  });

  it('maps earthquake to seismic moderate', () => {
    expect(mapTitle('רעידת אדמה')).toEqual({ type: 'seismic', severity: 'moderate' });
  });

  it('defaults unknown titles to alert moderate', () => {
    expect(mapTitle('unknown title')).toEqual({ type: 'alert', severity: 'moderate' });
  });
});

describe('mapCategory', () => {
  it('maps category 1 to critical alert', () => {
    expect(mapCategory(1)).toEqual({ type: 'alert', severity: 'critical' });
  });

  it('maps category 13 to cleared', () => {
    expect(mapCategory(13)).toEqual({ type: 'alert', severity: 'cleared' });
  });

  it('defaults unknown categories to alert moderate', () => {
    expect(mapCategory(999)).toEqual({ type: 'alert', severity: 'moderate' });
  });
});

describe('parseAsJerusalem', () => {
  it('parses Jerusalem time to UTC Date', () => {
    // Israel summer time (IDT) is UTC+3
    // "2026-04-01 12:00:00" Jerusalem = "2026-04-01 09:00:00" UTC
    const result = parseAsJerusalem('2026-04-01 12:00:00');
    expect(result.getUTCHours()).toBe(9);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it('returns a valid Date', () => {
    const result = parseAsJerusalem('2026-01-15 08:30:45');
    expect(result).toBeInstanceOf(Date);
    expect(isNaN(result.getTime())).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/workers/lib/normalize.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Create `src/workers/lib/dedup.ts`**

```typescript
import { sha256 } from './normalize';

/**
 * Dedup hash for Oref current alerts.
 * Rounds fetch time to the nearest minute so 30s polling
 * doesn't create duplicates for the same persisting alert.
 */
export function orefCurrentHash(title: string, city: string, fetchTime: Date): string {
  const rounded = new Date(fetchTime);
  rounded.setSeconds(0, 0);
  return sha256(`oref:${title}:${city}:${rounded.toISOString()}`);
}

/**
 * Dedup hash for Oref history records.
 * History records are immutable — exact match on alertDate + city.
 */
export function orefHistoryHash(alertDate: string, data: string): string {
  return sha256(`oref-hist:${alertDate}:${data}`);
}
```

- [ ] **Step 7: Create `src/workers/lib/dedup.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { orefCurrentHash, orefHistoryHash } from './dedup';

describe('orefCurrentHash', () => {
  it('produces a 64-char hex string', () => {
    const hash = orefCurrentHash('ירי רקטות וטילים', 'תל אביב', new Date('2026-04-01T12:00:30Z'));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rounds to minute — same hash within the same minute', () => {
    const t1 = new Date('2026-04-01T12:00:05Z');
    const t2 = new Date('2026-04-01T12:00:45Z');
    expect(orefCurrentHash('test', 'city', t1)).toBe(orefCurrentHash('test', 'city', t2));
  });

  it('different hash for different minutes', () => {
    const t1 = new Date('2026-04-01T12:00:30Z');
    const t2 = new Date('2026-04-01T12:01:30Z');
    expect(orefCurrentHash('test', 'city', t1)).not.toBe(orefCurrentHash('test', 'city', t2));
  });

  it('different hash for different cities', () => {
    const t = new Date('2026-04-01T12:00:00Z');
    expect(orefCurrentHash('test', 'city-a', t)).not.toBe(orefCurrentHash('test', 'city-b', t));
  });
});

describe('orefHistoryHash', () => {
  it('produces consistent hash for same inputs', () => {
    const h1 = orefHistoryHash('2026-04-01 11:09:50', 'יראון');
    const h2 = orefHistoryHash('2026-04-01 11:09:50', 'יראון');
    expect(h1).toBe(h2);
  });

  it('different hash for different alertDate', () => {
    const h1 = orefHistoryHash('2026-04-01 11:09:50', 'יראון');
    const h2 = orefHistoryHash('2026-04-01 11:10:50', 'יראון');
    expect(h1).not.toBe(h2);
  });
});
```

- [ ] **Step 8: Run dedup tests**

```bash
npx vitest run src/workers/lib/dedup.test.ts
```

Expected: All tests PASS.

- [ ] **Step 9: Create `src/workers/lib/base-collector.ts`**

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
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

function log(name: string, msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${name}] ${msg}`);
}

export async function runCollector(config: CollectorConfig): Promise<void> {
  const { name, intervalMs, timeoutMs = 15_000 } = config;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  log(name, `Starting (interval: ${intervalMs}ms, timeout: ${timeoutMs}ms)`);

  let running = true;
  const shutdown = () => {
    log(name, 'Shutting down...');
    running = false;
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  while (running) {
    const start = Date.now();
    try {
      const collected = await Promise.race([
        config.collect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeoutMs),
        ),
      ]);

      let inserted = 0;
      for (const event of collected) {
        try {
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
            .onConflictDoNothing();
          inserted++;
        } catch (err) {
          log(name, `Insert error: ${err}`);
        }
      }

      log(name, `Cycle: ${collected.length} fetched, ${inserted} processed (${Date.now() - start}ms)`);
    } catch (err) {
      log(name, `Cycle error: ${err}`);
    }

    if (running) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  await pool.end();
  log(name, 'Stopped.');
  process.exit(0);
}
```

- [ ] **Step 10: Run all tests**

```bash
npx vitest run src/workers/lib/
```

Expected: All tests PASS.

- [ ] **Step 11: Commit**

```bash
git add src/workers/lib/ vitest.config.ts package.json package-lock.json
git commit -m "feat: add base collector infrastructure with normalize, dedup, and collector loop"
```

---

## Task 2: Next.js API Routes (Agent B — Wave 1)

**Files:**
- Create: `src/app/api/events/route.ts`
- Create: `src/app/api/events/stream/route.ts`
- Create: `src/app/api/threat/route.ts`
- Create: `src/app/api/ticker/route.ts`
- Create: `src/app/api/status/route.ts`

**Context:** Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` before writing any route. Read the existing DB schema at `src/lib/db/schema.ts`. All routes query Postgres via the existing `src/lib/db` module and Drizzle ORM. All routes return JSON. No authentication.

- [ ] **Step 1: Create `src/app/api/events/route.ts`**

```typescript
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc, eq, and, gte, sql, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const severity = url.searchParams.get('severity');
    const type = url.searchParams.get('type');
    const active = url.searchParams.get('active');

    const conditions = [];
    if (severity) conditions.push(eq(events.severity, severity));
    if (type) conditions.push(eq(events.type, type));
    if (active === 'true') conditions.push(eq(events.isActive, true));
    if (active === 'false') conditions.push(eq(events.isActive, false));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(events)
        .where(where)
        .orderBy(desc(events.timestamp))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(events)
        .where(where),
    ]);

    return Response.json({
      events: rows,
      total: Number(totalResult[0].count),
    });
  } catch (err) {
    console.error('GET /api/events error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `src/app/api/events/stream/route.ts`**

```typescript
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc, gt } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let lastCheck = new Date();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial keepalive
      controller.enqueue(encoder.encode(': keepalive\n\n'));

      const interval = setInterval(async () => {
        try {
          const newEvents = await db
            .select()
            .from(events)
            .where(gt(events.ingestedAt, lastCheck))
            .orderBy(desc(events.timestamp))
            .limit(50);

          if (newEvents.length > 0) {
            lastCheck = new Date();
            const data = JSON.stringify({ events: newEvents });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        } catch (err) {
          console.error('SSE poll error:', err);
        }
      }, 5000);

      // Cleanup when client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
```

- [ ] **Step 3: Create `src/app/api/threat/route.ts`**

```typescript
import { db } from '@/lib/db';
import { threatAssessments, countryThreats } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const latest = await db
      .select()
      .from(threatAssessments)
      .orderBy(desc(threatAssessments.createdAt))
      .limit(1);

    if (latest.length === 0) {
      return Response.json({ assessment: null });
    }

    const assessment = latest[0];
    const countries = await db
      .select()
      .from(countryThreats)
      .where(eq(countryThreats.assessmentId, assessment.id));

    return Response.json({
      assessment: {
        ...assessment,
        overallScore: parseFloat(assessment.overallScore),
        countries: countries.map((c) => ({
          ...c,
          score: parseFloat(c.score),
        })),
      },
    });
  } catch (err) {
    console.error('GET /api/threat error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create `src/app/api/ticker/route.ts`**

```typescript
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(events)
      .orderBy(desc(events.timestamp))
      .limit(20);

    const items = rows.map((e) => ({
      id: e.id,
      text: `${e.title}${e.locationName ? ` — ${e.locationName}` : ''}`,
      type: e.type === 'alert' ? 'alert' as const
        : e.type === 'seismic' ? 'thermal' as const
        : 'news' as const,
      timestamp: e.timestamp,
    }));

    return Response.json({ items });
  } catch (err) {
    console.error('GET /api/ticker error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create `src/app/api/status/route.ts`**

```typescript
import { db } from '@/lib/db';
import { events, threatAssessments } from '@/lib/db/schema';
import { desc, gte, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [lastEventResult, lastAssessmentResult, countResult] = await Promise.all([
      db.select().from(events).orderBy(desc(events.timestamp)).limit(1),
      db.select().from(threatAssessments).orderBy(desc(threatAssessments.createdAt)).limit(1),
      db.select({ count: count() }).from(events).where(gte(events.timestamp, oneDayAgo)),
    ]);

    return Response.json({
      db: 'ok',
      lastEvent: lastEventResult[0]?.timestamp ?? null,
      lastAssessment: lastAssessmentResult[0]?.createdAt ?? null,
      eventCount24h: Number(countResult[0].count),
    });
  } catch (err) {
    console.error('GET /api/status error:', err);
    return Response.json({ error: 'Internal server error', db: 'error' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Verify build compiles**

```bash
npx next build
```

Expected: Build succeeds with no type errors in API routes.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/
git commit -m "feat: add API routes for events, SSE stream, threat, ticker, and status"
```

---

## Task 3: Docker, Config & Geocoding (Agent C — Wave 1)

**Files:**
- Create: `tsconfig.worker.json`
- Modify: `Dockerfile.worker`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Create: `scripts/generate-districts.ts`
- Create: `src/lib/geo/districts.json`

**Context:** Read the existing `docker-compose.yml`, `Dockerfile.worker`, and `.env.example`. The worker TypeScript compilation uses `tsc` with a separate config. Workers use relative imports (not `@/`) to avoid path alias issues with tsc output.

- [ ] **Step 1: Create `tsconfig.worker.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": [
    "src/workers/**/*",
    "src/lib/**/*",
    "src/types/**/*"
  ],
  "exclude": [
    "src/app/**/*",
    "src/components/**/*",
    "**/*.test.ts"
  ]
}
```

- [ ] **Step 2: Verify worker tsconfig compiles the existing lib files**

```bash
npx tsc --project tsconfig.worker.json --noEmit
```

Expected: No errors (there are no worker files yet, but `src/lib/` should compile).

- [ ] **Step 3: Update `Dockerfile.worker`**

Replace the entire file:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY tsconfig.worker.json ./
COPY src/ ./src/
RUN npx tsc --project tsconfig.worker.json
# CMD is overridden per-service in docker-compose.yml
CMD ["node", "dist/workers/oref-current.js"]
```

- [ ] **Step 4: Update `docker-compose.yml`**

Replace the existing `worker` and `ai-cron` services with the three new services. Keep `postgres` and `nextjs` unchanged.

Remove the `worker` service block and replace `ai-cron`. The full services section should be:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: was
      POSTGRES_USER: was
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-was_dev_password}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U was"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  nextjs:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://was:${POSTGRES_PASSWORD:-was_dev_password}@postgres:5432/was
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  worker-oref-current:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: ["node", "dist/workers/oref-current.js"]
    environment:
      - DATABASE_URL=postgresql://was:${POSTGRES_PASSWORD:-was_dev_password}@postgres:5432/was
      - OREF_BASE_URL=${OREF_BASE_URL:-https://www.oref.org.il}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  worker-oref-history:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: ["node", "dist/workers/oref-history.js"]
    environment:
      - DATABASE_URL=postgresql://was:${POSTGRES_PASSWORD:-was_dev_password}@postgres:5432/was
      - OREF_BASE_URL=${OREF_BASE_URL:-https://www.oref.org.il}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  ai-cron:
    build:
      context: .
      dockerfile: Dockerfile.worker
    command: ["node", "dist/workers/ai-assessment.js"]
    environment:
      - DATABASE_URL=postgresql://was:${POSTGRES_PASSWORD:-was_dev_password}@postgres:5432/was
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
```

- [ ] **Step 5: Update `.env.example`**

Add the new variables:

```
# Database
DATABASE_URL=postgresql://was:was_dev_password@localhost:5432/was
POSTGRES_PASSWORD=was_dev_password

# Oref API (default: direct to oref.org.il; set to proxy URL if not on Israeli IP)
OREF_BASE_URL=https://www.oref.org.il

# Telegram MTProto credentials
TELEGRAM_APP_ID=
TELEGRAM_APP_HASH=
TELEGRAM_SESSION=

# API Keys
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6-20250514

# Map
NEXT_PUBLIC_MAP_STYLE=https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json

# App
NEXT_PUBLIC_APP_NAME=War Alerting System
```

- [ ] **Step 6: Create `scripts/generate-districts.ts`**

This is a one-time script that fetches Oref district names and geocodes them via Nominatim. Run it with `npx tsx scripts/generate-districts.ts`.

```typescript
/**
 * One-time script: fetch Oref districts and geocode city names.
 * Usage: npx tsx scripts/generate-districts.ts
 *
 * Queries OpenStreetMap Nominatim (max 1 req/s as per usage policy).
 * Output: src/lib/geo/districts.json
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const DISTRICTS_URL =
  'https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OUTPUT_PATH = join(__dirname, '../src/lib/geo/districts.json');

interface OrefDistrict {
  label: string;
  label_he: string;
  id: string;
  areaid: number;
  areaname: string;
  migun_time: number;
}

interface GeoEntry {
  lat: number;
  lng: number;
  areaname: string;
  migun_time: number;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocode(name: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    q: `${name}, Israel`,
    format: 'json',
    limit: '1',
    'accept-language': 'he',
  });

  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': 'war-alerting-system/1.0 (geocoding script)' },
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (data.length === 0) return null;

  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function main() {
  console.log('Fetching districts from Oref...');
  const res = await fetch(DISTRICTS_URL);
  const districts: OrefDistrict[] = await res.json();
  console.log(`Got ${districts.length} districts.`);

  // First pass: geocode unique area names (fast, ~50-100 lookups)
  const areaNames = [...new Set(districts.map((d) => d.areaname))];
  console.log(`Geocoding ${areaNames.length} unique area names...`);
  const areaCoords: Record<string, { lat: number; lng: number }> = {};

  for (const area of areaNames) {
    const coords = await geocode(area);
    if (coords) areaCoords[area] = coords;
    console.log(`  ${area}: ${coords ? `${coords.lat}, ${coords.lng}` : 'NOT FOUND'}`);
    await sleep(1100); // Nominatim rate limit
  }

  // Second pass: build per-city lookup, using area coords as fallback
  console.log('Building per-city lookup...');
  const result: Record<string, GeoEntry> = {};
  let found = 0;
  let fallback = 0;
  let missing = 0;

  for (const d of districts) {
    const name = d.label_he;
    if (result[name]) continue; // Already have this city

    const areaFallback = areaCoords[d.areaname];
    if (areaFallback) {
      result[name] = {
        lat: areaFallback.lat,
        lng: areaFallback.lng,
        areaname: d.areaname,
        migun_time: d.migun_time,
      };
      fallback++;
    } else {
      // No area coords — will be null in lookups
      missing++;
    }
  }

  console.log(`Done: ${Object.keys(result).length} cities mapped (${fallback} via area, ${missing} missing).`);

  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

- [ ] **Step 7: Install tsx and run the geocoding script**

```bash
npm install -D tsx
npx tsx scripts/generate-districts.ts
```

Expected: Script fetches districts, geocodes area names (takes a few minutes), writes `src/lib/geo/districts.json`. Verify the file exists and has entries.

- [ ] **Step 8: Verify districts.json was created**

```bash
wc -l src/lib/geo/districts.json
head -20 src/lib/geo/districts.json
```

Expected: A JSON file with hundreds of entries.

- [ ] **Step 9: Commit**

```bash
git add tsconfig.worker.json Dockerfile.worker docker-compose.yml .env.example scripts/generate-districts.ts src/lib/geo/districts.json package.json package-lock.json
git commit -m "feat: add worker build config, docker services, and geocoded districts"
```

---

## Task 4: Oref Current Alerts Collector (Agent D — Wave 2)

**Files:**
- Create: `src/workers/oref-current.ts`

**Context:** Depends on Task 1 (base-collector, normalize, dedup). Read `src/workers/lib/base-collector.ts` for the `runCollector` API and `NewEvent` interface. Read `src/workers/lib/normalize.ts` and `src/workers/lib/dedup.ts` for available functions.

The Oref current alerts endpoint returns:
- Empty body when no active alerts
- A single JSON object `{ title, data: string[], desc }` when one alert type is active
- Possibly an array of such objects when multiple alert types are active
- Requires headers: `Referer: https://www.oref.org.il/`, `X-Requested-With: XMLHttpRequest`
- May return UTF-8 BOM that must be stripped

`data` is an ARRAY of city names — fan out to one event per city.

- [ ] **Step 1: Create `src/workers/oref-current.ts`**

```typescript
import { runCollector, NewEvent } from './lib/base-collector';
import { mapTitle } from './lib/normalize';
import { orefCurrentHash } from './lib/dedup';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load geocoding data
let districts: Record<string, { lat: number; lng: number }> = {};
try {
  const raw = readFileSync(join(__dirname, '../lib/geo/districts.json'), 'utf-8');
  districts = JSON.parse(raw);
} catch {
  console.warn('[oref-current] districts.json not found, coordinates will be null');
}

const BASE_URL = process.env.OREF_BASE_URL || 'https://www.oref.org.il';
const ALERTS_PATH = '/WarningMessages/alert/alerts.json';
const INTERVAL_MS = 30_000; // 30 seconds

interface OrefCurrentAlert {
  title: string;
  data: string[];
  desc?: string;
}

async function fetchAlerts(): Promise<OrefCurrentAlert[]> {
  const res = await fetch(`${BASE_URL}${ALERTS_PATH}`, {
    headers: {
      Referer: 'https://www.oref.org.il/',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`Oref returned ${res.status}`);
  }

  let text = await res.text();
  // Strip UTF-8 BOM
  text = text.replace(/^\uFEFF/, '').trim();

  if (!text) return [];

  const parsed = JSON.parse(text);
  // Normalize: could be a single object or an array
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function collect(): Promise<NewEvent[]> {
  const alerts = await fetchAlerts();
  const now = new Date();
  const events: NewEvent[] = [];

  for (const alert of alerts) {
    if (!alert.data || !alert.title) continue;

    const cities = Array.isArray(alert.data) ? alert.data : [alert.data];
    const { type, severity } = mapTitle(alert.title);

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
  intervalMs: INTERVAL_MS,
  collect,
});
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --project tsconfig.worker.json --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/workers/oref-current.ts
git commit -m "feat: add Oref current alerts collector (30s poll)"
```

---

## Task 5: Oref History Collector (Agent E — Wave 2)

**Files:**
- Create: `src/workers/oref-history.ts`

**Context:** Depends on Task 1. The Oref history endpoint returns an array of objects: `{ alertDate: string, title: string, data: string, category: number }`. `data` is a STRING (one city per record) — no fan-out needed. Category 13 = "event ended" — when seen, set matching prior events to `is_active = false`.

- [ ] **Step 1: Create `src/workers/oref-history.ts`**

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { runCollector, NewEvent } from './lib/base-collector';
import { mapCategory, parseAsJerusalem } from './lib/normalize';
import { orefHistoryHash } from './lib/dedup';
import { events } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load geocoding data
let districts: Record<string, { lat: number; lng: number }> = {};
try {
  const raw = readFileSync(join(__dirname, '../lib/geo/districts.json'), 'utf-8');
  districts = JSON.parse(raw);
} catch {
  console.warn('[oref-history] districts.json not found, coordinates will be null');
}

const BASE_URL = process.env.OREF_BASE_URL || 'https://www.oref.org.il';
const HISTORY_PATH = '/WarningMessages/alert/History/AlertsHistory.json';
const INTERVAL_MS = 5 * 60_000; // 5 minutes

// Separate pool for the clearance update queries
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

interface OrefHistoryRecord {
  alertDate: string;
  title: string;
  data: string;
  category: number;
}

async function fetchHistory(): Promise<OrefHistoryRecord[]> {
  const res = await fetch(`${BASE_URL}${HISTORY_PATH}`, {
    headers: {
      Referer: 'https://www.oref.org.il/',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`Oref history returned ${res.status}`);
  }

  let text = await res.text();
  text = text.replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  return JSON.parse(text);
}

async function collect(): Promise<NewEvent[]> {
  const records = await fetchHistory();
  const newEvents: NewEvent[] = [];

  for (const record of records) {
    if (!record.data || !record.alertDate) continue;

    const { type, severity } = mapCategory(record.category);
    const timestamp = parseAsJerusalem(record.alertDate);
    const geo = districts[record.data];

    // If this is a clearance (category 13), mark matching events as inactive
    if (record.category === 13) {
      try {
        await db
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
        console.error('[oref-history] Clearance update error:', err);
      }
    }

    newEvents.push({
      timestamp,
      type,
      severity,
      title: record.title,
      description: null,
      locationName: record.data,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      source: 'oref-history',
      sourceId: `oref-hist:${record.alertDate}:${record.data}`,
      metadata: { category: record.category },
      country: 'IL',
      dedupHash: orefHistoryHash(record.alertDate, record.data),
    });
  }

  return newEvents;
}

runCollector({
  name: 'oref-history',
  intervalMs: INTERVAL_MS,
  collect,
});
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --project tsconfig.worker.json --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/workers/oref-history.ts
git commit -m "feat: add Oref history collector with clearance handling (5min poll)"
```

---

## Task 6: AI Threat Assessment Worker (Agent F — Wave 2)

**Files:**
- Create: `src/workers/ai-assessment.ts`

**Context:** Depends on Task 1 (base-collector pattern). Uses `@anthropic-ai/sdk` (already in package.json). Reads events from the last 24h, summarizes them into a digest, sends to Claude for structured threat assessment, writes results to `threat_assessments` and `country_threats` tables. Read `src/lib/db/schema.ts` for the table shapes.

- [ ] **Step 1: Create `src/workers/ai-assessment.ts`**

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import { events, threatAssessments, countryThreats } from '../lib/db/schema';
import { gte, desc, sql, count, eq } from 'drizzle-orm';

const INTERVAL_MS = 10 * 60_000; // 10 minutes
const EVENT_WINDOW_MS = 24 * 60 * 60_000; // 24 hours
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6-20250514';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
const anthropic = new Anthropic();

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] [ai-assessment] ${msg}`);
}

interface EventDigest {
  totalEvents: number;
  activeEvents: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byLocation: Record<string, number>;
  recentAlerts: Array<{ title: string; location: string; time: string; severity: string }>;
}

async function buildDigest(): Promise<EventDigest> {
  const cutoff = new Date(Date.now() - EVENT_WINDOW_MS);

  const allEvents = await db
    .select()
    .from(events)
    .where(gte(events.timestamp, cutoff))
    .orderBy(desc(events.timestamp));

  const digest: EventDigest = {
    totalEvents: allEvents.length,
    activeEvents: allEvents.filter((e) => e.isActive).length,
    byType: {},
    bySeverity: {},
    byLocation: {},
    recentAlerts: [],
  };

  for (const e of allEvents) {
    digest.byType[e.type] = (digest.byType[e.type] || 0) + 1;
    digest.bySeverity[e.severity] = (digest.bySeverity[e.severity] || 0) + 1;
    if (e.locationName) {
      digest.byLocation[e.locationName] = (digest.byLocation[e.locationName] || 0) + 1;
    }
  }

  // Include the 20 most recent for context
  digest.recentAlerts = allEvents.slice(0, 20).map((e) => ({
    title: e.title,
    location: e.locationName || 'unknown',
    time: e.timestamp.toISOString(),
    severity: e.severity,
  }));

  return digest;
}

const SYSTEM_PROMPT = `You are a military intelligence analyst producing structured threat assessments for the Israel/Middle East theater. Analyze the event stream and produce a threat assessment in JSON format. Be concise and factual. Score from 1.0 (minimal) to 10.0 (extreme). Only include countries that appear in the event data or are directly relevant.`;

function buildUserPrompt(digest: EventDigest): string {
  return `Analyze this event digest from the last 24 hours and produce a threat assessment.

Event Summary:
- Total events: ${digest.totalEvents}
- Currently active: ${digest.activeEvents}
- By type: ${JSON.stringify(digest.byType)}
- By severity: ${JSON.stringify(digest.bySeverity)}
- Top locations: ${JSON.stringify(Object.entries(digest.byLocation).sort((a, b) => b[1] - a[1]).slice(0, 15))}

Recent alerts (most recent first):
${digest.recentAlerts.map((a) => `  [${a.severity}] ${a.time} — ${a.title} @ ${a.location}`).join('\n')}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "overall_score": <number 1.0-10.0>,
  "overall_trend": "escalating" | "de-escalating" | "stable",
  "situation_text": "<2-3 sentence situation summary>",
  "trend_text": "<1-2 sentence trend analysis>",
  "overall_text": "<1 sentence bottom line>",
  "countries": [
    {
      "country_code": "<2-letter ISO>",
      "country_name": "<name>",
      "score": <number 1.0-10.0>,
      "trend": "escalating" | "de-escalating" | "stable",
      "summary": "<1 sentence>"
    }
  ]
}`;
}

interface AssessmentResponse {
  overall_score: number;
  overall_trend: string;
  situation_text: string;
  trend_text: string;
  overall_text: string;
  countries: Array<{
    country_code: string;
    country_name: string;
    score: number;
    trend: string;
    summary: string;
  }>;
}

async function runAssessment(): Promise<void> {
  const digest = await buildDigest();

  if (digest.totalEvents === 0) {
    log('No events in the last 24h, skipping assessment.');
    return;
  }

  log(`Building assessment from ${digest.totalEvents} events...`);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(digest) }],
  });

  const text =
    message.content[0].type === 'text' ? message.content[0].text : '';

  let assessment: AssessmentResponse;
  try {
    assessment = JSON.parse(text);
  } catch (parseErr) {
    log(`Failed to parse Claude response as JSON: ${parseErr}. Raw: ${text.slice(0, 200)}`);
    return;
  }

  // Insert assessment
  const [inserted] = await db
    .insert(threatAssessments)
    .values({
      overallScore: assessment.overall_score.toFixed(1),
      overallTrend: assessment.overall_trend,
      situationText: assessment.situation_text,
      trendText: assessment.trend_text,
      overallText: assessment.overall_text,
      modelUsed: MODEL,
      eventWindow: '24 hours',
    })
    .returning({ id: threatAssessments.id });

  // Insert country threats
  if (assessment.countries?.length > 0) {
    await db.insert(countryThreats).values(
      assessment.countries.map((c) => ({
        assessmentId: inserted.id,
        countryCode: c.country_code,
        countryName: c.country_name,
        score: c.score.toFixed(1),
        trend: c.trend,
        summary: c.summary,
      })),
    );
  }

  log(
    `Assessment saved: score=${assessment.overall_score}, trend=${assessment.overall_trend}, countries=${assessment.countries?.length ?? 0}`,
  );
}

// --- Main loop ---

async function main() {
  log(`Starting (interval: ${INTERVAL_MS}ms, model: ${MODEL})`);

  let running = true;
  process.on('SIGTERM', () => { running = false; });
  process.on('SIGINT', () => { running = false; });

  while (running) {
    try {
      await runAssessment();
    } catch (err) {
      log(`Error: ${err}`);
    }

    if (running) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
    }
  }

  await pool.end();
  log('Stopped.');
  process.exit(0);
}

main();
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --project tsconfig.worker.json --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/workers/ai-assessment.ts
git commit -m "feat: add AI threat assessment worker (10min cycle, Claude Sonnet)"
```

---

## Task 7: Frontend Wiring (Agent G — Wave 2)

**Files:**
- Create: `src/lib/store.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/components/alerts/AlertFeed.tsx`
- Modify: `src/components/threats/ThreatPanel.tsx`
- Modify: `src/components/layout/NewsTicker.tsx`
- Modify: `src/components/layout/Header.tsx`

**Context:** Depends on Task 2 (API routes). Read the existing component files first — they're shell components with prop interfaces. We're replacing prop-driven data with Zustand store reads. The API response shapes match what Task 2 defined. Read `src/lib/constants.ts` for the COUNTRIES array (needed for flag lookup in ThreatPanel).

- [ ] **Step 1: Create `src/lib/store.ts`**

```typescript
import { create } from 'zustand';

export interface EventData {
  id: string;
  timestamp: string;
  ingestedAt: string;
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
  isActive: boolean;
  dedupHash: string | null;
}

export interface CountryThreatData {
  id: string;
  assessmentId: string;
  countryCode: string;
  countryName: string;
  score: number;
  trend: string;
  summary: string | null;
}

export interface ThreatData {
  id: string;
  createdAt: string;
  overallScore: number;
  overallTrend: string;
  situationText: string;
  trendText: string;
  overallText: string;
  countries: CountryThreatData[];
}

export interface TickerItemData {
  id: string;
  text: string;
  type: 'news' | 'alert' | 'thermal' | 'social';
  timestamp: string;
}

interface AppState {
  events: EventData[];
  threat: ThreatData | null;
  tickerItems: TickerItemData[];
  isLive: boolean;
  lastUpdate: Date | null;
  fetchEvents: () => Promise<void>;
  fetchThreat: () => Promise<void>;
  fetchTicker: () => Promise<void>;
  connectSSE: () => void;
  disconnectSSE: () => void;
}

let sseConnection: EventSource | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  events: [],
  threat: null,
  tickerItems: [],
  isLive: false,
  lastUpdate: null,

  fetchEvents: async () => {
    try {
      const res = await fetch('/api/events?limit=50&active=true');
      const data = await res.json();
      set({ events: data.events ?? [] });
    } catch (err) {
      console.error('fetchEvents error:', err);
    }
  },

  fetchThreat: async () => {
    try {
      const res = await fetch('/api/threat');
      const data = await res.json();
      set({ threat: data.assessment ?? null, lastUpdate: new Date() });
    } catch (err) {
      console.error('fetchThreat error:', err);
    }
  },

  fetchTicker: async () => {
    try {
      const res = await fetch('/api/ticker');
      const data = await res.json();
      set({ tickerItems: data.items ?? [] });
    } catch (err) {
      console.error('fetchTicker error:', err);
    }
  },

  connectSSE: () => {
    if (sseConnection) sseConnection.close();

    sseConnection = new EventSource('/api/events/stream');

    sseConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.events?.length > 0) {
          set((state) => ({
            events: [...data.events, ...state.events].slice(0, 200),
            lastUpdate: new Date(),
          }));
          // Refresh ticker with latest
          get().fetchTicker();
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    sseConnection.onopen = () => set({ isLive: true });
    sseConnection.onerror = () => set({ isLive: false });
  },

  disconnectSSE: () => {
    sseConnection?.close();
    sseConnection = null;
    set({ isLive: false });
  },
}));
```

- [ ] **Step 2: Update `src/app/page.tsx`**

Replace the entire file:

```typescript
"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "@/lib/store";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import NewsTicker from "@/components/layout/NewsTicker";
import AlertFeed from "@/components/alerts/AlertFeed";
import ThreatPanel from "@/components/threats/ThreatPanel";
import TimelineBar from "@/components/timeline/TimelineBar";

const MapContainer = dynamic(() => import("@/components/map/MapContainer"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center bg-background">
      <span className="text-sm text-muted">Loading map...</span>
    </div>
  ),
});

export default function Dashboard() {
  const { fetchEvents, fetchThreat, fetchTicker, connectSSE, disconnectSSE, isLive, lastUpdate } =
    useAppStore();

  useEffect(() => {
    fetchEvents();
    fetchThreat();
    fetchTicker();
    connectSSE();

    // Refresh threat assessment every 60s
    const threatInterval = setInterval(fetchThreat, 60_000);

    return () => {
      clearInterval(threatInterval);
      disconnectSSE();
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <Header isLive={isLive} lastUpdate={lastUpdate ?? undefined} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar>
          <AlertFeed />
          <ThreatPanel />
        </Sidebar>
        <MapContainer />
      </div>
      <TimelineBar isLive={isLive} currentTime={new Date()} />
      <NewsTicker />
    </div>
  );
}
```

- [ ] **Step 3: Update `src/components/alerts/AlertFeed.tsx`**

Replace the entire file:

```typescript
"use client";

import { useAppStore } from "@/lib/store";

const severityConfig = {
  critical: { label: "CRITICAL", color: "text-critical", bg: "bg-critical/10", dot: "bg-critical" },
  moderate: { label: "MODERATE", color: "text-moderate", bg: "bg-moderate/10", dot: "bg-moderate" },
  info: { label: "INFO", color: "text-info", bg: "bg-info/10", dot: "bg-info" },
  cleared: { label: "CLEARED", color: "text-cleared", bg: "bg-cleared/10", dot: "bg-cleared" },
};

export default function AlertFeed() {
  const events = useAppStore((s) => s.events);
  const activeAlerts = events.filter((e) => e.isActive);
  const criticalCount = activeAlerts.filter((e) => e.severity === "critical").length;

  return (
    <section className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <svg className="h-4 w-4 text-critical" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
        </svg>
        <span className="text-xs font-bold tracking-wide">ALERT FEED</span>
        {criticalCount > 0 && (
          <span className="rounded-full bg-critical/20 px-2 py-0.5 text-xs font-bold text-critical">
            {criticalCount}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeAlerts.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted">
            No active alerts
          </div>
        ) : (
          activeAlerts.map((event) => {
            const sev = event.severity as keyof typeof severityConfig;
            const config = severityConfig[sev] ?? severityConfig.info;
            return (
              <div
                key={event.id}
                className={`border-b border-border/50 px-3 py-2 ${config.bg}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                  <span className={`text-xs font-bold ${config.color}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-muted">
                    {formatTimeAgo(new Date(event.timestamp))}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium">{event.title}</p>
                {event.locationName && (
                  <p className="mt-0.5 text-xs text-muted">
                    @ {event.locationName} &middot; {event.source}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "less than a minute ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
```

- [ ] **Step 4: Update `src/components/threats/ThreatPanel.tsx`**

Replace the entire file:

```typescript
"use client";

import { useAppStore } from "@/lib/store";
import { COUNTRIES } from "@/lib/constants";

const trendArrows = {
  escalating: "\u2197",
  "de-escalating": "\u2198",
  stable: "\u2192",
};

const trendColors = {
  escalating: "text-critical",
  "de-escalating": "text-cleared",
  stable: "text-muted",
};

function scoreColor(score: number): string {
  if (score >= 8) return "bg-critical";
  if (score >= 6) return "bg-moderate";
  if (score >= 4) return "bg-warning";
  if (score >= 2) return "bg-cleared";
  return "bg-muted";
}

export default function ThreatPanel() {
  const threat = useAppStore((s) => s.threat);

  const overallScore = threat?.overallScore;
  const overallTrend = (threat?.overallTrend ?? "stable") as keyof typeof trendArrows;

  const countries = (threat?.countries ?? []).map((c) => ({
    countryCode: c.countryCode,
    countryName: c.countryName,
    flag: COUNTRIES.find((cc) => cc.code === c.countryCode)?.flag ?? "",
    score: c.score,
    trend: c.trend as keyof typeof trendArrows,
  }));

  return (
    <section className="flex flex-col border-t border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-moderate" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-bold tracking-wide">THREAT LEVEL</span>
        </div>
        <span className={`text-xs font-bold ${trendColors[overallTrend] ?? trendColors.stable}`}>
          {trendArrows[overallTrend] ?? trendArrows.stable} {overallTrend.toUpperCase()}
        </span>
      </div>

      {overallScore !== undefined && (
        <div className="flex items-center justify-center gap-1 py-2">
          <span className="text-3xl font-bold">{overallScore.toFixed(1)}</span>
          <span className="text-sm text-muted">/ 10</span>
        </div>
      )}

      <div className="space-y-0.5 px-3 pb-2">
        {countries.map((c) => (
          <div key={c.countryCode} className="flex items-center gap-2 py-0.5">
            <span className="w-5 text-center text-sm">{c.flag}</span>
            <span className="w-6 text-xs text-muted">{c.countryCode}</span>
            <div className="flex-1">
              <div className="h-1.5 w-full rounded-full bg-border">
                <div
                  className={`h-1.5 rounded-full ${scoreColor(c.score)} transition-all`}
                  style={{ width: `${(c.score / 10) * 100}%` }}
                />
              </div>
            </div>
            <span className="w-7 text-right text-xs font-medium">
              {c.score > 0 ? c.score.toFixed(1) : "-"}
            </span>
            <span className={`w-3 text-xs ${trendColors[c.trend] ?? trendColors.stable}`}>
              {trendArrows[c.trend] ?? trendArrows.stable}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Update `src/components/layout/NewsTicker.tsx`**

Replace the entire file:

```typescript
"use client";

import { useAppStore } from "@/lib/store";

const typeColors: Record<string, string> = {
  news: "bg-info",
  alert: "bg-critical",
  thermal: "bg-moderate",
  social: "bg-purple-500",
};

export default function NewsTicker() {
  const items = useAppStore((s) => s.tickerItems);

  if (items.length === 0) {
    return (
      <div className="flex h-7 shrink-0 items-center border-t border-border bg-surface px-4">
        <span className="text-xs text-muted">Waiting for events...</span>
      </div>
    );
  }

  return (
    <div className="flex h-7 shrink-0 items-center overflow-hidden border-t border-border bg-surface">
      <div className="animate-marquee flex whitespace-nowrap">
        {items.map((item) => (
          <span key={item.id} className="mx-6 flex items-center gap-2 text-xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${typeColors[item.type] ?? "bg-muted"}`}
            />
            <span className="text-foreground">{item.text}</span>
            <span className="text-muted">
              {formatTimeAgo(new Date(item.timestamp))}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 6: Update `src/components/layout/Header.tsx`**

Replace the entire file:

```typescript
"use client";

import { useAppStore } from "@/lib/store";

function getThreatColor(score: number): string {
  if (score >= 8) return "text-critical";
  if (score >= 6) return "text-moderate";
  if (score >= 4) return "text-warning";
  return "text-cleared";
}

function getThreatLabel(score: number): string {
  if (score >= 8) return "CRITICAL";
  if (score >= 6) return "HIGH";
  if (score >= 4) return "ELEVATED";
  if (score >= 2) return "GUARDED";
  return "LOW";
}

interface HeaderProps {
  isLive?: boolean;
  lastUpdate?: Date;
}

export default function Header({ isLive = false, lastUpdate }: HeaderProps) {
  const threat = useAppStore((s) => s.threat);
  const score = threat?.overallScore ?? 0;
  const label = getThreatLabel(score);
  const color = getThreatColor(score);

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-bold tracking-wide">
          <span className="text-foreground">WAR</span>
          <span className="text-muted">ALERTING</span>
          <span className="text-foreground">SYSTEM</span>
        </h1>

        {isLive && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-xs font-medium text-green-500">LIVE</span>
          </div>
        )}

        {threat && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${color}`}>
              THREAT: {label}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-bold ${color} bg-surface-elevated`}
            >
              ({score.toFixed(1)})
            </span>
          </div>
        )}

        {lastUpdate && (
          <span className="text-xs text-muted">
            upd {formatTimeAgo(lastUpdate)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button className="rounded px-2 py-1 text-xs text-muted hover:bg-surface-elevated hover:text-foreground">
          EN
        </button>
      </div>
    </header>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "less than a minute ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
```

- [ ] **Step 7: Verify the app builds**

```bash
npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/store.ts src/app/page.tsx src/components/alerts/AlertFeed.tsx src/components/threats/ThreatPanel.tsx src/components/layout/NewsTicker.tsx src/components/layout/Header.tsx
git commit -m "feat: wire frontend components to live API data via Zustand store"
```

---

## Post-Implementation Verification

After all 7 tasks are complete and merged:

1. **Run DB migrations:**
   ```bash
   npx drizzle-kit push
   ```

2. **Build and start everything:**
   ```bash
   docker compose build
   docker compose up -d
   ```

3. **Check worker logs:**
   ```bash
   docker compose logs -f worker-oref-current
   docker compose logs -f worker-oref-history
   docker compose logs -f ai-cron
   ```

4. **Verify API routes:**
   ```bash
   curl http://localhost:3000/api/status
   curl http://localhost:3000/api/events?limit=5
   curl http://localhost:3000/api/threat
   curl http://localhost:3000/api/ticker
   ```

5. **Open dashboard:** Navigate to `http://localhost:3000` — AlertFeed, ThreatPanel, and NewsTicker should show real data once the workers have run their first cycles.
