import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(events)
      .where(eq(events.type, 'news'))
      .orderBy(desc(events.timestamp))
      .limit(50);

    const items = rows.map((r) => {
      const meta = (r.metadata as Record<string, unknown>) ?? {};
      return {
        id: r.id,
        title: r.title,
        url: (meta.url as string) ?? null,
        source: r.source,
        category: (meta.category as string) ?? 'news',
        timestamp: r.timestamp.toISOString(),
      };
    });

    return Response.json({ items });
  } catch (err) {
    console.error('GET /api/news error:', err);
    return Response.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
