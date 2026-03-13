"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { DBTask, DBProject } from "@/types";
import { CustomSelect } from "@/components/CustomSelect";

const STATUS_OPTIONS = ["Non commencé", "En cours", "Terminé"];

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

// ─────────────────────────── Checkbox ────────────────────────────────────

function TaskCheckbox({ done, onChange }: { done: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      title={done ? "Marquer non terminé" : "Marquer terminé"}
      style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
        border: done ? "none" : "1.5px solid var(--border)",
        background: done ? "var(--green)" : "transparent",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}
    >
      {done && <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>✓</span>}
    </button>
  );
}

// ─────────────────────────── Page ─────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<DBTask[]>([]);
  const [projects, setProjects] = useState<DBProject[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterProject, setFilterProject] = useState("");

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState("Non commencé");
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

  // Filter then sort: non-terminé first, terminé at the bottom
  const filtered = tasks
    .filter((t) => {
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterProject && t.project_id !== filterProject) return false;
      return true;
    })
    .sort((a, b) => {
      const aD = a.status === "Terminé" ? 1 : 0;
      const bD = b.status === "Terminé" ? 1 : 0;
      return aD - bD;
    });

  async function handleToggleDone(t: DBTask) {
    const newStatus = t.status === "Terminé" ? "Non commencé" : "Terminé";
    await fetch(`/api/pomodoro/tasks?id=${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    await fetch("/api/pomodoro/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), status: newStatus, project_id: newProjectId || null }),
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
          <CustomSelect
            value={newStatus}
            onChange={setNewStatus}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
          <CustomSelect
            value={newProjectId}
            onChange={setNewProjectId}
            placeholder="— Projet —"
            searchable
            options={[{ value: "", label: "— Projet —" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
          />
          <button className="btn-primary" style={styles.btnPrimary} type="submit" disabled={saving}>
            {saving ? "Création..." : "Créer"}
          </button>
        </form>
      )}

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 32 }}></th>
              <th style={{ ...styles.th, width: 40, fontFamily: "var(--font-mono)" }}>#</th>
              <th style={styles.th}>Tâche</th>
              <ColFilterHeader label="Statut"
                options={[{ value: "", label: "Tous" }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]}
                value={filterStatus} onChange={setFilterStatus} thStyle={styles.th} />
              <ColFilterHeader label="Projet"
                options={projectOptions}
                value={filterProject} onChange={setFilterProject} thStyle={styles.th} />
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={styles.emptyCell}>Chargement...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={styles.emptyCell}>Aucune tâche</td></tr>
            ) : filtered.map((t) => {
              const done = t.status === "Terminé";
              return editingId === t.id ? (
                <tr key={t.id} style={styles.tr}>
                  <td style={styles.td}></td>
                  <td style={{ ...styles.td, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                    {t.issue_number != null ? `#${t.issue_number}` : ""}
                  </td>
                  <td style={styles.td}>
                    <input value={editValues.name ?? t.name}
                      onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                      style={styles.inlineInput} />
                  </td>
                  <td style={styles.td}>
                    <CustomSelect
                      value={editValues.status ?? t.status ?? ""}
                      onChange={(v) => setEditValues((ev) => ({ ...ev, status: v }))}
                      options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                    />
                  </td>
                  <td style={styles.td}>
                    <CustomSelect
                      value={editValues.project_id ?? t.project_id ?? ""}
                      onChange={(v) => setEditValues((ev) => ({ ...ev, project_id: v || null }))}
                      placeholder="— Aucun —"
                      searchable
                      options={[{ value: "", label: "— Aucun —" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
                    />
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button style={styles.btnSave} onClick={() => handleSaveEdit(t.id)}>✓</button>
                      <button style={styles.btnCancel} onClick={() => setEditingId(null)}>✕</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={t.id} style={{ ...styles.tr, opacity: done ? 0.5 : 1 }}>
                  <td style={{ ...styles.td, paddingRight: 0 }}>
                    <TaskCheckbox done={done} onChange={() => handleToggleDone(t)} />
                  </td>
                  <td style={{ ...styles.td, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", paddingLeft: 0 }}>
                    {t.issue_number != null ? `#${t.issue_number}` : ""}
                  </td>
                  <td style={{ ...styles.td, fontWeight: 500, textDecorationLine: done ? "line-through" : "none", color: done ? "var(--text-muted)" : "var(--text)" }}>
                    {t.name}
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: statusColor(t.status) }}>{t.status ?? "—"}</span>
                  </td>
                  <td style={{ ...styles.td, color: "var(--text-muted)" }}>{t.project_name ?? "—"}</td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button style={styles.btnEdit}
                        onClick={() => { setEditingId(t.id); setEditValues({ name: t.name, status: t.status ?? "", project_id: t.project_id ?? "" }); }}>
                        ✎
                      </button>
                      <button style={styles.btnDelete} onClick={() => handleDelete(t.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
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
