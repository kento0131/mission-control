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
  })
    .index("by_agent_id", ["agent_id"])
    .index("by_last_seen", ["last_seen"]),

  // agent_id + model で 1 行
  model_status: defineTable({
    agent_id: v.string(),
    model: v.string(),
    remaining_percent: v.number(),
    remaining_day_percent: v.optional(v.number()),
    raw: v.optional(v.string()),
    updated_at: v.number(),
  })
    .index("by_agent_id", ["agent_id"])
    .index("by_updated_at", ["updated_at"]),

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
  })
    .index("by_job_id_ts", ["job_id", "ts"])
    .index("by_ts", ["ts"]),

  // Discord bot → Mission Control ジョブイベント
  job_events: defineTable({
    agent_id: v.string(),
    type: v.union(v.literal("job_started"), v.literal("job_completed")),
    task: v.string(),
    created_at: v.number(),
  })
    .index("by_agent_id", ["agent_id"])
    .index("by_created_at", ["created_at"]),

  // 統合ジョブ追跡テーブル
  job_history: defineTable({
    job_id: v.string(),
    agent_id: v.optional(v.string()),
    task: v.string(),
    status: v.union(
      v.literal("started"),
      v.literal("completed"),
      v.literal("failed")
    ),
    started_at: v.number(),
    completed_at: v.optional(v.number()),
    duration_ms: v.optional(v.number()),
    raw_output: v.optional(v.string()),
    meta: v.optional(v.any()),
  })
    .index("by_job_id", ["job_id"])
    .index("by_agent_id", ["agent_id"])
    .index("by_started_at", ["started_at"]),

  // カレンダーイベント
  calendar_events: defineTable({
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
    created_at: v.number(),
    updated_at: v.number(),
  })
    .index("by_event_id", ["event_id"])
    .index("by_start_at", ["start_at"])
    .index("by_agent_id", ["agent_id"]),
});
