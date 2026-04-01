import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { events, telegramChannels } from '../lib/db/schema';
import { TELEGRAM_CHANNELS, TelegramChannelConfig } from './lib/telegram-config';
import { parseMessages } from './lib/telegram-parser';
import { sha256 } from './lib/normalize';
import { NewEvent } from './lib/base-collector';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 15_000;
const ALERT_KEYWORDS = /ירי|רקטות|טילים|צבע אדום|אזעקה/;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { events, telegramChannels } });

let running = true;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOrCreateChannel(channelName: string): Promise<{ lastMessageId: number }> {
  const existing = await db
    .select()
    .from(telegramChannels)
    .where(eq(telegramChannels.channelName, channelName))
    .limit(1);

  if (existing.length > 0) {
    return { lastMessageId: existing[0].lastMessageId ?? 0 };
  }

  const inserted = await db
    .insert(telegramChannels)
    .values({ channelName })
    .returning({ lastMessageId: telegramChannels.lastMessageId });

  return { lastMessageId: inserted[0].lastMessageId ?? 0 };
}

function determineSeverity(source: string, text: string): string {
  if (source === 'telegram-hfc-alerts' && ALERT_KEYWORDS.test(text)) {
    return 'critical';
  }
  return 'info';
}

function messageToEvent(
  channelConfig: TelegramChannelConfig,
  messageId: number,
  timestamp: Date,
  text: string,
): NewEvent {
  const sourceId = `telegram:${channelConfig.channel}:${messageId}`;

  return {
    timestamp,
    type: 'social',
    severity: determineSeverity(channelConfig.source, text),
    title: text.slice(0, 100),
    description: text.slice(0, 1000) || null,
    locationName: null,
    lat: null,
    lng: null,
    source: channelConfig.source,
    sourceId,
    country: 'IL',
    dedupHash: sha256(sourceId),
    metadata: {
      channel: channelConfig.channel,
      messageId,
      messageUrl: `https://t.me/${channelConfig.channel}/${messageId}`,
    },
  };
}

async function processChannel(
  channelConfig: TelegramChannelConfig,
): Promise<{ fetched: number; inserted: number }> {
  const { lastMessageId } = await getOrCreateChannel(channelConfig.channel);

  const url = `https://t.me/s/${channelConfig.channel}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  const html = await response.text();
  const messages = parseMessages(html, channelConfig.channel);
  const newMessages = messages.filter((m) => m.messageId > lastMessageId);

  let inserted = 0;

  for (const msg of newMessages) {
    const event = messageToEvent(channelConfig, msg.messageId, msg.timestamp, msg.text);
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

  // Update lastMessageId to the highest seen
  if (newMessages.length > 0) {
    const highestMessageId = newMessages[newMessages.length - 1].messageId;
    await db
      .update(telegramChannels)
      .set({ lastMessageId: highestMessageId })
      .where(eq(telegramChannels.channelName, channelConfig.channel));
  }

  return { fetched: newMessages.length, inserted };
}

async function runCycle(): Promise<void> {
  let totalChannels = 0;
  let totalFetched = 0;
  let totalInserted = 0;

  for (const channelConfig of TELEGRAM_CHANNELS) {
    try {
      const { fetched, inserted } = await processChannel(channelConfig);
      totalChannels++;
      totalFetched += fetched;
      totalInserted += inserted;
      console.log(
        `[telegram-scraper] ${channelConfig.name}: new=${fetched} inserted=${inserted}`,
      );
    } catch (err) {
      console.warn(
        `[telegram-scraper] warning: failed to process channel "${channelConfig.name}" (${channelConfig.channel}):`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(
    `[telegram-scraper] cycle complete: channels=${totalChannels}/${TELEGRAM_CHANNELS.length} new_messages=${totalFetched} inserted=${totalInserted}`,
  );
}

async function main(): Promise<void> {
  console.log(
    `[telegram-scraper] starting (interval=${INTERVAL_MS}ms, channels=${TELEGRAM_CHANNELS.length})`,
  );

  while (running) {
    await runCycle();

    if (running) {
      await sleep(INTERVAL_MS);
    }
  }
}

const shutdown = async () => {
  console.log('[telegram-scraper] shutting down...');
  running = false;
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((err) => {
  console.error('[telegram-scraper] fatal error:', err);
  process.exit(1);
});
