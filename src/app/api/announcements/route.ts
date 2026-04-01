import { db } from '@/lib/db';
import { announcements } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(announcements)
      .where(eq(announcements.isActive, true))
      .orderBy(desc(announcements.createdAt))
      .limit(1);

    if (rows.length === 0) {
      return Response.json({ announcement: null });
    }

    const row = rows[0];
    return Response.json({
      announcement: {
        id: row.id,
        text: row.text,
        createdAt: row.createdAt.toISOString(),
      },
    });
  } catch (err) {
    // Table may not exist yet — return null gracefully
    console.error('GET /api/announcements error:', err);
    return Response.json({ announcement: null });
  }
}
