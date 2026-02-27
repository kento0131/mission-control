import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getConvexUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";
}

export async function GET(req: Request) {
  const convexUrl = getConvexUrl();
  if (!convexUrl) {
    return new Response("Missing NEXT_PUBLIC_CONVEX_URL", { status: 500 });
  }

  const client = new ConvexHttpClient(convexUrl);
  const encoder = new TextEncoder();
  let closed = false;
  let lastEventId = "";

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        if (closed) return;
        try {
          const events = await client.query(api.queries.getRecentJobEvents, { limit: 1 });
          const latest = events?.[0];
          if (latest && latest._id !== lastEventId) {
            lastEventId = latest._id;
            push("job", {
              id: latest._id,
              type: latest.type,
              agent_id: latest.agent_id,
              task: latest.task,
              created_at: latest.created_at,
            });
          } else {
            push("heartbeat", { ts: Date.now() });
          }
        } catch (e) {
          push("error", { message: e instanceof Error ? e.message : String(e) });
        }
      };

      // immediate + every second (M4 target)
      poll();
      const timer = setInterval(poll, 1000);

      const onAbort = () => {
        closed = true;
        clearInterval(timer);
        controller.close();
      };

      req.signal.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
