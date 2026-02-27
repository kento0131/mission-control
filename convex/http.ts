import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// ── 認証 ────────────────────────────────────────────────
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

function badRequest(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * 制御文字 (U+0000–U+001F, U+007F) を除去し、日本語/Unicode は保持する。
 * ASCII-only フィールドには使わない（agent_id など識別子は呼び出し元でバリデート済み）。
 */
function sanitizeStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const cleaned = v.replace(/[\x00-\x1F\x7F]/g, "").trim();
  return cleaned || undefined;
}

// ── POST /api/openclaw/heartbeat ─────────────────────────
// body: { agent_id (必須), status, current_task?, current_model? }
http.route({
  path: "/api/openclaw/heartbeat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();

    if (!body.agent_id || typeof body.agent_id !== "string") {
      return badRequest("agent_id is required");
    }

    const status = body.status;
    if (!["running", "idle", "stopped"].includes(status)) {
      return badRequest(`Invalid status: ${status}`);
    }

    await ctx.runMutation(internal.mutations.upsertAgentStatus, {
      agent_id: body.agent_id,
      status,
      current_task:  sanitizeStr(body.current_task),
      current_model: sanitizeStr(body.current_model),
    });
    return ok();
  }),
});

// ── POST /api/openclaw/model_status ──────────────────────
// body: { agent_id (必須), model (必須), remaining_percent (必須), remaining_day_percent?, raw? }
http.route({
  path: "/api/openclaw/model_status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();

    if (!body.agent_id || typeof body.agent_id !== "string") {
      return badRequest("agent_id is required");
    }
    if (!body.model || typeof body.model !== "string") {
      return badRequest("model is required");
    }
    const remaining_percent = Number(body.remaining_percent);
    if (isNaN(remaining_percent)) {
      return badRequest("remaining_percent must be a number");
    }

    await ctx.runMutation(internal.mutations.upsertModelStatus, {
      agent_id:             body.agent_id,
      model:                sanitizeStr(body.model) ?? body.model,
      remaining_percent,
      remaining_day_percent:
        body.remaining_day_percent !== undefined
          ? Number(body.remaining_day_percent)
          : undefined,
      raw: sanitizeStr(body.raw),
    });
    return ok();
  }),
});

// ── POST /api/openclaw/jobStart ──────────────────────────
http.route({
  path: "/api/openclaw/jobStart",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.job_id || !body.title) return badRequest("job_id and title are required");
    await ctx.runMutation(internal.mutations.startJob, {
      job_id:   body.job_id,
      title:    sanitizeStr(body.title) ?? body.title,
      agent_id: body.agent_id ?? undefined,
    });
    return ok();
  }),
});

// ── POST /api/openclaw/jobFinish ─────────────────────────
http.route({
  path: "/api/openclaw/jobFinish",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.job_id) return badRequest("job_id is required");
    await ctx.runMutation(internal.mutations.finishJob, {
      job_id: body.job_id,
      result: sanitizeStr(body.result),
    });
    return ok();
  }),
});

// ── POST /api/openclaw/jobFail ───────────────────────────
http.route({
  path: "/api/openclaw/jobFail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.job_id) return badRequest("job_id is required");
    await ctx.runMutation(internal.mutations.failJob, {
      job_id: body.job_id,
      error:  sanitizeStr(body.error),
    });
    return ok();
  }),
});

// ── POST /api/openclaw/appendLog ─────────────────────────
http.route({
  path: "/api/openclaw/appendLog",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.job_id || !body.message) return badRequest("job_id and message are required");
    await ctx.runMutation(internal.mutations.appendLog, {
      job_id:  body.job_id,
      level:   body.level ?? "info",
      message: sanitizeStr(body.message) ?? body.message,
    });
    return ok();
  }),
});

// ── POST /api/discord/jobEvent ───────────────────────────
// body: { agent_id, type: "job_started"|"job_completed"|"job_failed", task, job_id? }
//
// job_started  → agents=running + jobs=running + logs(開始) + job_events
// job_completed → agents=idle  + jobs=success + logs(完了) + job_events
// job_failed   → agents=idle  + jobs=failed  + logs(失敗) + job_events
//
// job_id は省略可能。省略時は "discord-{agent_id}" を使用（エージェントごとに1アクティブジョブ）。
http.route({
  path: "/api/discord/jobEvent",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();

    const agent_id: string = body.agent_id;
    const type: string     = body.type;
    const task: string     = sanitizeStr(body.task) ?? body.task ?? "";

    if (!agent_id || !type || !task) {
      return badRequest("agent_id, type, task are required");
    }
    if (!["job_started", "job_completed", "job_failed"].includes(type)) {
      return badRequest("type must be job_started, job_completed, or job_failed");
    }

    // job_id: リクエスト指定 or エージェントごとの固定 ID（"discord-{agent_id}"）
    const job_id: string = sanitizeStr(body.job_id) ?? `discord-${agent_id}`;
    const now = Date.now();

    if (type === "job_started") {
      // jobs テーブルへ書き込み (upsert)
      await ctx.runMutation(internal.mutations.startJob, {
        job_id,
        title: task,
        agent_id,
      });
      // logs テーブルへ書き込み
      await ctx.runMutation(internal.mutations.appendLog, {
        job_id,
        level:   "info",
        message: `[job_started] ${task}`,
      });
      // job_events テーブル (後方互換)
      await ctx.runMutation(internal.mutations.insertJobEvent, {
        agent_id,
        type: "job_started",
        task,
      });
      // agents テーブル
      await ctx.runMutation(internal.mutations.upsertAgentStatus, {
        agent_id,
        status: "running",
        current_task: task,
      });

    } else if (type === "job_completed") {
      // jobs テーブルを success に更新
      await ctx.runMutation(internal.mutations.finishJob, {
        job_id,
        result: task,
      });
      // logs テーブルへ書き込み
      await ctx.runMutation(internal.mutations.appendLog, {
        job_id,
        level:   "info",
        message: `[job_completed] ${task}`,
      });
      // job_events テーブル (後方互換)
      await ctx.runMutation(internal.mutations.insertJobEvent, {
        agent_id,
        type: "job_completed",
        task,
      });
      // agents テーブル
      await ctx.runMutation(internal.mutations.upsertAgentStatus, {
        agent_id,
        status:       "idle",
        current_task: undefined,
      });

    } else {
      // job_failed
      await ctx.runMutation(internal.mutations.failJob, {
        job_id,
        error: task,
      });
      await ctx.runMutation(internal.mutations.appendLog, {
        job_id,
        level:   "error",
        message: `[job_failed] ${task}`,
      });
      // job_events (job_failed は insertJobEvent の type 定義外なので job_completed で代用)
      await ctx.runMutation(internal.mutations.insertJobEvent, {
        agent_id,
        type: "job_completed",
        task,
      });
      await ctx.runMutation(internal.mutations.upsertAgentStatus, {
        agent_id,
        status:       "idle",
        current_task: undefined,
      });
    }

    return ok({ ok: true, job_id, ts: now });
  }),
});

// ── POST /api/job/start ──────────────────────────────────
// body: { job_id, task, agent_id? }
http.route({
  path: "/api/job/start",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.job_id || !body.task) return badRequest("job_id and task are required");
    await ctx.runMutation(internal.mutations.startJobHistory, {
      job_id:   body.job_id,
      task:     sanitizeStr(body.task) ?? body.task,
      agent_id: body.agent_id ?? undefined,
    });
    return ok();
  }),
});

// ── POST /api/job/complete ───────────────────────────────
// body: { job_id, duration_ms?, raw_output? }
http.route({
  path: "/api/job/complete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.job_id) return badRequest("job_id is required");
    await ctx.runMutation(internal.mutations.completeJobHistory, {
      job_id:     body.job_id,
      duration_ms: body.duration_ms !== undefined ? Number(body.duration_ms) : undefined,
      raw_output:  sanitizeStr(body.raw_output),
    });
    return ok();
  }),
});

// ── POST /api/job/fail ───────────────────────────────────
// body: { job_id, duration_ms?, raw_output? }
http.route({
  path: "/api/job/fail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.job_id) return badRequest("job_id is required");
    await ctx.runMutation(internal.mutations.failJobHistory, {
      job_id:     body.job_id,
      duration_ms: body.duration_ms !== undefined ? Number(body.duration_ms) : undefined,
      raw_output:  sanitizeStr(body.raw_output),
    });
    return ok();
  }),
});

// ── POST /api/calendar/upsert ────────────────────────────
// body: { event_id, type, title, start_at, ...全フィールド }
http.route({
  path: "/api/calendar/upsert",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.event_id || !body.type || !body.title || !body.start_at) {
      return badRequest("event_id, type, title, start_at are required");
    }
    await ctx.runMutation(internal.mutations.upsertCalendarEvent, {
      event_id:    body.event_id,
      agent_id:    body.agent_id ?? undefined,
      type:        body.type,
      title:       sanitizeStr(body.title) ?? body.title,
      description: sanitizeStr(body.description),
      start_at:    Number(body.start_at),
      end_at:      body.end_at !== undefined ? Number(body.end_at) : undefined,
      cron_expr:   sanitizeStr(body.cron_expr),
      status:      body.status ?? undefined,
      last_run_at: body.last_run_at !== undefined ? Number(body.last_run_at) : undefined,
      next_run_at: body.next_run_at !== undefined ? Number(body.next_run_at) : undefined,
    });
    return ok();
  }),
});

// ── POST /api/calendar/run ───────────────────────────────
// body: { event_id, status, last_run_at, next_run_at? }
http.route({
  path: "/api/calendar/run",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyBearer(request)) return unauthorized();
    const body = await request.json();
    if (!body.event_id || !body.status || !body.last_run_at) {
      return badRequest("event_id, status, last_run_at are required");
    }
    await ctx.runMutation(internal.mutations.updateCalendarEventRun, {
      event_id:    body.event_id,
      status:      body.status,
      last_run_at: Number(body.last_run_at),
      next_run_at: body.next_run_at !== undefined ? Number(body.next_run_at) : undefined,
    });
    return ok();
  }),
});

export default http;
