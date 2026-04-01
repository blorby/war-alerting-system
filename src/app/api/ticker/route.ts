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
    case 'strike':
    case 'missile':
      return 'alert';
    case 'thermal':
    case 'seismic':
      return 'thermal';
    case 'social':
      return 'social';
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
      text: e.locationName ? `${e.title} — ${e.locationName}` : e.title,
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
