import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc, eq, and, isNotNull } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const MIL_PREFIXES = ['RCH', 'FORTE'];

function isMilitary(callsign: string, meta: Record<string, unknown>): boolean {
  if (meta.military) return true;
  return MIL_PREFIXES.some((p) => callsign.toUpperCase().startsWith(p));
}

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.type, 'flight'),
          eq(events.isActive, true),
          isNotNull(events.lat),
          isNotNull(events.lng),
        ),
      )
      .orderBy(desc(events.timestamp))
      .limit(100);

    const items = rows.map((r) => {
      const meta = (r.metadata as Record<string, unknown>) ?? {};
      const callsign = (meta.callsign as string) ?? '-';
      const mil = isMilitary(callsign, meta);
      return {
        id: r.id,
        callsign,
        type: mil ? 'MIL' : (meta.aircraftType as string) ?? '-',
        altitude: (meta.altitude as number) ?? 0,
        speed: (meta.speed as number) ?? 0,
        heading: (meta.heading as number) ?? 0,
        status: (meta.status as string) ?? 'unknown',
        isMilitary: mil,
        lat: r.lat,
        lng: r.lng,
        timestamp: r.timestamp.toISOString(),
      };
    });

    return Response.json({ items });
  } catch (err) {
    console.error('GET /api/flights error:', err);
    return Response.json(
      { error: 'Failed to fetch flights' },
      { status: 500 },
    );
  }
}
