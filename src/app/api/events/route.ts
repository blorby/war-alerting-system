import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc, eq, and, count, type SQL } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const offset = Number(url.searchParams.get('offset')) || 0;
    const severity = url.searchParams.get('severity');
    const type = url.searchParams.get('type');
    const active = url.searchParams.get('active');

    const conditions: SQL[] = [];

    if (severity) {
      conditions.push(eq(events.severity, severity));
    }
    if (type) {
      conditions.push(eq(events.type, type));
    }
    if (active !== null && active !== undefined && active !== '') {
      conditions.push(eq(events.isActive, active === 'true'));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(events)
        .where(where)
        .orderBy(desc(events.timestamp))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(events)
        .where(where),
    ]);

    return Response.json({ events: rows, total: totalResult[0].count });
  } catch (err) {
    console.error('GET /api/events error:', err);
    return Response.json(
      { error: 'Failed to fetch events' },
      { status: 500 },
    );
  }
}
