export const ja = {
  // ナビ
  nav: { dashboard: "ダッシュボード", office: "オフィス", jobs: "ジョブ", calendar: "カレンダー" },
  // ステータス
  status: { running: "処理中", idle: "待機中", stopped: "停止中", down: "オフライン" },
  // ランプ
  lamp: { active: "作業中", idle: "待機中", offline: "オフライン" },
  // ジョブ
  job: {
    started: "実行中", completed: "完了", failed: "失敗",
    pending: "待機中", running: "実行中", success: "成功",
    noHistory: "ジョブ履歴はまだありません",
    historyTitle: "ジョブ履歴",
    task: "タスク", duration: "実行時間", startedAt: "開始日時",
  },
  // フィード
  feed: { title: "最近のアクティビティ", empty: "まだアクティビティはありません", loading: "読み込み中..." },
  // カレンダー
  calendar: {
    title: "カレンダー",
    type: { scheduled_task: "スケジュール", cron: "Cron", deadline: "締め切り", event: "イベント" },
    status: { scheduled: "予定", running: "実行中", success: "成功", failed: "失敗", skipped: "スキップ" },
    noEvents: "この月にイベントはありません",
    lastRun: "前回実行", nextRun: "次回実行",
    weekdays: ["日", "月", "火", "水", "木", "金", "土"],
  },
  // エージェント
  agent: { noData: "データなし", lastSeen: "最終確認", task: "タスク", model: "モデル" },
  // 汎用
  common: { agents: "エージェント", active: "稼働中", loading: "読み込み中...", noData: "—" },
} as const;
