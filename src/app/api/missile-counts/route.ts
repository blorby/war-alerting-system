import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { sql, gte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const SINCE = new Date('2025-02-27T00:00:00Z');

export async function GET() {
  try {
    const rows = await db
      .select({
        day: sql<string>`date_trunc('day', ${events.timestamp})::date`.as(
          'day',
        ),
        alerts: sql<number>`count(*) filter (where ${events.type} = 'alert')`.as(
          'alerts',
        ),
        strikes: sql<number>`count(*) filter (where ${events.type} = 'strike')`.as(
          'strikes',
        ),
      })
      .from(events)
      .where(
        gte(events.timestamp, SINCE),
      )
      .groupBy(sql`date_trunc('day', ${events.timestamp})::date`)
      .orderBy(sql`date_trunc('day', ${events.timestamp})::date`);

    const dates = rows.map((r) => String(r.day));
    const alerts = rows.map((r) => Number(r.alerts));
    const strikes = rows.map((r) => Number(r.strikes));

    return Response.json({
      dates,
      alerts,
      strikes,
      totalAlerts: alerts.reduce((a, b) => a + b, 0),
      totalStrikes: strikes.reduce((a, b) => a + b, 0),
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
