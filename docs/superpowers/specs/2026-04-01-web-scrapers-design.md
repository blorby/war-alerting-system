# Web Scrapers — Design Spec

**Date:** 2026-04-01
**Scope:** Sub-project F — HTML scrapers for 8 websites covering Israeli military, Palestinian/humanitarian, and Iran OSINT sources.

---

## Architecture

One worker process cycles through all 8 sites every 15 minutes.

| Container | Entrypoint | Interval | Purpose |
|-----------|-----------|----------|---------|
| `worker-web-scrapers` | `dist/workers/web-scrapers.js` | 15min | Scrape 8 websites |

### Files

```
src/workers/
  lib/
    scraper-config.ts     — site URL/metadata config
    scraper-parser.ts     — per-site HTML parsing functions
    scraper-dedup.ts      — dedup hash function
  web-scrapers.ts         — main worker
```

---

## Sites

| Site | URL | Source key | Category |
|------|-----|-----------|----------|
| IDF Media Releases | `https://www.idf.il/en/idf-media-releases/?page=1` | `idf-releases` | official_statement |
| IDF Real-Time Updates | `https://www.idf.il/en/mini-sites/israel-at-war/real-time-updates/` | `idf-realtime` | official_statement |
| IDF Iran-Israel Updates | `https://www.idf.il/en/mini-sites/iran-israel-war-2026/iran-israel-war-2026-live-updates/` | `idf-iran` | official_statement |
| Shabak Terrorism | `https://www.shabak.gov.il/en/terror/` | `shabak-terror` | official_statement |
| OCHA oPt Updates | `https://www.ochaopt.org/updates` | `ocha-updates` | humanitarian |
| WAFA Last News | `https://english.wafa.ps/Pages/LastNews` | `wafa-news` | news |
| Ma'an Latest | `https://www.maannews.net/news/latest` | `maan-latest` | news |
| INSS Iran Dashboard | `https://www.inss.org.il/publication/iran-real-time/` | `inss-iran` | osint |

---

## Parsing Approach

Each site gets a parser function in `scraper-parser.ts` that:
1. Receives raw HTML
2. Extracts article/update items (title, URL, date if available, snippet)
3. Returns a standard `ScrapedItem[]` array

```typescript
interface ScrapedItem {
  title: string;
  url: string;
  date: Date | null;
  snippet: string | null;
}
```

The agent implementing this MUST fetch each site's HTML first to determine the actual DOM structure before writing the parser. Each site will have different selectors.

---

## Normalization

Per scraped item → one Event:

| Field | Event column | Logic |
|-------|-------------|-------|
| item date or fetch time | `timestamp` | Parsed date, fallback to now |
| — | `type` | `"news"` |
| — | `severity` | `"info"` |
| item title | `title` | Direct |
| item snippet | `description` | Capped at 500 chars |
| — | `locationName` | null |
| — | `lat`, `lng` | null |
| site source key | `source` | e.g. `"idf-releases"` |
| item URL | `sourceId` | `"scraper:{source}:{url}"` |
| — | `country` | `"IL"` for Israeli/Palestinian sources, null for others |
| sourceId | `dedupHash` | SHA-256 of sourceId |
| — | `metadata` | `{ category, siteUrl, itemUrl }` |

---

## Worker Flow

Same pattern as RSS/Telegram workers:
1. Every 15min, iterate through sites sequentially
2. Per site: fetch HTML (15s timeout, browser-like User-Agent), parse items, normalize, insert with dedup
3. Per-site error handling: log warning, skip to next
4. Log summary per cycle

---

## Docker

One new service added to docker-compose.yml.
