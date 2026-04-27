"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type Reminder = { id: string; name: string; due_date: string | null; done: boolean };
type PendingTask = { id: string; name: string };
type ProjectWithTasks = {
  id: string;
  name: string;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: PendingTask[];
  extra_task_count: number;
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
type FinanceWidgetData = {
  total_patrimony: number;
  assets: number;
  debts: number;
  patrimony_change: number;
  current_month: { income: number; expense: number; balance: number; savings_rate: number };
  monthly_patrimony: { label: string; ym: string; total: number }[];
  top_accounts: { name: string; type: string; color: string; balance: number }[];
  has_loans: boolean;
};
type DashboardData = {
  reminders: Reminder[];
  projects: ProjectWithTasks[];
  habits: HabitItem[];
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
  source: "ical" | "birthday" | "reminder" | "dnd";
  all_day: boolean;
  metadata?: Record<string, unknown>;
}

type SourceKey = "ical" | "birthday" | "reminder" | "dnd";

const SOURCE_CONFIG: Record<SourceKey, { label: string; color: string }> = {
  ical: { label: "iCloud", color: "#3b7ef8" },
  birthday: { label: "Anniversaires", color: "#d4697e" },
  reminder: { label: "Rappels", color: "#f59e0b" },
  dnd: { label: "D&D", color: "#8b5cf6" },
};

const DEFAULT_SOURCES: Record<SourceKey, boolean> = { ical: true, birthday: true, reminder: true, dnd: true };
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
  title, icon, children, action, headerExtra, accent, compact = false,
}: {
  title: string; icon: string; children: React.ReactNode;
  action?: { label: string; href: string };
  headerExtra?: React.ReactNode;
  accent?: boolean; compact?: boolean;
}) {
  const style: React.CSSProperties = compact ? compactWidgetStyle : widgetStyle;
  return (
    <div style={{
      ...style,
      ...(accent ? { borderTop: "3px solid var(--accent)", boxShadow: "0 4px 24px rgba(59,126,248,0.10), var(--shadow-sm)" } : {}),
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: compact ? 13 : 15 }}>{icon}</span>
          <span style={compact ? compactWidgetTitleStyle : widgetTitleStyle}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {headerExtra}
          {action && <Link href={action.href} className="widget-action-btn">{action.label}</Link>}
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

      {/* D&D session link */}
      {event.source === "dnd" && (
        <div style={{ paddingTop: 4, borderTop: "1px solid var(--border)" }}>
          <Link href="/dnd?tab=sessions" style={{ fontSize: 12, color: "#8b5cf6" }}>
            Voir les sessions D&amp;D →
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

                {/* D&D session link */}
                {event.source === "dnd" && (
                  <Link
                    href="/dnd?tab=sessions"
                    onClick={onClose}
                    style={{ fontSize: 12, color: "#8b5cf6", flexShrink: 0, marginTop: 3, textDecoration: "none" }}
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
    <Widget title="Projets" icon="📁" action={{ label: "Voir →", href: "/projects" }} compact>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><Skeleton height={36} /><Skeleton height={36} /></div>
      ) : projects.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun projet en cours.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {projects.map((project) => {
            const pct = project.total_tasks > 0 ? Math.round((project.completed_tasks / project.total_tasks) * 100) : 0;
            return (
              <div key={project.id}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{project.name}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0, marginLeft: 8 }}>{project.completed_tasks}/{project.total_tasks}</span>
                </div>
                <div style={{ background: "var(--surface2)", borderRadius: 3, height: 4, overflow: "hidden" }}>
                  <div style={{ background: "var(--accent)", width: `${pct}%`, height: "100%", borderRadius: 3, transition: "width 0.3s" }} />
                </div>
                {project.pending_tasks.length > 0 && (
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                    {project.pending_tasks.slice(0, 2).map((task) => (
                      <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--text-muted)", flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.name}</span>
                      </div>
                    ))}
                    {(project.extra_task_count + Math.max(0, project.pending_tasks.length - 2)) > 0 && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", paddingLeft: 8 }}>+{project.extra_task_count + Math.max(0, project.pending_tasks.length - 2)} autres</span>
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

// ── Meditation widget ─────────────────────────────────────────────────────────

function MeditationWidget({ meditation }: { meditation?: MeditationStats }) {
  const loading = meditation === undefined;

  return (
    <Widget title="Méditation" icon="🧘" action={{ label: "Stats →", href: "/petitbambou" }} compact>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><Skeleton height={32} /><Skeleton /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 700, color: "var(--accent2)" }}>{meditation.streak}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>j. de suite</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: 5, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span>Ce mois : <strong style={{ color: "var(--text)" }}>{meditation.month_count} séances</strong></span>
            {meditation.month_minutes > 0 && <span><strong style={{ color: "var(--text)" }}>{meditation.month_minutes} min</strong></span>}
          </div>
          {meditation.last_session && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              Dernière : {new Date(meditation.last_session.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
              {meditation.last_session.duration_min && <> · {Math.round(Number(meditation.last_session.duration_min))} min</>}
            </div>
          )}
        </div>
      )}
    </Widget>
  );
}

// ── Reading widget ────────────────────────────────────────────────────────────

function ReadingWidget({ books }: { books?: BookReading[] }) {
  const loading = books === undefined;

  return (
    <Widget title="Lecture" icon="📚" action={{ label: "Biblio →", href: "/library" }} compact>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><Skeleton height={36} /><Skeleton height={36} /></div>
      ) : books.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun livre en cours.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {books.map((book) => (
            <div key={book.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {book.image_url ? (
                <img src={book.image_url} alt={book.title} style={{ width: 26, height: 38, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 26, height: 38, borderRadius: 3, background: "var(--surface2)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>📖</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.title}</div>
                {book.author_name && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{book.author_name}</div>}
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
    <Widget title="Shopping" icon="🛒" action={{ label: "Liste →", href: "/shopping" }} compact>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><Skeleton height={28} /><Skeleton /><Skeleton /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 14 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--green)" }}>{shopping.non_purchased_count}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>articles</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--green)" }}>{shopping.remaining_budget.toFixed(0)}€</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>budget</div>
            </div>
          </div>
          {shopping.recent_items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 3, borderTop: "1px solid var(--border)", paddingTop: 5 }}>
              {shopping.recent_items.slice(0, 3).map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{item.name}</span>
                  {item.estimated_price && <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0, marginLeft: 6 }}>{Number(item.estimated_price).toFixed(0)}€</span>}
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

  useEffect(() => { if (initial !== undefined) setHabits(initial); }, [initial]);

  const toggle = async (id: string, currentlyDone: boolean) => {
    setHabits((prev) => prev.map((h) => h.id === id ? { ...h, completed_today: !currentlyDone } : h));
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    try {
      if (currentlyDone) {
        await fetch(`/api/habits/log?habit_id=${id}&date=${todayStr}`, { method: "DELETE" });
      } else {
        await fetch("/api/habits/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ habit_id: id, completed_date: todayStr }) });
      }
    } catch {
      setHabits((prev) => prev.map((h) => h.id === id ? { ...h, completed_today: currentlyDone } : h));
    }
  };

  const doneCount = habits.filter((h) => h.completed_today).length;
  const total = habits.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <Widget title="Habitudes du jour" icon="🎯" action={{ label: "Tout voir →", href: "/habits" }} accent compact>
      {loading ? (
        <div style={{ display: "flex", gap: 6 }}><Skeleton height={28} /><Skeleton height={28} /><Skeleton height={28} /></div>
      ) : total === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucune habitude prévue aujourd&apos;hui.</p>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Bubble toggles */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
            {habits.map((h) => (
              <button key={h.id} onClick={() => toggle(h.id, h.completed_today)} title={h.name} style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                border: `2px solid ${h.color || "var(--accent)"}`,
                background: h.completed_today ? (h.color || "var(--accent)") : "transparent",
                fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                opacity: h.completed_today ? 1 : 0.5,
                transition: "background 0.18s, opacity 0.18s",
              }}>
                {h.icon || h.name[0]}
              </button>
            ))}
          </div>
          {/* Progress */}
          <div style={{ flexShrink: 0, textAlign: "right", minWidth: 60 }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)", color: pct === 100 ? "var(--green)" : "var(--accent)" }}>{pct}%</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{doneCount}/{total}</div>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
              <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--green)" : "var(--accent)", borderRadius: 2, transition: "width 0.3s" }} />
            </div>
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
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [y, m, d] = dateStr.split("-").map(Number);
    const diff = Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { label: "Retard", color: "var(--red)" };
    if (diff === 0) return { label: "Auj.", color: "var(--accent)" };
    return { label: `J+${diff}`, color: "var(--text-muted)" };
  }

  return (
    <Widget title="Journal — À revoir" icon="📖" action={{ label: "Ouvrir →", href: "/journal" }} compact>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}><Skeleton /><Skeleton /><Skeleton /></div>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>✅ Rien à revoir</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((item) => {
            const badge = getReviewBadge(item.review_date);
            return (
              <Link key={item.id} href={`/journal?entry=${item.id}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, textDecoration: "none" }}>
                <span style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{item.title}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: badge.color, flexShrink: 0 }}>{badge.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </Widget>
  );
}

// ── Finances widget ───────────────────────────────────────────────────────────

function formatEurWidget(val: number): string {
  return val.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function PatrimonySparkline({ data }: { data: { label: string; total: number }[] }) {
  if (data.length < 2) return null;
  const vals = data.map((d) => d.total);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 200, H = 36;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const polyline = pts.join(" ");
  const lastY = parseFloat(pts[pts.length - 1].split(",")[1]);
  const trend = vals[vals.length - 1] >= vals[vals.length - 2];
  const color = trend ? "#16a34a" : "#dc2626";

  return (
    <div style={{ position: "relative" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {/* Gradient fill */}
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${H} ${polyline} ${W},${H}`}
          fill="url(#sparkGrad)"
        />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Last point dot */}
        <circle cx={W} cy={lastY} r="3.5" fill={color} />
      </svg>
      {/* Month labels */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        {data.map((d, i) => (
          <span key={i} style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "capitalize" }}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

function FinancesWidget({ data }: { data?: FinanceWidgetData | null }) {
  const loading = data === undefined;
  const empty = data === null;

  if (loading) {
    return (
      <Widget title="Finances" icon="💶" action={{ label: "Finances →", href: "/finances" }} compact>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><Skeleton height={36} /><Skeleton height={36} /><Skeleton /></div>
      </Widget>
    );
  }

  if (empty || !data) {
    return (
      <Widget title="Finances" icon="💶" action={{ label: "Configurer →", href: "/finances" }} compact>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun compte configuré.</p>
      </Widget>
    );
  }

  const { total_patrimony, assets, debts, patrimony_change, current_month, monthly_patrimony, top_accounts, has_loans } = data;
  const trend = patrimony_change >= 0;
  const trendColor = trend ? "var(--green)" : "var(--red)";

  return (
    <Widget title="Finances" icon="💶" action={{ label: "Finances →", href: "/finances" }} compact>
      {/* Patrimony + sparkline side by side */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Patrimoine net</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 800, color: total_patrimony >= 0 ? "var(--text)" : "var(--red)", lineHeight: 1 }}>
            {formatEurWidget(total_patrimony)}
          </div>
          {has_loans ? (
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: 6 }}>
              <span>Actifs <strong style={{ color: "var(--green)" }}>{formatEurWidget(assets)}</strong></span>
              <span>Dettes <strong style={{ color: "var(--red)" }}>{formatEurWidget(debts)}</strong></span>
            </div>
          ) : patrimony_change !== 0 ? (
            <div style={{ fontSize: 10, color: trendColor, fontWeight: 600, marginTop: 2 }}>
              {trend ? "↑" : "↓"} {formatEurWidget(Math.abs(patrimony_change))} vs M-1
            </div>
          ) : null}
        </div>
        {monthly_patrimony.length >= 2 && (
          <div style={{ flexShrink: 0, width: 120 }}>
            <PatrimonySparkline data={monthly_patrimony} />
          </div>
        )}
      </div>

      {/* Month KPIs */}
      <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
        {[
          { label: "Revenus", value: current_month.income, color: "var(--green)" },
          { label: "Dépenses", value: current_month.expense, color: "var(--red)" },
          { label: "Épargne", value: current_month.savings_rate, color: "var(--accent)", suffix: "%" },
        ].map((kpi, i) => (
          <div key={i} style={{ flex: 1, padding: "6px 8px", textAlign: "center", borderRight: i < 2 ? "1px solid var(--border)" : "none", background: "var(--bg)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, color: kpi.color }}>
              {kpi.suffix ? `${kpi.value}${kpi.suffix}` : formatEurWidget(kpi.value)}
            </div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 1 }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Top accounts */}
      {top_accounts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {top_accounts.slice(0, 3).map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: "var(--text)", flexShrink: 0 }}>{formatEurWidget(a.balance)}</span>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────


export default function DashboardWidgets({ userName }: { userName: string }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<UnifiedEvent[] | null>(null);
  const [calendarError, setCalendarError] = useState(false);
  const [financeData, setFinanceData] = useState<FinanceWidgetData | null | undefined>(undefined);

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

    fetch("/api/finances/widget")
      .then((r) => r.json())
      .then((d) => setFinanceData(d.error ? null : d))
      .catch(() => setFinanceData(null));
  }, []);

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
          {getGreeting()}, {userName} !
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", textTransform: "capitalize" }}>
          {formatDateFR(new Date())}
        </p>
      </div>

      {/* Grid — 4 columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>

        {/* Calendrier — full width */}
        <div style={{ gridColumn: "span 4" }}>
          <CalendarWidget events={calendarEvents} error={calendarError} />
        </div>

        {/* Habitudes — full width, compact horizontal */}
        <div style={{ gridColumn: "span 4" }}>
          <HabitsWidget habits={dashboard?.habits} />
        </div>

        {/* Finances — span 2 */}
        <div style={{ gridColumn: "span 2" }}>
          <FinancesWidget data={financeData} />
        </div>

        {/* Projets — span 2 */}
        <div style={{ gridColumn: "span 2" }}>
          <ProjectsWidget projects={dashboard?.projects} />
        </div>

        {/* Méditation */}
        <MeditationWidget meditation={dashboard?.meditation} />

        {/* Lecture */}
        <ReadingWidget books={dashboard?.books_reading} />

        {/* Shopping */}
        <ShoppingWidget shopping={dashboard?.shopping} />

        {/* Journal */}
        <JournalWidget items={dashboard?.journal_review} />
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const widgetStyle: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: 12,
  padding: "16px 18px",
  boxShadow: "var(--shadow-sm)",
  border: "1.5px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  height: "100%",
  overflow: "hidden",
  minWidth: 0,
};

const compactWidgetStyle: React.CSSProperties = {
  background: "var(--surface)",
  borderRadius: 10,
  padding: "11px 13px",
  boxShadow: "var(--shadow-sm)",
  border: "1.5px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
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

const compactWidgetTitleStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--text-muted)",
};
