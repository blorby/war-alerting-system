# API Integrations — Design Spec

**Date:** 2026-04-01
**Scope:** Sub-project D — aviation tracking (ADSB.lol + OpenSky) and GDELT news aggregation.

---

## Architecture

Two new workers:

| Container | Entrypoint | Interval | Purpose |
|-----------|-----------|----------|---------|
| `worker-aviation` | `dist/workers/aviation-tracker.js` | 5min | Track aircraft over Israel/Middle East region |
| `worker-gdelt` | `dist/workers/gdelt-collector.js` | 10min | Aggregate news coverage via GDELT API |

---

## Aviation Tracker

### APIs

**ADSB.lol** (free, no auth):
- Endpoint: `https://api.adsb.lol/v2/lat/{lat}/lon/{lon}/dist/{nm}`
- Returns aircraft within `{nm}` nautical miles of a point
- Focus area: lat=31.5, lon=35.2 (Israel center), dist=300nm (covers region)

**OpenSky Network** (free, no auth for anonymous):
- Endpoint: `https://opensky-network.org/api/states/all?lamin={}&lomin={}&lamax={}&lomax={}`
- Bounding box: lamin=25, lomin=30, lamax=40, lomax=55 (covers Israel through Iran)
- Rate limit: 10 requests/minute for anonymous

### Files

```
src/workers/
  lib/
    aviation-config.ts   — API endpoints, region bounds, filter config
  aviation-tracker.ts    — main worker
```

### Normalization

Per aircraft state vector → one Event:

| API field | Event column | Logic |
|-----------|-------------|-------|
| timestamp from API | `timestamp` | Current time or API-provided |
| — | `type` | `"flight"` |
| — | `severity` | `"info"` |
| callsign or hex | `title` | `"{callsign} ({hex})"` or `"Unknown {hex}"` |
| — | `description` | `"Alt: {alt}ft, Speed: {speed}kts, Heading: {heading}"` |
| — | `locationName` | null |
| longitude | `lng` | From API |
| latitude | `lat` | From API |
| `"adsb-lol"` or `"opensky"` | `source` | API source |
| hex code | `sourceId` | `"aviation:{source}:{hex}:{roundedTime}"` |
| — | `country` | origin country if available, else null |
| sourceId | `dedupHash` | SHA-256 of sourceId (rounded to 5min to avoid duplicates) |
| — | `metadata` | `{ hex, callsign, altitude, speed, heading, squawk, onGround, originCountry }` |

### Dedup

Round timestamp to 5-minute window in the hash — same aircraft seen across consecutive polls only creates one event per 5-minute window.

### Flow

1. Fetch from ADSB.lol first, then OpenSky
2. Merge results by hex code (prefer ADSB.lol if both have the same aircraft)
3. Normalize and insert with dedup
4. Log: aircraft count, new events inserted

---

## GDELT Collector

### API

**GDELT DOC API** (free, no auth):
- Endpoint: `https://api.gdeltproject.org/api/v2/doc/doc`
- Params: `query=Israel OR Iran OR Gaza OR Hezbollah OR "West Bank"&mode=artlist&maxrecords=75&format=json&sort=DateDesc`
- Returns recent articles matching the query

### Files

```
src/workers/
  lib/
    gdelt-config.ts      — query terms, API endpoint
  gdelt-collector.ts     — main worker
```

### Normalization

Per GDELT article → one Event:

| GDELT field | Event column | Logic |
|-------------|-------------|-------|
| `seendate` | `timestamp` | Parse GDELT date format |
| — | `type` | `"news"` |
| — | `severity` | `"info"` |
| `title` | `title` | Article title |
| `socialimage` or domain | `description` | `"Source: {domain}"` |
| — | `locationName` | null |
| — | `lat`, `lng` | null |
| `"gdelt"` | `source` | Fixed |
| `url` | `sourceId` | `"gdelt:{url}"` |
| — | `country` | null |
| sourceId | `dedupHash` | SHA-256 of sourceId |
| — | `metadata` | `{ url, domain, language, sourcecountry }` |

---

## Docker

Two new services added to docker-compose.yml (no env vars beyond DATABASE_URL needed).
