# RSS Feed Collector — Design Spec

**Date:** 2026-04-01
**Scope:** Sub-project B — single RSS collector worker that ingests 15 news feeds into the existing events pipeline.

---

## Architecture

One worker process (`worker-rss-feeds`) cycles through all configured RSS feeds every 10 minutes. Uses the existing `base-collector` pattern from sub-project A. Adds `rss-parser` as a dependency.

### Container

| Container | Entrypoint | Interval | Purpose |
|-----------|-----------|----------|---------|
| `worker-rss-feeds` | `dist/workers/rss-feeds.js` | 10min | Poll all 15 RSS feeds |

### Files

```
src/workers/
  lib/
    rss-config.ts       — feed URL/metadata config array
    rss-dedup.ts        — RSS-specific dedup hash function
  rss-feeds.ts          — main collector process
```

---

## Feed Configuration

Static array of 15 feeds, each with:

```typescript
interface RssFeedConfig {
  url: string;
  name: string;       // human-readable
  source: string;     // event source key
  category: string;   // israeli_news | international | iran_military
  language: string;   // en | he
}
```

| Feed | URL | Source key | Category | Lang |
|------|-----|-----------|----------|------|
| Times of Israel | `https://www.timesofisrael.com/feed/` | `toi` | israeli_news | en |
| JPost Headlines | `https://rss.jpost.com/rss/rssfeedsheadlines.aspx` | `jpost-headlines` | israeli_news | en |
| JPost Israel News | `https://rss.jpost.com/rss/rssfeedsisraelnews.aspx` | `jpost-israel` | israeli_news | en |
| JPost Gaza | `https://rss.jpost.com/rss/rssfeedsgaza.aspx` | `jpost-gaza` | israeli_news | en |
| JPost Middle East | `https://rss.jpost.com/rss/rssfeedsmiddleeastnews.aspx` | `jpost-mideast` | israeli_news | en |
| JPost Arab-Israeli Conflict | `https://rss.jpost.com/rss/rssfeedsarabisraeliconflict.aspx` | `jpost-conflict` | israeli_news | en |
| JPost Israel-Hamas War | `https://rss.jpost.com/rss/israel-hamas-war` | `jpost-hamas-war` | israeli_news | en |
| Israel National News | `https://www.israelnationalnews.com/Rss.aspx` | `inn` | israeli_news | en |
| Ynet Breaking | `https://www.ynet.co.il/Integration/StoryRss3254.xml` | `ynet-breaking` | israeli_news | he |
| Ynet All News | `https://www.ynet.co.il/Integration/StoryRss3082.xml` | `ynet-all` | israeli_news | he |
| BBC Middle East | `https://feeds.bbci.co.uk/news/world/middle_east/rss.xml` | `bbc-mideast` | international | en |
| Al Jazeera Middle East | `https://www.aljazeera.com/xml/rss/all.xml?region=middle-east` | `aljazeera-mideast` | international | en |
| Al Jazeera Global | `https://www.aljazeera.com/xml/rss/all.xml` | `aljazeera-global` | international | en |
| CENTCOM | `https://www.centcom.mil/RSS/` | `centcom` | iran_military | en |
| NATO ACT | `https://www.act.nato.int/article-rss-xml/` | `nato-act` | iran_military | en |

---

## Normalization

Each RSS item maps to one Event row:

| RSS field | Event column | Logic |
|-----------|-------------|-------|
| `pubDate` or `isoDate` | `timestamp` | Parse to Date, fallback to fetch time |
| — | `type` | `"news"` |
| — | `severity` | `"info"` |
| `title` | `title` | Direct |
| `contentSnippet` or `content` | `description` | Truncate to 500 chars |
| — | `locationName` | null |
| — | `lat`, `lng` | null |
| feed config `source` | `source` | e.g. `"toi"`, `"bbc-mideast"` |
| `guid` or `link` | `sourceId` | First available |
| — | `country` | null |
| source + guid/link | `dedupHash` | SHA-256 of `"rss:{source}:{guid or link}"` |
| — | `metadata` | `{ category, feedUrl, link }` |
| — | `isActive` | `true` |

---

## Deduplication

`SHA-256("rss:{source}:{guid or link}")` — RSS items have stable GUIDs. Uses existing `ON CONFLICT (dedup_hash) DO NOTHING`.

---

## Worker Flow

1. On each 10min cycle, iterate through all feeds sequentially
2. Per feed: fetch with 15s timeout, parse with `rss-parser`, normalize items, insert with dedup
3. On individual feed error: log warning, skip to next feed (don't fail the cycle)
4. Log summary: feeds processed, total items fetched, new items inserted

Not using `runCollector()` directly since the "collect" function needs to iterate multiple feeds with per-feed error handling. Uses its own loop with the same shutdown pattern.

---

## Agent Work Breakdown

2 agents, single wave (parallel):

| Agent | Scope | Files |
|-------|-------|-------|
| **A — RSS collector** | Feed config, dedup, main collector | `src/workers/lib/rss-config.ts`, `src/workers/lib/rss-dedup.ts`, `src/workers/rss-feeds.ts` |
| **B — Docker integration** | Container config, dependency | `docker-compose.yml`, `package.json` (add rss-parser) |

---

## Docker

```yaml
worker-rss-feeds:
  build: { context: ., dockerfile: Dockerfile.worker }
  command: ["node", "dist/workers/rss-feeds.js"]
  environment:
    - DATABASE_URL=postgresql://was:${POSTGRES_PASSWORD:-was_dev_password}@postgres:5432/was
  depends_on: { postgres: { condition: service_healthy } }
  restart: unless-stopped
```
