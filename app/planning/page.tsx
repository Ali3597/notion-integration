"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanningBlock {
  id: string;
  day: string;
  start_time: string;
  end_time: string;
  title: string;
  status: string | null;
  notes: string | null;
  project_id: string | null;
  reminder_id: string | null;
  habit_id: string | null;
  created_at: string;
  project_name: string | null;
  project_status: string | null;
  reminder_name: string | null;
  habit_name: string | null;
  habit_icon: string | null;
  habit_color: string | null;
}

interface LinkedProject { id: string; name: string; status: string | null; }
interface LinkedReminder { id: string; name: string; done: boolean; }
interface LinkedHabit { id: string; name: string; icon: string | null; color: string | null; active: boolean; }

type LinkType = "" | "project" | "reminder" | "habit";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  done:     { label: "Réussi",  color: "#16a34a", bg: "rgba(22,163,74,0.08)",   icon: "✓" },
  overtime: { label: "Débordé", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", icon: "⏱" },
  failed:   { label: "Échoué",  color: "#dc2626", bg: "rgba(220,38,38,0.08)",  icon: "✗" },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDayNav(dateStr: string): string {
  const today = getTodayStr();
  if (dateStr === today) return "Aujourd'hui";
  if (dateStr === addDays(today, 1)) return "Demain";
  if (dateStr === addDays(today, -1)) return "Hier";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatTime(t: string): string {
  return t.replace(":", "h");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PlanningPage() {
  useDynamicFavicon("📋");
  useEffect(() => { document.title = "Planning — life×hub"; }, []);

  const [currentDay, setCurrentDay] = useState(getTodayStr());
  const [blocks, setBlocks] = useState<PlanningBlock[]>([]);
  const [loading, setLoading] = useState(true);

  // Linked items for the form selects
  const [linkedProjects, setLinkedProjects] = useState<LinkedProject[]>([]);
  const [linkedReminders, setLinkedReminders] = useState<LinkedReminder[]>([]);
  const [linkedHabits, setLinkedHabits] = useState<LinkedHabit[]>([]);

  // Modal / form state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formDay, setFormDay] = useState(getTodayStr());
  const [formStart, setFormStart] = useState("09:00");
  const [formEnd, setFormEnd] = useState("10:00");
  const [formTitle, setFormTitle] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formLinkType, setFormLinkType] = useState<LinkType>("");
  const [formProjectId, setFormProjectId] = useState("");
  const [formReminderId, setFormReminderId] = useState("");
  const [formHabitId, setFormHabitId] = useState("");

  const titleInputRef = useRef<HTMLInputElement>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadBlocks = useCallback(async (day: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/planning?day=${day}`);
      const data = await res.json();
      if (Array.isArray(data)) setBlocks(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadLinkedItems = useCallback(async () => {
    try {
      const [p, r, h] = await Promise.all([
        fetch("/api/projects").then((x) => x.json()),
        fetch("/api/reminders").then((x) => x.json()),
        fetch("/api/habits").then((x) => x.json()),
      ]);
      if (Array.isArray(p)) setLinkedProjects(p);
      if (Array.isArray(r)) setLinkedReminders(r.filter((x: LinkedReminder) => !x.done));
      if (Array.isArray(h)) setLinkedHabits(h.filter((x: LinkedHabit) => x.active));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadBlocks(currentDay); }, [currentDay, loadBlocks]);
  useEffect(() => { loadLinkedItems(); }, [loadLinkedItems]);

  // ── Modal helpers ───────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setFormDay(currentDay);
    setFormStart("09:00");
    setFormEnd("10:00");
    setFormTitle("");
    setFormNotes("");
    setFormLinkType("");
    setFormProjectId("");
    setFormReminderId("");
    setFormHabitId("");
    setShowModal(true);
    setTimeout(() => titleInputRef.current?.focus(), 50);
  }

  function openEdit(block: PlanningBlock) {
    setEditingId(block.id);
    setFormDay(block.day);
    setFormStart(block.start_time);
    setFormEnd(block.end_time);
    setFormTitle(block.title);
    setFormNotes(block.notes ?? "");
    if (block.project_id) {
      setFormLinkType("project");
      setFormProjectId(block.project_id);
      setFormReminderId("");
      setFormHabitId("");
    } else if (block.reminder_id) {
      setFormLinkType("reminder");
      setFormReminderId(block.reminder_id);
      setFormProjectId("");
      setFormHabitId("");
    } else if (block.habit_id) {
      setFormLinkType("habit");
      setFormHabitId(block.habit_id);
      setFormProjectId("");
      setFormReminderId("");
    } else {
      setFormLinkType("");
      setFormProjectId("");
      setFormReminderId("");
      setFormHabitId("");
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setSaving(false);
  }

  // ── CRUD handlers ───────────────────────────────────────────────────────────

  async function handleSave() {
    if (!formTitle.trim() || !formStart || !formEnd || !formDay) return;
    setSaving(true);

    const payload = {
      day: formDay,
      start_time: formStart,
      end_time: formEnd,
      title: formTitle.trim(),
      notes: formNotes.trim() || null,
      project_id: formLinkType === "project" && formProjectId ? formProjectId : null,
      reminder_id: formLinkType === "reminder" && formReminderId ? formReminderId : null,
      habit_id: formLinkType === "habit" && formHabitId ? formHabitId : null,
    };

    try {
      if (editingId) {
        await fetch(`/api/planning?id=${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/planning", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
    } catch { /* ignore */ }

    setSaving(false);
    closeModal();
    if (formDay !== currentDay) {
      setCurrentDay(formDay);
    } else {
      loadBlocks(currentDay);
    }
  }

  async function handleStatusToggle(block: PlanningBlock, status: StatusKey) {
    const newStatus = block.status === status ? null : status;
    setBlocks((prev) =>
      prev.map((b) => b.id === block.id ? { ...b, status: newStatus } : b)
    );
    await fetch(`/api/planning?id=${block.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Supprimer "${title}" ?`)) return;
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    await fetch(`/api/planning?id=${id}`, { method: "DELETE" });
  }

  // ── Computed ─────────────────────────────────────────────────────────────────

  const today = getTodayStr();
  const canMarkStatus = currentDay <= today;
  const isFuture = currentDay > today;

  const doneCount = blocks.filter((b) => b.status === "done").length;
  const total = blocks.length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main style={s.main}>
      <Link href="/" className="btn-back">← Accueil</Link>

      {/* Header */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h1 style={s.title}>Planning</h1>
          {total > 0 && canMarkStatus && (
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: doneCount === total ? "var(--green)" : "var(--accent)",
              padding: "3px 10px", borderRadius: 20,
              background: doneCount === total ? "rgba(22,163,74,0.1)" : "rgba(59,126,248,0.1)",
            }}>
              {doneCount}/{total} réalisés
            </span>
          )}
        </div>
        <button onClick={openCreate} className="btn-primary">
          + Ajouter un bloc
        </button>
      </div>

      {/* Day navigation */}
      <div style={s.dayNav}>
        <button
          style={s.navArrow}
          onClick={() => setCurrentDay(addDays(currentDay, -1))}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--text-muted)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
        >‹</button>

        <div style={s.dayCenter}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", textTransform: "capitalize" }}>
            {formatDayNav(currentDay)}
          </span>
          {currentDay !== today && currentDay !== addDays(today, 1) && currentDay !== addDays(today, -1) && (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {new Date(currentDay + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          )}
        </div>

        <button
          style={s.navArrow}
          onClick={() => setCurrentDay(addDays(currentDay, 1))}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--text-muted)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
        >›</button>

        {currentDay !== today && (
          <button style={s.todayBtn} onClick={() => setCurrentDay(today)}>
            Aujourd&apos;hui
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={s.loadingState}>Chargement…</div>
      ) : total === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
            Aucun bloc planifié
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
            {isFuture
              ? "Planifie ta journée à l'avance."
              : currentDay < today
                ? "Aucun bloc n'avait été planifié pour ce jour."
                : "Commence à structurer ta journée."}
          </div>
          <button onClick={openCreate} className="btn-primary">+ Ajouter un bloc</button>
        </div>
      ) : (
        <div style={s.timeline}>
          {blocks.map((block, i) => {
            const statusCfg = block.status ? STATUS_CONFIG[block.status as StatusKey] : null;
            const borderColor = statusCfg ? statusCfg.color : "var(--accent)";

            return (
              <div
                key={block.id}
                style={{
                  ...s.blockCard,
                  borderLeftColor: borderColor,
                  background: statusCfg ? statusCfg.bg : "var(--surface)",
                  marginTop: i === 0 ? 0 : 6,
                }}
              >
                {/* Time column */}
                <div style={s.timeCol}>
                  <span style={s.timeText}>{formatTime(block.start_time)}</span>
                  <div style={{ width: 1, flex: 1, background: "var(--border)", margin: "4px auto" }} />
                  <span style={s.timeText}>{formatTime(block.end_time)}</span>
                </div>

                {/* Content + actions in one column */}
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>

                  {/* Top row: title + icon actions */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
                          {block.title}
                        </span>
                        {statusCfg && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            padding: "1px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                            color: statusCfg.color,
                            background: statusCfg.color + "18",
                            border: `1px solid ${statusCfg.color}38`,
                          }}>
                            {statusCfg.icon} {statusCfg.label}
                          </span>
                        )}
                      </div>

                      {block.project_name && (
                        <div style={{ ...s.linkedItem, marginTop: 4 }}>
                          <span style={{ fontSize: 11, opacity: 0.5 }}>📁</span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {block.project_name}
                            {block.project_status && <span style={{ opacity: 0.55 }}> · {block.project_status}</span>}
                          </span>
                        </div>
                      )}
                      {block.reminder_name && (
                        <div style={{ ...s.linkedItem, marginTop: 4 }}>
                          <span style={{ fontSize: 11, opacity: 0.5 }}>🔔</span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{block.reminder_name}</span>
                        </div>
                      )}
                      {block.habit_name && (
                        <div style={{ ...s.linkedItem, marginTop: 4 }}>
                          <span style={{ fontSize: 12 }}>{block.habit_icon ?? "🎯"}</span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{block.habit_name}</span>
                        </div>
                      )}
                      {block.notes && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginTop: 4 }}>
                          {block.notes}
                        </div>
                      )}
                    </div>

                    {/* Edit / Delete — icon buttons, top-right */}
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 1 }}>
                      <button
                        style={s.iconBtn}
                        onClick={() => openEdit(block)}
                        title="Modifier"
                        onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--surface2)"; b.style.borderColor = "var(--text-muted)"; b.style.color = "var(--text)"; }}
                        onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.borderColor = "var(--border)"; b.style.color = "var(--text-muted)"; }}
                      >
                        ✏
                      </button>
                      <button
                        style={s.iconBtnDanger}
                        onClick={() => handleDelete(block.id, block.title)}
                        title="Supprimer"
                        onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(220,38,38,0.1)"; b.style.borderColor = "rgba(220,38,38,0.5)"; }}
                        onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.borderColor = "rgba(220,38,38,0.25)"; }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Status buttons — bottom row, separated */}
                  {canMarkStatus && (
                    <div style={{
                      display: "flex", gap: 6,
                      paddingTop: 8,
                      borderTop: "1px solid var(--border)",
                      marginTop: 2,
                    }}>
                      {(["done", "overtime", "failed"] as StatusKey[]).map((sk) => {
                        const cfg = STATUS_CONFIG[sk];
                        const active = block.status === sk;
                        return (
                          <button
                            key={sk}
                            onClick={() => handleStatusToggle(block, sk)}
                            title={active ? `Annuler (${cfg.label})` : cfg.label}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              height: 28, padding: "0 12px",
                              borderRadius: 6,
                              border: `1.5px solid ${active ? cfg.color + "cc" : cfg.color + "30"}`,
                              background: active ? cfg.color : "transparent",
                              color: active ? "#fff" : cfg.color,
                              cursor: "pointer",
                              fontSize: 11, fontWeight: 600,
                              fontFamily: "var(--font-sans)",
                              boxShadow: active ? `0 1px 6px ${cfg.color}30` : "none",
                              transition: "all 0.13s",
                            }}
                            onMouseEnter={(e) => {
                              const b = e.currentTarget as HTMLButtonElement;
                              if (!active) { b.style.background = cfg.color + "14"; b.style.borderColor = cfg.color + "66"; }
                            }}
                            onMouseLeave={(e) => {
                              const b = e.currentTarget as HTMLButtonElement;
                              if (!active) { b.style.background = "transparent"; b.style.borderColor = cfg.color + "30"; }
                            }}
                          >
                            <span style={{ fontSize: 10 }}>{cfg.icon}</span>
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add block — subtle bottom row */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <button
              onClick={openCreate}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 20px",
                background: "transparent",
                border: "1.5px dashed var(--border)",
                borderRadius: 20, cursor: "pointer",
                color: "var(--text-muted)", fontSize: 12, fontWeight: 500,
                fontFamily: "var(--font-sans)",
                transition: "border-color 0.13s, color 0.13s, background 0.13s",
              }}
              onMouseEnter={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.borderColor = "var(--accent)";
                b.style.color = "var(--accent)";
                b.style.background = "rgba(59,126,248,0.05)";
              }}
              onMouseLeave={(e) => {
                const b = e.currentTarget as HTMLButtonElement;
                b.style.borderColor = "var(--border)";
                b.style.color = "var(--text-muted)";
                b.style.background = "transparent";
              }}
            >
              + Ajouter un bloc
            </button>
          </div>
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {showModal && (
        <div
          style={s.modalOverlay}
          onClick={closeModal}
          onKeyDown={(e) => { if (e.key === "Escape") closeModal(); }}
        >
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>

            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>
                {editingId ? "Modifier le bloc" : "Nouveau bloc"}
              </h2>
              <button
                style={s.modalClose}
                onClick={closeModal}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
              >✕</button>
            </div>

            {/* Day */}
            <div style={s.field}>
              <label style={s.label}>Jour</label>
              <input
                type="date"
                value={formDay}
                onChange={(e) => setFormDay(e.target.value)}
                style={s.input}
              />
            </div>

            {/* Times */}
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Début</label>
                <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} style={s.input} />
              </div>
              <div style={{ ...s.field, flex: 1 }}>
                <label style={s.label}>Fin</label>
                <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} style={s.input} />
              </div>
            </div>

            {/* Title */}
            <div style={s.field}>
              <label style={s.label}>Intitulé</label>
              <input
                ref={titleInputRef}
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Ex : Boulot, Sport, Lecture…"
                style={s.input}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSave(); }}
              />
            </div>

            {/* Notes */}
            <div style={s.field}>
              <label style={s.label}>Notes <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optionnel)</span></label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
                placeholder="Contexte, objectif, notes…"
                style={{ ...s.input, resize: "vertical" as const }}
              />
            </div>

            {/* Link type */}
            <div style={s.field}>
              <label style={s.label}>Lier à un élément <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optionnel)</span></label>
              <select
                value={formLinkType}
                onChange={(e) => {
                  setFormLinkType(e.target.value as LinkType);
                  setFormProjectId("");
                  setFormReminderId("");
                  setFormHabitId("");
                }}
                style={s.input}
              >
                <option value="">Aucun lien</option>
                <option value="project">Projet</option>
                <option value="reminder">Rappel</option>
                <option value="habit">Habitude</option>
              </select>
            </div>

            {/* Conditional link value */}
            {formLinkType === "project" && (
              <div style={s.field}>
                <label style={s.label}>Projet</label>
                <select value={formProjectId} onChange={(e) => setFormProjectId(e.target.value)} style={s.input}>
                  <option value="">— Choisir un projet</option>
                  {linkedProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.status ? ` (${p.status})` : ""}</option>
                  ))}
                </select>
              </div>
            )}

            {formLinkType === "reminder" && (
              <div style={s.field}>
                <label style={s.label}>Rappel</label>
                <select value={formReminderId} onChange={(e) => setFormReminderId(e.target.value)} style={s.input}>
                  <option value="">— Choisir un rappel</option>
                  {linkedReminders.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            {formLinkType === "habit" && (
              <div style={s.field}>
                <label style={s.label}>Habitude</label>
                <select value={formHabitId} onChange={(e) => setFormHabitId(e.target.value)} style={s.input}>
                  <option value="">— Choisir une habitude</option>
                  {linkedHabits.map((h) => (
                    <option key={h.id} value={h.id}>{h.icon ? `${h.icon} ` : ""}{h.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button
                style={s.cancelBtn}
                onClick={closeModal}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || !formTitle.trim() || !formStart || !formEnd || !formDay}
              >
                {saving ? "…" : editingId ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "var(--bg)",
    padding: "48px 40px",
    display: "flex",
    flexDirection: "column",
    gap: 24,
    maxWidth: 860,
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "var(--text)",
    letterSpacing: "-0.02em",
    margin: 0,
  },
  dayNav: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "var(--surface)",
    border: "1.5px solid var(--border)",
    borderRadius: 12,
    padding: "12px 16px",
    boxShadow: "var(--shadow-sm)",
  },
  dayCenter: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    textAlign: "center",
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1.5px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 20,
    fontWeight: 400,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "background 0.13s, border-color 0.13s",
    userSelect: "none",
  },
  todayBtn: {
    padding: "7px 16px",
    borderRadius: 20,
    border: "1.5px solid var(--accent)",
    background: "rgba(59,126,248,0.09)",
    color: "var(--accent)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
    fontFamily: "var(--font-sans)",
    letterSpacing: "-0.01em",
    transition: "background 0.13s",
  },
  loadingState: {
    textAlign: "center",
    color: "var(--text-muted)",
    fontSize: 13,
    padding: 60,
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    padding: "60px 0",
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
  },
  blockCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 16,
    padding: "14px 18px",
    background: "var(--surface)",
    border: "1.5px solid var(--border)",
    borderLeft: "4px solid var(--accent)",
    borderRadius: 12,
    transition: "box-shadow 0.15s",
    boxShadow: "var(--shadow-sm)",
  },
  timeCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: 48,
    flexShrink: 0,
  },
  timeText: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
  },
  blockContent: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  linkedItem: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    fontSize: 12,
    background: "transparent",
    color: "var(--text-muted)",
    border: "1.5px solid var(--border)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "background 0.13s, border-color 0.13s, color 0.13s",
  },
  iconBtnDanger: {
    width: 28,
    height: 28,
    borderRadius: 7,
    fontSize: 11,
    fontWeight: 700,
    background: "transparent",
    color: "var(--red)",
    border: "1.5px solid rgba(220,38,38,0.25)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "background 0.13s, border-color 0.13s",
  },
  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 500,
    padding: 20,
  },
  modal: {
    background: "var(--surface)",
    border: "1.5px solid var(--border)",
    borderRadius: 16,
    padding: "28px 28px 24px",
    width: "100%",
    maxWidth: 480,
    boxShadow: "var(--shadow-md)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "var(--text)",
    margin: 0,
    letterSpacing: "-0.01em",
  },
  modalClose: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "1.5px solid var(--border)",
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-sans)",
    transition: "background 0.13s, color 0.13s",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  input: {
    fontSize: 13,
    padding: "9px 12px",
    background: "var(--bg)",
    border: "1.5px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontFamily: "var(--font-sans)",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  cancelBtn: {
    padding: "9px 20px",
    borderRadius: 8,
    border: "1.5px solid var(--border)",
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
    transition: "background 0.13s",
  },
};
