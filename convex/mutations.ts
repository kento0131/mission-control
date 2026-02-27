import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const upsertAgentStatus = internalMutation({
  args: {
    agent_id: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("idle"),
      v.literal("stopped")
    ),
    current_task: v.optional(v.string()),
    current_model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_agent_id", (q) => q.eq("agent_id", args.agent_id))
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        current_task: args.current_task,
        current_model: args.current_model,
        last_seen: now,
      });
    } else {
      await ctx.db.insert("agents", {
        agent_id: args.agent_id,
        status: args.status,
        current_task: args.current_task,
        current_model: args.current_model,
        last_seen: now,
      });
    }
  },
});

export const upsertModelStatus = internalMutation({
  args: {
    agent_id: v.string(),
    model: v.string(),
    remaining_percent: v.number(),
    remaining_day_percent: v.optional(v.number()),
    raw: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // agent_id で絞り込み、同モデル名のレコードを探す
    const rows = await ctx.db
      .query("model_status")
      .withIndex("by_agent_id", (q) => q.eq("agent_id", args.agent_id))
      .collect();
    const existing = rows.find((r) => r.model === args.model);

    if (existing) {
      await ctx.db.patch(existing._id, {
        remaining_percent: args.remaining_percent,
        remaining_day_percent: args.remaining_day_percent,
        raw: args.raw,
        updated_at: now,
      });
    } else {
      await ctx.db.insert("model_status", {
        agent_id: args.agent_id,
        model: args.model,
        remaining_percent: args.remaining_percent,
        remaining_day_percent: args.remaining_day_percent,
        raw: args.raw,
        updated_at: now,
      });
    }
  },
});

export const startJob = internalMutation({
  args: { job_id: v.string(), title: v.string(), agent_id: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("job_id", args.job_id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { status: "running", started_at: Date.now() });
    } else {
      await ctx.db.insert("jobs", {
        job_id: args.job_id,
        agent_id: args.agent_id,
        title: args.title,
        status: "running",
        started_at: Date.now(),
      });
    }
  },
});

export const finishJob = internalMutation({
  args: { job_id: v.string(), result: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("job_id", args.job_id))
      .unique();
    if (job) {
      await ctx.db.patch(job._id, { status: "success", finished_at: Date.now(), result: args.result });
    }
  },
});

export const failJob = internalMutation({
  args: { job_id: v.string(), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("job_id", args.job_id))
      .unique();
    if (job) {
      await ctx.db.patch(job._id, { status: "failed", finished_at: Date.now(), error: args.error });
    }
  },
});

export const insertJobEvent = internalMutation({
  args: {
    agent_id: v.string(),
    type: v.union(v.literal("job_started"), v.literal("job_completed")),
    task: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("job_events", {
      agent_id: args.agent_id,
      type: args.type,
      task: args.task,
      created_at: Date.now(),
    });
  },
});

export const startJobHistory = internalMutation({
  args: {
    job_id: v.string(),
    task: v.string(),
    agent_id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("job_history")
      .withIndex("by_job_id", (q) => q.eq("job_id", args.job_id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { status: "started", started_at: Date.now() });
    } else {
      await ctx.db.insert("job_history", {
        job_id: args.job_id,
        agent_id: args.agent_id,
        task: args.task,
        status: "started",
        started_at: Date.now(),
      });
    }
  },
});

export const completeJobHistory = internalMutation({
  args: {
    job_id: v.string(),
    duration_ms: v.optional(v.number()),
    raw_output: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("job_history")
      .withIndex("by_job_id", (q) => q.eq("job_id", args.job_id))
      .unique();
    if (job) {
      await ctx.db.patch(job._id, {
        status: "completed",
        completed_at: Date.now(),
        duration_ms: args.duration_ms,
        raw_output: args.raw_output,
      });
    }
  },
});

export const failJobHistory = internalMutation({
  args: {
    job_id: v.string(),
    duration_ms: v.optional(v.number()),
    raw_output: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("job_history")
      .withIndex("by_job_id", (q) => q.eq("job_id", args.job_id))
      .unique();
    if (job) {
      await ctx.db.patch(job._id, {
        status: "failed",
        completed_at: Date.now(),
        duration_ms: args.duration_ms,
        raw_output: args.raw_output,
      });
    }
  },
});

export const upsertCalendarEvent = internalMutation({
  args: {
    event_id: v.string(),
    agent_id: v.optional(v.string()),
    type: v.union(
      v.literal("scheduled_task"),
      v.literal("cron"),
      v.literal("deadline"),
      v.literal("event")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    start_at: v.number(),
    end_at: v.optional(v.number()),
    cron_expr: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("scheduled"),
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("skipped")
    )),
    last_run_at: v.optional(v.number()),
    next_run_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("calendar_events")
      .withIndex("by_event_id", (q) => q.eq("event_id", args.event_id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        agent_id: args.agent_id,
        type: args.type,
        title: args.title,
        description: args.description,
        start_at: args.start_at,
        end_at: args.end_at,
        cron_expr: args.cron_expr,
        status: args.status,
        last_run_at: args.last_run_at,
        next_run_at: args.next_run_at,
        updated_at: now,
      });
    } else {
      await ctx.db.insert("calendar_events", {
        event_id: args.event_id,
        agent_id: args.agent_id,
        type: args.type,
        title: args.title,
        description: args.description,
        start_at: args.start_at,
        end_at: args.end_at,
        cron_expr: args.cron_expr,
        status: args.status,
        last_run_at: args.last_run_at,
        next_run_at: args.next_run_at,
        created_at: now,
        updated_at: now,
      });
    }
  },
});

export const updateCalendarEventRun = internalMutation({
  args: {
    event_id: v.string(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("running"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    last_run_at: v.number(),
    next_run_at: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("calendar_events")
      .withIndex("by_event_id", (q) => q.eq("event_id", args.event_id))
      .unique();
    if (event) {
      await ctx.db.patch(event._id, {
        status: args.status,
        last_run_at: args.last_run_at,
        next_run_at: args.next_run_at,
        updated_at: Date.now(),
      });
    }
  },
});

export const appendLog = internalMutation({
  args: {
    job_id: v.string(),
    level: v.union(
      v.literal("info"),
      v.literal("warn"),
      v.literal("error"),
      v.literal("debug")
    ),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("logs", {
      job_id: args.job_id,
      ts: Date.now(),
      level: args.level,
      message: args.message,
    });
  },
});
