import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function verifyBearer(request: Request): boolean {
  const auth = request.headers.get("Authorization");
  if (!auth) return false;
  return auth.replace("Bearer ", "") === process.env.OPENCLAW_SECRET;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function ok(data?: unknown): Response {
  return new Response(JSON.stringify(data ?? { ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /api/openclaw/heartbeat
// body: { agent_id (必須), status, current_task?, current_model? }
http.route({
  path: "/api/openclaw/heartbeat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();

    if (!body.agent_id || typeof body.agent_id !== "string") {
      return new Response(
        JSON.stringify({ error: "agent_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const status = body.status;
    if (!["running", "idle", "stopped"].includes(status)) {
      return new Response(
        JSON.stringify({ error: `Invalid status: ${status}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await ctx.runMutation(internal.mutations.upsertAgentStatus, {
      agent_id: body.agent_id,
      status,
      current_task: body.current_task ?? undefined,
      current_model: body.current_model ?? undefined,
    });
    return ok();
  }),
});

// POST /api/openclaw/model_status
// body: { agent_id (必須), model, remaining_percent, remaining_day_percent?, raw? }
http.route({
  path: "/api/openclaw/model_status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();

    if (!body.agent_id || typeof body.agent_id !== "string") {
      return new Response(
        JSON.stringify({ error: "agent_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await ctx.runMutation(internal.mutations.upsertModelStatus, {
      agent_id: body.agent_id,
      model: body.model,
      remaining_percent: Number(body.remaining_percent),
      remaining_day_percent:
        body.remaining_day_percent !== undefined
          ? Number(body.remaining_day_percent)
          : undefined,
      raw: body.raw ?? undefined,
    });
    return ok();
  }),
});

// POST /api/openclaw/jobStart
http.route({
  path: "/api/openclaw/jobStart",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    await ctx.runMutation(internal.mutations.startJob, {
      job_id: body.job_id,
      title: body.title,
      agent_id: body.agent_id ?? undefined,
    });
    return ok();
  }),
});

// POST /api/openclaw/jobFinish
http.route({
  path: "/api/openclaw/jobFinish",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    await ctx.runMutation(internal.mutations.finishJob, {
      job_id: body.job_id,
      result: body.result,
    });
    return ok();
  }),
});

// POST /api/openclaw/jobFail
http.route({
  path: "/api/openclaw/jobFail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    await ctx.runMutation(internal.mutations.failJob, {
      job_id: body.job_id,
      error: body.error,
    });
    return ok();
  }),
});

// POST /api/openclaw/appendLog
http.route({
  path: "/api/openclaw/appendLog",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    await ctx.runMutation(internal.mutations.appendLog, {
      job_id: body.job_id,
      level: body.level ?? "info",
      message: body.message,
    });
    return ok();
  }),
});

export default http;
