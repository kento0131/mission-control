import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getConvexUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL || "";
}

export async function GET() {
  const convexUrl = getConvexUrl();
  if (!convexUrl) {
    return Response.json({ error: "Missing NEXT_PUBLIC_CONVEX_URL" }, { status: 500 });
  }

  const client = new ConvexHttpClient(convexUrl);
  const [agents, models, jobs, events] = await Promise.all([
    client.query(api.queries.getAllAgents, {}),
    client.query(api.queries.getAllModelStatus, {}),
    client.query(api.queries.getRecentJobs, { limit: 20 }),
    client.query(api.queries.getRecentJobEvents, { limit: 20 }),
  ]);

  return Response.json({
    ts: Date.now(),
    agents,
    models,
    jobs,
    events,
  });
}
