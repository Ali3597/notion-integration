"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePomodoroContext, MODES } from "@/lib/pomodoro-context";

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
type DashboardData = {
  reminders: Reminder[];
  projects: ProjectWithTasks[];
  habits: HabitItem[];
  pomodoro: PomodoroStats;
  meditation: MeditationStats;
  books_reading: BookReading[];
  shopping: ShoppingStats;
};
type CalendarEvent = { title: string; start: string; end: string; allDay: boolean };

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


function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  return events.filter((e) => {
    const start = new Date(e.start);
    const end = new Date(e.end);
    return start <= dayEnd && end >= dayStart;
  });
}

// Returns the full 6-row grid for a month (Mon→Sun), including overflow days
function getMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
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

function getReminderBadge(due_date: string | null): { label: string; color: string } | null {
  if (!due_date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(due_date + "T00:00:00");
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: "En retard", color: "var(--red)" };
  if (diff === 0) return { label: "Aujourd'hui", color: "var(--accent)" };
  if (diff === 1) return { label: "Demain", color: "var(--accent2)" };
  return { label: `Dans ${diff}j`, color: "var(--text-muted)" };
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
            <Link href={action.href} style={widgetActionStyle}>
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

function EventChip({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  return (
    <div
      title={event.title}
      style={{
        fontSize: compact ? 9 : 10,
        padding: compact ? "1px 4px" : "2px 5px",
        background: "var(--accent)",
        color: "white",
        borderRadius: compact ? 3 : 4,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {!event.allDay && !compact && (
        <span style={{ opacity: 0.75, marginRight: 3 }}>
          {new Date(event.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
      {event.title}
    </div>
  );
}


function MonthView({ events, year, month }: { events: CalendarEvent[] | null; year: number; month: number }) {
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
          return (
            <div
              key={i}
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
              {/* Day number */}
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 3 }}>
                <span
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
                  }}
                >
                  {day.getDate()}
                </span>
              </div>
              {/* Events */}
              {events === null ? null : (
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {dayEvents.slice(0, 2).map((e, j) => <EventChip key={j} event={e} compact />)}
                  {dayEvents.length > 2 && (
                    <div style={{ fontSize: 9, color: "var(--text-muted)" }}>+{dayEvents.length - 2}</div>
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

function CalendarWidget({ events, error }: { events: CalendarEvent[] | null; error: boolean }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const now = new Date();
  const displayDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const displayYear = displayDate.getFullYear();
  const displayMonth = displayDate.getMonth();
  const monthLabel = displayDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

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
    <Widget title="Calendrier" icon="📅" headerExtra={headerExtra}>
      {error ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Calendrier non disponible</p>
      ) : (
        <MonthView events={events} year={displayYear} month={displayMonth} />
      )}
    </Widget>
  );
}

// ── Reminders widget ──────────────────────────────────────────────────────────

function RemindersWidget({ reminders: initial }: { reminders?: Reminder[] }) {
  const [reminders, setReminders] = useState<Reminder[]>(initial ?? []);
  const loading = initial === undefined;

  useEffect(() => {
    if (initial !== undefined) setReminders(initial);
  }, [initial]);

  const toggle = async (id: string, done: boolean) => {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, done } : r)));
    try {
      await fetch(`/api/reminders?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
    } catch {
      setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, done: !done } : r)));
    }
  };

  return (
    <Widget title="Rappels urgents" icon="🔔" action={{ label: "Tout voir →", href: "/reminders" }}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton /><Skeleton /><Skeleton />
        </div>
      ) : reminders.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>✅ Aucun rappel cette semaine</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {reminders.map((r) => {
            const badge = getReminderBadge(r.due_date);
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <button
                  onClick={() => toggle(r.id, !r.done)}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `1.5px solid ${r.done ? "var(--accent)" : "var(--border)"}`,
                    background: r.done ? "var(--accent)" : "transparent",
                    flexShrink: 0,
                    marginTop: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: 10,
                  }}
                >
                  {r.done && "✓"}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text)", textDecorationLine: r.done ? "line-through" : undefined, opacity: r.done ? 0.5 : 1 }}>
                    {r.name}
                  </div>
                  {badge && (
                    <span style={{ fontSize: 10, color: badge.color, fontWeight: 600 }}>{badge.label}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Widget>
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
  const { running, secondsLeft, mode, selectedProject, projects, todayStats, sessionStart, handlePause, handleStart } = usePomodoroContext();
  const loading = pomodoro === undefined;

  const modeConfig = MODES[mode];
  const modeColor = modeConfig.color;
  const projectName = projects.find((p) => p.id === selectedProject)?.name ?? null;

  // Live stats: prefer context (refreshed after each save), fallback to API
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
          {/* Live timer indicator */}
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

          {/* Stats */}
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
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split("T")[0];
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
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Aucune habitude prévue aujourd'hui.</p>
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

// ── Main export ───────────────────────────────────────────────────────────────

export default function DashboardWidgets({ userName }: { userName: string }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [calendar, setCalendar] = useState<CalendarEvent[] | null>(null);
  const [calendarError, setCalendarError] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setDashboard(d); })
      .catch(() => {});

    fetch("/api/calendar")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setCalendarError(true);
        else setCalendar(d);
      })
      .catch(() => setCalendarError(true));
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
        {/* Calendrier — col span 2 */}
        <div style={{ gridColumn: "span 2" }}>
          <CalendarWidget events={calendar} error={calendarError} />
        </div>

        {/* Rappels — col span 1 */}
        <RemindersWidget reminders={dashboard?.reminders} />

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

        {/* Lecture — col span 1 */}
        <ReadingWidget books={dashboard?.books_reading} />

        {/* Shopping — col span 1 */}
        <ShoppingWidget shopping={dashboard?.shopping} />
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

const widgetActionStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--accent)",
  textDecoration: "none",
  fontWeight: 500,
};
