import { db } from '@/lib/db';
import { events, threatAssessments } from '@/lib/db/schema';
import { desc, gte, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [lastEventResult, lastAssessmentResult, eventCountResult] =
      await Promise.all([
        db
          .select({ timestamp: events.timestamp })
          .from(events)
          .orderBy(desc(events.timestamp))
          .limit(1),
        db
          .select({ createdAt: threatAssessments.createdAt })
          .from(threatAssessments)
          .orderBy(desc(threatAssessments.createdAt))
          .limit(1),
        db
          .select({ count: count() })
          .from(events)
          .where(gte(events.timestamp, twentyFourHoursAgo)),
      ]);

    return Response.json({
      db: 'ok',
      lastEvent: lastEventResult[0]?.timestamp ?? null,
      lastAssessment: lastAssessmentResult[0]?.createdAt ?? null,
      eventCount24h: eventCountResult[0].count,
    });
  } catch (err) {
    console.error('GET /api/status error:', err);
    return Response.json(
      { error: 'Failed to fetch status' },
      { status: 500 },
    );
  }
}
