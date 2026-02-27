import { query } from "./_generated/server";
import { v } from "convex/values";

/** 特定エージェントのステータスを取得 */
export const getAgentStatus = query({
  args: { agent_id: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = args.agent_id ?? "openclaw-main";
    return await ctx.db
      .query("agents")
      .withIndex("by_agent_id", (q) => q.eq("agent_id", id))
      .unique();
  },
});

/** 全エージェント一覧（Office / Dashboard 用） */
export const getAllAgents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agents").collect();
  },
});

/** 特定エージェントのモデルステータス一覧（updated_at 降順） */
export const getModelStatusForAgent = query({
  args: { agent_id: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const id = args.agent_id ?? "openclaw-main";
    const rows = await ctx.db
      .query("model_status")
      .withIndex("by_agent_id", (q) => q.eq("agent_id", id))
      .collect();
    return rows.sort((a, b) => b.updated_at - a.updated_at);
  },
});

/** 後方互換: 全モデルステータス（updated_at 降順） */
export const getAllModelStatus = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("model_status").collect();
    return rows.sort((a, b) => b.updated_at - a.updated_at);
  },
});

export const getRecentJobs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_started_at")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const getJob = query({
  args: { job_id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_job_id", (q) => q.eq("job_id", args.job_id))
      .unique();
  },
});

export const getRecentJobEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("job_events")
      .withIndex("by_created_at")
      .order("desc")
      .take(args.limit ?? 10);
  },
});

export const getJobLogs = query({
  args: { job_id: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("logs")
      .withIndex("by_job_id_ts", (q) => q.eq("job_id", args.job_id))
      .order("asc")
      .take(args.limit ?? 200);
  },
});

export const getRecentJobHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("job_history")
      .withIndex("by_started_at")
      .order("desc")
      .take(args.limit ?? 10);
  },
});

export const getJobHistoryForAgent = query({
  args: { agent_id: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("job_history")
      .withIndex("by_agent_id", (q) => q.eq("agent_id", args.agent_id))
      .order("desc")
      .take(args.limit ?? 10);
    return rows.sort((a, b) => b.started_at - a.started_at);
  },
});

export const getCalendarEventsInRange = query({
  args: { start: v.number(), end: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("calendar_events")
      .withIndex("by_start_at", (q) =>
        q.gte("start_at", args.start).lte("start_at", args.end)
      )
      .order("asc")
      .collect();
  },
});

export const getAllCalendarEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("calendar_events")
      .withIndex("by_start_at")
      .order("asc")
      .take(args.limit ?? 200);
  },
});
