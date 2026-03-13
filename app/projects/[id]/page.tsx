"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

const PRIORITY_OPTIONS = [
  { value: "High",   label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low",    label: "Low" },
];

function priorityColor(p: string | null) {
  if (p === "High")   return "var(--red)";
  if (p === "Medium") return "#f97316";
  return "var(--text-muted)";
}

function priorityBg(p: string | null) {
  if (p === "High")   return "rgba(220,38,38,0.1)";
  if (p === "Medium") return "rgba(249,115,22,0.1)";
  return "rgba(136,136,170,0.1)";
}

function formatMinutes(min: number | null | undefined) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

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
  const [priority, setPriority] = useState("Medium");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(task?.name ?? "");
      setStatus(task?.status ?? initialStatus ?? "Non commencé");
      setPriority(task?.priority ?? "Medium");
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
        body: JSON.stringify({ name: name.trim(), status, priority }),
      });
    } else {
      await fetch("/api/pomodoro/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), status, priority, project_id: projectId }),
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={modalStyles.field}>
              <label style={modalStyles.label}>Statut</label>
              <CustomSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            </div>
            <div style={modalStyles.field}>
              <label style={modalStyles.label}>Priorité</label>
              <CustomSelect value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
            </div>
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
  task, projectMinutes, onEdit, onDelete, overlay = false,
}: {
  task: DBTask;
  projectMinutes: number | null;
  onEdit: (t: DBTask) => void;
  onDelete: (id: string) => void;
  overlay?: boolean;
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
        {(hovered || overlay) && (
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

      {/* Footer: priority + session time */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {task.priority && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5,
            backgroundColor: priorityBg(task.priority),
            color: priorityColor(task.priority),
          }}>
            {task.priority}
          </span>
        )}
        {time && (
          <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>
            ⏱ {time}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Sortable Card ────────────────────────────────

function SortableCard({ task, projectMinutes, onEdit, onDelete }: {
  task: DBTask;
  projectMinutes: number | null;
  onEdit: (t: DBTask) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} projectMinutes={projectMinutes} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

// ─────────────────────────── Droppable Column ─────────────────────────────

function KanbanColumn({
  col, tasks, projectMinutes, onAddTask, onEditTask, onDeleteTask,
}: {
  col: typeof KANBAN_COLUMNS[number];
  tasks: DBTask[];
  projectMinutes: number | null;
  onAddTask: (status: string) => void;
  onEditTask: (t: DBTask) => void;
  onDeleteTask: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 0,
    }}>
      {/* Column header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 16px",
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

      {/* Cards zone */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          minHeight: 120,
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

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [columns, setColumns] = useState<Record<string, DBTask[]>>({
    "Non commencé": [],
    "En cours": [],
    "Terminé": [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<DBTask | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTask, setModalTask] = useState<DBTask | null>(null);
  const [modalStatus, setModalStatus] = useState("Non commencé");

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
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── DnD handlers ──

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragStart({ active }: DragStartEvent) {
    const colId = getColumnId(active.id as string, columns);
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
    if (!over) return;

    const fromCol = getColumnId(active.id as string, columns);
    const toCol = getColumnId(over.id as string, columns);
    if (!fromCol) return;

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
    const task = columns[toCol!]?.find((t) => t.id === active.id);
    if (task && toCol) {
      try {
        await fetch(`/api/pomodoro/tasks?id=${active.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: toCol }),
        });
      } catch {
        // Rollback on error
        load();
      }
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

  // ── Stats ──

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
      <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 40px" }}>
        <Link href="/projects" className="btn-back">← Projets</Link>
        <div style={{ marginTop: 40, color: "var(--text-muted)", fontSize: 13 }}>Chargement...</div>
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
      <Link href="/projects" className="btn-back">← Projets</Link>

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

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start" }}>
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              col={col}
              tasks={columns[col.id] ?? []}
              projectMinutes={projectMinutes}
              onAddTask={openCreate}
              onEditTask={openEdit}
              onDeleteTask={handleDelete}
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
