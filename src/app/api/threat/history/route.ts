import { db } from '@/lib/db';
import { threatAssessments } from '@/lib/db/schema';
import { desc, gte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const RANGE_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const range = url.searchParams.get('range') ?? '24h';
    const ms = RANGE_MS[range] ?? RANGE_MS['24h'];
    const since = new Date(Date.now() - ms);

    const rows = await db
      .select({
        createdAt: threatAssessments.createdAt,
        overallScore: threatAssessments.overallScore,
      })
      .from(threatAssessments)
      .where(gte(threatAssessments.createdAt, since))
      .orderBy(desc(threatAssessments.createdAt));

    const history = rows.map((r) => ({
      timestamp: r.createdAt.toISOString(),
      score: Number(r.overallScore),
    }));

    return Response.json({ history });
  } catch (err) {
    console.error('GET /api/threat/history error:', err);
    return Response.json(
      { error: 'Failed to fetch threat history' },
      { status: 500 },
    );
  }
}
