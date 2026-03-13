"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DBProject } from "@/types";
import { CustomSelect } from "@/components/CustomSelect";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

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

const STATUS_OPTIONS = ["Non commencé", "En cours", "En pause", "Terminé"];
const TYPE_OPTIONS = ["Perso", "Pro", "Apprentissage", "Side project"];

type ProjectDetail = DBProject & {
  parents: { id: string; name: string }[];
  children: { id: string; name: string; own_minutes: number }[];
};

type TaskSummary = {
  id: string;
  name: string;
  status: string | null;
};

function formatMinutes(min: number) {
  if (!min || min === 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function statusColor(status: string | null) {
  if (status === "En cours") return "rgba(59,126,248,0.12)";
  if (status === "Terminé") return "rgba(22,163,74,0.12)";
  return "rgba(136,136,170,0.12)";
}

function ParentMultiSelect({ value, onChange, projects, excludeIds }: {
  value: string[];
  onChange: (ids: string[]) => void;
  projects: ProjectDetail[];
  excludeIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Only root projects (no parents) can be parents, and not excluded ones
  const available = projects.filter(p =>
    !excludeIds.includes(p.id) && p.parents.length === 0
  );
  const selectedNames = projects.filter(p => value.includes(p.id)).map(p => p.name);

  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <button type="button" onClick={() => setOpen(!open)} style={mss.btn}>
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedNames.length > 0 ? selectedNames.join(", ") : "— Projets parents —"}
        </span>
        <span>▾</span>
      </button>
      {open && (
        <div style={mss.dropdown}>
          {available.length === 0 ? (
            <div style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: 12 }}>
              Aucun projet racine disponible
            </div>
          ) : available.map(p => (
            <label key={p.id} style={mss.option}>
              <input
                type="checkbox"
                checked={value.includes(p.id)}
                onChange={(e) => {
                  if (e.target.checked) onChange([...value, p.id]);
                  else onChange(value.filter(id => id !== p.id));
                }}
              />
              {p.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Global stats ─────────────────────────────────

type GlobalStats = {
  kpis: {
    total_projects: number;
    active_projects: number;
    total_tasks: number;
    completed_tasks: number;
    completion_pct: number;
    total_minutes: number;
    total_sessions: number;
  };
  byProject: { id: string; name: string; status: string | null; minutes: number; sessions: number }[];
  heatmap: { date: string; count: number; minutes: number }[];
  monthly: { month: string; sessions: number; minutes: number }[];
};

function fmtMin(min: number) {
  if (!min || min === 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function fmtMonthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function HeatmapCell({ minutes, date }: { minutes: number; date: string }) {
  let bg = "var(--border)";
  if (minutes > 0 && minutes < 30) bg = "rgba(59,126,248,0.2)";
  else if (minutes >= 30 && minutes < 60) bg = "rgba(59,126,248,0.45)";
  else if (minutes >= 60 && minutes < 120) bg = "rgba(59,126,248,0.7)";
  else if (minutes >= 120) bg = "var(--accent)";
  return (
    <div
      title={`${date}: ${fmtMin(minutes)}`}
      style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: bg, flexShrink: 0, cursor: "default" }}
    />
  );
}

function GlobalStatsSection() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch("/api/pomodoro/projects/global-stats")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.kpis) {
          setStats(d);
        } else {
          setError(d?.error ?? "Erreur de chargement");
        }
        setLoading(false);
      })
      .catch(() => { setError("Erreur réseau"); setLoading(false); });
  }, [open]);

  const tooltipStyle = {
    contentStyle: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 },
    itemStyle: { color: "var(--text)" },
    labelStyle: { color: "var(--text-muted)", fontSize: 11 },
    cursor: { fill: "rgba(59,126,248,0.06)" },
  };

  function localDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // Build 90-day heatmap grid (13 weeks × 7 days)
  function buildHeatmapGrid(heatmap: GlobalStats["heatmap"]) {
    const map = new Map(heatmap.map((r) => [r.date, r.minutes]));
    const today = new Date();
    // start from 90 days ago, aligned to Monday
    const start = new Date(today);
    start.setDate(today.getDate() - 89);
    const day0 = start.getDay(); // 0=Sun
    const mondayPad = day0 === 0 ? 6 : day0 - 1;
    start.setDate(start.getDate() - mondayPad);

    const cells: { date: string; minutes: number; future: boolean }[] = [];
    for (let i = 0; i < 13 * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = localDateStr(d);
      cells.push({ date: key, minutes: map.get(key) ?? 0, future: d > today });
    }
    // Split into weeks (columns)
    const weeks: typeof cells[] = [];
    for (let w = 0; w < 13; w++) weeks.push(cells.slice(w * 7, w * 7 + 7));
    return weeks;
  }

  return (
    <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", background: "none", border: "none", cursor: "pointer",
          fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        <span>Vue d'ensemble</span>
        <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 16, borderTop: "1px solid var(--border)" }}>
          {loading ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Chargement…
            </div>
          ) : error ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: "var(--red)", fontSize: 12 }}>
              {error}
            </div>
          ) : stats && stats.kpis ? (
            <>
              {/* KPI row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, paddingTop: 16 }}>
                {[
                  { label: "Projets actifs", value: String(stats.kpis.active_projects), sub: `/ ${stats.kpis.total_projects} total` },
                  { label: "Tâches", value: String(stats.kpis.total_tasks), sub: `${stats.kpis.completed_tasks} terminées` },
                  { label: "Complétion", value: `${stats.kpis.completion_pct}%`, sub: "tâches terminées" },
                  { label: "Temps total", value: fmtMin(stats.kpis.total_minutes), sub: `${stats.kpis.total_sessions} sessions` },
                  { label: "Moy./session", value: stats.kpis.total_sessions > 0 ? fmtMin(Math.round(stats.kpis.total_minutes / stats.kpis.total_sessions)) : "—", sub: "par session" },
                ].map((c) => (
                  <div key={c.label} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{c.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent)", marginTop: 4, lineHeight: 1.2 }}>{c.value}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{c.sub}</div>
                  </div>
                ))}
              </div>

              {/* Charts row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

                {/* Top projets par temps */}
                <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
                    Temps par projet
                  </div>
                  {stats.byProject.filter((p) => p.minutes > 0).length === 0 ? (
                    <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>Aucune session</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart
                        layout="vertical"
                        data={stats.byProject.filter((p) => p.minutes > 0).slice(0, 8).map((p) => ({ name: p.name.length > 18 ? p.name.slice(0, 17) + "…" : p.name, minutes: p.minutes }))}
                        barSize={12}
                        margin={{ left: 4, right: 8 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--text)" }} axisLine={false} tickLine={false} width={110} />
                        <Tooltip formatter={(v: number) => [fmtMin(v), "Temps"]} {...tooltipStyle} />
                        <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                          {stats.byProject.filter((p) => p.minutes > 0).slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={i === 0 ? "var(--accent)" : `rgba(59,126,248,${0.6 - i * 0.06})`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Activité mensuelle */}
                <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
                    Activité mensuelle
                  </div>
                  {stats.monthly.length === 0 ? (
                    <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>Aucune session</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={stats.monthly.map((r) => ({ ...r, month: fmtMonthLabel(r.month) }))} barSize={20}>
                        <XAxis dataKey="month" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip formatter={(v: number, name: string) => name === "minutes" ? [fmtMin(v), "Temps"] : [v, "Sessions"]} {...tooltipStyle} />
                        <Bar dataKey="minutes" name="minutes" fill="rgba(59,126,248,0.5)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Heatmap */}
              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
                  Activité (90 jours)
                </div>
                <div style={{ display: "flex", gap: 3, overflowX: "auto" }}>
                  {buildHeatmapGrid(stats.heatmap).map((week, wi) => (
                    <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {week.map((cell, di) =>
                        cell.future ? (
                          <div key={di} style={{ width: 12, height: 12, flexShrink: 0 }} />
                        ) : (
                          <HeatmapCell key={di} date={cell.date} minutes={cell.minutes} />
                        )
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 10, color: "var(--text-muted)" }}>
                  <span>Moins</span>
                  {["var(--border)", "rgba(59,126,248,0.2)", "rgba(59,126,248,0.45)", "rgba(59,126,248,0.7)", "var(--accent)"].map((bg, i) => (
                    <div key={i} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: bg }} />
                  ))}
                  <span>Plus</span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Detail panel ──────────────────────────────────

function DetailPanel({ project, allProjects, onClose, onUpdate }: {
  project: ProjectDetail;
  allProjects: ProjectDetail[];
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState(project.status ?? "En cours");
  const [type, setType] = useState(project.type ?? "");
  const [parentIds, setParentIds] = useState<string[]>(project.parents.map(p => p.id));
  const [saving, setSaving] = useState(false);
  const [projectTasks, setProjectTasks] = useState<TaskSummary[]>([]);

  useEffect(() => {
    setName(project.name);
    setStatus(project.status ?? "En cours");
    setType(project.type ?? "");
    setParentIds(project.parents.map(p => p.id));
    fetch(`/api/pomodoro/tasks?projectId=${project.id}&all=true`)
      .then(r => r.json())
      .then(data => setProjectTasks(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [project.id]);

  const completedCount = projectTasks.filter(t => t.status === "Terminé").length;
  const progressPct = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0;

  const hasChildren = project.children.length > 0;
  const hasParents = project.parents.length > 0;
  const excludeIds = [project.id, ...project.children.map(c => c.id)];

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/pomodoro/projects?id=${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, status, type: type || null, parent_ids: hasChildren ? undefined : parentIds }),
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    setSaving(false);
    onUpdate();
  }

  return (
    <div style={dp.panel}>
      <div style={dp.header}>
        <div style={dp.title}>Détails projet</div>
        <button onClick={onClose} style={dp.closeBtn}>✕</button>
      </div>
      <div style={dp.body}>
        <div style={dp.fieldGroup}>
          <label style={dp.label}>Nom</label>
          <input value={name} onChange={e => setName(e.target.value)} style={dp.input} />
        </div>
        <div style={dp.fieldGroup}>
          <label style={dp.label}>Statut</label>
          <CustomSelect
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
        </div>
        <div style={dp.fieldGroup}>
          <label style={dp.label}>Type</label>
          <CustomSelect
            value={type}
            onChange={setType}
            placeholder="—"
            options={[{ value: "", label: "—" }, ...TYPE_OPTIONS.map((t) => ({ value: t, label: t }))]}
          />
        </div>

        {!hasChildren && (
          <div style={dp.fieldGroup}>
            <label style={dp.label}>Projets parents</label>
            <ParentMultiSelect
              value={parentIds}
              onChange={setParentIds}
              projects={allProjects}
              excludeIds={excludeIds}
            />
          </div>
        )}

        {hasChildren && (
          <div style={dp.fieldGroup}>
            <label style={dp.label}>Sous-projets ({project.children.length})</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {project.children.map(c => (
                <div key={c.id} style={dp.childRow}>
                  <span style={{ fontSize: 12 }}>▹ {c.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                    {formatMinutes(c.own_minutes)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasParents && (
          <div style={dp.fieldGroup}>
            <label style={dp.label}>Projets parents</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {project.parents.map(par => (
                <span key={par.id} style={styles.parentBadge}>{par.name}</span>
              ))}
            </div>
          </div>
        )}

        <button
          className="btn-primary"
          style={{ padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", cursor: "pointer", width: "100%", marginTop: 4 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>

        {projectTasks.length > 0 && (
          <div style={dp.fieldGroup}>
            <label style={dp.label}>
              Progression — {completedCount}/{projectTasks.length} tâches ({progressPct}%)
            </label>
            <div style={dp.progressTrack}>
              <div style={{ ...dp.progressFill, width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {projectTasks.length > 0 && (
          <div style={dp.fieldGroup}>
            <label style={dp.label}>Tâches</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {projectTasks.map(t => (
                <div key={t.id} style={dp.taskRow}>
                  <span style={{
                    fontSize: 10,
                    color: t.status === "Terminé" ? "var(--green)" : t.status === "En cours" ? "var(--accent)" : "var(--text-muted)",
                  }}>●</span>
                  <span style={{
                    flex: 1, fontSize: 12,
                    color: t.status === "Terminé" ? "var(--text-muted)" : "var(--text)",
                    textDecoration: t.status === "Terminé" ? "line-through" : "none",
                  }}>
                    {t.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link href={`/tasks?projectId=${project.id}`} style={dp.viewTasksBtn}>
          Voir les tâches →
        </Link>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState("En cours");
  const [newType, setNewType] = useState("");
  const [newParentIds, setNewParentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/pomodoro/projects")
      .then(r => r.json())
      .then(data => {
        setProjects(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Build display rows: root projects first, then their children when expanded
  const roots = projects.filter(p => p.parents.length === 0);
  type DisplayRow = { project: ProjectDetail; indent: boolean; parentId?: string };
  const displayRows: DisplayRow[] = [];
  const addedIds = new Set<string>();

  for (const root of roots) {
    displayRows.push({ project: root, indent: false });
    addedIds.add(root.id);
    if (expanded.has(root.id)) {
      for (const childRef of root.children) {
        const child = projects.find(p => p.id === childRef.id);
        if (child) {
          displayRows.push({ project: child, indent: true, parentId: root.id });
          addedIds.add(child.id);
        }
      }
    }
  }
  // Edge case: projects not yet shown
  for (const p of projects) {
    if (!addedIds.has(p.id)) displayRows.push({ project: p, indent: false });
  }

  const filteredRows = displayRows.filter(({ project: p }) => {
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterType && (p.type ?? "") !== filterType) return false;
    return true;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/pomodoro/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), status: newStatus, type: newType || null, parent_ids: newParentIds }),
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    setNewName(""); setNewType(""); setNewParentIds([]);
    setCreating(false); setSaving(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce projet ? Les tâches associées seront dissociées.")) return;
    await fetch(`/api/pomodoro/projects?id=${id}`, { method: "DELETE" });
    load();
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const COL_COUNT = 8;

  return (
    <main style={styles.main}>
      <Link href="/" className="btn-back">← Accueil</Link>
      <div style={styles.header}>
        <div style={styles.title}>Projets</div>
        <button className="btn-primary" style={styles.btnPrimary} onClick={() => setCreating(v => !v)}>
          {creating ? "Annuler" : "+ Nouveau projet"}
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} style={styles.form}>
          <input
            type="text"
            placeholder="Nom du projet"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={styles.input}
            autoFocus
          />
          <CustomSelect
            value={newStatus}
            onChange={setNewStatus}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
          <CustomSelect
            value={newType}
            onChange={setNewType}
            placeholder="— Type —"
            options={[{ value: "", label: "— Type —" }, ...TYPE_OPTIONS.map((t) => ({ value: t, label: t }))]}
          />
          <ParentMultiSelect value={newParentIds} onChange={setNewParentIds} projects={projects} excludeIds={[]} />
          <button className="btn-primary" style={styles.btnPrimary} type="submit" disabled={saving}>
            {saving ? "Création..." : "Créer"}
          </button>
        </form>
      )}

      <GlobalStatsSection />

      <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nom</th>
                  <ColFilterHeader label="Statut"
                    options={[{ value: "", label: "Tous" }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]}
                    value={filterStatus} onChange={setFilterStatus} thStyle={styles.th} />
                  <ColFilterHeader label="Type"
                    options={[{ value: "", label: "Tous" }, ...TYPE_OPTIONS.map((t) => ({ value: t, label: t }))]}
                    value={filterType} onChange={setFilterType} thStyle={styles.th} />
                  <th style={styles.th}>Parents</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Tâches</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Sessions</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Temps total</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COL_COUNT} style={styles.emptyCell}>Chargement...</td></tr>
                ) : filteredRows.length === 0 ? (
                  <tr><td colSpan={COL_COUNT} style={styles.emptyCell}>Aucun projet</td></tr>
                ) : filteredRows.map(({ project: p, indent, parentId }) => {
                  const hasChildren = p.children.length > 0;
                  const isExpanded = expanded.has(p.id);
                  const totalMin = Number(p.total_minutes ?? 0);
                  const tooltipParts = hasChildren && totalMin > 0
                    ? [`Direct: ${formatMinutes(p.own_minutes ?? 0)}`, ...p.children.map(c => `${c.name}: ${formatMinutes(c.own_minutes)}`)]
                    : [];

                  return (
                    <tr
                      key={`${p.id}-${parentId ?? "root"}`}
                      style={styles.tr}
                    >
                      <td style={{ ...styles.td, fontWeight: 500 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: indent ? 20 : 0 }}>
                          {indent && <span style={{ color: "var(--text-muted)", userSelect: "none", fontSize: 12 }}>└</span>}
                          {!indent && hasChildren ? (
                            <button onClick={() => toggleExpand(p.id)} style={styles.chevronBtn}>
                              {isExpanded ? "▾" : "▸"}
                            </button>
                          ) : !indent ? (
                            <span style={{ width: 18, display: "inline-block" }} />
                          ) : null}
                          <Link href={`/projects/${p.id}`} style={styles.projectNameLink}>
                            {p.name}
                          </Link>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, background: statusColor(p.status) }}>
                          {p.status ?? "—"}
                        </span>
                      </td>
                      <td style={{ ...styles.td, color: "var(--text-muted)" }}>{p.type ?? "—"}</td>
                      <td style={styles.td}>
                        {p.parents.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {p.parents.map(par => (
                              <span key={par.id} style={styles.parentBadge}>{par.name}</span>
                            ))}
                          </div>
                        ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {p.task_count ?? 0}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {p.session_count ?? 0}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          fontWeight: totalMin > 0 ? 700 : 400,
                          color: totalMin > 0 ? "var(--accent)" : "var(--text-muted)",
                          cursor: tooltipParts.length > 0 ? "help" : "default",
                        }}
                        title={tooltipParts.join("\n") || undefined}
                      >
                        {formatMinutes(totalMin)}
                      </td>
                      <td style={styles.td}>
                        <div style={styles.actions}>
                          <button
                            style={styles.btnEdit}
                            onClick={() => router.push(`/projects/${p.id}`)}
                          >✎</button>
                          <button style={styles.btnDelete} onClick={() => handleDelete(p.id)}>✕</button>
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

const mss: Record<string, React.CSSProperties> = {
  btn: {
    display: "flex", alignItems: "center", gap: 8, width: "100%",
    fontSize: 13, padding: "10px 14px",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    borderRadius: 8, color: "var(--text)", cursor: "pointer",
    fontFamily: "var(--font-sans)",
  },
  dropdown: {
    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
    background: "var(--surface)", border: "1.5px solid var(--border)",
    borderRadius: 8, boxShadow: "var(--shadow-md)",
    maxHeight: 220, overflowY: "auto",
  },
  option: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 12px", fontSize: 13, cursor: "pointer", color: "var(--text)",
  },
};

const dp: Record<string, React.CSSProperties> = {
  panel: {
    width: 320, flexShrink: 0,
    background: "var(--surface)", border: "1.5px solid var(--border)",
    borderRadius: 16, boxShadow: "var(--shadow-md)",
    display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 160px)",
    position: "sticky", top: 24,
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px", borderBottom: "1px solid var(--border)",
  },
  title: { fontSize: 13, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" },
  closeBtn: {
    background: "none", border: "none", cursor: "pointer",
    fontSize: 14, color: "var(--text-muted)", padding: "2px 6px",
  },
  body: {
    flex: 1, overflowY: "auto", padding: "16px 20px",
    display: "flex", flexDirection: "column", gap: 14,
  },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" },
  input: {
    fontSize: 13, padding: "8px 12px",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    borderRadius: 8, color: "var(--text)", fontFamily: "var(--font-sans)",
  },
  select: {
    fontSize: 13, padding: "8px 12px",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    borderRadius: 8, color: "var(--text)",
  },
  childRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "6px 10px", background: "var(--bg)", borderRadius: 6,
    border: "1px solid var(--border)",
  },
  taskRow: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "5px 8px", background: "var(--bg)", borderRadius: 6,
  },
  progressTrack: {
    height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden",
  },
  progressFill: {
    height: "100%", background: "var(--accent)", borderRadius: 3,
    transition: "width 0.3s ease",
  },
  viewTasksBtn: {
    display: "block", textAlign: "center",
    padding: "10px", borderRadius: 8,
    background: "var(--bg)", border: "1.5px solid var(--border)",
    fontSize: 12, color: "var(--accent)", textDecoration: "none",
    fontWeight: 500,
  },
};

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh", background: "var(--bg)",
    padding: "48px 40px", display: "flex", flexDirection: "column", gap: 24,
  },
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
  parentBadge: {
    display: "inline-block", padding: "2px 8px", borderRadius: 6,
    fontSize: 11, fontWeight: 500,
    background: "rgba(136,136,170,0.12)", color: "var(--text-muted)",
    border: "1px solid var(--border)",
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
  chevronBtn: {
    padding: "2px 4px", borderRadius: 4, fontSize: 11,
    background: "none", color: "var(--text-muted)", cursor: "pointer",
    lineHeight: 1,
  },
  projectNameLink: {
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationStyle: "dotted",
    textUnderlineOffset: 3,
    textDecorationColor: "var(--border)",
  },
};
