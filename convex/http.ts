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

// POST /api/discord/jobEvent
// body: { agent_id, type: "job_started"|"job_completed", task }
// job_started  → agent status = "running", current_task = task
// job_completed → agent status = "idle",    current_task = undefined
http.route({
  path: "/api/discord/jobEvent",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();

    const agent_id: string = body.agent_id;
    const type: string = body.type;
    const task: string = body.task;

    if (!agent_id || !type || !task) {
      return new Response(
        JSON.stringify({ error: "agent_id, type, task are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    if (type !== "job_started" && type !== "job_completed") {
      return new Response(
        JSON.stringify({ error: "type must be job_started or job_completed" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Insert job event
    await ctx.runMutation(internal.mutations.insertJobEvent, {
      agent_id,
      type: type as "job_started" | "job_completed",
      task,
    });

    // Update agent status to reflect active/idle state
    const agentStatus = type === "job_started" ? "running" : "idle";
    await ctx.runMutation(internal.mutations.upsertAgentStatus, {
      agent_id,
      status: agentStatus,
      current_task: type === "job_started" ? task : undefined,
    });

    return ok();
  }),
});

// POST /api/job/start
// body: { job_id, task, agent_id? }
http.route({
  path: "/api/job/start",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.job_id || !body.task) {
      return new Response(
        JSON.stringify({ error: "job_id and task are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    await ctx.runMutation(internal.mutations.startJobHistory, {
      job_id: body.job_id,
      task: body.task,
      agent_id: body.agent_id ?? undefined,
    });
    return ok();
  }),
});

// POST /api/job/complete
// body: { job_id, duration_ms?, raw_output? }
http.route({
  path: "/api/job/complete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.job_id) {
      return new Response(
        JSON.stringify({ error: "job_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    await ctx.runMutation(internal.mutations.completeJobHistory, {
      job_id: body.job_id,
      duration_ms: body.duration_ms !== undefined ? Number(body.duration_ms) : undefined,
      raw_output: body.raw_output ?? undefined,
    });
    return ok();
  }),
});

// POST /api/job/fail
// body: { job_id, duration_ms?, raw_output? }
http.route({
  path: "/api/job/fail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.job_id) {
      return new Response(
        JSON.stringify({ error: "job_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    await ctx.runMutation(internal.mutations.failJobHistory, {
      job_id: body.job_id,
      duration_ms: body.duration_ms !== undefined ? Number(body.duration_ms) : undefined,
      raw_output: body.raw_output ?? undefined,
    });
    return ok();
  }),
});

// POST /api/calendar/upsert
// body: { event_id, type, title, start_at, ...全フィールド }
http.route({
  path: "/api/calendar/upsert",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.event_id || !body.type || !body.title || !body.start_at) {
      return new Response(
        JSON.stringify({ error: "event_id, type, title, start_at are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    await ctx.runMutation(internal.mutations.upsertCalendarEvent, {
      event_id: body.event_id,
      agent_id: body.agent_id ?? undefined,
      type: body.type,
      title: body.title,
      description: body.description ?? undefined,
      start_at: Number(body.start_at),
      end_at: body.end_at !== undefined ? Number(body.end_at) : undefined,
      cron_expr: body.cron_expr ?? undefined,
      status: body.status ?? undefined,
      last_run_at: body.last_run_at !== undefined ? Number(body.last_run_at) : undefined,
      next_run_at: body.next_run_at !== undefined ? Number(body.next_run_at) : undefined,
    });
    return ok();
  }),
});

// POST /api/calendar/run
// body: { event_id, status, last_run_at, next_run_at? }
http.route({
  path: "/api/calendar/run",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.event_id || !body.status || !body.last_run_at) {
      return new Response(
        JSON.stringify({ error: "event_id, status, last_run_at are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    await ctx.runMutation(internal.mutations.updateCalendarEventRun, {
      event_id: body.event_id,
      status: body.status,
      last_run_at: Number(body.last_run_at),
      next_run_at: body.next_run_at !== undefined ? Number(body.next_run_at) : undefined,
    });
    return ok();
  }),
});

export default http;
