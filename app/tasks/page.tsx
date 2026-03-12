"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { DBTask, DBProject } from "@/types";

const STATUS_OPTIONS = ["À faire", "Non commencé", "En cours", "Terminé"];
const PRIORITY_OPTIONS = ["High", "Medium", "Low"];

function formatMinutes(min: number) {
  if (!min || min === 0) return "—";
  if (min < 60) return `${Math.round(min)}min`;
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? String(Math.round(min % 60)).padStart(2, "0") : ""}`;
}

// ─────────────────────────── Column filter header ─────────────────────────

function ColFilterHeader({ label, options, value, onChange, thStyle }: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  thStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isActive = value !== "";

  return (
    <th ref={ref}
      style={{ ...thStyle, cursor: "pointer", position: "relative", userSelect: "none" }}
      onClick={() => setOpen((v) => !v)}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        {isActive && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", display: "inline-block", flexShrink: 0 }} />}
        <span style={{ fontSize: 7, opacity: 0.5 }}>{open ? "▲" : "▼"}</span>
      </span>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, zIndex: 300,
          background: "var(--surface)", border: "1.5px solid var(--border)",
          borderRadius: 8, boxShadow: "var(--shadow-md)", minWidth: 160,
          overflow: "hidden", fontWeight: "normal", letterSpacing: "normal",
          textTransform: "none", fontSize: 12,
        }} onClick={(e) => e.stopPropagation()}>
          {options.map((opt) => (
            <div key={opt.value}
              style={{ padding: "8px 14px", cursor: "pointer",
                color: value === opt.value ? "var(--accent)" : "var(--text)",
                fontWeight: value === opt.value ? 600 : 400,
                background: "transparent" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              onClick={() => { onChange(opt.value); setOpen(false); }}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </th>
  );
}

// ─────────────────────────── Page ─────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<DBTask[]>([]);
  const [projects, setProjects] = useState<DBProject[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterProject, setFilterProject] = useState("");

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState("À faire");
  const [newPriority, setNewPriority] = useState("Medium");
  const [newProjectId, setNewProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<DBTask>>({});

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/pomodoro/tasks").then((r) => r.json()),
      fetch("/api/pomodoro/projects").then((r) => r.json()),
    ])
      .then(([t, p]) => {
        setTasks(Array.isArray(t) ? t : []);
        setProjects(Array.isArray(p) ? p : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("projectId");
    if (pid) setFilterProject(pid);
  }, []);

  const filtered = tasks.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterProject && t.project_id !== filterProject) return false;
    return true;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    await fetch("/api/pomodoro/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), status: newStatus, priority: newPriority, project_id: newProjectId || null }),
    });
    setNewName("");
    setCreating(false);
    setSaving(false);
    load();
  }

  async function handleSaveEdit(id: string) {
    await fetch(`/api/pomodoro/tasks?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    });
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette tâche ?")) return;
    await fetch(`/api/pomodoro/tasks?id=${id}`, { method: "DELETE" });
    load();
  }

  const priorityIcon = (p: string | null) =>
    p === "High" ? "🔴" : p === "Medium" ? "🟡" : "🟢";

  const projectOptions = [
    { value: "", label: "Tous les projets" },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <main style={styles.main}>
      <Link href="/" className="btn-back">← Accueil</Link>
      <div style={styles.header}>
        <div style={styles.title}>Tâches</div>
        <button className="btn-primary" style={styles.btnPrimary} onClick={() => setCreating((v) => !v)}>
          {creating ? "Annuler" : "+ Nouvelle tâche"}
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} style={styles.form}>
          <input type="text" placeholder="Nom de la tâche" value={newName}
            onChange={(e) => setNewName(e.target.value)} style={styles.input} autoFocus />
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={styles.select}>
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} style={styles.select}>
            {PRIORITY_OPTIONS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)} style={styles.select}>
            <option value="">— Projet —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn-primary" style={styles.btnPrimary} type="submit" disabled={saving}>
            {saving ? "Création..." : "Créer"}
          </button>
        </form>
      )}

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Tâche</th>
              <ColFilterHeader label="Statut"
                options={[{ value: "", label: "Tous" }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]}
                value={filterStatus} onChange={setFilterStatus} thStyle={styles.th} />
              <ColFilterHeader label="Priorité"
                options={[{ value: "", label: "Toutes" }, ...PRIORITY_OPTIONS.map((p) => ({ value: p, label: p }))]}
                value={filterPriority} onChange={setFilterPriority} thStyle={styles.th} />
              <ColFilterHeader label="Projet"
                options={projectOptions}
                value={filterProject} onChange={setFilterProject} thStyle={styles.th} />
              <th style={{ ...styles.th, textAlign: "right" }}>Sessions</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Total</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={styles.emptyCell}>Chargement...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={styles.emptyCell}>Aucune tâche</td></tr>
            ) : filtered.map((t) => (
              editingId === t.id ? (
                <tr key={t.id} style={styles.tr}>
                  <td style={styles.td}>
                    <input value={editValues.name ?? t.name}
                      onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                      style={styles.inlineInput} />
                  </td>
                  <td style={styles.td}>
                    <select value={editValues.status ?? t.status ?? ""}
                      onChange={(e) => setEditValues((v) => ({ ...v, status: e.target.value }))}
                      style={styles.inlineSelect}>
                      {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={styles.td}>
                    <select value={editValues.priority ?? t.priority ?? ""}
                      onChange={(e) => setEditValues((v) => ({ ...v, priority: e.target.value }))}
                      style={styles.inlineSelect}>
                      {PRIORITY_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </td>
                  <td style={styles.td} colSpan={3}></td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button style={styles.btnSave} onClick={() => handleSaveEdit(t.id)}>✓</button>
                      <button style={styles.btnCancel} onClick={() => setEditingId(null)}>✕</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={t.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 500 }}>{t.name}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: statusColor(t.status) }}>{t.status ?? "—"}</span>
                  </td>
                  <td style={styles.td}>{priorityIcon(t.priority)} {t.priority ?? "—"}</td>
                  <td style={{ ...styles.td, color: "var(--text-muted)" }}>{t.project_name ?? "—"}</td>
                  <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                    {t.session_count ?? 0}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                    {formatMinutes(t.total_minutes ?? 0)}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button style={styles.btnEdit}
                        onClick={() => { setEditingId(t.id); setEditValues({ name: t.name, status: t.status ?? "", priority: t.priority ?? "" }); }}>
                        ✎
                      </button>
                      <button style={styles.btnDelete} onClick={() => handleDelete(t.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function statusColor(status: string | null) {
  if (status === "En cours") return "rgba(59,126,248,0.12)";
  if (status === "Terminé") return "rgba(22,163,74,0.12)";
  return "rgba(136,136,170,0.12)";
}

const styles: Record<string, React.CSSProperties> = {
  main: { minHeight: "100vh", background: "var(--bg)", padding: "48px 40px", display: "flex", flexDirection: "column", gap: 24 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 24, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" },
  form: { display: "flex", gap: 12, alignItems: "center", background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "16px 20px" },
  input: { flex: 1, fontSize: 13, padding: "10px 14px", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font-sans)" },
  select: { fontSize: 13, padding: "10px 14px", width: "auto", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 8, color: "var(--text)" },
  btnPrimary: { padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" },
  tableWrapper: { background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-md)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "12px 16px", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "var(--bg)" },
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 16px", color: "var(--text)", verticalAlign: "middle" },
  emptyCell: { padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 },
  badge: { display: "inline-block", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500, color: "var(--text)" },
  actions: { display: "flex", gap: 6 },
  btnEdit: { padding: "4px 8px", borderRadius: 6, fontSize: 13, background: "var(--surface2)", color: "var(--text-muted)", cursor: "pointer" },
  btnDelete: { padding: "4px 8px", borderRadius: 6, fontSize: 13, background: "rgba(220,38,38,0.08)", color: "var(--red)", cursor: "pointer" },
  btnSave: { padding: "4px 8px", borderRadius: 6, fontSize: 13, background: "rgba(22,163,74,0.1)", color: "var(--green)", cursor: "pointer" },
  btnCancel: { padding: "4px 8px", borderRadius: 6, fontSize: 13, background: "var(--surface2)", color: "var(--text-muted)", cursor: "pointer" },
  inlineInput: { width: "100%", fontSize: 13, padding: "6px 10px", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 6, color: "var(--text)", fontFamily: "var(--font-sans)" },
  inlineSelect: { fontSize: 13, padding: "6px 10px", width: "100%", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 6, color: "var(--text)" },
};
