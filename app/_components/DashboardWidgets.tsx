"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePomodoroContext, MODES } from "@/lib/pomodoro-context";
import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

type Reminder = { id: string; name: string; due_date: string | null; done: boolean };
type PendingTask = { id: string; name: string; total_minutes: number };
type ProjectWithTasks = {
  id: string;
  name: string;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: PendingTask[];
  extra_task_count: number;
};
type PomodoroStats = {
  session_count: number;
  total_minutes: number;
  last_project: { project_name: string | null } | null;
};
type MeditationStats = {
  streak: number;
  last_session: { lesson: string | null; date: string; duration_min: string | null } | null;
  month_count: number;
  month_minutes: number;
};
type BookReading = { id: string; title: string; image_url: string | null; author_name: string | null };
type ShoppingStats = {
  non_purchased_count: number;
  remaining_budget: number;
  recent_items: { name: string; estimated_price: string | null }[];
};
type HabitItem = { id: string; name: string; icon: string | null; color: string | null; completed_today: boolean };
type JournalReviewItem = { id: string; title: string; review_date: string };
type DashboardData = {
  reminders: Reminder[];
  projects: ProjectWithTasks[];
  habits: HabitItem[];
  pomodoro: PomodoroStats;
  meditation: MeditationStats;
  books_reading: BookReading[];
  shopping: ShoppingStats;
  journal_review: JournalReviewItem[];
};

export interface UnifiedEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  end_date?: string; // YYYY-MM-DD (inclusive)
  end_time?: string; // HH:MM
  source: "ical" | "birthday" | "reminder";
  all_day: boolean;
  metadata?: Record<string, unknown>;
}

type SourceKey = "ical" | "birthday" | "reminder";

const SOURCE_CONFIG: Record<SourceKey, { label: string; color: string }> = {
  ical: { label: "iCloud", color: "#3b7ef8" },
  birthday: { label: "Anniversaires", color: "#d4697e" },
  reminder: { label: "Rappels", color: "#f59e0b" },
};

const DEFAULT_SOURCES: Record<SourceKey, boolean> = { ical: true, birthday: true, reminder: true };
const SOURCES_STORAGE_KEY = "calendar-sources";

// ── Utilities ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bonne après-midi";
  return "Bonsoir";
}

function formatDateFR(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getEventsForDay(events: UnifiedEvent[], day: Date): UnifiedEvent[] {
  const dayStr = toLocalDateStr(day);
  return events.filter((e) => {
    const endDate = e.end_date || e.date;
    return e.date <= dayStr && endDate >= dayStr;
  });
}

// Returns the full 6-row grid for a month (Mon→Sun), including overflow days
function getMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const startOffset = startDow === 0 ? 6 : startDow - 1;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startOffset);
  const endDow = lastDay.getDay();
  const endOffset = endDow === 0 ? 0 : 7 - endDow;
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + endOffset);
  const days: Date[] = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ── Widget wrapper ────────────────────────────────────────────────────────────

function Widget({
  title,
  icon,
  children,
  action,
  headerExtra,
  accent,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  action?: { label: string; href: string };
  headerExtra?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div style={{
      ...widgetStyle,
      ...(accent ? {
        borderTop: "3px solid var(--accent)",
        boxShadow: "0 4px 24px rgba(59,126,248,0.10), var(--shadow-sm)",
      } : {}),
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15 }}>{icon}</span>
          <span style={widgetTitleStyle}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {headerExtra}
          {action && (
            <Link href={action.href} className="widget-action-btn">
              {action.label}
            </Link>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function Skeleton({ height = 18 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        background: "var(--surface2)",
        borderRadius: 6,
        opacity: 0.7,
        animation: "skeletonPulse 1.4s ease-in-out infinite",
      }}
    />
  );
}

// ── Calendar widget ───────────────────────────────────────────────────────────

const DAY_NAMES_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

type EventPopupState = {
  event: UnifiedEvent;
  x: number;
  y: number;
};

type DayPopupState = {
  day: Date;
  events: UnifiedEvent[];
  rect: DOMRect;
};

function EventChip({
  event,
  compact = false,
  onClick,
}: {
  event: UnifiedEvent;
  compact?: boolean;
  onClick?: (e: React.MouseEvent, event: UnifiedEvent) => void;
}) {
  const color = SOURCE_CONFIG[event.source]?.color ?? "var(--accent)";
  return (
    <div
      title={event.title}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(e, event); } : undefined}
      style={{
        fontSize: compact ? 9 : 10,
        padding: compact ? "1px 4px" : "2px 5px",
        background: color + "22",
        borderLeft: `2px solid ${color}`,
        color: "var(--text)",
        borderRadius: compact ? 3 : 4,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        gap: 3,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
      {!event.all_day && !compact && event.time && (
        <span style={{ opacity: 0.65, marginRight: 1 }}>{event.time}</span>
      )}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{event.title}</span>
    </div>
  );
}

function EventPopupCard({
  popup,
  onClose,
  onReminderToggle,
}: {
  popup: EventPopupState;
  onClose: () => void;
  onReminderToggle: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { event, x, y } = popup;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Position popup: try to keep within viewport
  const popupW = 240;
  const left = Math.min(x + 8, window.innerWidth - popupW - 12);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: y + 8,
        left,
        width: popupW,
        background: "var(--surface)",
        border: "1.5px solid var(--border)",
        borderRadius: 10,
        boxShadow: "var(--shadow-md)",
        padding: "12px 14px",
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Source label */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: SOURCE_CONFIG[event.source].color, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {SOURCE_CONFIG[event.source].label}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>
        {event.title}
      </div>

      {/* Date / time */}
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {new Date(event.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        {event.time && <> · {event.time}{event.end_time ? ` → ${event.end_time}` : ""}</>}
      </div>

      {/* Reminder toggle */}
      {event.source === "reminder" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => { onReminderToggle(event.metadata?.id as string); onClose(); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: "var(--accent)", fontFamily: "var(--font-sans)",
              padding: 0,
            }}
          >
            ✓ Marquer comme fait
          </button>
          <Link href="/reminders" style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
            Voir →
          </Link>
        </div>
      )}

      {/* Birthday link */}
      {event.source === "birthday" && (
        <div style={{ paddingTop: 4, borderTop: "1px solid var(--border)" }}>
          <Link href="/birthdays" style={{ fontSize: 12, color: "var(--accent)" }}>
            Voir les anniversaires →
          </Link>
        </div>
      )}
    </div>
  );
}

function DayPopoverCard({
  popup,
  onClose,
  onReminderToggle,
  doneReminderIds,
}: {
  popup: DayPopupState;
  onClose: () => void;
  onReminderToggle: (id: string) => void;
  doneReminderIds: Set<string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { day, events, rect } = popup;

  // Sort: timed events first (chronological), then all-day
  const timedEvents = events
    .filter((e) => !e.all_day && e.time)
    .sort((a, b) => (a.time! > b.time! ? 1 : -1));
  const allDayEvents = events.filter((e) => e.all_day || !e.time);
  const sorted = [...timedEvents, ...allDayEvents];

  // Positioning
  const popoverW = 280;
  const margin = 8;
  let left = rect.left;
  if (left + popoverW > window.innerWidth - margin) left = Math.max(margin, rect.right - popoverW);
  if (left < margin) left = margin;

  const estimatedH = Math.min(360, 80 + sorted.length * 44);
  const openAbove =
    window.innerHeight - rect.bottom < estimatedH + margin && rect.top > estimatedH + margin;

  const positionStyle: React.CSSProperties = openAbove
    ? { bottom: window.innerHeight - rect.top + margin }
    : { top: rect.bottom + margin };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const dateLabel = day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left,
        width: popoverW,
        maxHeight: 360,
        ...positionStyle,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        boxShadow: "var(--shadow-md)",
        zIndex: 400,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px 8px", borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textTransform: "capitalize" }}>
          {dateLabel}
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: 14, padding: "2px 5px",
            borderRadius: 4, lineHeight: 1, fontFamily: "var(--font-sans)",
          }}
        >
          ✕
        </button>
      </div>

      {/* Events list */}
      <div style={{ overflowY: "auto", flex: 1, padding: "6px 0" }}>
        {sorted.length === 0 ? (
          <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-muted)" }}>
            Aucun événement
          </div>
        ) : (
          sorted.map((event, i) => {
            const color = SOURCE_CONFIG[event.source]?.color ?? "var(--accent)";
            const reminderId = event.metadata?.id as string | undefined;
            const isDone = !!reminderId && doneReminderIds.has(reminderId);

            // Extract age label from birthday title (e.g. "🎂 Alice — 30 ans")
            const ageMatch = event.source === "birthday" ? event.title.match(/— (\d+ ans)/) : null;

            return (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "7px 14px",
                  opacity: isDone ? 0.45 : 1,
                  borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                {/* Source dot */}
                <span style={{
                  width: 8, height: 8, borderRadius: "50%", background: color,
                  flexShrink: 0, marginTop: 4,
                }} />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {(event.time || ageMatch) && (
                    <div style={{ display: "flex", gap: 6, marginBottom: 2 }}>
                      {event.time && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                          {event.time}{event.end_time ? ` → ${event.end_time}` : ""}
                        </span>
                      )}
                      {ageMatch && (
                        <span style={{ fontSize: 11, color, fontWeight: 600 }}>{ageMatch[1]}</span>
                      )}
                    </div>
                  )}
                  <div style={{
                    fontSize: 13, color: "var(--text)", lineHeight: 1.35,
                    wordBreak: "break-word",
                    textDecoration: isDone ? "line-through" : "none",
                  }}>
                    {event.title}
                  </div>
                </div>

                {/* Reminder checkbox */}
                {event.source === "reminder" && !isDone && reminderId && (
                  <button
                    onClick={() => onReminderToggle(reminderId)}
                    title="Marquer comme fait"
                    style={{
                      flexShrink: 0, background: "none",
                      border: "1.5px solid var(--border)", borderRadius: 5,
                      width: 20, height: 20, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--text-muted)", fontSize: 11, marginTop: 2,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                    }}
                  >
                    ✓
                  </button>
                )}

                {/* Birthday link */}
                {event.source === "birthday" && (
                  <Link
                    href="/birthdays"
                    onClick={onClose}
                    style={{ fontSize: 12, color: "var(--accent)", flexShrink: 0, marginTop: 3, textDecoration: "none" }}
                  >
                    →
                  </Link>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function MonthView({
  events,
  year,
  month,
  onEventClick,
  onDayClick,
}: {
  events: UnifiedEvent[] | null;
  year: number;
  month: number;
  onEventClick: (e: React.MouseEvent, event: UnifiedEvent) => void;
  onDayClick: (day: Date, dayEvents: UnifiedEvent[], rect: DOMRect) => void;
}) {
  const todayTime = new Date().setHours(0, 0, 0, 0);
  const days = getMonthGrid(year, month);

  return (
    <div style={{ overflow: "hidden" }}>
      {/* Day-of-week headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} style={{ fontSize: 10, textAlign: "center", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 0", minWidth: 0 }}>
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {days.map((day, i) => {
          const isCurrentMonth = day.getMonth() === month;
          const isToday = new Date(day).setHours(0, 0, 0, 0) === todayTime;
          const dayEvents = events ? getEventsForDay(events, day) : [];
          const hasDayPopup = dayEvents.length > 0;

          const openDayPopup = (e: React.MouseEvent) => {
            e.stopPropagation();
            const cell = (e.currentTarget as HTMLElement).closest("[data-daycell]") as HTMLElement | null;
            const rect = (cell ?? e.currentTarget as HTMLElement).getBoundingClientRect();
            onDayClick(day, dayEvents, rect);
          };

          return (
            <div
              key={i}
              data-daycell="true"
              style={{
                borderRadius: 6,
                padding: "4px 5px",
                minHeight: 58,
                minWidth: 0,
                overflow: "hidden",
                background: isToday ? "rgba(59, 126, 248, 0.06)" : "transparent",
                border: `1px solid ${isToday ? "rgba(59, 126, 248, 0.25)" : "var(--border)"}`,
                opacity: isCurrentMonth ? 1 : 0.38,
              }}
            >
              {/* Day number — clickable */}
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 3 }}>
                <span
                  onClick={hasDayPopup ? openDayPopup : undefined}
                  style={{
                    fontSize: 11,
                    fontWeight: isToday ? 700 : 400,
                    width: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    background: isToday ? "var(--accent)" : "transparent",
                    color: isToday ? "white" : "var(--text)",
                    cursor: hasDayPopup ? "pointer" : "default",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    if (hasDayPopup && !isToday)
                      (e.currentTarget as HTMLSpanElement).style.background = "var(--surface2)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isToday)
                      (e.currentTarget as HTMLSpanElement).style.background = "transparent";
                  }}
                >
                  {day.getDate()}
                </span>
              </div>
              {/* Events */}
              {events !== null && (
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {dayEvents.slice(0, 2).map((e, j) => (
                    <EventChip key={j} event={e} compact onClick={onEventClick} />
                  ))}
                  {dayEvents.length > 2 && (
                    <button
                      onClick={openDayPopup}
                      style={{
                        background: "var(--surface2)",
                        color: "var(--accent)",
                        border: "none",
                        borderRadius: 4,
                        fontSize: 9,
                        padding: "1px 5px",
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                        fontWeight: 600,
                        lineHeight: 1.5,
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "var(--border)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)";
                      }}
                    >
                      +{dayEvents.length - 2}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarWidget({ events, error }: { events: UnifiedEvent[] | null; error: boolean }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [sourcesEnabled, setSourcesEnabled] = useState<Record<SourceKey, boolean>>(DEFAULT_SOURCES);
  const [popup, setPopup] = useState<EventPopupState | null>(null);
  const [dayPopup, setDayPopup] = useState<DayPopupState | null>(null);
  const [doneReminderIds, setDoneReminderIds] = useState<Set<string>>(new Set());

  // Load source toggles from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SOURCES_STORAGE_KEY);
      if (stored) setSourcesEnabled({ ...DEFAULT_SOURCES, ...JSON.parse(stored) });
    } catch {
      // ignore
    }
  }, []);

  function toggleSource(key: SourceKey) {
    setSourcesEnabled((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(SOURCES_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  const handleEventClick = useCallback((e: React.MouseEvent, event: UnifiedEvent) => {
    setDayPopup(null);
    setPopup({ event, x: e.clientX, y: e.clientY });
  }, []);

  const handleDayClick = useCallback((day: Date, dayEvents: UnifiedEvent[], rect: DOMRect) => {
    setPopup(null);
    setDayPopup({ day, events: dayEvents, rect });
  }, []);

  const handleReminderToggle = useCallback(async (id: string) => {
    setDoneReminderIds((prev) => new Set([...prev, id]));
    try {
      await fetch(`/api/reminders?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      });
    } catch {
      setDoneReminderIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }, []);

  const now = new Date();
  const displayDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const displayYear = displayDate.getFullYear();
  const displayMonth = displayDate.getMonth();
  const monthLabel = displayDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  // Filter events by enabled sources + done reminders
  const filteredEvents = events
    ? events.filter((e) => {
        if (!sourcesEnabled[e.source]) return false;
        if (e.source === "reminder" && doneReminderIds.has(e.metadata?.id as string)) return false;
        return true;
      })
    : null;

  const headerExtra = (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button
        onClick={() => setMonthOffset((o) => o - 1)}
        style={{ fontSize: 16, padding: "0 6px", background: "none", border: "1.5px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", cursor: "pointer", lineHeight: 1.5 }}
      >
        ‹
      </button>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", minWidth: 120, textAlign: "center", textTransform: "capitalize" }}>
        {monthLabel}
      </span>
      <button
        onClick={() => setMonthOffset((o) => o + 1)}
        style={{ fontSize: 16, padding: "0 6px", background: "none", border: "1.5px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", cursor: "pointer", lineHeight: 1.5 }}
      >
        ›
      </button>
    </div>
  );

  return (
    <>
      <Widget title="Calendrier" icon="📅" headerExtra={headerExtra}>
        {/* Source legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {(Object.entries(SOURCE_CONFIG) as [SourceKey, { label: string; color: string }][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => toggleSource(key)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "none", border: "none", cursor: "pointer",
                padding: "2px 6px", borderRadius: 20,
                opacity: sourcesEnabled[key] ? 1 : 0.4,
                outline: "none",
                fontFamily: "var(--font-sans)",
              }}
              title={`${sourcesEnabled[key] ? "Masquer" : "Afficher"} ${cfg.label}`}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{cfg.label}</span>
            </button>
          ))}
        </div>

        {error ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Calendrier non disponible</p>
        ) : (
          <MonthView
            events={filteredEvents}
            year={displayYear}
            month={displayMonth}
            onEventClick={handleEventClick}
            onDayClick={handleDayClick}
          />
        )}
      </Widget>

      {popup && (
        <EventPopupCard
          popup={popup}
          onClose={() => setPopup(null)}
          onReminderToggle={handleReminderToggle}
        />
      )}
      {dayPopup && (
        <DayPopoverCard
          popup={dayPopup}
          onClose={() => setDayPopup(null)}
          onReminderToggle={handleReminderToggle}
          doneReminderIds={doneReminderIds}
        />
      )}
    </>
  );
}


// ── Projects widget ───────────────────────────────────────────────────────────

function ProjectsWidget({ projects }: { projects?: ProjectWithTasks[] }) {
  const loading = projects === undefined;

  return (
    <Widget title="Projets en cours" icon="📁" action={{ label: "Projets →", href: "/projects" }}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Skeleton height={60} /><Skeleton height={60} />
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>Aucun projet en cours.</p>
          <Link href="/projects" style={{ fontSize: 13, color: "var(--accent)" }}>Créer un projet →</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {projects.map((project) => {
            const pct = project.total_tasks > 0 ? Math.round((project.completed_tasks / project.total_tasks) * 100) : 0;
            return (
              <div key={project.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{project.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {project.completed_tasks}/{project.total_tasks} tâches
                  </span>
                </div>
                {/* Progress bar */}
                <div style={{ background: "var(--surface2)", borderRadius: 4, height: 5, overflow: "hidden" }}>
                  <div style={{ background: "var(--accent)", width: `${pct}%`, height: "100%", borderRadius: 4, transition: "width 0.3s" }} />
                </div>
                {/* Pending tasks */}
                {project.pending_tasks.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 4 }}>
                    {project.pending_tasks.map((task) => (
                      <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text-muted)", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "var(--text)", flex: 1 }}>{task.name}</span>
                        {task.total_minutes > 0 && (
                          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{task.total_minutes}min</span>
                        )}
                      </div>
                    ))}
                    {project.extra_task_count > 0 && (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 10 }}>
                        ... et {project.extra_task_count} autres
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

// ── Pomodoro widget ───────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, "0"); }

function PomodoroWidget({ pomodoro }: { pomodoro?: PomodoroStats }) {
  const { running, secondsLeft, mode, selectedProject, projects, todayStats, handlePause, handleStart } = usePomodoroContext();
  const loading = pomodoro === undefined;

  const modeConfig = MODES[mode];
  const modeColor = modeConfig.color;
  const projectName = projects.find((p) => p.id === selectedProject)?.name ?? null;

  const sessionCount = todayStats?.session_count ?? pomodoro?.session_count ?? 0;
  const totalMinutes = todayStats?.total_minutes ?? pomodoro?.total_minutes ?? 0;

  return (
    <Widget title="Pomodoro du jour" icon="⏱️">
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton height={40} /><Skeleton />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {selectedProject && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 10,
              background: running ? "rgba(59,126,248,0.06)" : "var(--bg)",
              border: `1.5px solid ${running ? "rgba(59,126,248,0.2)" : "var(--border)"}`,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: modeColor,
                boxShadow: running ? `0 0 6px ${modeColor}` : "none",
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: modeColor, lineHeight: 1 }}>
                  {pad(Math.floor(secondsLeft / 60))}:{pad(secondsLeft % 60)}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {modeConfig.label.toUpperCase()} · {projectName}
                </div>
              </div>
              {running ? (
                <button onClick={handlePause} style={miniBtn}>⏸</button>
              ) : (
                <button onClick={handleStart} style={{ ...miniBtn, background: modeColor, color: "#fff", borderColor: modeColor }}>▶</button>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>
                {sessionCount}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>sessions</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>
                {totalMinutes}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>minutes</div>
            </div>
          </div>

          {!selectedProject && pomodoro?.last_project?.project_name && (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Dernier : <span style={{ color: "var(--text)" }}>{pomodoro.last_project.project_name}</span>
            </div>
          )}

          <Link
            href="/pomodoro"
            style={{ display: "block", textAlign: "center", padding: "8px", background: "var(--accent)", color: "white", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
          >
            {selectedProject ? "Voir le timer →" : "Démarrer une session"}
          </Link>
        </div>
      )}
    </Widget>
  );
}

const miniBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
  background: "var(--surface2)", border: "1px solid var(--border)",
  color: "var(--text-muted)", fontSize: 11, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};

// ── Meditation widget ─────────────────────────────────────────────────────────

function MeditationWidget({ meditation }: { meditation?: MeditationStats }) {
  const loading = meditation === undefined;

  return (
    <Widget title="Méditation" icon="🧘" action={{ label: "Stats →", href: "/petitbambou" }}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton height={40} /><Skeleton /><Skeleton />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 32, fontWeight: 700, color: "var(--accent2)" }}>
              {meditation.streak}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>jours de suite</span>
          </div>
          {meditation.last_session && (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Dernière :{" "}
              <span style={{ color: "var(--text)" }}>
                {new Date(meditation.last_session.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              </span>
              {meditation.last_session.duration_min && (
                <> · {Math.round(Number(meditation.last_session.duration_min))} min</>
              )}
              {meditation.last_session.lesson && (
                <div style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {meditation.last_session.lesson}
                </div>
              )}
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--text-muted)", paddingTop: 2, borderTop: "1px solid var(--border)" }}>
            Ce mois : <span style={{ color: "var(--text)", fontWeight: 600 }}>{meditation.month_count} sessions</span>
            {meditation.month_minutes > 0 && <> · {meditation.month_minutes} min</>}
          </div>
        </div>
      )}
    </Widget>
  );
}

// ── Reading widget ────────────────────────────────────────────────────────────

function ReadingWidget({ books }: { books?: BookReading[] }) {
  const loading = books === undefined;

  return (
    <Widget title="Lecture en cours" icon="📚" action={{ label: "Bibliothèque →", href: "/library" }}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton height={52} /><Skeleton height={52} />
        </div>
      ) : books.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Aucun livre en cours.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {books.map((book) => (
            <div key={book.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {book.image_url ? (
                <img
                  src={book.image_url}
                  alt={book.title}
                  style={{ width: 36, height: 52, objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 36, height: 52, borderRadius: 4, background: "var(--surface2)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--text-muted)" }}>
                  📖
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {book.title}
                </div>
                {book.author_name && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{book.author_name}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// ── Shopping widget ───────────────────────────────────────────────────────────

function ShoppingWidget({ shopping }: { shopping?: ShoppingStats }) {
  const loading = shopping === undefined;

  return (
    <Widget title="Shopping" icon="🛒" action={{ label: "Voir la liste →", href: "/shopping" }}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton height={32} /><Skeleton /><Skeleton />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--green)" }}>
                {shopping.non_purchased_count}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>articles</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--green)" }}>
                {shopping.remaining_budget.toFixed(0)}€
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>à dépenser</div>
            </div>
          </div>
          {shopping.recent_items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {shopping.recent_items.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {item.name}
                  </span>
                  {item.estimated_price && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0, marginLeft: 8 }}>
                      {Number(item.estimated_price).toFixed(0)}€
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Widget>
  );
}

// ── Habits widget ─────────────────────────────────────────────────────────────

function HabitsWidget({ habits: initial }: { habits?: HabitItem[] }) {
  const [habits, setHabits] = useState<HabitItem[]>(initial ?? []);
  const loading = initial === undefined;

  useEffect(() => {
    if (initial !== undefined) setHabits(initial);
  }, [initial]);

  const toggle = async (id: string, currentlyDone: boolean) => {
    setHabits((prev) => prev.map((h) => h.id === id ? { ...h, completed_today: !currentlyDone } : h));
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    try {
      if (currentlyDone) {
        await fetch(`/api/habits/log?habit_id=${id}&date=${todayStr}`, { method: "DELETE" });
      } else {
        await fetch("/api/habits/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ habit_id: id, completed_date: todayStr }),
        });
      }
    } catch {
      setHabits((prev) => prev.map((h) => h.id === id ? { ...h, completed_today: currentlyDone } : h));
    }
  };

  const doneCount = habits.filter((h) => h.completed_today).length;
  const total = habits.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <Widget title="Habitudes du jour" icon="🎯" action={{ label: "Voir tout →", href: "/habits" }} accent>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton /><Skeleton /><Skeleton />
        </div>
      ) : total === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Aucune habitude prévue aujourd&apos;hui.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Progress bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "var(--text-muted)" }}>
              <span>{doneCount}/{total} complétées</span>
              <span style={{ fontWeight: 600, color: pct === 100 ? "var(--green)" : "var(--accent)" }}>{pct}%</span>
            </div>
            <div style={{ background: "var(--border)", borderRadius: 4, height: 5, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--green)" : "var(--accent)", borderRadius: 4, transition: "width 0.3s" }} />
            </div>
          </div>
          {/* Habit checkboxes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {habits.map((h) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => toggle(h.id, h.completed_today)}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `2px solid ${h.color || "var(--accent)"}`,
                    background: h.completed_today ? (h.color || "var(--accent)") : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "background 0.2s",
                  }}
                >
                  {h.completed_today && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span style={{ fontSize: 13, color: h.completed_today ? "var(--text-muted)" : "var(--text)", textDecoration: h.completed_today ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {h.icon ? `${h.icon} ` : ""}{h.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Widget>
  );
}

// ── Journal widget ────────────────────────────────────────────────────────────

function JournalWidget({ items }: { items?: JournalReviewItem[] }) {
  const loading = items === undefined;

  function getReviewBadge(dateStr: string): { label: string; color: string } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = dateStr.split("-").map(Number);
    const due = new Date(y, m - 1, d);
    const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: "En retard", color: "var(--red)" };
    if (diff === 0) return { label: "Aujourd'hui", color: "var(--accent)" };
    return { label: `Dans ${diff}j`, color: "var(--text-muted)" };
  }

  return (
    <Widget title="Journal — À revoir" icon="📖" action={{ label: "Ouvrir →", href: "/journal" }}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton /><Skeleton /><Skeleton />
        </div>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>✅ Aucun thread à revoir cette semaine</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item) => {
            const badge = getReviewBadge(item.review_date);
            return (
              <Link
                key={item.id}
                href={`/journal?entry=${item.id}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textDecoration: "none" }}
              >
                <span style={{ fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {item.title}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: badge.color, flexShrink: 0 }}>
                  {badge.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

// ── Weight widget ─────────────────────────────────────────────────────────────

type WeightData = {
  last: { weight: number; measured_at: string } | null;
  stats: {
    "30d": { min: number; max: number; avg: number } | null;
    variation_total: number | null;
    slope_30d: number;
  } | null;
  history: { date: string; weight: number }[];
  periods: { "30d": string };
};

function WeightWidget({ data }: { data: WeightData | null | undefined }) {
  const loading = data === undefined;

  if (loading) {
    return (
      <div style={widgetStyle}>
        <div style={widgetTitleStyle}>⚖️ Poids</div>
        <Skeleton /><Skeleton height={80} />
      </div>
    );
  }

  const last = data?.last ?? null;
  const s = data?.stats ?? null;
  const history30 = data
    ? data.history.filter((p) => !data.periods["30d"] || p.date.slice(0, 10) >= data.periods["30d"])
    : [];

  // Variation 30j
  const oldest30 = history30.length > 0 ? history30[0] : null;
  const var30 =
    last && oldest30 && oldest30.weight !== last.weight
      ? Math.round((last.weight - oldest30.weight) * 10) / 10
      : s?.variation_total != null && history30.length >= 2
      ? Math.round((history30[history30.length - 1].weight - history30[0].weight) * 10) / 10
      : null;

  // Trend
  const slope = s?.slope_30d ?? 0;
  const trend =
    slope < -0.02
      ? { label: "En baisse", icon: "📉", color: "var(--green)", bg: "rgba(16,185,129,0.1)" }
      : slope > 0.02
      ? { label: "En hausse", icon: "📈", color: "var(--red)", bg: "rgba(220,38,38,0.08)" }
      : { label: "Stable", icon: "➡️", color: "var(--text-muted)", bg: "var(--surface2)" };

  // Is last measure today?
  const dateLabel = (() => {
    if (!last) return null;
    const d = new Date(last.measured_at);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    return isToday
      ? "Aujourd'hui"
      : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  })();

  return (
    <div style={widgetStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={widgetTitleStyle}>⚖️ Poids</span>
        <Link
          href="/weight"
          style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
        >
          Voir tout →
        </Link>
      </div>

      {!last ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Aucune mesure — configure le Raccourci iOS pour démarrer.
        </p>
      ) : (
        <>
          {/* Stats row */}
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            {/* Poids actuel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Poids actuel
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 500, color: "var(--text)", lineHeight: 1 }}>
                  {Number(last.weight).toFixed(1)}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>kg</span>
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{dateLabel}</span>
            </div>

            <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />

            {/* Variation 30j */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Sur 30 jours
              </span>
              {var30 !== null ? (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 500, lineHeight: 1,
                      color: Math.abs(var30) < 0.2 ? "var(--text-muted)" : var30 < 0 ? "var(--green)" : "var(--red)",
                    }}>
                      {var30 > 0 ? "+" : ""}{var30.toFixed(1)}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>kg</span>
                  </div>
                  <span style={{ fontSize: 11, color: Math.abs(var30) < 0.2 ? "var(--text-muted)" : var30 < 0 ? "var(--green)" : "var(--red)" }}>
                    {Math.abs(var30) < 0.2 ? "= stable" : var30 < 0 ? "▼ perte" : "▲ prise"}
                  </span>
                </>
              ) : (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 500, color: "var(--text-muted)", lineHeight: 1 }}>—</span>
              )}
            </div>

            <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />

            {/* Tendance */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Tendance
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 12, fontWeight: 600, color: trend.color,
                background: trend.bg, borderRadius: 6,
                padding: "3px 8px", alignSelf: "flex-start", marginTop: 2,
              }}>
                {trend.icon} {trend.label}
              </span>
            </div>
          </div>

          {/* Sparkline */}
          {history30.length >= 2 ? (
            <div style={{ marginTop: -4 }}>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={history30} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <Tooltip
                    formatter={(v: number) => [`${Number(v).toFixed(2)} kg`, "Poids"]}
                    labelFormatter={(l: string) =>
                      new Date(l).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                    }
                    contentStyle={{ fontSize: 11, borderRadius: 7, border: "1px solid var(--border)", padding: "4px 8px" }}
                  />
                  <Line
                    type="monotone" dataKey="weight" stroke="var(--accent)"
                    strokeWidth={2} dot={false} isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
              Pas encore assez de données — pèse-toi pour commencer le suivi.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function DashboardWidgets({ userName }: { userName: string }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<UnifiedEvent[] | null>(null);
  const [calendarError, setCalendarError] = useState(false);
  const [weightData, setWeightData] = useState<WeightData | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setDashboard(d); })
      .catch(() => {});

    fetch("/api/calendar/unified")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setCalendarError(true);
        else setCalendarEvents(d);
      })
      .catch(() => setCalendarError(true));

    fetch("/api/weight/stats")
      .then((r) => r.json())
      .then((d) => setWeightData(d.error ? null : d))
      .catch(() => setWeightData(null));
  }, []);

  return (
    <div style={{ padding: "32px 36px", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          {getGreeting()}, {userName} !
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", textTransform: "capitalize" }}>
          {formatDateFR(new Date())}
        </p>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 20,
        }}
      >
        {/* Calendrier — full width (col span 3) */}
        <div style={{ gridColumn: "span 3" }}>
          <CalendarWidget events={calendarEvents} error={calendarError} />
        </div>

        {/* Habitudes — col span 2 */}
        <div style={{ gridColumn: "span 2" }}>
          <HabitsWidget habits={dashboard?.habits} />
        </div>

        {/* Pomodoro — col span 1 */}
        <PomodoroWidget pomodoro={dashboard?.pomodoro} />

        {/* Projets — col span 2 */}
        <div style={{ gridColumn: "span 2" }}>
          <ProjectsWidget projects={dashboard?.projects} />
        </div>

        {/* Méditation — col span 1 */}
        <MeditationWidget meditation={dashboard?.meditation} />

        {/* Poids — col span 2 */}
        <div style={{ gridColumn: "span 2" }}>
          <WeightWidget data={weightData} />
        </div>

        {/* Lecture — col span 1 */}
        <ReadingWidget books={dashboard?.books_reading} />

        {/* Shopping — col span 1 */}
        <ShoppingWidget shopping={dashboard?.shopping} />

        {/* Journal — col span 1 */}
        <JournalWidget items={dashboard?.journal_review} />
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const widgetStyle: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: 14,
  padding: "20px 22px",
  boxShadow: "var(--shadow-sm)",
  border: "1.5px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  height: "100%",
  overflow: "hidden",
  minWidth: 0,
};

const widgetTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-muted)",
};
