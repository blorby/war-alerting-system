import { db } from '@/lib/db';
import { threatAssessments, countryThreats } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [assessment] = await db
      .select()
      .from(threatAssessments)
      .orderBy(desc(threatAssessments.createdAt))
      .limit(1);

    if (!assessment) {
      return Response.json({ assessment: null });
    }

    const countries = await db
      .select()
      .from(countryThreats)
      .where(eq(countryThreats.assessmentId, assessment.id));

    return Response.json({
      assessment: {
        ...assessment,
        overallScore: parseFloat(assessment.overallScore),
        countries: countries.map((c) => ({
          ...c,
          score: parseFloat(c.score),
        })),
      },
    });
  } catch (err) {
    console.error('GET /api/threat error:', err);
    return Response.json(
      { error: 'Failed to fetch threat assessment' },
      { status: 500 },
    );
  }
}
