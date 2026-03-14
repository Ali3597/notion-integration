"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { CustomSelect } from "@/components/CustomSelect";
import type { DBTask, DBProject } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Cell,
} from "recharts";
import { KanbanSkeleton } from "@/components/skeletons/KanbanSkeleton";
import { StatsSkeleton } from "@/components/skeletons/StatsSkeleton";
import { Spinner } from "@/components/Spinner";

// ─────────────────────────── Constants ────────────────────────────────────

const KANBAN_COLUMNS = [
  { id: "Non commencé", label: "À faire", color: "var(--text-muted)", bg: "rgba(136,136,170,0.06)", border: "rgba(136,136,170,0.2)" },
  { id: "En cours",     label: "En cours", color: "var(--accent)",     bg: "rgba(59,126,248,0.06)",  border: "rgba(59,126,248,0.25)" },
  { id: "Terminé",      label: "Terminé",  color: "var(--green)",      bg: "rgba(22,163,74,0.06)",   border: "rgba(22,163,74,0.25)" },
];

const STATUS_OPTIONS = [
  { value: "Non commencé", label: "À faire" },
  { value: "En cours",     label: "En cours" },
  { value: "Terminé",      label: "Terminé" },
];

function formatMinutes(min: number | null | undefined) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

// ─────────────────────────── Stats types ──────────────────────────────────

type ProjectStats = {
  completion: { total: number; done: number; in_progress: number; todo: number; pct: number };
  totalMinutes: number;
  sessionCount: number;
  timeByWeek: { week: string; minutes: number }[];
  tasksByWeek: { week: string; created: number; completed: number }[];
  timeByDow: { day: string; minutes: number }[];
  monthly: { month: string; sessions: number; minutes: number }[];
};

// ─────────────────────────── Task Modal ───────────────────────────────────

function TaskModal({
  open, onClose, onSave,
  projectId, initialStatus, task,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  projectId: string;
  initialStatus?: string;
  task?: DBTask | null;
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("Non commencé");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(task?.name ?? "");
      setStatus(task?.status ?? initialStatus ?? "Non commencé");
    }
  }, [open, task, initialStatus]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    if (task) {
      await fetch(`/api/pomodoro/tasks?id=${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), status }),
      });
    } else {
      await fetch("/api/pomodoro/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), status, project_id: projectId }),
      });
    }
    setSaving(false);
    onSave();
    onClose();
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <span style={modalStyles.title}>
            {task ? (
              <>
                {task.issue_number != null && (
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: 12, marginRight: 8 }}>
                    #{task.issue_number}
                  </span>
                )}
                Modifier la tâche
              </>
            ) : "Nouvelle tâche"}
          </span>
          <button onClick={onClose} style={modalStyles.closeBtn}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={modalStyles.form}>
          <div style={modalStyles.field}>
            <label style={modalStyles.label}>Nom *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={modalStyles.input}
              placeholder="Titre de la tâche"
              required
            />
          </div>
          <div style={modalStyles.field}>
            <label style={modalStyles.label}>Statut</label>
            <CustomSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          </div>
          <div style={modalStyles.footer}>
            <button type="button" onClick={onClose} style={modalStyles.btnCancel}>Annuler</button>
            <button type="submit" disabled={saving} style={modalStyles.btnSave}>
              {saving ? "..." : task ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────── Task Card ────────────────────────────────────

function TaskCard({
  task, projectMinutes, onEdit, onDelete, overlay = false, patching = false,
}: {
  task: DBTask;
  projectMinutes: number | null;
  onEdit: (t: DBTask) => void;
  onDelete: (id: string) => void;
  overlay?: boolean;
  patching?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const time = formatMinutes(projectMinutes);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1.5px solid var(--border)",
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: overlay ? "var(--shadow-md)" : "var(--shadow-sm)",
        cursor: overlay ? "grabbing" : "grab",
        userSelect: "none",
        position: "relative",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Issue number + actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", lineHeight: 1 }}>
          {task.issue_number != null ? `#${task.issue_number}` : ""}
        </span>
        {patching ? (
          <Spinner size={13} color="var(--accent)" />
        ) : (hovered || overlay) && (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(task); }}
              style={cardBtnStyle}
              title="Modifier"
            >✎</button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              style={{ ...cardBtnStyle, color: "var(--red)" }}
              title="Supprimer"
            >🗑</button>
          </div>
        )}
      </div>

      {/* Task name */}
      <div style={{
        fontSize: 13, fontWeight: 500, lineHeight: 1.4,
        textDecoration: task.status === "Terminé" ? "line-through" : "none",
        color: task.status === "Terminé" ? "var(--text-muted)" : "var(--text)",
      }}>
        {task.name}
      </div>

      {/* Footer: session time */}
      {time && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            ⏱ {time}
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Sortable Card ────────────────────────────────

function SortableCard({ task, projectMinutes, onEdit, onDelete, patching }: {
  task: DBTask;
  projectMinutes: number | null;
  onEdit: (t: DBTask) => void;
  onDelete: (id: string) => void;
  patching?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} projectMinutes={projectMinutes} onEdit={onEdit} onDelete={onDelete} patching={patching} />
    </div>
  );
}

// ─────────────────────────── Droppable Column ─────────────────────────────

function KanbanColumn({
  col, tasks, projectMinutes, onAddTask, onEditTask, onDeleteTask, patchingTaskId,
}: {
  col: typeof KANBAN_COLUMNS[number];
  tasks: DBTask[];
  projectMinutes: number | null;
  onAddTask: (status: string) => void;
  onEditTask: (t: DBTask) => void;
  onDeleteTask: (id: string) => void;
  patchingTaskId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div style={{
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Column header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 16px",
        flexShrink: 0,
        borderRadius: "12px 12px 0 0",
        backgroundColor: col.bg,
        border: `1.5px solid ${col.border}`,
        borderBottom: "none",
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: col.color, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {col.label}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "2px 7px",
          borderRadius: 20, backgroundColor: "var(--surface)",
          border: `1px solid ${col.border}`, color: col.color,
        }}>
          {tasks.length}
        </span>
      </div>

      {/* Cards zone — scrolls internally */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "10px 12px",
          borderRadius: "0 0 12px 12px",
          border: `1.5px solid ${col.border}`,
          borderTop: "1px dashed var(--border)",
          backgroundColor: isOver ? col.bg : "var(--surface)",
          transition: "background-color 0.15s",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableCard
              key={t.id}
              task={t}
              projectMinutes={projectMinutes}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              patching={patchingTaskId === t.id}
            />
          ))}
        </SortableContext>

        {/* Add task link */}
        <button
          onClick={() => onAddTask(col.id)}
          style={{
            background: "none", border: "none",
            color: "var(--text-muted)", fontSize: 12, cursor: "pointer",
            padding: "6px 4px", textAlign: "left",
            display: "flex", alignItems: "center", gap: 4,
            borderRadius: 6, marginTop: 2,
            transition: "color 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = col.color; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
        >
          + Ajouter une tâche
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── Stats section ────────────────────────────────

function StatsSection({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/pomodoro/projects/${projectId}/stats`)
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [projectId, refreshKey]);

  if (loading) return <StatsSkeleton kpiCount={4} />;

  if (!stats) return null;

  const { completion, totalMinutes, sessionCount, timeByWeek, tasksByWeek, timeByDow, monthly } = stats;

  const tooltipStyle = {
    contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 },
    itemStyle: { color: "var(--text)" },
    labelStyle: { color: "var(--text-muted)", fontSize: 11 },
    cursor: { fill: "rgba(59,126,248,0.06)" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Section title */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        Statistiques
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          {
            label: "Avancement",
            value: `${completion.done} / ${completion.total}`,
            sub: `${completion.pct}% terminé`,
            accent: "var(--green)",
            extra: (
              <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginTop: 6 }}>
                <div style={{ height: "100%", width: `${completion.pct}%`, background: "var(--green)", borderRadius: 2, transition: "width 0.4s ease" }} />
              </div>
            ),
          },
          {
            label: "Temps total",
            value: formatMinutes(totalMinutes) ?? "—",
            sub: `${sessionCount} session${sessionCount !== 1 ? "s" : ""}`,
            accent: "var(--accent)",
          },
          {
            label: "En cours",
            value: String(completion.in_progress),
            sub: "tâche" + (completion.in_progress !== 1 ? "s" : ""),
            accent: "rgba(59,126,248,0.8)",
          },
          {
            label: "À faire",
            value: String(completion.todo),
            sub: "tâche" + (completion.todo !== 1 ? "s" : "") + " restante" + (completion.todo !== 1 ? "s" : ""),
            accent: "var(--text-muted)",
          },
        ].map((card) => (
          <div key={card.label} style={kpiCard}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              {card.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: card.accent, lineHeight: 1.2, marginTop: 4 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{card.sub}</div>
            {card.extra}
          </div>
        ))}
      </div>

      {/* Charts grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Temps / semaine */}
        <div style={chartCard}>
          <div style={chartTitle}>Temps / semaine (4 sem.)</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={timeByWeek} barSize={28}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v: number) => [formatMinutes(v) ?? `${v}min`, "Temps"]}
                {...tooltipStyle}
              />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                {timeByWeek.map((_, i) => (
                  <Cell key={i} fill={i === timeByWeek.length - 1 ? "var(--accent)" : "rgba(59,126,248,0.35)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tâches / semaine */}
        <div style={chartCard}>
          <div style={chartTitle}>Tâches / semaine (8 sem.)</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={tasksByWeek} barSize={14} barGap={2}>
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis hide allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="created" name="Créées" fill="rgba(136,136,170,0.35)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="completed" name="Terminées" fill="rgba(22,163,74,0.6)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Temps par jour de semaine */}
        <div style={chartCard}>
          <div style={chartTitle}>Par jour de semaine</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={timeByDow} barSize={24}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v: number) => [formatMinutes(v) ?? `${v}min`, "Temps"]}
                {...tooltipStyle}
              />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]} fill="rgba(59,126,248,0.45)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activité mensuelle */}
        <div style={chartCard}>
          <div style={chartTitle}>Activité mensuelle</div>
          {monthly.length === 0 ? (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
              Aucune donnée
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={monthly.map((r) => ({ ...r, month: formatMonth(r.month) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number, name: string) =>
                    name === "minutes" ? [formatMinutes(v) ?? `${v}min`, "Temps"] : [v, "Sessions"]
                  }
                  {...tooltipStyle}
                />
                <Line type="monotone" dataKey="minutes" name="minutes" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent)" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────── Main Page ────────────────────────────────────

type ProjectDetail = DBProject & {
  parents: { id: string; name: string }[];
  children: { id: string; name: string; own_minutes: number }[];
};

function getColumnId(id: string, cols: Record<string, DBTask[]>): string | null {
  if (id in cols) return id;
  for (const [colId, tasks] of Object.entries(cols)) {
    if (tasks.some((t) => t.id === id)) return colId;
  }
  return null;
}

export default function ProjectKanbanPage() {
  const { id } = useParams<{ id: string }>();
  useDynamicFavicon("📁");

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [columns, setColumns] = useState<Record<string, DBTask[]>>({
    "Non commencé": [],
    "En cours": [],
    "Terminé": [],
  });
  const [loading, setLoading] = useState(true);
  const [statsKey, setStatsKey] = useState(0);
  const [activeTask, setActiveTask] = useState<DBTask | null>(null);
  const [patchingTaskId, setPatchingTaskId] = useState<string | null>(null);
  const dragFromColRef = useRef<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTask, setModalTask] = useState<DBTask | null>(null);
  const [modalStatus, setModalStatus] = useState("Non commencé");

  useEffect(() => {
    document.title = project ? `${project.name} — life×hub` : "Projets — life×hub";
  }, [project]);

  const projectMinutes = project?.own_minutes ?? null;

  const load = useCallback(async () => {
    const [projData, tasksData] = await Promise.all([
      fetch("/api/pomodoro/projects").then((r) => r.json()),
      fetch(`/api/pomodoro/tasks?projectId=${id}&all=true`).then((r) => r.json()),
    ]);
    const proj = Array.isArray(projData) ? projData.find((p: ProjectDetail) => p.id === id) : null;
    setProject(proj ?? null);
    const taskList: DBTask[] = Array.isArray(tasksData) ? tasksData : [];
    setColumns({
      "Non commencé": taskList.filter((t) => t.status === "Non commencé"),
      "En cours":     taskList.filter((t) => t.status === "En cours"),
      "Terminé":      taskList.filter((t) => t.status === "Terminé"),
    });
    setLoading(false);
    setStatsKey((k) => k + 1);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── DnD handlers ──

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragStart({ active }: DragStartEvent) {
    const colId = getColumnId(active.id as string, columns);
    dragFromColRef.current = colId;
    if (!colId) return;
    const task = columns[colId].find((t) => t.id === active.id) ?? null;
    setActiveTask(task);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const fromCol = getColumnId(active.id as string, columns);
    const toCol = getColumnId(over.id as string, columns);
    if (!fromCol || !toCol || fromCol === toCol) return;

    setColumns((prev) => {
      const task = prev[fromCol].find((t) => t.id === active.id);
      if (!task) return prev;
      return {
        ...prev,
        [fromCol]: prev[fromCol].filter((t) => t.id !== active.id),
        [toCol]: [...prev[toCol], { ...task, status: toCol }],
      };
    });
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    // Use the ref — columns state was already mutated by DragOver
    const fromCol = dragFromColRef.current;
    dragFromColRef.current = null;

    if (!over || !fromCol) return;

    const toCol = getColumnId(over.id as string, columns);
    if (!toCol) return;

    // Same column reorder
    if (fromCol === toCol) {
      const oldIndex = columns[fromCol].findIndex((t) => t.id === active.id);
      const newIndex = columns[fromCol].findIndex((t) => t.id === over.id);
      if (oldIndex !== newIndex && newIndex !== -1) {
        setColumns((prev) => ({
          ...prev,
          [fromCol]: arrayMove(prev[fromCol], oldIndex, newIndex),
        }));
      }
      return;
    }

    // Status changed — already moved optimistically in DragOver, now persist
    setPatchingTaskId(active.id as string);
    try {
      await fetch(`/api/pomodoro/tasks?id=${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toCol }),
      });
    } catch {
      load(); // Rollback on error
    } finally {
      setPatchingTaskId(null);
    }
  }

  // ── Task actions ──

  function openCreate(status: string) {
    setModalTask(null);
    setModalStatus(status);
    setModalOpen(true);
  }

  function openEdit(task: DBTask) {
    setModalTask(task);
    setModalStatus(task.status ?? "Non commencé");
    setModalOpen(true);
  }

  async function handleDelete(taskId: string) {
    if (!confirm("Supprimer cette tâche ?")) return;
    await fetch(`/api/pomodoro/tasks?id=${taskId}`, { method: "DELETE" });
    load();
  }

  // ── Header counters ──

  const allTasks = Object.values(columns).flat();
  const totalCount = allTasks.length;
  const inProgressCount = (columns["En cours"] ?? []).length;
  const doneCount = (columns["Terminé"] ?? []).length;

  function statusColor(s: string | null) {
    if (s === "En cours") return "rgba(59,126,248,0.12)";
    if (s === "Terminé") return "rgba(22,163,74,0.12)";
    if (s === "En pause") return "rgba(249,115,22,0.12)";
    return "rgba(136,136,170,0.12)";
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 40px", display: "flex", flexDirection: "column", gap: 32 }}>
        <Link href="/projects" className="btn-back">← Projets</Link>
        <KanbanSkeleton />
        <StatsSkeleton kpiCount={4} />
      </main>
    );
  }

  if (!project) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 40px" }}>
        <Link href="/projects" className="btn-back">← Projets</Link>
        <div style={{ marginTop: 40, color: "var(--red)", fontSize: 13 }}>Projet introuvable.</div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 40px 64px", display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        <Link href="/projects" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>Projets</Link>
        <span style={{ color: "var(--text-muted)" }}>›</span>
        <span style={{ color: "var(--text)" }}>{project.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>
              {project.name}
            </h1>
            <span style={{
              display: "inline-block", padding: "4px 10px", borderRadius: 8,
              fontSize: 12, fontWeight: 600,
              backgroundColor: statusColor(project.status), color: "var(--text)",
            }}>
              {project.status ?? "—"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 16 }}>
            <span>{totalCount} tâche{totalCount !== 1 ? "s" : ""}</span>
            {inProgressCount > 0 && <span style={{ color: "var(--accent)" }}>{inProgressCount} en cours</span>}
            {doneCount > 0 && <span style={{ color: "var(--green)" }}>{doneCount} terminée{doneCount !== 1 ? "s" : ""}</span>}
            {formatMinutes(projectMinutes) && (
              <span style={{ fontFamily: "var(--font-mono)" }}>⏱ {formatMinutes(projectMinutes)}</span>
            )}
          </div>
        </div>
        <button
          className="btn-primary"
          onClick={() => openCreate("Non commencé")}
          style={{ padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          + Nouvelle tâche
        </button>
      </div>

      {/* Kanban board — 60vh with per-column internal scroll */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr", gap: 16, height: "60vh", overflow: "hidden" }}>
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              col={col}
              tasks={columns[col.id] ?? []}
              projectMinutes={projectMinutes}
              onAddTask={openCreate}
              onEditTask={openEdit}
              onDeleteTask={handleDelete}
              patchingTaskId={patchingTaskId}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <TaskCard
              task={activeTask}
              projectMinutes={projectMinutes}
              onEdit={() => {}}
              onDelete={() => {}}
              overlay
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* Stats section */}
      <StatsSection projectId={id} refreshKey={statsKey} />

      {/* Task modal */}
      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={load}
        projectId={id}
        initialStatus={modalStatus}
        task={modalTask}
      />
    </main>
  );
}

// ─────────────────────────── Styles ───────────────────────────────────────

const cardBtnStyle: React.CSSProperties = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  color: "var(--text-muted)",
  fontSize: 12,
  padding: "3px 7px",
  borderRadius: 6,
  cursor: "pointer",
  lineHeight: 1,
};

const kpiCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1.5px solid var(--border)",
  borderRadius: 12,
  padding: "16px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const chartCard: React.CSSProperties = {
  background: "var(--surface)",
  border: "1.5px solid var(--border)",
  borderRadius: 12,
  padding: "18px 20px 14px",
};

const chartTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 12,
};

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 10000,
  },
  dialog: {
    background: "var(--surface)",
    border: "1.5px solid var(--border)",
    borderRadius: 16,
    boxShadow: "var(--shadow-md)",
    width: 460,
    maxWidth: "calc(100vw - 32px)",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 22px 14px",
    borderBottom: "1px solid var(--border)",
  },
  title: { fontSize: 14, fontWeight: 700, color: "var(--text)" },
  closeBtn: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: 14, color: "var(--text-muted)", padding: "2px 6px",
  },
  form: { padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: {
    fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
    textTransform: "uppercase", color: "var(--text-muted)",
  },
  input: {
    fontSize: 13, padding: "10px 14px",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    borderRadius: 8, color: "var(--text)", fontFamily: "var(--font-sans)",
  },
  footer: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 },
  btnCancel: {
    padding: "9px 18px", borderRadius: 8, fontSize: 13,
    background: "var(--surface2)", border: "1.5px solid var(--border)",
    color: "var(--text)", cursor: "pointer",
  },
  btnSave: {
    padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
  },
};
