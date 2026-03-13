"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { TableSkeleton } from "@/components/skeletons/TableSkeleton";
import { Spinner } from "@/components/Spinner";

// ─────────────────────────── Types ────────────────────────────────────────

interface Reminder {
  id: string;
  name: string;
  due_date: string | null;
  done: boolean;
  created_at: string;
}

type DoneFilter = "" | "todo" | "done";
type SortKey = "due_date" | "name" | "created_at";

// ─────────────────────────── Helpers ──────────────────────────────────────

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

function isToday(dateStr: string | null): boolean {
  return !!dateStr && dateStr === getTodayStr();
}

function isOverdue(dateStr: string | null, done: boolean): boolean {
  return !!dateStr && !done && dateStr < getTodayStr();
}

function applyFilterAndSort(items: Reminder[], doneFilter: DoneFilter, sortKey: SortKey): Reminder[] {
  let result = [...items];

  if (doneFilter === "todo") result = result.filter((r) => !r.done);
  if (doneFilter === "done") result = result.filter((r) => r.done);

  result.sort((a, b) => {
    // Undone first (unless filtering only done)
    if (doneFilter !== "done") {
      if (a.done && !b.done) return 1;
      if (!a.done && b.done) return -1;
    }
    if (sortKey === "name") return a.name.localeCompare(b.name);
    if (sortKey === "created_at") {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    // due_date: nulls last
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  return result;
}

// ─────────────────────────── Filter / Sort buttons ────────────────────────

const dropdownStyle: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 300,
  background: "var(--surface)", border: "1.5px solid var(--border)",
  borderRadius: 8, boxShadow: "var(--shadow-md)", minWidth: 160, overflow: "hidden",
};

function dropdownItemStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 14px", cursor: "pointer", fontSize: 12,
    color: active ? "var(--accent)" : "var(--text)",
    fontWeight: active ? 600 : 400, background: "transparent",
  };
}

function FilterButton({ value, onChange }: { value: DoneFilter; onChange: (v: DoneFilter) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isActive = value !== "";
  const labels: Record<string, string> = { todo: "Non fait", done: "Fait" };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
        cursor: "pointer", border: "1.5px solid",
        borderColor: isActive ? "var(--accent)" : "var(--border)",
        background: isActive ? "rgba(59,126,248,0.08)" : "var(--surface)",
        color: isActive ? "var(--accent)" : "var(--text-muted)",
        boxShadow: "var(--shadow-sm)",
      }}>
        {isActive ? `État : ${labels[value]}` : "+ Filtre"}
        {isActive && (
          <span onClick={(e) => { e.stopPropagation(); onChange(""); }}
            style={{ fontWeight: 700, fontSize: 14, lineHeight: 1 }}>×</span>
        )}
      </button>
      {open && (
        <div style={dropdownStyle} onClick={(e) => e.stopPropagation()}>
          {([
            { value: "" as DoneFilter, label: "Tous" },
            { value: "todo" as DoneFilter, label: "Non fait" },
            { value: "done" as DoneFilter, label: "Fait" },
          ]).map((opt) => (
            <div key={opt.value} style={dropdownItemStyle(value === opt.value)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              onClick={() => { onChange(opt.value); setOpen(false); }}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SortButton({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isActive = value !== "due_date";
  const sortOptions: { value: SortKey; label: string }[] = [
    { value: "due_date", label: "Date limite" },
    { value: "name", label: "Nom" },
    { value: "created_at", label: "Date de création" },
  ];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
        cursor: "pointer", border: "1.5px solid",
        borderColor: isActive ? "var(--accent)" : "var(--border)",
        background: isActive ? "rgba(59,126,248,0.08)" : "var(--surface)",
        color: isActive ? "var(--accent)" : "var(--text-muted)",
        boxShadow: "var(--shadow-sm)",
      }}>
        Tris
        {isActive && (
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 18, height: 18, borderRadius: "50%",
            background: "var(--accent)", color: "#fff", fontSize: 10, fontWeight: 700,
          }}>1</span>
        )}
      </button>
      {open && (
        <div style={dropdownStyle} onClick={(e) => e.stopPropagation()}>
          {sortOptions.map((opt) => (
            <div key={opt.value} style={dropdownItemStyle(value === opt.value)}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              onClick={() => { onChange(opt.value); setOpen(false); }}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Page ─────────────────────────────────────────

export default function RemindersPage() {
  const [remindersList, setRemindersList] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const [doneFilter, setDoneFilter] = useState<DoneFilter>("");
  const [sortKey, setSortKey] = useState<SortKey>("due_date");

  const [newName, setNewName] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/reminders");
      const data = await res.json();
      if (Array.isArray(data)) setRemindersList(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const displayed = useMemo(
    () => applyFilterAndSort(remindersList, doneFilter, sortKey),
    [remindersList, doneFilter, sortKey]
  );

  const undoneCount = remindersList.filter((r) => !r.done).length;
  const overdueCount = remindersList.filter((r) => isOverdue(r.due_date, r.done)).length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), due_date: newDueDate || null }),
    });
    setNewName("");
    setNewDueDate("");
    setAdding(false);
    load();
  }

  async function handleToggle(r: Reminder) {
    setTogglingId(r.id);
    setRemindersList((prev) => prev.map((item) => item.id === r.id ? { ...item, done: !item.done } : item));
    await fetch(`/api/reminders?id=${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !r.done }),
    });
    setTogglingId(null);
    load();
  }

  async function handleSaveEdit(id: string) {
    await fetch(`/api/reminders?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, due_date: editDueDate || null }),
    });
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    await fetch(`/api/reminders?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main style={styles.main}>
      <Link href="/" className="btn-back">← Accueil</Link>

      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={styles.title}>Rappels</h1>
          {undoneCount > 0 && (
            <span style={styles.counter}>{undoneCount} à faire</span>
          )}
          {overdueCount > 0 && (
            <span style={styles.counterOverdue}>{overdueCount} en retard</span>
          )}
        </div>
      </div>

      {/* Filter / Sort bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <FilterButton value={doneFilter} onChange={setDoneFilter} />
        <SortButton value={sortKey} onChange={setSortKey} />
      </div>

      {/* Quick add form */}
      <form onSubmit={handleAdd} style={styles.addForm}>
        <input
          type="text"
          placeholder="Nom du rappel"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={styles.addInput}
        />
        <input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          style={styles.addDate}
        />
        <button
          type="submit"
          className="btn-primary"
          style={{ ...styles.addBtn, opacity: adding || !newName.trim() ? 0.55 : 1 }}
          disabled={adding || !newName.trim()}
        >
          {adding ? "..." : "Ajouter"}
        </button>
      </form>

      {/* Table */}
      {loading ? <TableSkeleton columns={4} rows={5} /> : (
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Nom</th>
              <th style={styles.th}>Date Limite</th>
              <th style={{ ...styles.th, textAlign: "center", width: 80 }}>État</th>
              <th style={{ ...styles.th, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr><td colSpan={4} style={styles.emptyCell}>Aucun rappel</td></tr>
            ) : displayed.map((r) => {
              const overdue = isOverdue(r.due_date, r.done);
              const today = isToday(r.due_date);
              const isEditing = editingId === r.id;

              return (
                <tr key={r.id} style={{
                  ...styles.tr,
                  opacity: r.done ? 0.45 : 1,
                  background: today && !r.done ? "rgba(59,126,248,0.04)" : undefined,
                }}>
                  {isEditing ? (
                    <>
                      <td style={styles.td}>
                        <input value={editName} onChange={(e) => setEditName(e.target.value)}
                          style={styles.inlineInput} autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(r.id);
                            if (e.key === "Escape") setEditingId(null);
                          }} />
                      </td>
                      <td style={styles.td}>
                        <input type="date" value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          style={{ ...styles.inlineInput, width: 160 }} />
                      </td>
                      <td style={styles.td}></td>
                      <td style={styles.td}>
                        <div style={styles.actions}>
                          <button style={styles.btnSave} onClick={() => handleSaveEdit(r.id)}>✓</button>
                          <button style={styles.btnCancel} onClick={() => setEditingId(null)}>✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ ...styles.td, fontWeight: 500 }}>
                        <span
                          style={{
                            cursor: "pointer",
                            textDecorationLine: r.done ? "line-through" : "underline",
                            textDecorationStyle: r.done ? "solid" : "dotted",
                            textUnderlineOffset: 3,
                            textDecorationColor: "var(--border)",
                          }}
                          onClick={() => { setEditingId(r.id); setEditName(r.name); setEditDueDate(r.due_date ?? ""); }}
                        >
                          {r.name}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ color: overdue ? "var(--red)" : "var(--text)" }}>
                            {formatDueDate(r.due_date)}
                          </span>
                          {today && !r.done && <span style={styles.badgeToday}>Aujourd'hui</span>}
                          {overdue && <span style={styles.badgeOverdue}>En retard</span>}
                        </div>
                      </td>
                      <td style={{ ...styles.td, textAlign: "center" }}>
                        {togglingId === r.id ? (
                          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16 }}>
                            <Spinner size={14} />
                          </div>
                        ) : (
                          <input type="checkbox" checked={r.done} onChange={() => handleToggle(r)}
                            style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--accent)" }} />
                        )}
                      </td>
                      <td style={styles.td}>
                        <button style={styles.btnDelete} onClick={() => handleDelete(r.id, r.name)}>✕</button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </main>
  );
}

// ─────────────────────────── Styles ───────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  main: { minHeight: "100vh", background: "var(--bg)", padding: "48px 40px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 900, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 24, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 },
  counter: { display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "rgba(59,126,248,0.1)", color: "var(--accent)" },
  counterOverdue: { display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "rgba(220,38,38,0.08)", color: "var(--red)" },
  addForm: { display: "flex", gap: 12, alignItems: "center", background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "14px 20px", boxShadow: "var(--shadow-sm)" },
  addInput: { flex: 1, fontSize: 13, padding: "9px 14px", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font-sans)", outline: "none" },
  addDate: { fontSize: 13, padding: "9px 12px", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font-sans)", outline: "none", cursor: "pointer" },
  addBtn: { padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", cursor: "pointer", border: "none", whiteSpace: "nowrap" },
  tableWrapper: { background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-md)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "12px 16px", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "var(--bg)" },
  tr: { borderBottom: "1px solid var(--border)", transition: "background 0.1s" },
  td: { padding: "12px 16px", color: "var(--text)", verticalAlign: "middle" },
  emptyCell: { padding: "40px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 },
  actions: { display: "flex", gap: 6 },
  btnDelete: { padding: "4px 8px", borderRadius: 6, fontSize: 13, background: "rgba(220,38,38,0.08)", color: "var(--red)", cursor: "pointer", border: "none" },
  btnSave: { padding: "4px 8px", borderRadius: 6, fontSize: 13, background: "rgba(22,163,74,0.1)", color: "var(--green)", cursor: "pointer", border: "none" },
  btnCancel: { padding: "4px 8px", borderRadius: 6, fontSize: 13, background: "var(--surface2)", color: "var(--text-muted)", cursor: "pointer", border: "none" },
  inlineInput: { width: "100%", fontSize: 13, padding: "6px 10px", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 6, color: "var(--text)", fontFamily: "var(--font-sans)" },
  badgeToday: { display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: "rgba(59,126,248,0.12)", color: "var(--accent)" },
  badgeOverdue: { display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: "rgba(220,38,38,0.1)", color: "var(--red)" },
};
