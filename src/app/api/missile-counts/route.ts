import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { sql, gte, and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const SINCE = new Date('2025-02-27T00:00:00Z');

// Hebrew titles for missile/rocket alerts
const MISSILE_TITLE = 'ירי רקטות וטילים';
const UAV_TITLE = 'חדירת כלי טיס עוין';

export async function GET() {
  try {
    // Count distinct attack waves per day.
    // Each wave = alerts within the same 5-minute window.
    // This avoids counting each per-district notification as a separate attack.
    const rows = await db
      .select({
        day: sql<string>`date_trunc('day', ${events.timestamp})::date`.as('day'),
        missiles: sql<number>`count(distinct date_trunc('minute', ${events.timestamp})) filter (where ${events.title} = ${MISSILE_TITLE} and ${events.severity} = 'critical')`.as('missiles'),
        uavs: sql<number>`count(distinct date_trunc('minute', ${events.timestamp})) filter (where ${events.title} = ${UAV_TITLE} and ${events.severity} = 'critical')`.as('uavs'),
      })
      .from(events)
      .where(
        and(
          gte(events.timestamp, SINCE),
          eq(events.type, 'alert'),
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
