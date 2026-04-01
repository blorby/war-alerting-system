import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { gte, desc } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { events, threatAssessments, countryThreats } from '../lib/db/schema';

// --- Database setup ---

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { events, threatAssessments, countryThreats } });

// --- Anthropic setup ---

const anthropic = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6-20250514';

// --- Interval ---

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// --- Prompts ---

const SYSTEM_PROMPT = `You are a military intelligence analyst producing structured threat assessments focused on Israel and the Middle East. You analyze incoming OSINT event data and produce a JSON threat assessment.

Your output MUST be valid JSON with this exact structure:
{
  "overall_score": <number 1.0-10.0>,
  "overall_trend": "<rising|falling|stable>",
  "situation_text": "<1-3 sentence situational summary>",
  "trend_text": "<1-2 sentence trend analysis>",
  "overall_text": "<1-2 sentence overall assessment>",
  "countries": [
    {
      "country_code": "<ISO 2-letter code>",
      "country_name": "<full name>",
      "score": <number 1.0-10.0>,
      "trend": "<rising|falling|stable>",
      "summary": "<1-2 sentence summary>"
    }
  ]
}

Score scale: 1.0 = minimal threat, 10.0 = maximum threat.
Only include countries that are directly relevant to the current events. Do not pad with irrelevant countries.
Output ONLY the JSON object, no markdown fences, no commentary.`;

// --- Types ---

interface Digest {
  totalEvents: number;
  activeEvents: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byLocation: Record<string, number>;
  recentAlerts: string[];
}

interface CountryAssessment {
  country_code: string;
  country_name: string;
  score: number;
  trend: string;
  summary: string;
}

interface Assessment {
  overall_score: number;
  overall_trend: string;
  situation_text: string;
  trend_text: string;
  overall_text: string;
  countries?: CountryAssessment[];
}

// --- Functions ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildDigest(): Promise<Digest> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Fetch all events from the last 24 hours
  const recentEvents = await db
    .select()
    .from(events)
    .where(gte(events.timestamp, twentyFourHoursAgo))
    .orderBy(desc(events.timestamp));

  const totalEvents = recentEvents.length;
  const activeEvents = recentEvents.filter((e) => e.isActive).length;

  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byLocation: Record<string, number> = {};

  for (const event of recentEvents) {
    byType[event.type] = (byType[event.type] || 0) + 1;
    bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;
    if (event.locationName) {
      byLocation[event.locationName] = (byLocation[event.locationName] || 0) + 1;
    }
  }

  // Format last 20 events as alert strings
  const recentAlerts = recentEvents.slice(0, 20).map((e) => {
    const time = e.timestamp.toISOString().slice(11, 16); // HH:MM
    const loc = e.locationName || 'unknown';
    return `[${e.severity}] ${time} — ${e.title} @ ${loc}`;
  });

  return { totalEvents, activeEvents, byType, bySeverity, byLocation, recentAlerts };
}

function buildUserPrompt(digest: Digest): string {
  // Top 15 locations by count
  const topLocations = Object.entries(digest.byLocation)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, n]) => `${name}: ${n}`)
    .join(', ');

  const typeBreakdown = Object.entries(digest.byType)
    .map(([t, n]) => `${t}: ${n}`)
    .join(', ');

  const severityBreakdown = Object.entries(digest.bySeverity)
    .map(([s, n]) => `${s}: ${n}`)
    .join(', ');

  return `Analyze the following event digest and produce a threat assessment as JSON.

Total events (24h): ${digest.totalEvents}
Active events: ${digest.activeEvents}

Type breakdown: ${typeBreakdown || 'none'}
Severity breakdown: ${severityBreakdown || 'none'}

Top 15 locations: ${topLocations || 'none'}

Last 20 events:
${digest.recentAlerts.length > 0 ? digest.recentAlerts.join('\n') : '(no recent events)'}

Respond with a JSON object containing: overall_score, overall_trend, situation_text, trend_text, overall_text, and a countries array.`;
}

async function runAssessment(): Promise<void> {
  const digest = await buildDigest();

  if (digest.totalEvents === 0) {
    console.log('[ai-assessment] no events in last 24h, skipping cycle');
    return;
  }

  console.log(
    `[ai-assessment] digest: total=${digest.totalEvents} active=${digest.activeEvents} types=${Object.keys(digest.byType).length}`,
  );

  const userPrompt = buildUserPrompt(digest);

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  // Extract text from response
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    console.error('[ai-assessment] no text block in response');
    return;
  }

  const raw = textBlock.text.trim();

  let assessment: Assessment;
  try {
    assessment = JSON.parse(raw) as Assessment;
  } catch (err) {
    console.error(
      '[ai-assessment] failed to parse JSON from Claude:',
      raw.slice(0, 200),
    );
    return;
  }

  // Write to DB
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

  console.log(`[ai-assessment] wrote assessment id=${inserted.id} score=${assessment.overall_score}`);

  // Insert country threats
  if (assessment.countries?.length) {
    for (const country of assessment.countries) {
      await db.insert(countryThreats).values({
        assessmentId: inserted.id,
        countryCode: country.country_code,
        countryName: country.country_name,
        score: country.score.toFixed(1),
        trend: country.trend,
        summary: country.summary,
      });
    }
    console.log(`[ai-assessment] wrote ${assessment.countries.length} country threats`);
  }
}

// --- Main loop ---

let running = true;

const shutdown = async () => {
  console.log('[ai-assessment] shutting down...');
  running = false;
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function main(): Promise<void> {
  console.log(`[ai-assessment] starting (interval=${INTERVAL_MS}ms, model=${MODEL})`);

  while (running) {
    try {
      await runAssessment();
    } catch (err) {
      console.error('[ai-assessment] error:', err instanceof Error ? err.message : err);
    }

    if (running) {
      await sleep(INTERVAL_MS);
    }
  }
}

main();
