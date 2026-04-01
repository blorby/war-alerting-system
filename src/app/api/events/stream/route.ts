import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc, gt } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let lastCheck = new Date();

      // Send initial keepalive
      controller.enqueue(encoder.encode(': keepalive\n\n'));

      intervalId = setInterval(async () => {
        try {
          const newEvents = await db
            .select()
            .from(events)
            .where(gt(events.ingestedAt, lastCheck))
            .orderBy(desc(events.timestamp));

          if (newEvents.length > 0) {
            lastCheck = new Date();
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ events: newEvents })}\n\n`),
            );
          }
        } catch (err) {
          console.error('SSE poll error:', err);
        }
      }, 5000);

      request.signal.addEventListener('abort', () => {
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }
        controller.close();
      });
    },
    cancel() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
