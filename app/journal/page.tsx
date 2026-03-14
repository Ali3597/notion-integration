"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────

interface JournalEntry {
  id: string;
  title: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
  log_count: number;
  last_log_preview: string | null;
  review_date: string | null;
}

interface JournalLog {
  id: string;
  entry_id: string;
  content: string;
  review_date: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)}sem`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatLogDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatReviewDate(dateStr: string): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function reviewDateStatus(dateStr: string): "future" | "today" | "overdue" {
  const today = getTodayStr();
  if (dateStr < today) return "overdue";
  if (dateStr === today) return "today";
  return "future";
}

// ── Main content (needs useSearchParams) ──────────────────────────────────────

function JournalContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<JournalLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Right panel state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogContent, setEditLogContent] = useState("");
  const [editLogReviewDate, setEditLogReviewDate] = useState("");

  // Add log form
  const [newContent, setNewContent] = useState("");
  const [newReviewDate, setNewReviewDate] = useState("");
  const [addingLog, setAddingLog] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const newContentRef = useRef<HTMLTextAreaElement>(null);

  // ── Load entries ────────────────────────────────────────────────────────────

  const loadEntries = useCallback(async (q?: string) => {
    const url = q ? `/api/journal/entries?search=${encodeURIComponent(q)}` : "/api/journal/entries";
    const res = await fetch(url);
    if (res.ok) setEntries(await res.json());
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Handle initial ?entry= param
  useEffect(() => {
    const id = searchParams.get("entry");
    if (id) setSelectedId(id);
  }, [searchParams]);

  // ── Search debounce ─────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => loadEntries(search || undefined), 200);
    return () => clearTimeout(t);
  }, [search, loadEntries]);

  // ── Load logs when entry selected ───────────────────────────────────────────

  useEffect(() => {
    if (!selectedId) { setLogs([]); return; }
    setLoadingLogs(true);
    fetch(`/api/journal/logs?entry_id=${selectedId}`)
      .then((r) => r.json())
      .then((data) => { setLogs(data); setLoadingLogs(false); })
      .catch(() => setLoadingLogs(false));
  }, [selectedId]);

  // Scroll to bottom of logs when they load or a new one is added
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  // Focus title input when editing
  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  // ── Selected entry ──────────────────────────────────────────────────────────

  const selectedEntry = entries.find((e) => e.id === selectedId) ?? null;

  // ── Actions ─────────────────────────────────────────────────────────────────

  const selectEntry = (id: string) => {
    setSelectedId(id);
    setEditingTitle(false);
    setEditingLogId(null);
    router.replace(`/journal?entry=${id}`, { scroll: false });
  };

  const createEntry = async () => {
    const res = await fetch("/api/journal/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Nouveau thread" }),
    });
    if (!res.ok) return;
    const entry = await res.json();
    await loadEntries(search || undefined);
    selectEntry(entry.id);
    setTimeout(() => {
      setTitleDraft("Nouveau thread");
      setEditingTitle(true);
    }, 50);
  };

  const saveTitle = async () => {
    if (!selectedId || !titleDraft.trim()) return;
    setEditingTitle(false);
    await fetch(`/api/journal/entries?id=${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titleDraft }),
    });
    setEntries((prev) =>
      prev.map((e) => (e.id === selectedId ? { ...e, title: titleDraft.trim() || e.title } : e))
    );
  };

  const togglePin = async () => {
    if (!selectedEntry) return;
    const newPinned = !selectedEntry.pinned;
    await fetch(`/api/journal/entries?id=${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: newPinned }),
    });
    await loadEntries(search || undefined);
  };

  const deleteEntry = async () => {
    if (!selectedId || !confirm("Supprimer ce thread et tous ses logs ?")) return;
    await fetch(`/api/journal/entries?id=${selectedId}`, { method: "DELETE" });
    setSelectedId(null);
    router.replace("/journal", { scroll: false });
    await loadEntries(search || undefined);
  };

  const addLog = async () => {
    if (!newContent.trim() || !selectedId) return;
    setAddingLog(true);
    const res = await fetch("/api/journal/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry_id: selectedId, content: newContent, review_date: newReviewDate || null }),
    });
    if (res.ok) {
      const log = await res.json();
      setLogs((prev) => [...prev, log]);
      setNewContent("");
      setNewReviewDate("");
      await loadEntries(search || undefined);
    }
    setAddingLog(false);
  };

  const startEditLog = (log: JournalLog) => {
    setEditingLogId(log.id);
    setEditLogContent(log.content);
    setEditLogReviewDate(log.review_date ?? "");
  };

  const saveEditLog = async () => {
    if (!editingLogId) return;
    const res = await fetch(`/api/journal/logs?id=${editingLogId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editLogContent, review_date: editLogReviewDate || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLogs((prev) => prev.map((l) => (l.id === editingLogId ? updated : l)));
      setEditingLogId(null);
      await loadEntries(search || undefined);
    }
  };

  const deleteLog = async (id: string) => {
    if (!confirm("Supprimer ce log ?")) return;
    await fetch(`/api/journal/logs?id=${id}`, { method: "DELETE" });
    setLogs((prev) => prev.filter((l) => l.id !== id));
    await loadEntries(search || undefined);
  };

  // ── Compute review_date from latest log that has one ────────────────────────

  const activeReviewDate = (() => {
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].review_date) return logs[i].review_date;
    }
    return selectedEntry?.review_date ?? null;
  })();

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)", fontFamily: "var(--font-sans)" }}>

      {/* ── Left panel ── */}
      <div style={{
        width: 300,
        minWidth: 300,
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--surface)",
      }}>

        {/* Header */}
        <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Link href="/" className="btn-back" style={{ marginBottom: 0 }}>← Accueil</Link>
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: "0 0 12px" }}>📖 Journal</h1>
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px",
              border: "1.5px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
              background: "var(--bg)",
              color: "var(--text)",
              outline: "none",
              fontFamily: "var(--font-sans)",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Thread list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {entries.length === 0 && (
            <div style={{ padding: "24px 16px", color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
              {search ? "Aucun résultat" : "Aucun thread"}
            </div>
          )}
          {entries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => selectEntry(entry.id)}
              style={{
                padding: "10px 14px",
                cursor: "pointer",
                borderLeft: entry.id === selectedId ? "3px solid var(--accent)" : "3px solid transparent",
                background: entry.id === selectedId ? "rgba(59,126,248,0.06)" : "transparent",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => {
                if (entry.id !== selectedId) (e.currentTarget as HTMLDivElement).style.background = "var(--surface2)";
              }}
              onMouseLeave={(e) => {
                if (entry.id !== selectedId) (e.currentTarget as HTMLDivElement).style.background = "transparent";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                {entry.pinned && <span style={{ fontSize: 10, color: "var(--accent)" }}>📌</span>}
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {entry.title}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {formatRelativeDate(entry.updated_at)}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.6 }}>·</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {entry.log_count} log{entry.log_count !== 1 ? "s" : ""}
                </span>
                {entry.review_date && (
                  <>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.6 }}>·</span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: reviewDateStatus(entry.review_date) === "overdue" ? "var(--red)" : "var(--accent)",
                    }}>
                      🔁 {entry.review_date}
                    </span>
                  </>
                )}
              </div>
              {entry.last_log_preview && (
                <div style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.4,
                }}>
                  {entry.last_log_preview}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* New thread button */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button
            onClick={createEntry}
            style={{
              width: "100%",
              padding: "9px",
              border: "1.5px dashed var(--border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--accent)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              transition: "border-color 0.12s, background 0.12s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(59,126,248,0.06)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            }}
          >
            + Nouveau thread
          </button>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", minWidth: 0 }}>

        {!selectedEntry ? (
          /* Empty state */
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-muted)",
            gap: 12,
          }}>
            <span style={{ fontSize: 40, opacity: 0.3 }}>📖</span>
            <p style={{ fontSize: 14, margin: 0 }}>Sélectionne un thread ou crée-en un nouveau</p>
            <button
              onClick={createEntry}
              className="btn-primary"
              style={{ marginTop: 4 }}
            >
              + Nouveau thread
            </button>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div style={{
              padding: "20px 28px 16px",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
              background: "var(--surface)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {editingTitle ? (
                  <input
                    ref={titleInputRef}
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                    style={{
                      flex: 1,
                      fontSize: 20,
                      fontWeight: 700,
                      color: "var(--text)",
                      border: "none",
                      borderBottom: "2px solid var(--accent)",
                      outline: "none",
                      background: "transparent",
                      fontFamily: "var(--font-sans)",
                      padding: "2px 0",
                    }}
                  />
                ) : (
                  <h2
                    onClick={() => { setTitleDraft(selectedEntry.title); setEditingTitle(true); }}
                    style={{
                      flex: 1,
                      fontSize: 20,
                      fontWeight: 700,
                      color: "var(--text)",
                      margin: 0,
                      cursor: "text",
                      borderBottom: "2px solid transparent",
                      padding: "2px 0",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "var(--border)")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
                    title="Cliquer pour renommer"
                  >
                    {selectedEntry.title}
                  </h2>
                )}
                <button
                  onClick={togglePin}
                  title={selectedEntry.pinned ? "Désépingler" : "Épingler"}
                  style={{
                    background: selectedEntry.pinned ? "rgba(59,126,248,0.1)" : "transparent",
                    border: "1.5px solid var(--border)",
                    borderRadius: 7,
                    padding: "4px 8px",
                    cursor: "pointer",
                    fontSize: 14,
                    color: selectedEntry.pinned ? "var(--accent)" : "var(--text-muted)",
                    transition: "background 0.12s",
                  }}
                >
                  📌
                </button>
                <button
                  onClick={deleteEntry}
                  title="Supprimer le thread"
                  style={{
                    background: "transparent",
                    border: "1.5px solid var(--border)",
                    borderRadius: 7,
                    padding: "4px 8px",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "var(--text-muted)",
                    transition: "color 0.12s, border-color 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--red)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--red)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                  }}
                >
                  🗑
                </button>
              </div>

              {/* Review date banner */}
              {activeReviewDate && (
                <div style={{
                  marginTop: 10,
                  padding: "6px 12px",
                  borderRadius: 7,
                  background: reviewDateStatus(activeReviewDate) === "overdue"
                    ? "rgba(239,68,68,0.08)"
                    : "rgba(59,126,248,0.08)",
                  border: `1px solid ${reviewDateStatus(activeReviewDate) === "overdue" ? "rgba(239,68,68,0.2)" : "rgba(59,126,248,0.2)"}`,
                  fontSize: 12,
                  color: reviewDateStatus(activeReviewDate) === "overdue" ? "var(--red)" : "var(--accent)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}>
                  🔁 À revoir le <strong>{formatReviewDate(activeReviewDate)}</strong>
                  {reviewDateStatus(activeReviewDate) === "overdue" && (
                    <span style={{ fontWeight: 600 }}>· En retard</span>
                  )}
                  {reviewDateStatus(activeReviewDate) === "today" && (
                    <span style={{ fontWeight: 600 }}>· Aujourd'hui</span>
                  )}
                </div>
              )}
            </div>

            {/* Logs feed */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
              {loadingLogs && (
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Chargement…</div>
              )}
              {!loadingLogs && logs.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", marginTop: 40 }}>
                  Aucun log pour l'instant. Ajoute une première mise à jour ci-dessous.
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {logs.map((log) => (
                  <div key={log.id} style={{ position: "relative" }} className="journal-log-item">
                    {/* Date header */}
                    <div style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "capitalize",
                      letterSpacing: "0.04em",
                      marginBottom: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      {formatLogDate(log.created_at)}
                      {log.review_date && (
                        <span style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 4,
                          background: reviewDateStatus(log.review_date) === "overdue" ? "rgba(239,68,68,0.1)" : "rgba(59,126,248,0.1)",
                          color: reviewDateStatus(log.review_date) === "overdue" ? "var(--red)" : "var(--accent)",
                          fontWeight: 600,
                        }}>
                          🔁 {formatReviewDate(log.review_date)}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    {editingLogId === log.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <textarea
                          value={editLogContent}
                          onChange={(e) => setEditLogContent(e.target.value)}
                          autoFocus
                          rows={4}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            border: "1.5px solid var(--accent)",
                            borderRadius: 8,
                            fontSize: 13,
                            lineHeight: 1.6,
                            color: "var(--text)",
                            background: "var(--bg)",
                            fontFamily: "var(--font-sans)",
                            outline: "none",
                            resize: "vertical",
                            boxSizing: "border-box",
                          }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                            🔁 Revenir le
                            <input
                              type="date"
                              value={editLogReviewDate}
                              onChange={(e) => setEditLogReviewDate(e.target.value)}
                              style={{
                                border: "1.5px solid var(--border)",
                                borderRadius: 6,
                                padding: "3px 7px",
                                fontSize: 12,
                                color: "var(--text)",
                                background: "var(--bg)",
                                fontFamily: "var(--font-sans)",
                                outline: "none",
                              }}
                            />
                          </label>
                          <button onClick={saveEditLog} className="btn-primary" style={{ fontSize: 12, padding: "5px 14px" }}>
                            Enregistrer
                          </button>
                          <button
                            onClick={() => setEditingLogId(null)}
                            style={{
                              fontSize: 12,
                              padding: "5px 12px",
                              border: "1.5px solid var(--border)",
                              borderRadius: 6,
                              background: "transparent",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              fontFamily: "var(--font-sans)",
                            }}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          position: "relative",
                          padding: "10px 14px",
                          background: "var(--surface)",
                          border: "1.5px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 13,
                          lineHeight: 1.6,
                          color: "var(--text)",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {log.content}
                        {/* Actions on hover */}
                        <div className="log-actions" style={{
                          position: "absolute",
                          top: 6,
                          right: 8,
                          display: "flex",
                          gap: 4,
                          opacity: 0,
                          transition: "opacity 0.15s",
                        }}>
                          <button
                            onClick={() => startEditLog(log)}
                            title="Modifier"
                            style={{
                              width: 24, height: 24, borderRadius: 5,
                              border: "1px solid var(--border)",
                              background: "var(--bg)",
                              fontSize: 11, cursor: "pointer",
                              color: "var(--text-muted)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => deleteLog(log.id)}
                            title="Supprimer"
                            style={{
                              width: 24, height: 24, borderRadius: 5,
                              border: "1px solid var(--border)",
                              background: "var(--bg)",
                              fontSize: 11, cursor: "pointer",
                              color: "var(--text-muted)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div ref={logsEndRef} />
            </div>

            {/* Add log form */}
            <div style={{
              padding: "16px 28px 20px",
              borderTop: "1px solid var(--border)",
              flexShrink: 0,
              background: "var(--surface)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Ajouter une mise à jour
              </div>
              <textarea
                ref={newContentRef}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Écris ta mise à jour…"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addLog();
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1.5px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--text)",
                  background: "var(--bg)",
                  fontFamily: "var(--font-sans)",
                  outline: "none",
                  resize: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.12s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                  🔁 Revenir le
                  <input
                    type="date"
                    value={newReviewDate}
                    onChange={(e) => setNewReviewDate(e.target.value)}
                    style={{
                      border: "1.5px solid var(--border)",
                      borderRadius: 6,
                      padding: "4px 8px",
                      fontSize: 12,
                      color: "var(--text)",
                      background: "var(--bg)",
                      fontFamily: "var(--font-sans)",
                      outline: "none",
                    }}
                  />
                </label>
                <button
                  onClick={addLog}
                  disabled={!newContent.trim() || addingLog}
                  className="btn-primary"
                  style={{ marginLeft: "auto", opacity: !newContent.trim() ? 0.5 : 1 }}
                >
                  {addingLog ? "Ajout…" : "Ajouter"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                Ctrl+Entrée pour soumettre
              </div>
            </div>
          </>
        )}
      </div>

      {/* Hover styles injected */}
      <style>{`
        .journal-log-item:hover .log-actions {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}

// ── Page export ────────────────────────────────────────────────────────────────

export default function JournalPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
        Chargement…
      </div>
    }>
      <JournalContent />
    </Suspense>
  );
}
