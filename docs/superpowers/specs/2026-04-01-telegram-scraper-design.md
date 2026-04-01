# Telegram Channel Scraper — Design Spec

**Date:** 2026-04-01
**Scope:** Sub-project C — HTTP scraper for 3 public Telegram channel preview pages.

---

## Architecture

One worker process (`worker-telegram-scraper`) scrapes 3 public `t.me/s/` pages every 5 minutes. No authentication needed — these are public HTML pages. No new dependencies — uses fetch + regex parsing.

### Container

| Container | Entrypoint | Interval | Purpose |
|-----------|-----------|----------|---------|
| `worker-telegram-scraper` | `dist/workers/telegram-scraper.js` | 5min | Scrape 3 Telegram channels |

### Files

```
src/workers/
  lib/
    telegram-config.ts    — channel config array
    telegram-parser.ts    — HTML parsing for t.me/s/ pages
  telegram-scraper.ts     — main worker process
```

---

## Channel Configuration

| Channel | URL path | Source key | Language |
|---------|----------|-----------|---------|
| HFC Alerts | `PikudHaOref_all` | `telegram-hfc-alerts` | he |
| HFC Instructions | `HanhayotPikudHaOref` | `telegram-hfc-instructions` | he |
| IDF Official | `idfofficial` | `telegram-idf` | en |

---

## HTML Structure (verified)

Each message on `t.me/s/{channel}` has:

```html
<div class="tgme_widget_message_wrap">
  <div class="tgme_widget_message" data-post="{channel}/{messageId}">
    <div class="tgme_widget_message_text">{HTML content}</div>
    <time datetime="2026-03-31T22:00:07+00:00">...</time>
  </div>
</div>
```

Key selectors:
- `data-post="{channel}/{id}"` — message ID (number after `/`)
- `datetime` attribute on `<time>` — ISO 8601 UTC timestamp
- `tgme_widget_message_text` class — message body (HTML, needs tag stripping)

---

## Parsing

`telegram-parser.ts` extracts messages from raw HTML using regex:

1. Find all `data-post` values → extract numeric message IDs
2. For each message block, extract `datetime` value
3. For each message block, extract text content from `tgme_widget_message_text`, strip HTML tags
4. Return array of `{ messageId: number, timestamp: string, text: string }`

---

## Normalization

| Field | Event column | Logic |
|-------|-------------|-------|
| `datetime` | `timestamp` | Parse ISO string to Date |
| — | `type` | `"social"` |
| channel + text content | `severity` | `"critical"` if HFC alerts channel AND text contains alert keywords (ירי, רקטות, טילים, צבע אדום); otherwise `"info"` |
| first 100 chars of text | `title` | Truncated message text |
| full text | `description` | Stripped of HTML, capped at 1000 chars |
| — | `locationName` | null |
| — | `lat`, `lng` | null |
| channel source key | `source` | e.g. `"telegram-idf"` |
| channel + messageId | `sourceId` | `"telegram:{channel}:{messageId}"` |
| — | `country` | `"IL"` |
| sourceId | `dedupHash` | SHA-256 of sourceId |
| — | `metadata` | `{ channel, messageId, messageUrl: "https://t.me/{channel}/{id}" }` |

---

## Position Tracking

Uses the existing `telegramChannels` DB table (already in schema):
- `channelName` — channel identifier
- `lastMessageId` — highest processed message ID

On each cycle per channel:
1. Read `lastMessageId` from DB
2. Fetch `https://t.me/s/{channel}`
3. Parse messages, filter to `messageId > lastMessageId`
4. Insert new events with dedup
5. Update `lastMessageId` to the highest seen ID

On first run (no row in DB), insert a new row for each channel and process all visible messages.

---

## Worker Flow

1. Every 5 minutes, iterate through 3 channels sequentially
2. Per channel: fetch page, parse messages, filter new ones, normalize, insert, update lastMessageId
3. Per-channel error handling: log warning, skip to next channel
4. Log summary per cycle

Own loop (not `runCollector()`) — same pattern as RSS worker.

---

## Docker

```yaml
worker-telegram-scraper:
  build: { context: ., dockerfile: Dockerfile.worker }
  command: ["node", "dist/workers/telegram-scraper.js"]
  environment:
    - DATABASE_URL=postgresql://was:${POSTGRES_PASSWORD:-was_dev_password}@postgres:5432/was
  depends_on: { postgres: { condition: service_healthy } }
  restart: unless-stopped
```
