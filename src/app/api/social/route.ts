import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(events)
      .where(eq(events.type, 'social'))
      .orderBy(desc(events.timestamp))
      .limit(50);

    const items = rows.map((r) => {
      const meta = (r.metadata as Record<string, unknown>) ?? {};
      return {
        id: r.id,
        channel: (meta.channel as string) ?? r.source,
        channelUrl:
          (meta.channelUrl as string) ?? `https://t.me/${r.source}`,
        text: r.description ?? r.title,
        messageUrl: (meta.messageUrl as string) ?? null,
        credibility: (meta.credibility as number) ?? 50,
        verified: r.corroborated,
        platform: (meta.platform as string) ?? 'Telegram',
        timestamp: r.timestamp.toISOString(),
      };
    });

    return Response.json({ items });
  } catch (err) {
    console.error('GET /api/social error:', err);
    return Response.json(
      { error: 'Failed to fetch social' },
      { status: 500 },
    );
  }
}
