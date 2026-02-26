import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // agent_id ごとに 1 行。"down" はクライアント側で last_seen から計算する。
  agents: defineTable({
    agent_id: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("idle"),
      v.literal("stopped")
    ),
    current_task: v.optional(v.string()),
    current_model: v.optional(v.string()),
    last_seen: v.number(),
  }).index("by_agent_id", ["agent_id"]),

  // agent_id + model で 1 行
  model_status: defineTable({
    agent_id: v.string(),
    model: v.string(),
    remaining_percent: v.number(),
    remaining_day_percent: v.optional(v.number()),
    raw: v.optional(v.string()),
    updated_at: v.number(),
  }).index("by_agent_id", ["agent_id"]),

  jobs: defineTable({
    job_id: v.string(),
    agent_id: v.optional(v.string()),
    title: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("success"),
      v.literal("failed")
    ),
    started_at: v.number(),
    finished_at: v.optional(v.number()),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_job_id", ["job_id"])
    .index("by_started_at", ["started_at"]),

  logs: defineTable({
    job_id: v.string(),
    ts: v.number(),
    level: v.union(
      v.literal("info"),
      v.literal("warn"),
      v.literal("error"),
      v.literal("debug")
    ),
    message: v.string(),
  }).index("by_job_id_ts", ["job_id", "ts"]),
});
