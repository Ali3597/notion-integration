"use client";

import { useState, useEffect } from "react";
import type { DBProject } from "@/types";

const STATUS_OPTIONS = ["En cours", "En pause", "Terminé"];
const TYPE_OPTIONS = ["Perso", "Pro", "Apprentissage", "Side project"];

function formatMinutes(min: number) {
  if (!min || min === 0) return "—";
  if (min < 60) return `${Math.round(min)}min`;
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? String(Math.round(min % 60)).padStart(2, "0") : ""}`;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<DBProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState("En cours");
  const [newType, setNewType] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<DBProject>>({});

  const load = () => {
    setLoading(true);
    fetch("/api/pomodoro/projects")
      .then((r) => r.json())
      .then((data) => { setProjects(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    await fetch("/api/pomodoro/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), status: newStatus, type: newType || null }),
    });
    setNewName("");
    setNewType("");
    setCreating(false);
    setSaving(false);
    load();
  }

  async function handleSaveEdit(id: string) {
    await fetch(`/api/pomodoro/projects?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    });
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce projet ? Les tâches associées seront dissociées.")) return;
    await fetch(`/api/pomodoro/projects?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main style={styles.main}>
      <div style={styles.header}>
        <div style={styles.title}>Projets</div>
        <button
          className="btn-primary"
          style={styles.btnPrimary}
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? "Annuler" : "+ Nouveau projet"}
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} style={styles.form}>
          <input
            type="text"
            placeholder="Nom du projet"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={styles.input}
            autoFocus
          />
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={styles.select}>
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={newType} onChange={(e) => setNewType(e.target.value)} style={styles.select}>
            <option value="">— Type —</option>
            {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
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
              <th style={styles.th}>Nom</th>
              <th style={styles.th}>Statut</th>
              <th style={styles.th}>Type</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Tâches</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Sessions</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Total</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={styles.emptyCell}>Chargement...</td></tr>
            ) : projects.length === 0 ? (
              <tr><td colSpan={7} style={styles.emptyCell}>Aucun projet</td></tr>
            ) : projects.map((p) => (
              editingId === p.id ? (
                <tr key={p.id} style={styles.tr}>
                  <td style={styles.td}>
                    <input
                      value={editValues.name ?? p.name}
                      onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                      style={styles.inlineInput}
                    />
                  </td>
                  <td style={styles.td}>
                    <select
                      value={editValues.status ?? p.status ?? ""}
                      onChange={(e) => setEditValues((v) => ({ ...v, status: e.target.value }))}
                      style={styles.inlineSelect}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={styles.td}>
                    <select
                      value={editValues.type ?? p.type ?? ""}
                      onChange={(e) => setEditValues((v) => ({ ...v, type: e.target.value }))}
                      style={styles.inlineSelect}
                    >
                      <option value="">—</option>
                      {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </td>
                  <td style={styles.td} colSpan={3}></td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button style={styles.btnSave} onClick={() => handleSaveEdit(p.id)}>✓</button>
                      <button style={styles.btnCancel} onClick={() => setEditingId(null)}>✕</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 500 }}>{p.name}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: statusColor(p.status) }}>
                      {p.status ?? "—"}
                    </span>
                  </td>
                  <td style={{ ...styles.td, color: "var(--text-muted)" }}>{p.type ?? "—"}</td>
                  <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                    {p.task_count ?? 0}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                    {p.session_count ?? 0}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                    {formatMinutes(p.total_minutes ?? 0)}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button style={styles.btnEdit}
                        onClick={() => { setEditingId(p.id); setEditValues({ name: p.name, status: p.status ?? "", type: p.type ?? "" }); }}>
                        ✎
                      </button>
                      <button style={styles.btnDelete} onClick={() => handleDelete(p.id)}>✕</button>
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
  form: {
    display: "flex", gap: 12, alignItems: "center",
    background: "var(--surface)", border: "1.5px solid var(--border)",
    borderRadius: 12, padding: "16px 20px",
  },
  input: {
    flex: 1, fontSize: 13, padding: "10px 14px",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    borderRadius: 8, color: "var(--text)", fontFamily: "var(--font-sans)",
  },
  select: {
    fontSize: 13, padding: "10px 14px", width: "auto",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    borderRadius: 8, color: "var(--text)",
  },
  btnPrimary: {
    padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: "var(--accent)", color: "#fff", cursor: "pointer", whiteSpace: "nowrap",
  },
  tableWrapper: {
    background: "var(--surface)", border: "1.5px solid var(--border)",
    borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-md)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left", padding: "12px 16px", fontSize: 10,
    fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
    color: "var(--text-muted)", borderBottom: "1px solid var(--border)",
    background: "var(--bg)",
  },
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 16px", color: "var(--text)", verticalAlign: "middle" },
  emptyCell: { padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 },
  badge: {
    display: "inline-block", padding: "3px 8px", borderRadius: 6,
    fontSize: 11, fontWeight: 500, color: "var(--text)",
  },
  actions: { display: "flex", gap: 6 },
  btnEdit: {
    padding: "4px 8px", borderRadius: 6, fontSize: 13,
    background: "var(--surface2)", color: "var(--text-muted)", cursor: "pointer",
  },
  btnDelete: {
    padding: "4px 8px", borderRadius: 6, fontSize: 13,
    background: "rgba(220,38,38,0.08)", color: "var(--red)", cursor: "pointer",
  },
  btnSave: {
    padding: "4px 8px", borderRadius: 6, fontSize: 13,
    background: "rgba(22,163,74,0.1)", color: "var(--green)", cursor: "pointer",
  },
  btnCancel: {
    padding: "4px 8px", borderRadius: 6, fontSize: 13,
    background: "var(--surface2)", color: "var(--text-muted)", cursor: "pointer",
  },
  inlineInput: {
    width: "100%", fontSize: 13, padding: "6px 10px",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    borderRadius: 6, color: "var(--text)", fontFamily: "var(--font-sans)",
  },
  inlineSelect: {
    fontSize: 13, padding: "6px 10px", width: "100%",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    borderRadius: 6, color: "var(--text)",
  },
};
