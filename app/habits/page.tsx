"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";
import { CustomSelect } from "@/components/CustomSelect";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  Cell,
} from "recharts";
import type { DBHabit, DBHabitWithStats } from "@/types";
import { StatsSkeleton } from "@/components/skeletons/StatsSkeleton";
import { Spinner } from "@/components/Spinner";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "today" | "calendar" | "stats";
type FreqType = "daily" | "weekly" | "specific_days" | "monthly";

const FREQ_LABELS: Record<FreqType, string> = {
  daily: "Chaque jour",
  weekly: "Hebdomadaire",
  specific_days: "Jours spécifiques",
  monthly: "Mensuel (jour du mois)",
};

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isHabitDue(habit: DBHabit, date: Date): boolean {
  const isoDay = date.getDay() === 0 ? 7 : date.getDay();
  switch (habit.frequency_type) {
    case "daily": return true;
    case "specific_days": {
      const days: number[] = JSON.parse(habit.frequency_days || "[]");
      return days.includes(isoDay);
    }
    case "weekly": return true;
    case "monthly": {
      const day = parseInt(habit.frequency_days || "1", 10);
      return date.getDate() === day;
    }
    default: return false;
  }
}

function ldate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  return ldate(new Date());
}

// ── Main page ─────────────────────────────────────────────────────────────────

const VALID_HABITS_TABS: Tab[] = ["today", "calendar", "stats"];

export default function HabitsPage() {
  useDynamicFavicon("🎯");
  useEffect(() => { document.title = "Habitudes — life×hub"; }, []);

  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "today";
    const p = new URLSearchParams(window.location.search).get("tab") as Tab;
    return VALID_HABITS_TABS.includes(p) ? p : "today";
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }, [tab]);
  const [habits, setHabits] = useState<DBHabitWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editHabit, setEditHabit] = useState<DBHabitWithStats | null>(null);

  const fetchHabits = useCallback(async () => {
    const res = await fetch("/api/habits");
    if (res.ok) setHabits(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  const handleToggle = async (habit: DBHabitWithStats) => {
    setTogglingId(habit.id);
    const today = todayStr();
    if (habit.completed_today) {
      await fetch(`/api/habits/log?habit_id=${habit.id}&date=${today}`, { method: "DELETE" });
    } else {
      await fetch("/api/habits/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habit_id: habit.id, completed_date: today }),
      });
    }
    setTogglingId(null);
    // Optimistic update
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habit.id
          ? { ...h, completed_today: !h.completed_today }
          : h
      )
    );
    // Refetch for accurate streaks
    fetchHabits();
  };

  const handleArchive = async (id: string) => {
    await fetch(`/api/habits?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false, archived_at: new Date().toISOString() }),
    });
    fetchHabits();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette habitude et tous ses logs ?")) return;
    await fetch(`/api/habits?id=${id}`, { method: "DELETE" });
    fetchHabits();
  };

  const todayHabits = habits.filter((h) => isHabitDue(h as unknown as DBHabit, new Date()));
  const doneCount = todayHabits.filter((h) => h.completed_today).length;

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <div style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>

        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🎯 Habitudes</h1>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setEditHabit(null); setShowForm(true); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 18px",
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(59,126,248,0.25)",
            letterSpacing: "0.01em",
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          Nouvelle habitude
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "0 24px",
      }}>
        {(["today", "calendar", "stats"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "12px 20px",
              border: "none",
              borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`,
              background: "none",
              color: tab === t ? "var(--accent)" : "var(--text-muted)",
              fontWeight: tab === t ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {t === "today" ? "Aujourd'hui" : t === "calendar" ? "Calendrier" : "Statistiques"}
          </button>
        ))}
      </div>

      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        {loading ? (
          <StatsSkeleton kpiCount={4} />
        ) : tab === "today" ? (
          <TodayTab
            habits={habits}
            todayHabits={todayHabits}
            doneCount={doneCount}
            onToggle={handleToggle}
            togglingId={togglingId}
            onEdit={(h) => { setEditHabit(h); setShowForm(true); }}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        ) : tab === "calendar" ? (
          <CalendarTab habits={habits} onRefreshHabits={fetchHabits} />
        ) : (
          <StatsTab habits={habits} />
        )}
      </div>

      {showForm && (
        <HabitFormModal
          habit={editHabit}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchHabits(); }}
        />
      )}
    </main>
  );
}

// ── Today Tab ─────────────────────────────────────────────────────────────────

function TodayTab({
  habits, todayHabits, doneCount, onToggle, onEdit, onArchive, onDelete, togglingId,
}: {
  habits: DBHabitWithStats[];
  todayHabits: DBHabitWithStats[];
  doneCount: number;
  onToggle: (h: DBHabitWithStats) => void;
  onEdit: (h: DBHabitWithStats) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  togglingId?: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const total = todayHabits.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const notDueToday = habits.filter((h) => !isHabitDue(h as unknown as DBHabit, new Date()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Progress summary */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{doneCount}</span>
            <span style={{ fontSize: 18, color: "var(--text-muted)", marginLeft: 6 }}>/ {total} aujourd'hui</span>
          </div>
          <div style={{
            fontSize: 24,
            fontWeight: 700,
            color: pct === 100 ? "var(--green)" : "var(--accent)",
          }}>
            {pct}%
          </div>
        </div>
        <div style={{ background: "var(--border)", borderRadius: 4, height: 8, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`,
            height: "100%",
            background: pct === 100 ? "var(--green)" : "var(--accent)",
            borderRadius: 4,
            transition: "width 0.3s",
          }} />
        </div>
        {pct === 100 && total > 0 && (
          <div style={{ marginTop: 8, color: "var(--green)", fontSize: 13, fontWeight: 600 }}>
            Toutes les habitudes complétées ! 🎉
          </div>
        )}
      </div>

      {/* Habit list for today */}
      {total === 0 ? (
        <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>
          Aucune habitude prévue aujourd'hui.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {todayHabits.map((h) => (
            <HabitRow
              key={h.id}
              habit={h}
              onToggle={() => onToggle(h)}
              onEdit={() => onEdit(h)}
              onArchive={() => onArchive(h.id)}
              onDelete={() => onDelete(h.id)}
              toggling={togglingId === h.id}
            />
          ))}
        </div>
      )}

      {/* Not due today (collapsible) */}
      {notDueToday.length > 0 && (
        <div>
          <button
            onClick={() => setShowAll((v) => !v)}
            style={{
              background: "none", border: "none", color: "var(--text-muted)",
              fontSize: 13, cursor: "pointer", padding: "4px 0",
            }}
          >
            {showAll ? "▾" : "▸"} {notDueToday.length} habitude{notDueToday.length > 1 ? "s" : ""} non prévue{notDueToday.length > 1 ? "s" : ""} aujourd'hui
          </button>
          {showAll && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, opacity: 0.6 }}>
              {notDueToday.map((h) => (
                <HabitRow
                  key={h.id}
                  habit={h}
                  onToggle={() => onToggle(h)}
                  onEdit={() => onEdit(h)}
                  onArchive={() => onArchive(h.id)}
                  onDelete={() => onDelete(h.id)}
                  dimmed
                  toggling={togglingId === h.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Habit Row ─────────────────────────────────────────────────────────────────

function HabitRow({
  habit, onToggle, onEdit, onArchive, onDelete, dimmed, toggling,
}: {
  habit: DBHabitWithStats;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  dimmed?: boolean;
  toggling?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${habit.completed_today ? (habit.color || "var(--accent)") : "var(--border)"}`,
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: dimmed ? 0.6 : 1,
        transition: "border-color 0.2s",
      }}
    >
      {/* Checkbox / Spinner */}
      {toggling ? (
        <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Spinner size={20} color={habit.color || "var(--accent)"} />
        </div>
      ) : (
      <button
        onClick={onToggle}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: `2px solid ${habit.color || "var(--accent)"}`,
          background: habit.completed_today ? (habit.color || "var(--accent)") : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          transition: "background 0.2s",
        }}
      >
        {habit.completed_today && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7l4 4 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      )}

      {/* Icon + Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {habit.icon && <span style={{ fontSize: 16 }}>{habit.icon}</span>}
          <span style={{
            fontWeight: 600,
            fontSize: 14,
            textDecoration: habit.completed_today ? "line-through" : "none",
            color: habit.completed_today ? "var(--text-muted)" : "var(--text)",
          }}>
            {habit.name}
          </span>
        </div>
        {habit.description && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {habit.description}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
        <StatBadge label="Série" value={`${habit.current_streak}j`} accent={habit.current_streak > 0} />
        <StatBadge label="Meilleur" value={`${habit.best_streak}j`} />
        <StatBadge label="30j" value={`${habit.completion_rate_30d}%`} />
      </div>

      {/* Menu */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, fontSize: 16 }}
        >
          ···
        </button>
        {menuOpen && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 10 }}
              onClick={() => setMenuOpen(false)}
            />
            <div style={{
              position: "absolute", right: 0, top: "100%", zIndex: 20,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 8, boxShadow: "var(--shadow-md)", minWidth: 140,
              overflow: "hidden",
            }}>
              {[
                { label: "Modifier", action: onEdit },
                { label: "Archiver", action: onArchive },
                { label: "Supprimer", action: onDelete, danger: true },
              ].map(({ label, action, danger }) => (
                <button
                  key={label}
                  onClick={() => { setMenuOpen(false); action(); }}
                  style={{
                    display: "block", width: "100%", padding: "8px 14px",
                    background: "none", border: "none", textAlign: "left",
                    cursor: "pointer", fontSize: 13,
                    color: danger ? "var(--red)" : "var(--text)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatBadge({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ textAlign: "center", minWidth: 40 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: accent ? "var(--accent)" : "var(--text)" }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

// ── Calendar Tab ──────────────────────────────────────────────────────────────

// SVG completion ring for each day cell
function CompletionRing({ done, total }: { done: number; total: number }) {
  const r = 15;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const strokeColor = pct === 1 ? "var(--green)" : "var(--accent)";
  return (
    <svg width={38} height={38} viewBox="0 0 38 38" style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={19} cy={19} r={r} fill="none" stroke="var(--surface2)" strokeWidth={3} />
      {pct > 0 && (
        <circle
          cx={19} cy={19} r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={3}
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function CalendarTab({ habits, onRefreshHabits }: { habits: DBHabitWithStats[]; onRefreshHabits: () => void }) {
  const [view, setView] = useState<"month" | "week">("month");
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  // Compute visible date range
  const { rangeFrom, rangeTo, displayYear, displayMonth, weekDays, periodLabel } = useMemo(() => {
    if (view === "month") {
      const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      return {
        rangeFrom: ldate(d),
        rangeTo: ldate(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
        displayYear: d.getFullYear(),
        displayMonth: d.getMonth(),
        weekDays: null as Date[] | null,
        periodLabel: `${MONTH_FR[d.getMonth()]} ${d.getFullYear()}`,
      };
    } else {
      const ws = new Date(today);
      const dow = ws.getDay() === 0 ? 6 : ws.getDay() - 1;
      ws.setDate(ws.getDate() - dow + weekOffset * 7);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(ws.getDate() + i); return d; });
      const fmtShort = (d: Date) => `${d.getDate()} ${MONTH_FR[d.getMonth()].slice(0, 3).toLowerCase()}`;
      return {
        rangeFrom: ldate(ws),
        rangeTo: ldate(we),
        displayYear: ws.getFullYear(),
        displayMonth: ws.getMonth(),
        weekDays: days,
        periodLabel: `${fmtShort(ws)} – ${fmtShort(we)} ${we.getFullYear()}`,
      };
    }
  }, [view, monthOffset, weekOffset, today]);

  const fetchLogs = useCallback(() => {
    fetch(`/api/habits/log?from=${rangeFrom}&to=${rangeTo}`)
      .then((r) => r.json())
      .then((data: { habit_id: string; completed_date: string }[]) => {
        const map: Record<string, string[]> = {};
        for (const log of data) {
          if (!map[log.habit_id]) map[log.habit_id] = [];
          map[log.habit_id].push(log.completed_date);
        }
        setLogs(map);
      });
  }, [rangeFrom, rangeTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const toggleLog = async (habitId: string, dateStr: string, done: boolean) => {
    setLogs((prev) => ({
      ...prev,
      [habitId]: done
        ? (prev[habitId] || []).filter((d) => d !== dateStr)
        : [...(prev[habitId] || []), dateStr],
    }));
    try {
      if (done) {
        await fetch(`/api/habits/log?habit_id=${habitId}&date=${dateStr}`, { method: "DELETE" });
      } else {
        await fetch("/api/habits/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ habit_id: habitId, completed_date: dateStr }),
        });
      }
      onRefreshHabits();
    } catch {
      fetchLogs();
    }
  };

  // For a given date, compute due habits and done count
  const getDayStats = useCallback((dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const due = habits.filter((h) => isHabitDue(h as unknown as DBHabit, d));
    const done = due.filter((h) => (logs[h.id] || []).includes(dateStr)).length;
    return { due: due.length, done };
  }, [habits, logs]);

  // Month grid
  const monthGrid = useMemo(() => {
    const firstDow = new Date(displayYear, displayMonth, 1).getDay();
    const startOffset = firstDow === 0 ? 6 : firstDow - 1;
    const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
    const grid: (number | null)[] = [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [displayYear, displayMonth]);

  const isAtCurrentPeriod = view === "month" ? monthOffset === 0 : weekOffset === 0;

  const prevPeriod = () => view === "month" ? setMonthOffset((v) => v - 1) : setWeekOffset((v) => v - 1);
  const nextPeriod = () => view === "month" ? setMonthOffset((v) => v + 1) : setWeekOffset((v) => v + 1);
  const resetPeriod = () => { setMonthOffset(0); setWeekOffset(0); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {/* Nav */}
        <button onClick={prevPeriod} style={navBtnStyle}>‹</button>
        <span style={{ fontWeight: 600, fontSize: 15, minWidth: 200, textAlign: "center", textTransform: "capitalize" }}>
          {periodLabel}
        </span>
        <button onClick={nextPeriod} disabled={isAtCurrentPeriod} style={{ ...navBtnStyle, opacity: isAtCurrentPeriod ? 0.35 : 1 }}>›</button>
        {!isAtCurrentPeriod && (
          <button onClick={resetPeriod} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            Aujourd'hui
          </button>
        )}
        {/* View toggle */}
        <div style={{ marginLeft: "auto", display: "flex", background: "var(--surface2)", borderRadius: 8, padding: 3, gap: 2 }}>
          {(["month", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "none",
                background: view === v ? "var(--surface)" : "transparent",
                color: view === v ? "var(--text)" : "var(--text-muted)",
                fontWeight: view === v ? 600 : 400,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: view === v ? "var(--shadow-sm)" : "none",
              }}
            >
              {v === "month" ? "Mois" : "Semaine"}
            </button>
          ))}
        </div>
      </div>

      {habits.length === 0 ? (
        <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>Aucune habitude active.</div>
      ) : view === "month" ? (
        /* ── Month view ── */
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
            {DAY_LABELS.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 0" }}>{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {monthGrid.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const dateStr = `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const d = new Date(displayYear, displayMonth, day);
              const isFuture = d > today;
              const isToday = dateStr === todayStr();
              const { due, done } = getDayStats(dateStr);
              const isSelected = selectedDate === dateStr;

              return (
                <div
                  key={idx}
                  onClick={() => !isFuture && setSelectedDate(isSelected ? null : dateStr)}
                  title={!isFuture ? `${done}/${due} habitudes` : undefined}
                  style={{
                    borderRadius: 10,
                    padding: "6px 4px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    cursor: isFuture ? "default" : "pointer",
                    opacity: isFuture ? 0.3 : 1,
                    background: isSelected ? "rgba(59,126,248,0.08)" : isToday ? "rgba(59,126,248,0.04)" : "transparent",
                    border: isToday ? "2px solid var(--accent)" : isSelected ? "2px solid var(--accent)" : "2px solid transparent",
                    transition: "background 0.15s",
                  }}
                >
                  {/* Day number */}
                  <span style={{
                    fontSize: 12,
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? "var(--accent)" : "var(--text)",
                  }}>
                    {day}
                  </span>
                  {/* Ring */}
                  {due > 0 && !isFuture && <CompletionRing done={done} total={due} />}
                  {/* Count label */}
                  {due > 0 && !isFuture && (
                    <span style={{ fontSize: 9, color: done === due ? "var(--green)" : "var(--text-muted)", fontWeight: 600 }}>
                      {done}/{due}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Week view ── */
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(7, minmax(120px, 1fr))`, gap: 8, minWidth: 700 }}>
            {weekDays!.map((day) => {
              const dateStr = ldate(day);
              const isFuture = day > today;
              const isToday = dateStr === todayStr();
              const dueHabits = habits.filter((h) => isHabitDue(h as unknown as DBHabit, day));
              const { done } = getDayStats(dateStr);

              return (
                <div key={dateStr} style={{
                  borderRadius: 10,
                  border: isToday ? "2px solid var(--accent)" : "1px solid var(--border)",
                  background: isToday ? "rgba(59,126,248,0.04)" : "var(--bg)",
                  overflow: "hidden",
                }}>
                  {/* Day header */}
                  <div style={{
                    padding: "8px 10px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: isToday ? "rgba(59,126,248,0.06)" : "transparent",
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: isToday ? "var(--accent)" : "var(--text-muted)", fontWeight: 600, textTransform: "uppercase" }}>
                        {DAY_LABELS[day.getDay() === 0 ? 6 : day.getDay() - 1]}
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: isToday ? "var(--accent)" : "var(--text)", lineHeight: 1.2 }}>
                        {day.getDate()}
                      </div>
                    </div>
                    {dueHabits.length > 0 && (
                      <span style={{ fontSize: 11, color: done === dueHabits.length ? "var(--green)" : "var(--text-muted)", fontWeight: 600 }}>
                        {done}/{dueHabits.length}
                      </span>
                    )}
                  </div>
                  {/* Habit list */}
                  <div style={{ padding: "6px 0" }}>
                    {dueHabits.length === 0 ? (
                      <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>—</div>
                    ) : dueHabits.map((h) => {
                      const done = (logs[h.id] || []).includes(dateStr);
                      return (
                        <div
                          key={h.id}
                          onClick={() => !isFuture && toggleLog(h.id, dateStr, done)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            padding: "5px 10px",
                            cursor: isFuture ? "default" : "pointer",
                            opacity: isFuture ? 0.45 : 1,
                            background: done ? `${h.color || "var(--accent)"}18` : "transparent",
                            transition: "background 0.15s",
                          }}
                        >
                          <div style={{
                            width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                            border: `2px solid ${h.color || "var(--accent)"}`,
                            background: done ? (h.color || "var(--accent)") : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {done && (
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span style={{ fontSize: 12, color: done ? "var(--text-muted)" : "var(--text)", textDecoration: done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {h.icon ? `${h.icon} ` : ""}{h.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Day panel (drawer) ── */}
      {selectedDate && (
        <DayPanel
          dateStr={selectedDate}
          habits={habits}
          logs={logs}
          today={today}
          onToggle={toggleLog}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "5px 12px",
  cursor: "pointer",
  fontSize: 16,
  color: "var(--text)",
  lineHeight: 1,
};

// ── Day Panel (drawer) ────────────────────────────────────────────────────────

function DayPanel({
  dateStr, habits, logs, today, onToggle, onClose,
}: {
  dateStr: string;
  habits: DBHabitWithStats[];
  logs: Record<string, string[]>;
  today: Date;
  onToggle: (habitId: string, dateStr: string, done: boolean) => void;
  onClose: () => void;
}) {
  const d = new Date(dateStr + "T00:00:00");
  const isFuture = d > today;
  const dueHabits = habits.filter((h) => isHabitDue(h as unknown as DBHabit, d));
  const doneIds = new Set(dueHabits.filter((h) => (logs[h.id] || []).includes(dateStr)).map((h) => h.id));
  const doneCount = doneIds.size;

  const dateLabel = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 40, backdropFilter: "blur(2px)" }}
      />
      {/* Drawer */}
      <div style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 360,
        maxWidth: "100vw",
        background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", textTransform: "capitalize" }}>{dateLabel}</div>
              {dueHabits.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${dueHabits.length > 0 ? Math.round((doneCount / dueHabits.length) * 100) : 0}%`,
                      background: doneCount === dueHabits.length ? "var(--green)" : "var(--accent)",
                      borderRadius: 3,
                      transition: "width 0.3s",
                    }} />
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>{doneCount}/{dueHabits.length}</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 20, lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Habit list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px" }}>
          {isFuture && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "8px 0 12px" }}>
              Les jours futurs ne peuvent pas être cochés.
            </div>
          )}
          {dueHabits.length === 0 ? (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "24px 0", fontSize: 13 }}>
              Aucune habitude prévue ce jour.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 8px 8px" }}>
                Habitudes prévues
              </div>
              {/* Done first */}
              {[...dueHabits].sort((a, b) => (doneIds.has(b.id) ? 1 : 0) - (doneIds.has(a.id) ? 1 : 0)).map((h) => {
                const done = doneIds.has(h.id);
                return (
                  <div
                    key={h.id}
                    onClick={() => !isFuture && onToggle(h.id, dateStr, done)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 8px",
                      borderRadius: 8,
                      marginBottom: 4,
                      cursor: isFuture ? "default" : "pointer",
                      background: done ? `${h.color || "#6366f1"}15` : "transparent",
                      border: `1px solid ${done ? (h.color || "var(--accent)") + "40" : "transparent"}`,
                      transition: "background 0.15s",
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${h.color || "var(--accent)"}`,
                      background: done ? (h.color || "var(--accent)") : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      opacity: isFuture ? 0.4 : 1,
                      transition: "background 0.15s",
                    }}>
                      {done && (
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                          <path d="M1.5 5.5l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: done ? "var(--text-muted)" : "var(--text)",
                        textDecoration: done ? "line-through" : "none",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {h.icon ? `${h.icon} ` : ""}{h.name}
                      </div>
                    </div>
                    {/* Streak */}
                    <div style={{ fontSize: 11, color: h.current_streak > 0 ? "var(--accent)" : "var(--text-muted)", flexShrink: 0, fontWeight: 600 }}>
                      ⚡{h.current_streak}
                    </div>
                  </div>
                );
              })}
            </>
          )}

        </div>
      </div>
    </>
  );
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────

type StatsSubTab = "general" | "per-habit";

function StatsTab({ habits }: { habits: DBHabitWithStats[] }) {
  const [subTab, setSubTab] = useState<StatsSubTab>("general");
  const [selectedId, setSelectedId] = useState<string | null>(habits[0]?.id ?? null);
  const [statsData, setStatsData] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (subTab !== "per-habit" || !selectedId) return;
    setLoadingStats(true);
    fetch(`/api/habits/stats?id=${selectedId}&days=90`)
      .then((r) => r.json())
      .then((data) => { setStatsData(data); setLoadingStats(false); });
  }, [selectedId, subTab]);

  if (habits.length === 0) {
    return <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>Aucune habitude active.</div>;
  }

  const selected = habits.find((h) => h.id === selectedId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Sub-tab toggle */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: -8 }}>
        {(["general", "per-habit"] as StatsSubTab[]).map((st) => (
          <button
            key={st}
            onClick={() => setSubTab(st)}
            style={{
              padding: "8px 18px",
              border: "none",
              borderBottom: `2px solid ${subTab === st ? "var(--accent)" : "transparent"}`,
              background: "none",
              color: subTab === st ? "var(--accent)" : "var(--text-muted)",
              fontWeight: subTab === st ? 600 : 400,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {st === "general" ? "Général" : "Par habitude"}
          </button>
        ))}
      </div>

      {subTab === "general" ? (
        <GeneralStatsTab habits={habits} />
      ) : (
      <>
      {/* Habit selector */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {habits.map((h) => (
          <button
            key={h.id}
            onClick={() => setSelectedId(h.id)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: `1.5px solid ${selectedId === h.id ? (h.color || "var(--accent)") : "var(--border)"}`,
              background: selectedId === h.id ? (h.color || "var(--accent)") : "transparent",
              color: selectedId === h.id ? "white" : "var(--text)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: selectedId === h.id ? 600 : 400,
            }}
          >
            {h.icon ? `${h.icon} ` : ""}{h.name}
          </button>
        ))}
      </div>

      {loadingStats || !statsData ? (
        <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>Chargement…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Série actuelle", value: `${selected?.current_streak ?? 0}j`, color: "var(--accent)" },
              { label: "Meilleure série", value: `${selected?.best_streak ?? 0}j`, color: "var(--accent2)" },
              { label: "Taux 30j", value: `${selected?.completion_rate_30d ?? 0}%`, color: "var(--green)" },
              { label: "Cette semaine", value: `${selected?.logs_this_week ?? 0}`, color: "var(--text)" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Heatmap (90 days) */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Activité (90 jours)</div>
            <Heatmap data={statsData.heatmap} color={selected?.color || undefined} />
          </div>

          {/* Bar chart: by month */}
          {statsData.byMonth.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Complétions par mois</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={statsData.byMonth} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <Tooltip
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, name: string) => [v, name === "done" ? "Fait" : "Prévu"]}
                  />
                  <Bar dataKey="due" fill="var(--border)" radius={[3, 3, 0, 0]} name="due" />
                  <Bar dataKey="done" fill={selected?.color || "var(--accent)"} radius={[3, 3, 0, 0]} name="done" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Line chart: streak history */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Évolution de la série (30 jours)</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={statsData.streakHistory} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [v, "Série"]}
                  labelFormatter={(l: string) => l}
                />
                <Line type="monotone" dataKey="streak" stroke={selected?.color || "var(--accent)"} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Radar: by day of week */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Taux de complétion par jour</div>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={statsData.byDayOfWeek} cx="50%" cy="50%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text)" }} />
                <Radar name="Taux" dataKey="rate" stroke={selected?.color || "var(--accent)"} fill={selected?.color || "var(--accent)"} fillOpacity={0.25} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}%`, "Taux"]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

// ── GeneralStatsTab ───────────────────────────────────────────────────────────

type GeneralStats = {
  globalRate30d: number;
  bestDayOfWeek: string | null;
  mostRegularHabit: { name: string; icon: string | null; streak: number } | null;
  leastRegularHabit: { name: string; icon: string | null; rate: number } | null;
  dailyRates30d: { date: string; rate: number; done: number; due: number }[];
  byDayOfWeek: { label: string; done: number; due: number; rate: number }[];
  habitRanking: { id: string; name: string; icon: string | null; color: string | null; rate30d: number; streak: number }[];
  heatmap90d: { date: string; done: number; total: number; rate: number }[];
};

function GeneralStatsTab({ habits }: { habits: DBHabitWithStats[] }) {
  const [data, setData] = useState<GeneralStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/habits/general-stats")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) {
    return <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>Chargement…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>{data.globalRate30d}%</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Taux global 30j</div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent2)" }}>{data.bestDayOfWeek ?? "—"}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Meilleur jour</div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)", lineHeight: 1.3 }}>
            {data.mostRegularHabit
              ? `${data.mostRegularHabit.icon ? data.mostRegularHabit.icon + " " : ""}${data.mostRegularHabit.name}`
              : "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {data.mostRegularHabit ? `${data.mostRegularHabit.streak}j de suite` : ""}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Habitude la plus régulière</div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--red)", lineHeight: 1.3 }}>
            {data.leastRegularHabit
              ? `${data.leastRegularHabit.icon ? data.leastRegularHabit.icon + " " : ""}${data.leastRegularHabit.name}`
              : "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {data.leastRegularHabit ? `${data.leastRegularHabit.rate}% de complétion` : ""}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Habitude la moins régulière</div>
        </div>
      </div>

      {/* Graph 1: Daily completion rate 30 days */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Taux de complétion journalier (30 jours)</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data.dailyRates30d} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} interval={4} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [`${v}%`, "Taux"]}
            />
            <Bar dataKey="rate" radius={[3, 3, 0, 0]}>
              {data.dailyRates30d.map((entry, i) => (
                <Cell key={i} fill={entry.rate >= 80 ? "var(--green)" : entry.rate >= 50 ? "var(--accent)" : entry.due === 0 ? "var(--border)" : "var(--red)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Graph 2: Completion by day of week */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Complétion par jour de la semaine</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.byDayOfWeek} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [`${v}%`, "Taux moyen"]}
            />
            <Bar dataKey="rate" fill="var(--accent)" radius={[3, 3, 0, 0]}>
              {data.byDayOfWeek.map((entry, i) => (
                <Cell key={i} fill={entry.label === data.bestDayOfWeek ? "var(--green)" : "var(--accent)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Graph 3: Habit ranking */}
      {data.habitRanking.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Classement des habitudes (30 jours)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.habitRanking.map((h) => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 160, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>
                  {h.icon ? `${h.icon} ` : ""}{h.name}
                </div>
                <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 4, height: 14, overflow: "hidden" }}>
                  <div style={{
                    width: `${h.rate30d}%`,
                    height: "100%",
                    borderRadius: 4,
                    background: h.color || "var(--accent)",
                    transition: "width 0.4s ease",
                  }} />
                </div>
                <div style={{ width: 40, textAlign: "right", fontSize: 13, fontWeight: 600, color: "var(--text)", flexShrink: 0 }}>
                  {h.rate30d}%
                </div>
                <div style={{ width: 52, textAlign: "right", fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                  {h.streak > 0 ? `🔥 ${h.streak}j` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graph 4: Heatmap 90 days */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Activité globale (90 jours)</div>
        <GlobalHeatmap data={data.heatmap90d} totalHabits={habits.length} />
      </div>
    </div>
  );
}

// ── GlobalHeatmap ─────────────────────────────────────────────────────────────

function GlobalHeatmap({ data, totalHabits }: {
  data: { date: string; done: number; total: number; rate: number }[];
  totalHabits: number;
}) {
  const weeks: (typeof data[0] | null)[][] = [];
  let week: (typeof data[0] | null)[] = [];

  if (data.length > 0) {
    const firstDow = new Date(data[0].date + "T00:00:00").getDay();
    const offset = firstDow === 0 ? 6 : firstDow - 1;
    for (let i = 0; i < offset; i++) week.push(null);
  }

  for (const entry of data) {
    week.push(entry);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  function cellColor(rate: number, total: number): string {
    if (total === 0) return "var(--surface2)";
    if (rate === 0) return "var(--surface2)";
    if (rate < 25) return "#d1fae5";
    if (rate < 50) return "#6ee7b7";
    if (rate < 75) return "#34d399";
    if (rate < 100) return "#10b981";
    return "#059669";
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 3, overflowX: "auto" }}>
        {weeks.map((w, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {w.map((cell, di) => (
              <div
                key={di}
                title={cell ? `${cell.date}: ${cell.done}/${cell.total} (${cell.rate}%)` : undefined}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: !cell ? "transparent" : cellColor(cell.rate, cell.total),
                  border: cell ? "1px solid var(--border)" : "none",
                  opacity: !cell ? 0 : 1,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
        <span>0%</span>
        {["#d1fae5", "#6ee7b7", "#34d399", "#10b981", "#059669"].map((c, i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: c, border: "1px solid var(--border)" }} />
        ))}
        <span>100%</span>
      </div>
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function Heatmap({ data, color }: { data: { date: string; done: boolean; due: boolean }[]; color?: string }) {
  // Group by week (rows = 7 days, cols = weeks)
  const weeks: (typeof data[0] | null)[][] = [];
  let week: (typeof data[0] | null)[] = [];

  // Pad start to Monday
  if (data.length > 0) {
    const firstDow = new Date(data[0].date + "T00:00:00").getDay();
    const offset = firstDow === 0 ? 6 : firstDow - 1;
    for (let i = 0; i < offset; i++) week.push(null);
  }

  for (const entry of data) {
    week.push(entry);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const fill = color || "var(--accent)";

  return (
    <div style={{ display: "flex", gap: 3, overflowX: "auto" }}>
      {weeks.map((w, wi) => (
        <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {w.map((cell, di) => (
            <div
              key={di}
              title={cell?.date}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: !cell
                  ? "transparent"
                  : cell.done
                    ? fill
                    : cell.due
                      ? "var(--surface2)"
                      : "transparent",
                border: cell ? "1px solid var(--border)" : "none",
                opacity: !cell ? 0 : 1,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Habit Form Modal ──────────────────────────────────────────────────────────

function HabitFormModal({
  habit, onClose, onSaved,
}: {
  habit: DBHabitWithStats | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [icon, setIcon] = useState(habit?.icon ?? "");
  const [color, setColor] = useState(habit?.color ?? "#6366f1");
  const [freqType, setFreqType] = useState<FreqType>((habit?.frequency_type as FreqType) ?? "daily");
  const [freqDays, setFreqDays] = useState<number[]>(
    habit?.frequency_days ? JSON.parse(habit.frequency_days) : []
  );
  const [monthDay, setMonthDay] = useState(
    habit?.frequency_type === "monthly" ? parseInt(habit.frequency_days || "1", 10) : 1
  );
  const [target, setTarget] = useState(habit?.target_per_period ?? 1);
  const [saving, setSaving] = useState(false);

  const COLORS = ["#6366f1", "#ec4899", "#f97316", "#22c55e", "#06b6d4", "#a855f7", "#eab308", "#64748b"];

  const toggleDay = (day: number) => {
    setFreqDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description || null,
      icon: icon || null,
      color: color || null,
      frequency_type: freqType,
      frequency_days: freqType === "specific_days"
        ? JSON.stringify(freqDays)
        : freqType === "monthly"
          ? String(monthDay)
          : null,
      target_per_period: freqType === "weekly" ? target : 1,
    };

    if (habit) {
      await fetch(`/api/habits?id=${habit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100 }}
        onClick={onClose}
      />
      <div style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 101,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        boxShadow: "var(--shadow-md)",
        width: 480,
        maxWidth: "95vw",
        maxHeight: "90vh",
        overflowY: "auto",
        padding: 24,
      }}>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>
          {habit ? "Modifier l'habitude" : "Nouvelle habitude"}
        </h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Nom *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Méditer, Lire, Sport…"
              required
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionnel"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box" }}
            />
          </div>

          {/* Icon + Color */}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Icône (emoji)</label>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🎯"
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 18, textAlign: "center", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Couleur</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 220 }}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: c,
                      border: color === c ? "3px solid var(--text)" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Frequency type */}
          <div>
            <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Fréquence</label>
            <CustomSelect
              value={freqType}
              onChange={(v) => setFreqType(v as FreqType)}
              options={(Object.entries(FREQ_LABELS) as [FreqType, string][]).map(([k, v]) => ({ value: k, label: v }))}
            />
          </div>

          {/* Specific days picker */}
          {freqType === "specific_days" && (
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Jours (ISO: 1=Lun … 7=Dim)</label>
              <div style={{ display: "flex", gap: 6 }}>
                {DAY_LABELS.map((label, i) => {
                  const isoDay = i + 1;
                  return (
                    <button
                      key={isoDay}
                      type="button"
                      onClick={() => toggleDay(isoDay)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: freqDays.includes(isoDay) ? (color || "var(--accent)") : "var(--bg)",
                        color: freqDays.includes(isoDay) ? "white" : "var(--text)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly day picker */}
          {freqType === "monthly" && (
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Jour du mois (1–31)</label>
              <input
                type="number"
                min={1} max={31}
                value={monthDay}
                onChange={(e) => setMonthDay(parseInt(e.target.value, 10))}
                style={{ width: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14 }}
              />
            </div>
          )}

          {/* Weekly target */}
          {freqType === "weekly" && (
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Objectif par semaine</label>
              <input
                type="number"
                min={1} max={7}
                value={target}
                onChange={(e) => setTarget(parseInt(e.target.value, 10))}
                style={{ width: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14 }}
              />
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "none", cursor: "pointer", fontSize: 14 }}>
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 22px",
                background: saving ? "var(--text-muted)" : "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: saving ? "none" : "0 2px 10px rgba(59,126,248,0.3)",
                letterSpacing: "0.01em",
                transition: "background 0.2s, box-shadow 0.2s",
              }}
            >
              {saving ? (
                <>
                  <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Enregistrement…
                </>
              ) : habit ? (
                <>✓ Modifier</>
              ) : (
                <><span style={{ fontSize: 16 }}>+</span> Créer</>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
