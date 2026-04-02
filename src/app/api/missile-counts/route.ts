import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { sql, gte, and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const SINCE = new Date('2025-02-27T00:00:00Z');

// Hebrew keywords for missile/rocket alerts
const MISSILE_KEYWORD = 'ירי רקטות וטילים';
const UAV_KEYWORD = 'חדירת כלי טיס עוין';

export async function GET() {
  try {
    // Count distinct attack waves per day.
    // Each wave = alerts within the same 5-minute window.
    // Matches both Oref direct (type='alert', exact title) and
    // Telegram HFC (type='social', title/description contains keyword).
    const rows = await db
      .select({
        day: sql<string>`date_trunc('day', ${events.timestamp})::date`.as('day'),
        missiles: sql<number>`count(distinct date_trunc('minute', ${events.timestamp})) filter (where (${events.title} = ${MISSILE_KEYWORD} or (${events.source} = 'telegram-hfc-alerts' and (${events.title} like ${'%' + MISSILE_KEYWORD + '%'} or ${events.description} like ${'%' + MISSILE_KEYWORD + '%'}))) and ${events.severity} = 'critical')`.as('missiles'),
        uavs: sql<number>`count(distinct date_trunc('minute', ${events.timestamp})) filter (where (${events.title} = ${UAV_KEYWORD} or (${events.source} = 'telegram-hfc-alerts' and (${events.title} like ${'%' + UAV_KEYWORD + '%'} or ${events.description} like ${'%' + UAV_KEYWORD + '%'}))) and ${events.severity} = 'critical')`.as('uavs'),
      })
      .from(events)
      .where(
        and(
          gte(events.timestamp, SINCE),
          sql`(${events.type} = 'alert' or (${events.type} = 'social' and ${events.source} = 'telegram-hfc-alerts'))`,
        ),
      )
      .groupBy(sql`date_trunc('day', ${events.timestamp})::date`)
      .orderBy(sql`date_trunc('day', ${events.timestamp})::date`);

    const dates = rows.map((r) => String(r.day));
    const missiles = rows.map((r) => Number(r.missiles));
    const uavs = rows.map((r) => Number(r.uavs));

    return Response.json({
      dates,
      missiles,
      uavs,
      totalMissiles: missiles.reduce((a, b) => a + b, 0),
      totalUavs: uavs.reduce((a, b) => a + b, 0),
      since: SINCE.toISOString(),
    });
  } catch (err) {
    console.error('GET /api/missile-counts error:', err);
    return Response.json(
      { error: 'Failed to fetch missile counts' },
      { status: 500 },
    );
  }
}
