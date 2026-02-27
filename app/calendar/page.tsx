"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ja } from "../../lib/i18n/ja";

// ── 型 ────────────────────────────────────────────────
type CalendarEvent = {
  _id: string;
  event_id: string;
  agent_id?: string;
  type: "scheduled_task" | "cron" | "deadline" | "event";
  title: string;
  description?: string;
  start_at: number;
  end_at?: number;
  cron_expr?: string;
  status?: "scheduled" | "running" | "success" | "failed" | "skipped";
  last_run_at?: number;
  next_run_at?: number;
};

// ── カラー定義 ─────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  scheduled: "#6b7280",
  running:   "#3b82f6",
  success:   "#22c55e",
  failed:    "#ef4444",
  skipped:   "#eab308",
};

const TYPE_COLOR: Record<string, string> = {
  scheduled_task: "#6366f1",
  cron:           "#8b5cf6",
  deadline:       "#ef4444",
  event:          "#3b82f6",
};

// ── ユーティリティ ─────────────────────────────────────
function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

// ── EventPill ─────────────────────────────────────────
function EventPill({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const color = event.status ? STATUS_COLOR[event.status] ?? "#6b7280" : TYPE_COLOR[event.type] ?? "#6b7280";
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        backgroundColor: `${color}22`,
        border: `1px solid ${color}55`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        padding: "1px 5px",
        fontSize: "0.68rem",
        color,
        cursor: "pointer",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        marginBottom: 2,
      }}
    >
      {event.title}
    </div>
  );
}

// ── EventModal ────────────────────────────────────────
function EventModal({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const statusColor = event.status ? STATUS_COLOR[event.status] ?? "#6b7280" : "#6b7280";
  const typeLabel = ja.calendar.type[event.type] ?? event.type;
  const statusLabel = event.status ? ja.calendar.status[event.status] ?? event.status : "—";

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100 }}
      />
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(480px, 90vw)",
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        zIndex: 101,
        overflow: "hidden",
      }}>
        {/* ヘッダー */}
        <div style={{
          padding: "1rem 1.25rem",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: "0.75rem",
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>{event.title}</p>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{
                fontSize: "0.7rem", fontWeight: 600,
                backgroundColor: `${TYPE_COLOR[event.type] ?? "#6b7280"}22`,
                color: TYPE_COLOR[event.type] ?? "#6b7280",
                padding: "2px 8px", borderRadius: 4,
              }}>{typeLabel}</span>
              {event.status && (
                <span style={{
                  fontSize: "0.7rem", fontWeight: 600,
                  backgroundColor: `${statusColor}22`,
                  color: statusColor,
                  padding: "2px 8px", borderRadius: 4,
                }}>{statusLabel}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.25rem", cursor: "pointer" }}
          >×</button>
        </div>

        {/* 詳細 */}
        <div style={{ padding: "1rem 1.25rem" }}>
          {event.description && (
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              {event.description}
            </p>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {(
                [
                  ["開始", formatDateTime(event.start_at)],
                  ...(event.end_at ? [["終了", formatDateTime(event.end_at)]] : []),
                  ...(event.agent_id ? [["エージェント", event.agent_id]] : []),
                  ...(event.cron_expr ? [["Cron式", event.cron_expr]] : []),
                  ...(event.last_run_at ? [[ja.calendar.lastRun, formatDateTime(event.last_run_at)]] : []),
                  ...(event.next_run_at ? [[ja.calendar.nextRun, formatDateTime(event.next_run_at)]] : []),
                ] as [string, string][]
              ).map(([label, value]) => (
                <tr key={label}>
                  <td style={{ padding: "0.35rem 0", fontSize: "0.75rem", color: "var(--text-muted)", width: 100 }}>
                    {label}
                  </td>
                  <td style={{ padding: "0.35rem 0", fontSize: "0.8rem", fontFamily: value.includes(":") ? "monospace" : "inherit", color: "var(--text)" }}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Month View ────────────────────────────────────────
function MonthView({ year, month, events, onEventClick }: {
  year: number;
  month: number;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  // グリッド開始日（前月の日曜日から）
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  // 6週分のセルを生成
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    cells.push(d);
  }

  // 日付ごとにイベントをグループ化
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.start_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [events]);

  const today = new Date();

  return (
    <div>
      {/* 曜日ヘッダー */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        marginBottom: 4,
      }}>
        {ja.calendar.weekdays.map((wd) => (
          <div key={wd} style={{
            textAlign: "center", fontSize: "0.7rem", fontWeight: 600,
            color: "var(--text-muted)", padding: "4px 0",
          }}>{wd}</div>
        ))}
      </div>

      {/* カレンダーグリッド */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        border: "1px solid var(--border)",
        borderRadius: 8, overflow: "hidden",
      }}>
        {cells.map((cell, i) => {
          const key = `${cell.getFullYear()}-${cell.getMonth()}-${cell.getDate()}`;
          const dayEvents = eventsByDay.get(key) ?? [];
          const isToday = isSameDay(cell, today);
          const isCurrentMonth = cell.getMonth() === month;
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - 3;

          return (
            <div
              key={i}
              style={{
                minHeight: 90,
                padding: "4px 5px",
                borderRight: (i % 7) < 6 ? "1px solid var(--border)" : "none",
                borderBottom: i < 35 ? "1px solid var(--border)" : "none",
                backgroundColor: isToday ? "rgba(59,130,246,0.07)" : "transparent",
              }}
            >
              <div style={{
                fontSize: "0.75rem",
                fontWeight: isToday ? 700 : 400,
                color: isToday ? "#3b82f6" : isCurrentMonth ? "var(--text)" : "var(--text-muted)",
                marginBottom: 3,
                width: 20, height: 20,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "50%",
                backgroundColor: isToday ? "#3b82f622" : "transparent",
              }}>
                {cell.getDate()}
              </div>
              {visible.map((ev) => (
                <EventPill key={ev._id} event={ev} onClick={() => onEventClick(ev)} />
              ))}
              {overflow > 0 && (
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", paddingLeft: 3 }}>
                  +{overflow}件
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ─────────────────────────────────────────
function WeekView({ startDate, events, onEventClick }: {
  startDate: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}) {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const today = new Date();

  // 終日イベント vs 時間指定イベント
  const allDayEvents = events.filter((ev) => {
    const d = new Date(ev.start_at);
    return d.getHours() === 0 && d.getMinutes() === 0 && !ev.end_at;
  });

  const timedEvents = events.filter((ev) => !allDayEvents.includes(ev));

  return (
    <div style={{ overflowX: "auto" }}>
      {/* 終日イベント行 */}
      {allDayEvents.length > 0 && (
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
          <div style={{ width: 48, flexShrink: 0 }} />
          {days.map((day, i) => {
            const dayAllDay = allDayEvents.filter((ev) => isSameDay(new Date(ev.start_at), day));
            return (
              <div key={i} style={{ flex: 1, padding: "4px 2px", minWidth: 80 }}>
                {dayAllDay.map((ev) => (
                  <EventPill key={ev._id} event={ev} onClick={() => onEventClick(ev)} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* 列ヘッダー */}
      <div style={{ display: "flex", marginBottom: 2 }}>
        <div style={{ width: 48, flexShrink: 0 }} />
        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} style={{
              flex: 1, textAlign: "center", minWidth: 80,
              fontSize: "0.75rem",
              color: isToday ? "#3b82f6" : "var(--text-muted)",
              fontWeight: isToday ? 700 : 400,
              paddingBottom: 4,
            }}>
              {ja.calendar.weekdays[day.getDay()]} {day.getDate()}
            </div>
          );
        })}
      </div>

      {/* 時間グリッド */}
      <div style={{ position: "relative", maxHeight: 500, overflowY: "auto" }}>
        {hours.map((h) => (
          <div key={h} style={{ display: "flex", height: 48 }}>
            <div style={{
              width: 48, flexShrink: 0,
              fontSize: "0.65rem", color: "var(--text-muted)",
              textAlign: "right", paddingRight: 6, paddingTop: 2,
            }}>
              {String(h).padStart(2, "0")}:00
            </div>
            {days.map((day, di) => {
              const hourEvents = timedEvents.filter((ev) => {
                const d = new Date(ev.start_at);
                return isSameDay(d, day) && d.getHours() === h;
              });
              return (
                <div key={di} style={{
                  flex: 1, minWidth: 80,
                  borderLeft: "1px solid var(--border)",
                  borderTop: "1px solid var(--border)",
                  padding: "1px 2px",
                  backgroundColor: isSameDay(day, today) ? "rgba(59,130,246,0.04)" : "transparent",
                }}>
                  {hourEvents.map((ev) => (
                    <EventPill key={ev._id} event={ev} onClick={() => onEventClick(ev)} />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Day View ──────────────────────────────────────────
function DayView({ date, events, onEventClick }: {
  date: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
}) {
  const dayEvents = events
    .filter((ev) => isSameDay(new Date(ev.start_at), date))
    .sort((a, b) => a.start_at - b.start_at);

  if (dayEvents.length === 0) {
    return (
      <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", padding: "1rem" }}>
        {ja.calendar.noEvents}
      </p>
    );
  }

  return (
    <div>
      {dayEvents.map((ev) => {
        const color = ev.status ? STATUS_COLOR[ev.status] ?? "#6b7280" : TYPE_COLOR[ev.type] ?? "#6b7280";
        const typeLabel = ja.calendar.type[ev.type] ?? ev.type;
        const statusLabel = ev.status ? ja.calendar.status[ev.status] ?? ev.status : null;

        return (
          <div
            key={ev._id}
            onClick={() => onEventClick(ev)}
            style={{
              display: "flex", gap: "1rem", alignItems: "flex-start",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid var(--border)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <div style={{
              width: 3, alignSelf: "stretch", borderRadius: 2,
              backgroundColor: color, flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 4 }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                  {ev.title}
                </span>
                <span style={{
                  fontSize: "0.65rem", fontWeight: 600,
                  backgroundColor: `${TYPE_COLOR[ev.type] ?? "#6b7280"}22`,
                  color: TYPE_COLOR[ev.type] ?? "#6b7280",
                  padding: "1px 6px", borderRadius: 4,
                }}>{typeLabel}</span>
                {statusLabel && (
                  <span style={{
                    fontSize: "0.65rem", fontWeight: 600,
                    backgroundColor: `${color}22`, color,
                    padding: "1px 6px", borderRadius: 4,
                  }}>{statusLabel}</span>
                )}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {formatTime(ev.start_at)}
                {ev.end_at ? ` 〜 ${formatTime(ev.end_at)}` : ""}
                {ev.agent_id ? ` · ${ev.agent_id}` : ""}
              </div>
              {ev.description && (
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
                  {ev.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── CalendarPage ──────────────────────────────────────
type ViewMode = "month" | "week" | "day";

export default function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const allEvents = useQuery(api.queries.getAllCalendarEvents, { limit: 200 });

  // 表示期間の計算
  const { displayTitle, periodStart, periodEnd } = useMemo(() => {
    if (viewMode === "month") {
      const y = currentDate.getFullYear();
      const m = currentDate.getMonth();
      return {
        displayTitle: `${y}年${m + 1}月`,
        periodStart: new Date(y, m, 1).getTime(),
        periodEnd: new Date(y, m + 1, 0, 23, 59, 59).getTime(),
      };
    } else if (viewMode === "week") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - d.getDay());
      const start = new Date(d);
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      return {
        displayTitle: `${formatDate(start.getTime())} 〜 ${formatDate(end.getTime())}`,
        periodStart: startOfDay(start).getTime(),
        periodEnd: end.setHours(23, 59, 59),
      };
    } else {
      return {
        displayTitle: formatDate(currentDate.getTime()),
        periodStart: startOfDay(currentDate).getTime(),
        periodEnd: startOfDay(currentDate).getTime() + 86399999,
      };
    }
  }, [viewMode, currentDate]);

  // 表示期間内のイベントをフィルタリング
  const visibleEvents = useMemo(() => {
    if (!allEvents) return [];
    return (allEvents as CalendarEvent[]).filter(
      (ev) => ev.start_at >= periodStart && ev.start_at <= periodEnd
    );
  }, [allEvents, periodStart, periodEnd]);

  // ナビゲーション
  function navigate(dir: 1 | -1) {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "month") d.setMonth(d.getMonth() + dir);
      else if (viewMode === "week") d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  }

  // 週の開始日（日曜日）
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [currentDate]);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* ヘッダー */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem",
      }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>{ja.calendar.title}</h1>

        {/* 表示モードタブ */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["month", "week", "day"] as ViewMode[]).map((mode) => {
            const label = mode === "month" ? "月" : mode === "week" ? "週" : "日";
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: "4px 14px",
                  fontSize: "0.8rem",
                  fontWeight: viewMode === mode ? 600 : 400,
                  backgroundColor: viewMode === mode ? "var(--text)" : "transparent",
                  color: viewMode === mode ? "var(--bg)" : "var(--text-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ナビゲーション */}
      <div style={{
        display: "flex", alignItems: "center", gap: "1rem",
        marginBottom: "1rem",
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none", border: "1px solid var(--border)",
            borderRadius: 6, padding: "4px 10px",
            fontSize: "0.875rem", color: "var(--text-muted)", cursor: "pointer",
          }}
        >←</button>
        <span style={{ fontSize: "0.9rem", fontWeight: 600, minWidth: 160, textAlign: "center" }}>
          {displayTitle}
        </span>
        <button
          onClick={() => navigate(1)}
          style={{
            background: "none", border: "1px solid var(--border)",
            borderRadius: 6, padding: "4px 10px",
            fontSize: "0.875rem", color: "var(--text-muted)", cursor: "pointer",
          }}
        >→</button>
        <button
          onClick={() => setCurrentDate(new Date())}
          style={{
            background: "none", border: "1px solid var(--border)",
            borderRadius: 6, padding: "4px 10px",
            fontSize: "0.8rem", color: "var(--text-muted)", cursor: "pointer",
          }}
        >今日</button>
      </div>

      {/* カレンダー本体 */}
      <div style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
        overflow: "hidden",
        padding: viewMode === "month" ? "0.75rem" : "0",
      }}>
        {allEvents === undefined ? (
          <p style={{ padding: "1rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
            {ja.common.loading}
          </p>
        ) : viewMode === "month" ? (
          <MonthView
            year={currentDate.getFullYear()}
            month={currentDate.getMonth()}
            events={visibleEvents}
            onEventClick={setSelectedEvent}
          />
        ) : viewMode === "week" ? (
          <div style={{ padding: "0.75rem" }}>
            <WeekView
              startDate={weekStart}
              events={visibleEvents}
              onEventClick={setSelectedEvent}
            />
          </div>
        ) : (
          <DayView
            date={currentDate}
            events={visibleEvents}
            onEventClick={setSelectedEvent}
          />
        )}
      </div>

      {/* イベントモーダル */}
      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
