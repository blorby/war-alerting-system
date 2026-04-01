# Core Ingest Pipeline + Pikud HaOref Alerts — Design Spec

**Date:** 2026-04-01
**Scope:** Sub-project A of the war alerting system — worker framework, Oref alert ingestion, AI threat assessment, API routes, frontend wiring.

---

## 1. Architecture Overview

Separate-process-per-collector architecture. Each collector runs as its own Docker container with a dedicated `command:` override. All collectors share the same Postgres database via the existing Drizzle ORM setup.

### Containers

| Container | Entrypoint | Interval | Purpose |
|-----------|-----------|----------|---------|
| `worker-oref-current` | `dist/workers/oref-current.js` | 30s | Poll Oref current alerts JSON |
| `worker-oref-history` | `dist/workers/oref-history.js` | 5min | Poll Oref alert history JSON |
| `ai-cron` | `dist/workers/ai-assessment.js` | 10min | AI threat assessment via Anthropic |
| `nextjs` | (existing) | — | Dashboard + API routes |
| `postgres` | (existing) | — | Database |

### Directory Structure

```
src/workers/
  lib/
    base-collector.ts    — shared loop, DB insert, dedup, error handling
    normalize.ts         — raw source data -> unified Event shape
    dedup.ts             — SHA-256 hash generation + unique constraint check
  oref-current.ts        — polls alerts.json every 30s
  oref-history.ts        — polls AlertsHistory.json every 5min
  ai-assessment.ts       — runs threat assessment every 10min

src/app/api/
  events/
    route.ts             — GET paginated events
    stream/
      route.ts           — SSE real-time event stream
  threat/
    route.ts             — GET latest threat assessment
  ticker/
    route.ts             — GET recent ticker items
  status/
    route.ts             — GET health check

src/lib/
  store.ts               — Zustand store for frontend state
  geo/
    districts.json       — Static city name -> lat/lng lookup (generated)
```

---

## 2. Agent Work Breakdown

Implementation is split into 7 agents across 2 waves to maximize parallelism.

### Wave 1 (parallel — no dependencies)

| Agent | Scope | Files |
|-------|-------|-------|
| **A — Base collector infra** | Shared worker loop, normalize, dedup utilities | `src/workers/lib/base-collector.ts`, `normalize.ts`, `dedup.ts` |
| **B — API routes** | All Next.js route handlers | `src/app/api/events/route.ts`, `events/stream/route.ts`, `threat/route.ts`, `ticker/route.ts`, `status/route.ts` |
| **C — Docker + infra** | Container config, TypeScript config, env vars, geocoding data | `docker-compose.yml`, `Dockerfile.worker`, `tsconfig.worker.json`, `.env.example`, `src/lib/geo/districts.json` |

### Wave 2 (parallel — depends on Wave 1)

| Agent | Scope | Files | Depends on |
|-------|-------|-------|------------|
| **D — Oref current collector** | 30s polling of alerts.json | `src/workers/oref-current.ts` | A |
| **E — Oref history collector** | 5min polling of AlertsHistory.json | `src/workers/oref-history.ts` | A |
| **F — AI threat assessment** | 10min Anthropic-powered analysis | `src/workers/ai-assessment.ts` | A |
| **G — Frontend wiring** | Connect shell components to API routes via Zustand | Modify `AlertFeed.tsx`, `ThreatPanel.tsx`, `NewsTicker.tsx`, `Header.tsx`, `page.tsx`; create `src/lib/store.ts` | B |

---

## 3. Oref Data Model & Normalization

### Verified Endpoint Shapes

**Current alerts** (`/WarningMessages/alert/alerts.json`) — returns a single object when active, empty body when clear:

```json
{
  "title": "ירי רקטות וטילים",
  "data": ["יראון", "קריית שמונה"],
  "desc": "היכנסו למרחב המוגן"
}
```

Required headers: `Referer: https://www.oref.org.il/`, `X-Requested-With: XMLHttpRequest`.

May also return an array of objects when multiple alert types are active simultaneously. The collector normalizes both shapes to an array.

**Alert history** (`/WarningMessages/alert/History/AlertsHistory.json`) — array of per-city records:

```json
[
  {
    "alertDate": "2026-04-01 11:09:50",
    "title": "ירי רקטות וטילים",
    "data": "יראון",
    "category": 1
  }
]
```

**Districts** (`/Shared/Ajax/GetDistricts.aspx?lang=he`) — area metadata, no coordinates:

```json
{
  "label": "אזור תעשייה שחורת",
  "value": "124FC5752F86660B7458D50DCE51AE40",
  "id": "10",
  "areaid": 1,
  "areaname": "אילת",
  "label_he": "אזור תעשייה שחורת",
  "migun_time": 30
}
```

### Current Alerts Normalization (fan-out: `data` is an array)

| Oref field | Event column | Logic |
|-----------|-------------|-------|
| *fetch time* | `timestamp` | No `alertDate` in current alerts |
| `title` | `title` | Hebrew alert type string |
| `desc` | `description` | Shelter instructions |
| `data[n]` | `location_name` | One event row per city |
| `title` | `type` | Title-to-type mapping (see below) |
| `title` | `severity` | Title-to-severity mapping (see below) |
| — | `source` | `"oref-current"` |
| title + city + time | `dedup_hash` | SHA-256 of `"oref:{title}:{city}:{fetchTime rounded to minute}"` |
| — | `country` | `"IL"` |
| city name | `lat`, `lng` | Static lookup from `districts.json` |

### History Normalization (no fan-out: `data` is a string)

| Oref field | Event column | Logic |
|-----------|-------------|-------|
| `alertDate` | `timestamp` | Parse as Asia/Jerusalem, convert to UTC |
| `title` | `title` | Hebrew alert type string |
| — | `description` | null |
| `data` | `location_name` | Direct string |
| `category` | `type` | Category-to-type mapping (see below) |
| `category` | `severity` | Category-to-severity mapping (see below) |
| — | `source` | `"oref-history"` |
| alertDate + city | `dedup_hash` | SHA-256 of `"oref-hist:{alertDate}:{data}"` |
| — | `country` | `"IL"` |
| `data` value | `lat`, `lng` | Static lookup from `districts.json` |
| category 13 | `is_active` | Set matching prior alerts to `is_active = false` |

### Title-to-Type Mapping (current alerts)

| Hebrew title | `type` | `severity` |
|-------------|--------|-----------|
| ירי רקטות וטילים (rockets & missiles) | `alert` | `critical` |
| חדירת כלי טיס עוין (hostile aircraft) | `alert` | `critical` |
| חדירת מחבלים (infiltration) | `alert` | `critical` |
| רעידת אדמה (earthquake) | `seismic` | `moderate` |
| צונאמי (tsunami) | `alert` | `critical` |
| חומרים מסוכנים (hazardous materials) | `alert` | `moderate` |
| האירוע הסתיים (event ended) | `alert` | `cleared` |
| Unknown | `alert` | `moderate` |

### Category-to-Type Mapping (history)

| Category | `type` | `severity` |
|----------|--------|-----------|
| 1 | `alert` | `critical` |
| 2 | `seismic` | `moderate` |
| 3 | `alert` | `critical` |
| 13 | `alert` | `cleared` |
| Other | `alert` | `moderate` |

### Geocoding

A static `districts.json` file maps Oref city names to lat/lng coordinates. Generated once by a standalone script (`scripts/generate-districts.ts`), committed to the repo, and updated manually when needed:

1. Fetching the full districts list from `GetDistricts.aspx`
2. For each unique `label_he`, querying OpenStreetMap Nominatim for coordinates (with rate limiting)
3. Saving as `{ "city_name_he": { "lat": number, "lng": number, "areaname": string, "migun_time": number } }`

Falls back to null coordinates if a city name isn't found.

### Proxy Configuration

The `OREF_BASE_URL` environment variable controls the upstream:
- Israeli server: `https://www.oref.org.il` (default)
- External server: `http://your-proxy:3001` (any Oref relay proxy)

---

## 4. AI Threat Assessment Worker

Runs every 10 minutes. Uses `@anthropic-ai/sdk` with `claude-sonnet-4-6`.

### Process

1. Query events from the last 24h
2. Summarize into a digest (counts by type/severity/location across 1h/6h/24h windows, active vs cleared ratio)
3. Send prompt to Claude requesting structured JSON assessment
4. Parse response and insert into `threat_assessments` + `country_threats` tables

### Prompt Structure

```
You are a military intelligence analyst. Given the following event
stream from the last {window}, produce a threat assessment.

Events: {serialized event digest}

Respond with JSON:
{
  "overall_score": <1.0-10.0>,
  "overall_trend": "escalating" | "de-escalating" | "stable",
  "situation_text": "<2-3 sentence situation summary>",
  "trend_text": "<1-2 sentence trend analysis>",
  "overall_text": "<1 sentence bottom line>",
  "countries": [
    {
      "country_code": "IL",
      "country_name": "Israel",
      "score": <1.0-10.0>,
      "trend": "escalating" | "de-escalating" | "stable",
      "summary": "<1 sentence>"
    }
  ]
}
```

### Event Digest Format

Rather than sending raw events (token-expensive), summarize:
- Alert counts by type: last 1h / 6h / 24h
- Affected locations with frequency
- Active vs cleared ratio
- Category breakdown
- Notable patterns (clusters, escalations)

### Fallback

If the Anthropic API is unreachable, log the failure and skip the cycle. The dashboard shows the most recent successful assessment. The `created_at` timestamp tells the frontend how fresh it is.

---

## 5. API Routes

All routes are Next.js 16 route handlers in `src/app/api/`. Read from Postgres via Drizzle. No authentication (local/internal tool). Error shape: `{ error: string }`.

### `GET /api/events`

Paginated event list for AlertFeed.

- Params: `?limit=50&offset=0&severity=critical&type=alert&active=true`
- Response: `{ events: Event[], total: number }`
- Default: last 50 active events, newest first

### `GET /api/events/stream`

Server-Sent Events for real-time dashboard updates.

- Polls DB every 5s for events newer than client's last-seen timestamp
- Sends: `data: { events: Event[] }` when new events exist
- Used by frontend to update AlertFeed and NewsTicker without page refresh

### `GET /api/threat`

Latest threat assessment for ThreatPanel and Header.

- No params — returns most recent `threat_assessment` joined with `country_threats`
- Response: `{ assessment: { ...ThreatAssessment, countries: CountryThreat[] } }`

### `GET /api/ticker`

Recent events for the news ticker.

- Returns last 20 events across all types
- Response: `{ items: TickerItem[] }`

### `GET /api/status`

Health check showing system status.

- Response: `{ db: "ok", lastEvent: Date | null, lastAssessment: Date | null, eventCount24h: number }`

---

## 6. Frontend Wiring

### Zustand Store (`src/lib/store.ts`)

```typescript
interface AppState {
  events: Event[];
  threat: ThreatAssessment | null;
  tickerItems: TickerItem[];
  isLive: boolean;
  fetchEvents: () => Promise<void>;
  fetchThreat: () => Promise<void>;
  fetchTicker: () => Promise<void>;
  connectSSE: () => void;
}
```

### Component Changes

| Component | Current | After |
|-----------|---------|-------|
| `page.tsx` | Hardcoded props | Initialize store, call `connectSSE()` on mount, pass store data |
| `Header.tsx` | Static `isLive={true}` | Read `threat.overallScore` and `isLive` from store |
| `AlertFeed.tsx` | Empty `alerts=[]` | Read `events` from store, filter to active |
| `ThreatPanel.tsx` | No data | Read `threat` from store (score, trend, countries) |
| `NewsTicker.tsx` | Empty `items=[]` | Read `tickerItems` from store |

### Data Flow

1. Page load: `fetchEvents()` + `fetchThreat()` + `fetchTicker()` fire in parallel
2. `connectSSE()` opens `/api/events/stream` — on each message, prepend new events to store and refresh ticker
3. Threat assessment refreshes via polling every 60s (cheap since server updates every 10min)

### Not Changed This Phase

`MapContainer`, `Sidebar`, `TimelineBar`, map overlay components — these get real data in later phases when more source types are integrated.

---

## 7. Configuration

### Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | Yes | — | Postgres connection string |
| `OREF_BASE_URL` | No | `https://www.oref.org.il` | Oref API base (or proxy URL) |
| `ANTHROPIC_API_KEY` | Yes (for ai-cron) | — | Claude API key |
| `NEXT_PUBLIC_MAP_STYLE` | No | CartoDB dark matter | Map tile style URL |

### Docker Compose Services

```yaml
worker-oref-current:
  build: { context: ., dockerfile: Dockerfile.worker }
  command: ["node", "dist/workers/oref-current.js"]
  environment:
    - DATABASE_URL=postgresql://was:${POSTGRES_PASSWORD}@postgres:5432/was
    - OREF_BASE_URL=${OREF_BASE_URL:-https://www.oref.org.il}
  depends_on: { postgres: { condition: service_healthy } }
  restart: unless-stopped

worker-oref-history:
  build: { context: ., dockerfile: Dockerfile.worker }
  command: ["node", "dist/workers/oref-history.js"]
  environment:
    - DATABASE_URL=postgresql://was:${POSTGRES_PASSWORD}@postgres:5432/was
    - OREF_BASE_URL=${OREF_BASE_URL:-https://www.oref.org.il}
  depends_on: { postgres: { condition: service_healthy } }
  restart: unless-stopped

ai-cron:
  build: { context: ., dockerfile: Dockerfile.worker }
  command: ["node", "dist/workers/ai-assessment.js"]
  environment:
    - DATABASE_URL=postgresql://was:${POSTGRES_PASSWORD}@postgres:5432/was
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
  depends_on: { postgres: { condition: service_healthy } }
  restart: unless-stopped
```

### Worker TypeScript Config

A separate `tsconfig.worker.json` targeting Node.js (not browser), outputting to `dist/workers/`.

---

## 8. Deduplication Strategy

Each event gets a `dedup_hash` (SHA-256) based on source-specific fields. The `events` table has a unique index on `dedup_hash`.

- **Oref current:** `SHA-256("oref:{title}:{city}:{fetchTime rounded to minute}")` — prevents duplicate inserts from 30s polling when the same alert persists
- **Oref history:** `SHA-256("oref-hist:{alertDate}:{data}")` — history records are immutable, so exact match on timestamp + city

On insert, use Postgres `ON CONFLICT (dedup_hash) DO NOTHING` to silently skip duplicates.

### Event Lifecycle

1. Oref current collector creates events with `is_active = true`
2. When Oref history shows `category: 13` (event ended), the history collector sets matching prior events to `is_active = false`
3. AlertFeed defaults to showing only `is_active = true` events
