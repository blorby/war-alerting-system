import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface TickerItem {
  id: string;
  text: string;
  type: string;
  timestamp: Date;
}

function mapTickerType(eventType: string): string {
  switch (eventType) {
    case 'alert':
      return 'alert';
    case 'seismic':
      return 'thermal';
    default:
      return 'news';
  }
}

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(events)
      .orderBy(desc(events.timestamp))
      .limit(20);

    const items: TickerItem[] = rows.map((e) => ({
      id: e.id,
      text: `${e.title} — ${e.locationName}`,
      type: mapTickerType(e.type),
      timestamp: e.timestamp,
    }));

    return Response.json({ items });
  } catch (err) {
    console.error('GET /api/ticker error:', err);
    return Response.json(
      { error: 'Failed to fetch ticker items' },
      { status: 500 },
    );
  }
}
