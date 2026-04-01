import { db } from '@/lib/db';
import { threatAssessments } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(threatAssessments)
      .orderBy(desc(threatAssessments.createdAt))
      .limit(1);

    if (rows.length === 0) {
      return Response.json({ digest: null });
    }

    const row = rows[0];
    return Response.json({
      digest: {
        summary: row.overallText,
        bullets: [row.situationText, row.trendText],
        generatedAt: row.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('GET /api/digest error:', err);
    return Response.json(
      { error: 'Failed to fetch digest' },
      { status: 500 },
    );
  }
}
