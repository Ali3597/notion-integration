"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = "month" | "accounts" | "categories" | "stats";

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: string;
  budget?: string | null;
  transaction_count?: number;
}

interface Transaction {
  id: string;
  amount: string;
  description: string;
  type: string;
  date: string;
  notes: string | null;
  recurring_id: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
}

interface MonthStats {
  income: string;
  expense: string;
  balance: string;
  savings_rate: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  color: string;
  latest_balance: string | null;
  latest_date: string | null;
}

interface Snapshot {
  id: string;
  account_id: string;
  balance: string;
  date: string;
  note: string | null;
}

interface StatsData {
  monthly: { label: string; yearMonth: string; income: number; expense: number; balance: number; savings_rate: number }[];
  allCategoryExpenses: { id: string; name: string; color: string; icon: string; total: number }[];
  dailyData: { date: string; expense: number; income: number }[];
  categoryByMonth: { month: string; cat_id: string; cat_name: string; cat_color: string; cat_icon: string; total: number }[];
  byDayOfWeek: { day: string; total: number; count: number }[];
  accounts: { id: string; name: string; type: string; color: string; latest_balance: number; snapshots: { date: string; balance: number }[] }[];
  totalPatrimony: number;
  patrimonyTimeline: { date: string; total: number }[];
  trends: { expense_vs_prev: number; income_vs_prev: number; savings_vs_prev: number; patrimony_trend: number };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatEur(val: number | string): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function formatDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function trendArrow(val: number, invertGood?: boolean): { icon: string; color: string } {
  if (val === 0) return { icon: "→", color: "var(--text-muted)" };
  const positive = val > 0;
  const good = invertGood ? !positive : positive;
  return { icon: positive ? "↑" : "↓", color: good ? "var(--green)" : "var(--red)" };
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  savings: "Épargne",
  investment: "Investissement",
  checking: "Courant",
};

const CAT_TYPE_LABELS: Record<string, string> = {
  income: "Revenu",
  expense: "Dépense",
  both: "Les deux",
};

const PRESET_COLORS = [
  "#3b7ef8", "#e84f7b", "#16a34a", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#ef4444", "#10b981", "#f97316", "#6366f1",
];

const DEFAULT_CATEGORIES: Omit<Category, "id" | "transaction_count">[] = [
  { name: "Loyer", color: "#ef4444", icon: "🏠", type: "expense" },
  { name: "Courses", color: "#16a34a", icon: "🛒", type: "expense" },
  { name: "Transport", color: "#f59e0b", icon: "🚗", type: "expense" },
  { name: "Loisirs", color: "#8b5cf6", icon: "🎮", type: "expense" },
  { name: "Restaurants", color: "#e84f7b", icon: "🍽️", type: "expense" },
  { name: "Santé", color: "#06b6d4", icon: "💊", type: "expense" },
  { name: "Salaire", color: "#16a34a", icon: "💼", type: "income" },
  { name: "Autre", color: "#888aaa", icon: "💰", type: "both" },
];

// ── Shared styles ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "9px 12px",
  border: "1.5px solid var(--border)", borderRadius: 9, fontSize: 14,
  background: "var(--bg)", color: "var(--text)", fontFamily: "inherit",
};

const selectStyle: React.CSSProperties = { ...inputStyle };

// Primary CTA — filled accent
const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  padding: "9px 18px", borderRadius: 10,
  background: "var(--accent)", color: "#fff",
  fontWeight: 600, fontSize: 14, border: "none",
  cursor: "pointer", fontFamily: "inherit",
  boxShadow: "0 1px 4px rgba(59,126,248,0.25)",
  whiteSpace: "nowrap",
  transition: "filter 0.15s, transform 0.15s, box-shadow 0.15s",
};

// Secondary — outlined, subtle
const btnSecondary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  padding: "8px 14px", borderRadius: 10,
  background: "var(--surface)", color: "var(--text)",
  fontWeight: 500, fontSize: 13, border: "1.5px solid var(--border)",
  cursor: "pointer", fontFamily: "inherit",
  boxShadow: "var(--shadow-sm)", whiteSpace: "nowrap",
  transition: "background 0.15s, border-color 0.15s",
};

// Ghost — for cancel / neutral
const btnGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  padding: "9px 14px", borderRadius: 10,
  background: "transparent", color: "var(--text-muted)",
  fontWeight: 500, fontSize: 14, border: "1.5px solid var(--border)",
  cursor: "pointer", fontFamily: "inherit",
  transition: "background 0.15s, color 0.15s",
};

// Danger — destructive secondary
const btnDanger: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  padding: "8px 14px", borderRadius: 10,
  background: "rgba(220,38,38,0.07)", color: "var(--red)",
  fontWeight: 500, fontSize: 13, border: "1.5px solid rgba(220,38,38,0.2)",
  cursor: "pointer", fontFamily: "inherit",
  whiteSpace: "nowrap",
};

// Icon — square icon-only button
const btnIcon: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
  background: "var(--bg)", border: "1.5px solid var(--border)",
  cursor: "pointer", color: "var(--text-muted)",
  transition: "background 0.15s, border-color 0.15s, color 0.15s",
};

// Pill — filter / period selector
function pillStyle(active: boolean, activeColor?: string): React.CSSProperties {
  return {
    padding: "5px 14px", borderRadius: 20, fontWeight: active ? 600 : 400, fontSize: 13,
    border: active ? "1.5px solid transparent" : "1.5px solid var(--border)",
    background: active ? (activeColor ?? "var(--accent)") : "var(--surface)",
    color: active ? "#fff" : "var(--text-muted)",
    cursor: "pointer", fontFamily: "inherit",
    transition: "background 0.15s, color 0.15s, border-color 0.15s",
    whiteSpace: "nowrap" as const,
  };
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}


function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
      padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4, minWidth: 160,
      boxShadow: "var(--shadow-sm)",
    }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? "var(--text)", fontFamily: "var(--font-mono)" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

// ── Trend Badge ────────────────────────────────────────────────────────────────

function TrendBadge({ label, value, invertGood, unit }: { label: string; value: number; invertGood?: boolean; unit?: string }) {
  const { icon, color } = trendArrow(value, invertGood);
  const abs = Math.abs(value);
  const display = unit === "%" ? `${abs.toFixed(1)} %` : formatEur(abs);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
      padding: "10px 16px", fontSize: 13, boxShadow: "var(--shadow-sm)",
    }}>
      <span style={{ fontSize: 20, color, lineHeight: 1 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, color, fontSize: 14 }}>{display} vs mois dernier</div>
        <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      backdropFilter: "blur(2px)",
    }} onClick={onClose}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
        padding: "28px 28px 24px", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.1)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{
            ...btnIcon, background: "var(--surface2)", border: "none",
            width: 32, height: 32, borderRadius: 9, color: "var(--text-muted)",
          }}>
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Field ──────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
        marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em",
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Form footer ────────────────────────────────────────────────────────────────

function FormFooter({ onCancel, onSave, saveLabel = "Enregistrer" }: { onCancel: () => void; onSave: () => void; saveLabel?: string }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
      <button onClick={onCancel} style={{ ...btnGhost, flex: 1 }}>Annuler</button>
      <button onClick={onSave} className="btn-primary" style={{ ...btnPrimary, flex: 2 }}>{saveLabel}</button>
    </div>
  );
}

// ── Type Toggle ────────────────────────────────────────────────────────────────

function TypeToggle({ value, onChange }: { value: "income" | "expense"; onChange: (v: "income" | "expense") => void }) {
  return (
    <div style={{
      display: "flex", gap: 0, border: "1.5px solid var(--border)", borderRadius: 10, overflow: "hidden",
      background: "var(--bg)",
    }}>
      {(["expense", "income"] as const).map((t) => {
        const active = value === t;
        const col = t === "income" ? "#16a34a" : "#dc2626";
        const bg = t === "income" ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)";
        return (
          <button key={t} onClick={() => onChange(t)} style={{
            flex: 1, padding: "9px 0", border: "none",
            background: active ? bg : "transparent",
            color: active ? col : "var(--text-muted)",
            fontWeight: active ? 700 : 400, fontSize: 14,
            cursor: "pointer", fontFamily: "inherit",
            transition: "background 0.15s, color 0.15s",
            borderRight: t === "expense" ? "1px solid var(--border)" : "none",
          }}>
            {t === "income" ? "💚 Revenu" : "🔴 Dépense"}
          </button>
        );
      })}
    </div>
  );
}

// ── Color Picker ───────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {PRESET_COLORS.map((c) => (
        <div key={c} onClick={() => onChange(c)} style={{
          width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", flexShrink: 0,
          border: value === c ? `3px solid var(--text)` : "3px solid transparent",
          boxShadow: value === c ? `0 0 0 1px ${c}` : "none",
          transition: "transform 0.12s",
        }} />
      ))}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: 32, height: 32, border: "1.5px solid var(--border)", borderRadius: 8, cursor: "pointer", padding: 2, background: "var(--bg)" }} />
    </div>
  );
}

// ── Row actions ────────────────────────────────────────────────────────────────

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      <button onClick={onEdit} style={btnIcon} title="Modifier"><IconEdit /></button>
      <button onClick={onDelete} style={{ ...btnIcon, color: "var(--red)", borderColor: "rgba(220,38,38,0.25)", background: "rgba(220,38,38,0.05)" }} title="Supprimer"><IconTrash /></button>
    </div>
  );
}

// ── Tab: Mois ──────────────────────────────────────────────────────────────────

function MonthTab({ categories }: { categories: Category[] }) {
  const [month, setMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [typeFilter, setTypeFilter] = useState<"" | "income" | "expense">("");

  const form = {
    amount: useState(""),
    description: useState(""),
    category_id: useState(""),
    type: useState<"income" | "expense">("expense"),
    date: useState(todayISO()),
    notes: useState(""),
  };

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/finances/transactions?month=${month}`);
    const data = await r.json();
    setTransactions(data.transactions ?? []);
    setStats(data.stats ?? null);
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

function openAdd() {
    form.amount[1](""); form.description[1](""); form.category_id[1]("");
    form.type[1]("expense"); form.date[1](todayISO()); form.notes[1]("");
    setShowAdd(true);
  }

  function openEdit(tx: Transaction) {
    setEditTx(tx);
    form.amount[1](tx.amount);
    form.description[1](tx.description);
    form.category_id[1](tx.category_id ?? "");
    form.type[1](tx.type as "income" | "expense");
    form.date[1](tx.date);
    form.notes[1](tx.notes ?? "");
  }

  async function save() {
    const body = {
      amount: form.amount[0], description: form.description[0],
      category_id: form.category_id[0] || null, type: form.type[0],
      date: form.date[0], notes: form.notes[0] || null,
    };
    if (editTx) {
      await fetch(`/api/finances/transactions?id=${editTx.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setEditTx(null);
    } else {
      await fetch("/api/finances/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setShowAdd(false);
    }
    load();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette transaction ?")) return;
    await fetch(`/api/finances/transactions?id=${id}`, { method: "DELETE" });
    load();
  }

  const filtered = useMemo(() => {
    if (!typeFilter) return transactions;
    return transactions.filter((t) => t.type === typeFilter);
  }, [transactions, typeFilter]);

  const catOptions = categories.filter((c) => !form.type[0] || c.type === form.type[0] || c.type === "both");

  function TxForm({ onClose }: { onClose: () => void }) {
    return (
      <>
        <Field label="Type">
          <TypeToggle value={form.type[0]} onChange={form.type[1]} />
        </Field>
        <Field label="Montant (€)">
          <input style={inputStyle} type="number" min="0" step="0.01" value={form.amount[0]}
            onChange={(e) => form.amount[1](e.target.value)} placeholder="0,00" />
        </Field>
        <Field label="Description">
          <input style={inputStyle} value={form.description[0]}
            onChange={(e) => form.description[1](e.target.value)} placeholder="Libellé de la transaction" />
        </Field>
        <Field label="Catégorie">
          <select style={selectStyle} value={form.category_id[0]} onChange={(e) => form.category_id[1](e.target.value)}>
            <option value="">Sans catégorie</option>
            {catOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input style={inputStyle} type="date" value={form.date[0]} onChange={(e) => form.date[1](e.target.value)} />
        </Field>
        <Field label="Notes">
          <input style={inputStyle} value={form.notes[0]} onChange={(e) => form.notes[1](e.target.value)} placeholder="Optionnel" />
        </Field>
        <FormFooter onCancel={onClose} onSave={save} />
      </>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          style={{ ...inputStyle, width: "auto", fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 14 }} />
        <button onClick={openAdd} className="btn-primary" style={btnPrimary}>
          <IconPlus /> Transaction
        </button>
      </div>

      {/* KPIs */}
      {stats && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <KpiCard label="Revenus" value={formatEur(stats.income)} color="var(--green)" />
          <KpiCard label="Dépenses" value={formatEur(stats.expense)} color="var(--red)" />
          <KpiCard label="Solde" value={formatEur(stats.balance)} color={parseFloat(stats.balance) >= 0 ? "var(--green)" : "var(--red)"} />
          <KpiCard label="Taux d'épargne" value={`${stats.savings_rate} %`} color="var(--accent)" />
        </div>
      )}

      {/* Type filter pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {([["", "Toutes"], ["income", "Revenus"], ["expense", "Dépenses"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setTypeFilter(v as "" | "income" | "expense")}
            style={pillStyle(typeFilter === v)}>
            {l}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      {loading ? (
        <div style={{ color: "var(--text-muted)", padding: 48, textAlign: "center", fontSize: 14 }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          color: "var(--text-muted)", padding: 48, textAlign: "center", fontSize: 14,
          background: "var(--surface)", borderRadius: 12, border: "1px dashed var(--border)",
        }}>
          Aucune transaction ce mois-ci.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {filtered.map((tx) => (
            <div key={tx.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "var(--surface)", border: "1.5px solid var(--border)",
              borderRadius: 11, padding: "10px 14px",
              borderLeft: `3px solid ${tx.category_color ?? (tx.type === "income" ? "var(--green)" : "var(--red)")}`,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  {tx.category_icon && <span style={{ fontSize: 16 }}>{tx.category_icon}</span>}
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx.description}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {tx.category_name ?? "Sans catégorie"} · {formatDate(tx.date)}
                </div>
              </div>
              <div style={{
                fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15, flexShrink: 0,
                color: tx.type === "income" ? "var(--green)" : "var(--red)",
              }}>
                {tx.type === "income" ? "+" : "−"}{formatEur(tx.amount)}
              </div>
              <RowActions onEdit={() => openEdit(tx)} onDelete={() => remove(tx.id)} />
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Nouvelle transaction" onClose={() => setShowAdd(false)}>
          <TxForm onClose={() => setShowAdd(false)} />
        </Modal>
      )}
      {editTx && (
        <Modal title="Modifier la transaction" onClose={() => setEditTx(null)}>
          <TxForm onClose={() => setEditTx(null)} />
        </Modal>
      )}
    </div>
  );
}

// ── Tab: Comptes ───────────────────────────────────────────────────────────────

function AccountsTab() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [openSnapAccount, setOpenSnapAccount] = useState<Account | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [showAddSnap, setShowAddSnap] = useState(false);

  const form = {
    name: useState(""),
    type: useState("savings"),
    institution: useState(""),
    color: useState("#3b7ef8"),
  };

  const snapForm = {
    balance: useState(""),
    date: useState(todayISO()),
    note: useState(""),
  };

  const load = useCallback(async () => {
    const r = await fetch("/api/finances/accounts");
    setAccounts(await r.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadSnaps = useCallback(async (accountId: string) => {
    const r = await fetch(`/api/finances/accounts/snapshots?account_id=${accountId}`);
    setSnapshots(await r.json());
  }, []);

  async function saveAccount() {
    const body = {
      name: form.name[0], type: form.type[0],
      institution: form.institution[0] || null, color: form.color[0],
    };
    if (editAccount) {
      await fetch(`/api/finances/accounts?id=${editAccount.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setEditAccount(null);
    } else {
      await fetch("/api/finances/accounts", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setShowAdd(false);
    }
    load();
  }

  async function removeAccount(id: string) {
    if (!confirm("Supprimer ce compte et tout son historique ?")) return;
    await fetch(`/api/finances/accounts?id=${id}`, { method: "DELETE" });
    load();
  }

  async function saveSnap() {
    await fetch("/api/finances/accounts/snapshots", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: openSnapAccount!.id,
        balance: snapForm.balance[0], date: snapForm.date[0], note: snapForm.note[0] || null,
      }),
    });
    setShowAddSnap(false);
    snapForm.balance[1](""); snapForm.note[1](""); snapForm.date[1](todayISO());
    loadSnaps(openSnapAccount!.id);
    load();
  }

  async function removeSnap(id: string) {
    await fetch(`/api/finances/accounts/snapshots?id=${id}`, { method: "DELETE" });
    loadSnaps(openSnapAccount!.id);
    load();
  }

  function openAccEdit(a: Account) {
    setEditAccount(a);
    form.name[1](a.name); form.type[1](a.type);
    form.institution[1](a.institution ?? ""); form.color[1](a.color);
  }

  const totalPatrimony = accounts.reduce((s, a) => s + (a.latest_balance ? parseFloat(a.latest_balance) : 0), 0);

  function AccountForm({ onClose }: { onClose: () => void }) {
    return (
      <>
        <Field label="Nom">
          <input style={inputStyle} value={form.name[0]} onChange={(e) => form.name[1](e.target.value)} placeholder="ex. Livret A, CTO Boursorama…" />
        </Field>
        <Field label="Type">
          <select style={selectStyle} value={form.type[0]} onChange={(e) => form.type[1](e.target.value)}>
            <option value="savings">Épargne</option>
            <option value="investment">Investissement</option>
            <option value="checking">Courant</option>
          </select>
        </Field>
        <Field label="Établissement">
          <input style={inputStyle} value={form.institution[0]} onChange={(e) => form.institution[1](e.target.value)} placeholder="ex. BNP, Boursorama, Fortuneo…" />
        </Field>
        <Field label="Couleur">
          <ColorPicker value={form.color[0]} onChange={form.color[1]} />
        </Field>
        <FormFooter onCancel={onClose} onSave={saveAccount} />
      </>
    );
  }

  const snapChartData = useMemo(() => {
    return [...snapshots].reverse().map((s) => ({
      date: formatDate(s.date),
      balance: parseFloat(s.balance),
    }));
  }, [snapshots]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <KpiCard label="Patrimoine total" value={formatEur(totalPatrimony)} color="var(--accent)" />
        <button onClick={() => { form.name[1](""); form.type[1]("savings"); form.institution[1](""); form.color[1]("#3b7ef8"); setShowAdd(true); }}
          className="btn-primary" style={{ ...btnPrimary, marginLeft: "auto" }}>
          <IconPlus /> Compte
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {accounts.map((a) => (
          <div key={a.id} style={{
            background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 18,
            borderLeft: `4px solid ${a.color}`, boxShadow: "var(--shadow-sm)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {ACCOUNT_TYPE_LABELS[a.type] ?? a.type}{a.institution ? ` · ${a.institution}` : ""}
                </div>
              </div>
              <RowActions onEdit={() => openAccEdit(a)} onDelete={() => removeAccount(a.id)} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "var(--font-mono)", color: a.color, marginBottom: 2 }}>
              {a.latest_balance ? formatEur(a.latest_balance) : "—"}
            </div>
            {a.latest_date && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 14 }}>au {formatDate(a.latest_date)}</div>
            )}
            <button onClick={() => { setOpenSnapAccount(a); loadSnaps(a.id); setShowAddSnap(false); }} style={{
              ...btnSecondary, width: "100%", justifyContent: "center",
            }}>
              Mettre à jour / Historique
            </button>
          </div>
        ))}
        {accounts.length === 0 && (
          <div style={{
            color: "var(--text-muted)", fontSize: 14, padding: 32, textAlign: "center",
            gridColumn: "1/-1", background: "var(--surface)", borderRadius: 12, border: "1px dashed var(--border)",
          }}>
            Aucun compte. Ajoutez un Livret A, CTO, PEL…
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title="Nouveau compte" onClose={() => setShowAdd(false)}>
          <AccountForm onClose={() => setShowAdd(false)} />
        </Modal>
      )}
      {editAccount && (
        <Modal title="Modifier le compte" onClose={() => setEditAccount(null)}>
          <AccountForm onClose={() => setEditAccount(null)} />
        </Modal>
      )}

      {/* Snapshots side panel */}
      {openSnapAccount && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          backdropFilter: "blur(2px)",
        }} onClick={() => { setOpenSnapAccount(null); setShowAddSnap(false); }}>
          <div style={{
            width: "min(480px, 100vw)", height: "100vh", background: "var(--surface)",
            borderLeft: "1.5px solid var(--border)", padding: "24px 24px 32px",
            overflowY: "auto", display: "flex", flexDirection: "column", gap: 20,
            boxShadow: "-8px 0 32px rgba(0,0,0,0.1)",
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{openSnapAccount.name}</h2>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{ACCOUNT_TYPE_LABELS[openSnapAccount.type] ?? openSnapAccount.type}</div>
              </div>
              <button onClick={() => { setOpenSnapAccount(null); setShowAddSnap(false); }} style={{ ...btnIcon, width: 34, height: 34 }}>
                <IconClose />
              </button>
            </div>

            {/* Mini chart */}
            {snapChartData.length > 1 && (
              <div style={{ height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={snapChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => `${v.toLocaleString("fr-FR")} €`} width={70} />
                    <Tooltip formatter={(v: number) => [formatEur(v), "Solde"]} />
                    <Line type="monotone" dataKey="balance" stroke={openSnapAccount.color} strokeWidth={2.5} dot={{ r: 4, fill: openSnapAccount.color }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* CTA update */}
            {!showAddSnap ? (
              <button onClick={() => setShowAddSnap(true)} className="btn-primary" style={btnPrimary}>
                <IconPlus /> Mettre à jour le solde
              </button>
            ) : (
              <div style={{ background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Nouveau solde</div>
                <Field label="Solde (€)">
                  <input style={inputStyle} type="number" step="0.01" value={snapForm.balance[0]}
                    onChange={(e) => snapForm.balance[1](e.target.value)} placeholder="0,00" />
                </Field>
                <Field label="Date">
                  <input style={inputStyle} type="date" value={snapForm.date[0]} onChange={(e) => snapForm.date[1](e.target.value)} />
                </Field>
                <Field label="Note">
                  <input style={inputStyle} value={snapForm.note[0]} onChange={(e) => snapForm.note[1](e.target.value)} placeholder="Optionnel" />
                </Field>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button onClick={() => setShowAddSnap(false)} style={btnGhost}>Annuler</button>
                  <button onClick={saveSnap} className="btn-primary" style={{ ...btnPrimary, flex: 1 }}>Enregistrer</button>
                </div>
              </div>
            )}

            {/* History */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Historique</div>
              {snapshots.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Aucun historique.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {snapshots.map((s) => (
                    <div key={s.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 9, padding: "9px 12px",
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontFamily: "var(--font-mono)", fontSize: 14, color: openSnapAccount.color }}>{formatEur(s.balance)}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{formatDate(s.date)}{s.note ? ` · ${s.note}` : ""}</div>
                      </div>
                      <button onClick={() => removeSnap(s.id)} style={{ ...btnIcon, color: "var(--red)", borderColor: "rgba(220,38,38,0.2)", background: "rgba(220,38,38,0.05)" }}>
                        <IconTrash />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Catégories ────────────────────────────────────────────────────────────

function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [seeding, setSeeding] = useState(false);

  const form = {
    name: useState(""),
    color: useState("#3b7ef8"),
    icon: useState("💰"),
    type: useState("both"),
    budget: useState(""),
  };

  const load = useCallback(async () => {
    const r = await fetch("/api/finances/categories");
    setCategories(await r.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function seedDefaults() {
    setSeeding(true);
    for (const cat of DEFAULT_CATEGORIES) {
      await fetch("/api/finances/categories", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cat),
      });
    }
    setSeeding(false);
    load();
  }

  function openAdd() {
    form.name[1](""); form.color[1]("#3b7ef8"); form.icon[1]("💰"); form.type[1]("both"); form.budget[1]("");
    setShowAdd(true);
  }

  function openEdit(cat: Category) {
    setEditCat(cat);
    form.name[1](cat.name); form.color[1](cat.color); form.icon[1](cat.icon); form.type[1](cat.type);
    form.budget[1](cat.budget ? String(cat.budget) : "");
  }

  async function save() {
    const body = { name: form.name[0], color: form.color[0], icon: form.icon[0], type: form.type[0], budget: form.budget[0] || null };
    if (editCat) {
      await fetch(`/api/finances/categories?id=${editCat.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setEditCat(null);
    } else {
      await fetch("/api/finances/categories", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setShowAdd(false);
    }
    load();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette catégorie ?")) return;
    await fetch(`/api/finances/categories?id=${id}`, { method: "DELETE" });
    load();
  }

  function CatForm({ onClose }: { onClose: () => void }) {
    return (
      <>
        <Field label="Nom">
          <input style={inputStyle} value={form.name[0]} onChange={(e) => form.name[1](e.target.value)} placeholder="ex. Loyer, Salaire…" />
        </Field>
        <Field label="Icône (emoji)">
          <input style={inputStyle} value={form.icon[0]} onChange={(e) => form.icon[1](e.target.value)} placeholder="💰" />
        </Field>
        <Field label="Couleur">
          <ColorPicker value={form.color[0]} onChange={form.color[1]} />
        </Field>
        <Field label="Type de transactions">
          <select style={selectStyle} value={form.type[0]} onChange={(e) => form.type[1](e.target.value)}>
            <option value="both">Revenus et dépenses</option>
            <option value="income">Revenus uniquement</option>
            <option value="expense">Dépenses uniquement</option>
          </select>
        </Field>
        <Field label="Budget mensuel (€) — optionnel">
          <input style={inputStyle} type="number" min="0" step="0.01" value={form.budget[0]}
            onChange={(e) => form.budget[1](e.target.value)} placeholder="ex. 300 €" />
        </Field>
        <FormFooter onCancel={onClose} onSave={save} />
      </>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={openAdd} className="btn-primary" style={btnPrimary}>
          <IconPlus /> Catégorie
        </button>
        {categories.length === 0 && (
          <button onClick={seedDefaults} disabled={seeding} style={{ ...btnSecondary, opacity: seeding ? 0.6 : 1 }}>
            {seeding ? "Ajout en cours…" : "✨ Catégories par défaut"}
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {categories.map((cat) => (
          <div key={cat.id} style={{
            background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12,
            padding: "13px 14px", display: "flex", alignItems: "center", gap: 12,
            borderLeft: `4px solid ${cat.color}`, boxShadow: "var(--shadow-sm)",
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{cat.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                {CAT_TYPE_LABELS[cat.type] ?? cat.type}
                {cat.transaction_count ? ` · ${cat.transaction_count} opér.` : ""}
                {cat.budget ? ` · ${formatEur(cat.budget)}/mois` : ""}
              </div>
            </div>
            <RowActions onEdit={() => openEdit(cat)} onDelete={() => remove(cat.id)} />
          </div>
        ))}
        {categories.length === 0 && (
          <div style={{
            color: "var(--text-muted)", fontSize: 14, gridColumn: "1/-1",
            padding: 32, textAlign: "center", background: "var(--surface)",
            borderRadius: 12, border: "1px dashed var(--border)",
          }}>
            Aucune catégorie. Ajoutez-en une ou utilisez les catégories par défaut.
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title="Nouvelle catégorie" onClose={() => setShowAdd(false)}>
          <CatForm onClose={() => setShowAdd(false)} />
        </Modal>
      )}
      {editCat && (
        <Modal title="Modifier la catégorie" onClose={() => setEditCat(null)}>
          <CatForm onClose={() => setEditCat(null)} />
        </Modal>
      )}
    </div>
  );
}

// ── Tab: Statistiques ──────────────────────────────────────────────────────────

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}
function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
function monthLongLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function CategoryBars({ data }: { data: { id: string; name: string; color: string; icon: string; total: number }[] }) {
  const total = data.reduce((s, c) => s + c.total, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((cat) => {
        const pct = total > 0 ? (cat.total / total) * 100 : 0;
        return (
          <div key={cat.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{cat.icon} {cat.name}</span>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{formatEur(cat.total)}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", width: 34, textAlign: "right" }}>{pct.toFixed(0)} %</span>
              </div>
            </div>
            <div style={{ height: 6, background: "var(--surface2)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: cat.color, borderRadius: 3, transition: "width 0.4s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Expense Heatmap ────────────────────────────────────────────────────────────

function ExpenseHeatmap({ data }: { data: { date: string; expense: number; income: number }[] }) {
  if (data.length === 0) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune donnée.</div>;

  const map: Record<string, number> = {};
  for (const d of data) map[d.date] = d.expense;
  const vals = Object.values(map).filter((v) => v > 0);
  const maxExp = vals.length > 0 ? Math.max(...vals) : 1;

  // Align start to Monday of first week
  const firstDate = new Date(data[0].date + "T12:00:00");
  const dow = (firstDate.getDay() + 6) % 7;
  firstDate.setDate(firstDate.getDate() - dow);

  const today = new Date();
  const days: { date: string; exp: number }[] = [];
  const cur = new Date(firstDate);
  while (cur <= today) {
    const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    days.push({ date: ds, exp: map[ds] ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }

  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  function cellColor(val: number) {
    if (val === 0) return "var(--surface2)";
    const pct = val / maxExp;
    if (pct < 0.2) return "#fecaca";
    if (pct < 0.4) return "#f87171";
    if (pct < 0.65) return "#ef4444";
    if (pct < 0.85) return "#dc2626";
    return "#991b1b";
  }

  const DOW_LABELS = ["L", "", "M", "", "J", "", "S"];

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start", minWidth: "max-content" }}>
        {/* Day-of-week labels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 20 }}>
          {DOW_LABELS.map((label, i) => (
            <div key={i} style={{ height: 12, width: 12, fontSize: 9, color: "var(--text-muted)", lineHeight: "12px", textAlign: "center" }}>{label}</div>
          ))}
        </div>
        {/* Week columns */}
        <div style={{ display: "flex", gap: 2 }}>
          {weeks.map((week, wi) => {
            const firstDay = week[0];
            const showLabel = firstDay && firstDay.date.slice(8) <= "07";
            const monthLabel = showLabel
              ? new Date(firstDay.date + "T12:00:00").toLocaleDateString("fr-FR", { month: "short" })
              : "";
            return (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ height: 16, fontSize: 9, color: "var(--text-muted)", whiteSpace: "nowrap", lineHeight: "16px" }}>{monthLabel}</div>
                {week.map((day, di) => (
                  <div key={di} title={`${day.date} — ${formatEur(day.exp)}`} style={{
                    width: 12, height: 12, borderRadius: 2,
                    background: cellColor(day.exp),
                    cursor: "default",
                  }} />
                ))}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 20, marginLeft: 10 }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)" }}>Faible</div>
          {["#fecaca", "#f87171", "#ef4444", "#dc2626", "#991b1b"].map((c) => (
            <div key={c} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
          ))}
          <div style={{ fontSize: 9, color: "var(--text-muted)" }}>Fort</div>
        </div>
      </div>
    </div>
  );
}

function StatsTab({ categories }: { categories: Category[] }) {
  const [viewMode, setViewMode] = useState<"period" | "month">("period");

  // ── Period view state
  const [periodMonths, setPeriodMonths] = useState(6);
  const [periodData, setPeriodData] = useState<StatsData | null>(null);
  const [periodLoading, setPeriodLoading] = useState(true);

  // ── Month view state
  const [selMonth, setSelMonth] = useState(currentMonth());
  const [monthTx, setMonthTx] = useState<Transaction[]>([]);
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);

  // Always load period data (default view)
  useEffect(() => {
    setPeriodLoading(true);
    fetch(`/api/finances/stats?months=${periodMonths}`)
      .then((r) => r.json())
      .then((d) => { setPeriodData(d); setPeriodLoading(false); });
  }, [periodMonths]);

  // Load month data on demand
  useEffect(() => {
    if (viewMode !== "month") return;
    setMonthLoading(true);
    fetch(`/api/finances/transactions?month=${selMonth}`)
      .then((r) => r.json())
      .then((d) => { setMonthTx(d.transactions ?? []); setMonthStats(d.stats ?? null); setMonthLoading(false); });
  }, [viewMode, selMonth]);

  // ── Computed: month view
  const monthCatData = useMemo(() => {
    const map: Record<string, { id: string; name: string; color: string; icon: string; total: number }> = {};
    for (const tx of monthTx.filter((t) => t.type === "expense")) {
      const key = tx.category_id ?? "none";
      if (!map[key]) map[key] = { id: key, name: tx.category_name ?? "Sans catégorie", color: tx.category_color ?? "#9ca3af", icon: tx.category_icon ?? "💰", total: 0 };
      map[key].total += parseFloat(tx.amount);
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [monthTx]);

  const topExpenses = useMemo(() =>
    [...monthTx].filter((t) => t.type === "expense").sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)).slice(0, 5),
    [monthTx]
  );

  // ── Computed: period view
  const periodSummary = useMemo(() => {
    if (!periodData) return null;
    const { monthly, allCategoryExpenses } = periodData;
    const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
    const totalExpense = monthly.reduce((s, m) => s + m.expense, 0);
    const totalBalance = totalIncome - totalExpense;
    const withIncome = monthly.filter((m) => m.income > 0);
    const avgSavingsRate = withIncome.length > 0
      ? withIncome.reduce((s, m) => s + m.savings_rate, 0) / withIncome.length : 0;
    const bestMonth = [...monthly].sort((a, b) => b.savings_rate - a.savings_rate)[0];
    const worstMonth = [...monthly].filter((m) => m.income > 0).sort((a, b) => a.savings_rate - b.savings_rate)[0];
    const top8 = allCategoryExpenses.slice(0, 8);
    const otherTotal = allCategoryExpenses.slice(8).reduce((s, c) => s + c.total, 0);
    const donutData = otherTotal > 0 ? [...top8, { id: "other", name: "Autre", color: "#9ca3af", icon: "…", total: otherTotal }] : top8;
    return { totalIncome, totalExpense, totalBalance, avgSavingsRate, bestMonth, worstMonth, donutData };
  }, [periodData]);

  // ── Cumulative balance from dailyData
  const cumulativeBalance = useMemo(() => {
    if (!periodData) return [];
    let running = 0;
    return [...periodData.dailyData]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => {
        running += d.income - d.expense;
        return { date: d.date.slice(5), balance: Math.round(running * 100) / 100 };
      });
  }, [periodData]);

  // ── Stacked category-by-month data
  const stackedCatData = useMemo(() => {
    if (!periodData) return { rows: [], cats: [] };
    const catsMap = new Map<string, { name: string; color: string; icon: string }>();
    for (const r of periodData.categoryByMonth) {
      if (!catsMap.has(r.cat_id)) catsMap.set(r.cat_id, { name: r.cat_name, color: r.cat_color, icon: r.cat_icon });
    }
    const byMonth: Record<string, Record<string, number>> = {};
    for (const r of periodData.categoryByMonth) {
      if (!byMonth[r.month]) byMonth[r.month] = {};
      byMonth[r.month][r.cat_id] = r.total;
    }
    const rows = periodData.monthly.map((m) => ({
      label: m.label,
      yearMonth: m.yearMonth,
      ...(byMonth[m.yearMonth] ?? {}),
    }));
    const cats = [...catsMap.entries()].map(([id, info]) => ({ id, ...info }));
    return { rows, cats };
  }, [periodData]);

  // ── Patrimony by account type
  const patrimonyByType = useMemo(() => {
    if (!periodData) return [];
    const TYPE_COLORS: Record<string, string> = { savings: "#3b7ef8", investment: "#8b5cf6", checking: "#16a34a" };
    const map: Record<string, { total: number; color: string }> = {};
    for (const a of periodData.accounts) {
      if (!map[a.type]) map[a.type] = { total: 0, color: TYPE_COLORS[a.type] ?? "#888" };
      map[a.type].total += a.latest_balance;
    }
    return Object.entries(map).map(([type, { total, color }]) => ({
      type, label: ACCOUNT_TYPE_LABELS[type] ?? type, total, color,
    }));
  }, [periodData]);

  // ── Month view: projection
  const monthProjection = useMemo(() => {
    if (!monthStats) return null;
    const [y, m] = selMonth.split("-").map(Number);
    const today = new Date();
    const daysInMonth = new Date(y, m, 0).getDate();
    const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
    const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;
    const totalExpense = parseFloat(monthStats.expense);
    const dailyAvg = daysElapsed > 0 ? totalExpense / daysElapsed : 0;
    const projected = isCurrentMonth ? dailyAvg * daysInMonth : totalExpense;
    return { dailyAvg, projected, daysElapsed, daysInMonth, isCurrentMonth };
  }, [monthStats, selMonth]);

  // ── Month view: budget vs réel
  const budgetComparison = useMemo(() => {
    return categories
      .filter((c) => c.budget && parseFloat(c.budget) > 0 && (c.type === "expense" || c.type === "both"))
      .map((c) => {
        const spent = monthCatData.find((m) => m.id === c.id)?.total ?? 0;
        const budget = parseFloat(c.budget!);
        const pct = budget > 0 ? (spent / budget) * 100 : 0;
        const color = pct >= 100 ? "var(--red)" : pct >= 80 ? "#f59e0b" : "var(--green)";
        return { id: c.id, name: c.name, icon: c.icon, color: c.color, spent, budget, pct, barColor: color };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [categories, monthCatData]);

  const TOOLTIP_STYLE: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13,
  };
  const ST: React.CSSProperties = { fontSize: 15, fontWeight: 700, marginBottom: 14 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

      {/* ── Selector bar ── */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {/* Mode toggle */}
        <div style={{ display: "flex", border: "1.5px solid var(--border)", borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
          {(["period", "month"] as const).map((m, i) => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding: "7px 18px", border: "none", fontFamily: "inherit", cursor: "pointer", fontSize: 13,
              background: viewMode === m ? "var(--accent)" : "transparent",
              color: viewMode === m ? "#fff" : "var(--text-muted)",
              fontWeight: viewMode === m ? 600 : 400,
              borderRight: i === 0 ? "1px solid var(--border)" : "none",
              transition: "background 0.15s, color 0.15s",
            }}>
              {m === "period" ? "Période" : "Mois"}
            </button>
          ))}
        </div>

        {/* Period pills */}
        {viewMode === "period" && (
          <div style={{ display: "flex", gap: 6 }}>
            {[3, 6, 12].map((m) => (
              <button key={m} onClick={() => setPeriodMonths(m)} style={pillStyle(periodMonths === m)}>
                {m} mois
              </button>
            ))}
          </div>
        )}

        {/* Month navigator */}
        {viewMode === "month" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setSelMonth(prevMonth(selMonth))} style={{ ...btnIcon, fontSize: 18, width: 32, height: 32 }}>‹</button>
            <input type="month" value={selMonth} onChange={(e) => setSelMonth(e.target.value)} style={{
              ...inputStyle, width: "auto", fontWeight: 600, fontSize: 14, fontFamily: "var(--font-mono)",
            }} />
            <button onClick={() => setSelMonth(nextMonth(selMonth))} style={{ ...btnIcon, fontSize: 18, width: 32, height: 32 }}>›</button>
          </div>
        )}
      </div>

      {/* ══════════════════ PÉRIODE ══════════════════ */}
      {viewMode === "period" && (
        periodLoading ? (
          <div style={{ color: "var(--text-muted)", padding: 48, textAlign: "center" }}>Chargement…</div>
        ) : !periodData || !periodSummary ? (
          <div style={{ color: "var(--red)", padding: 32, textAlign: "center" }}>Aucune donnée.</div>
        ) : (
          <>
            {/* ① Résumé global */}
            <div>
              <div style={ST}>Résumé sur {periodMonths} mois</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <KpiCard label="Total revenus" value={formatEur(periodSummary.totalIncome)} color="var(--green)" />
                <KpiCard label="Total dépenses" value={formatEur(periodSummary.totalExpense)} color="var(--red)" />
                <KpiCard label="Net épargné" value={formatEur(periodSummary.totalBalance)} color={periodSummary.totalBalance >= 0 ? "var(--green)" : "var(--red)"} />
                <KpiCard label="Taux moyen" value={`${periodSummary.avgSavingsRate.toFixed(1)} %`} color="var(--accent)" />
              </div>
            </div>

            {/* ② Tendances + highlights */}
            {periodData.monthly.length >= 2 && (
              <div>
                <div style={ST}>Tendances vs mois précédent</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                  <TrendBadge label="Dépenses" value={periodData.trends.expense_vs_prev} invertGood />
                  <TrendBadge label="Revenus" value={periodData.trends.income_vs_prev} />
                  <TrendBadge label="Épargne" value={periodData.trends.savings_vs_prev} />
                  {periodData.totalPatrimony > 0 && (
                    <TrendBadge label="Patrimoine" value={periodData.trends.patrimony_trend} />
                  )}
                </div>
                {/* Best / worst month */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {periodSummary.bestMonth && (
                    <div style={{
                      background: "rgba(22,163,74,0.07)", border: "1.5px solid rgba(22,163,74,0.22)", borderRadius: 11,
                      padding: "12px 16px", flex: 1, minWidth: 180,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Meilleur mois</div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{periodSummary.bestMonth.label}</div>
                      <div style={{ fontSize: 13, color: "var(--green)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                        {periodSummary.bestMonth.savings_rate} % épargné · {formatEur(periodSummary.bestMonth.balance)}
                      </div>
                    </div>
                  )}
                  {periodSummary.worstMonth && (
                    <div style={{
                      background: "rgba(220,38,38,0.06)", border: "1.5px solid rgba(220,38,38,0.18)", borderRadius: 11,
                      padding: "12px 16px", flex: 1, minWidth: 180,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Mois le plus chargé</div>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{periodSummary.worstMonth.label}</div>
                      <div style={{ fontSize: 13, color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                        {formatEur(periodSummary.worstMonth.expense)} dépensés
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ③ Bar chart évolution */}
            <div>
              <div style={ST}>Évolution revenus / dépenses / épargne</div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={periodData.monthly} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} tickFormatter={(v) => `${v.toLocaleString("fr-FR")} €`} width={82} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatEur(v)} />
                    <Bar dataKey="income" name="Revenus" fill="var(--green)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Dépenses" fill="var(--red)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="balance" name="Épargne" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ④ Heatmap des dépenses */}
            {periodData.dailyData.length > 0 && (
              <div>
                <div style={ST}>Heatmap des dépenses</div>
                <ExpenseHeatmap data={periodData.dailyData} />
              </div>
            )}

            {/* ⑤ Solde cumulé */}
            {cumulativeBalance.length > 1 && (
              <div>
                <div style={ST}>Solde cumulé sur la période</div>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cumulativeBalance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => `${v.toLocaleString("fr-FR")} €`} width={82} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatEur(v), "Solde cumulé"]} />
                      <Line type="monotone" dataKey="balance" stroke="var(--accent)" strokeWidth={2.5}
                        dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ⑥ Catégories par mois (stacked) */}
            {stackedCatData.cats.length > 0 && (
              <div>
                <div style={ST}>Dépenses par catégorie · mois par mois</div>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stackedCatData.rows} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} tickFormatter={(v) => `${v.toLocaleString("fr-FR")} €`} width={82} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [formatEur(v), name]} />
                      {stackedCatData.cats.map((cat) => (
                        <Bar key={cat.id} dataKey={cat.id} name={`${cat.icon} ${cat.name}`}
                          stackId="s" fill={cat.color} radius={[0, 0, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ⑦ Dépenses par jour de la semaine */}
            {periodData.byDayOfWeek.length > 0 && (
              <div>
                <div style={ST}>Dépenses par jour de la semaine</div>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={periodData.byDayOfWeek} barSize={36}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="day" tick={{ fontSize: 13, fill: "var(--text-muted)" }} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => `${v.toLocaleString("fr-FR")} €`} width={82} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatEur(v), "Total dépensé"]} />
                      <Bar dataKey="total" name="Dépenses" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ⑧ Taux d'épargne */}
            <div>
              <div style={ST}>Taux d'épargne mensuel</div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={periodData.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--text-muted)" }} tickFormatter={(v) => `${v} %`} width={50} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v} %`, "Taux d'épargne"]} />
                    <Line type="monotone" dataKey="savings_rate" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--accent)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ⑨ Répartition dépenses par catégorie */}
            {periodSummary.donutData.length > 0 && (
              <div>
                <div style={ST}>Répartition des dépenses par catégorie</div>
                <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ width: 200, height: 200, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={periodSummary.donutData} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={88} paddingAngle={2}>
                          {periodSummary.donutData.map((e) => <Cell key={e.id} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [formatEur(v), n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <CategoryBars data={periodSummary.donutData} />
                  </div>
                </div>
              </div>
            )}

            {/* ⑩ Patrimoine */}
            {periodData.accounts.length > 0 && (
              <div>
                <div style={ST}>Vue Patrimoine</div>

                {/* Total + donut par type */}
                <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Total patrimoine</div>
                    <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                      {formatEur(periodData.totalPatrimony)}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
                      {periodData.accounts.map((a) => (
                        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>{a.name}</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13, color: a.color }}>{formatEur(a.latest_balance)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {patrimonyByType.length > 1 && (
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Par type</div>
                      <div style={{ width: 180, height: 180 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={patrimonyByType} dataKey="total" nameKey="label"
                              cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={3}>
                              {patrimonyByType.map((e) => <Cell key={e.type} fill={e.color} />)}
                            </Pie>
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [formatEur(v), n]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 8 }}>
                        {patrimonyByType.map((e) => (
                          <div key={e.type} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: e.color }} />
                            <span style={{ color: "var(--text-muted)" }}>{e.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Évolution globale */}
                {periodData.patrimonyTimeline.length > 1 && (
                  <>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>Évolution du patrimoine global</div>
                    <div style={{ height: 180, marginBottom: 24 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={periodData.patrimonyTimeline}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                          <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => `${v.toLocaleString("fr-FR")} €`} width={80} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatEur(v), "Patrimoine"]} />
                          <Line type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--accent)" }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}

                {/* Sparklines par compte */}
                {periodData.accounts.filter((a) => a.snapshots.length > 1).length > 0 && (
                  <>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>Progression par compte</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                      {periodData.accounts.filter((a) => a.snapshots.length > 1).map((a) => (
                        <div key={a.id} style={{
                          background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 10,
                          padding: "12px 14px", borderTop: `3px solid ${a.color}`,
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: a.color, marginBottom: 2 }}>{a.name}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{formatEur(a.latest_balance)}</div>
                          <div style={{ height: 80 }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={[...a.snapshots].reverse()}>
                                <Line type="monotone" dataKey="balance" stroke={a.color} strokeWidth={2} dot={false} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [formatEur(v), "Solde"]} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )
      )}

      {/* ══════════════════ MOIS ══════════════════ */}
      {viewMode === "month" && (
        monthLoading ? (
          <div style={{ color: "var(--text-muted)", padding: 48, textAlign: "center" }}>Chargement…</div>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", textTransform: "capitalize" }}>
              {monthLongLabel(selMonth)}
            </div>

            {/* KPIs du mois */}
            {monthStats && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <KpiCard label="Revenus" value={formatEur(monthStats.income)} color="var(--green)" />
                <KpiCard label="Dépenses" value={formatEur(monthStats.expense)} color="var(--red)" />
                <KpiCard label="Solde" value={formatEur(monthStats.balance)} color={parseFloat(monthStats.balance) >= 0 ? "var(--green)" : "var(--red)"} />
                <KpiCard label="Taux d'épargne" value={`${monthStats.savings_rate} %`} color="var(--accent)" />
              </div>
            )}

            {/* Projection de fin de mois */}
            {monthProjection && monthProjection.isCurrentMonth && parseFloat(monthStats?.expense ?? "0") > 0 && (
              <div style={{
                background: "linear-gradient(135deg, rgba(59,126,248,0.07) 0%, rgba(59,126,248,0.03) 100%)",
                border: "1.5px solid rgba(59,126,248,0.2)", borderRadius: 12, padding: "16px 20px",
                display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                    Moyenne journalière
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 22 }}>{formatEur(monthProjection.dailyAvg)}/j</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                    sur {monthProjection.daysElapsed} j écoulés
                  </div>
                </div>
                <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                    Projection fin de mois
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: 22, color: "var(--red)" }}>{formatEur(monthProjection.projected)}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                    à ce rythme sur {monthProjection.daysInMonth} j
                  </div>
                </div>
              </div>
            )}

            {/* Budget vs Réel */}
            {budgetComparison.length > 0 && (
              <div>
                <div style={ST}>Budget vs Réel</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {budgetComparison.map((cat) => (
                    <div key={cat.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{cat.icon} {cat.name}</span>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatEur(cat.spent)} / {formatEur(cat.budget)}</span>
                          <span style={{
                            fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)",
                            color: cat.barColor, minWidth: 42, textAlign: "right",
                          }}>{cat.pct.toFixed(0)} %</span>
                        </div>
                      </div>
                      <div style={{ height: 8, background: "var(--surface2)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${Math.min(cat.pct, 100)}%`,
                          background: cat.barColor, borderRadius: 4, transition: "width 0.4s ease",
                        }} />
                      </div>
                      {cat.pct > 100 && (
                        <div style={{ fontSize: 11, color: "var(--red)", marginTop: 3 }}>
                          Dépassement de {formatEur(cat.spent - cat.budget)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {monthTx.length === 0 ? (
              <div style={{
                color: "var(--text-muted)", padding: 48, textAlign: "center", fontSize: 14,
                background: "var(--surface)", borderRadius: 12, border: "1px dashed var(--border)",
              }}>
                Aucune transaction ce mois-ci.
              </div>
            ) : (
              <>
                {/* Répartition catégories du mois */}
                {monthCatData.length > 0 && (
                  <div>
                    <div style={ST}>Dépenses par catégorie</div>
                    <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
                      <div style={{ width: 200, height: 200, flexShrink: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={monthCatData} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={88} paddingAngle={2}>
                              {monthCatData.map((e) => <Cell key={e.id} fill={e.color} />)}
                            </Pie>
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [formatEur(v), n]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <CategoryBars data={monthCatData} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Top 5 dépenses */}
                {topExpenses.length > 0 && (
                  <div>
                    <div style={ST}>Top 5 dépenses du mois</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {topExpenses.map((tx, i) => (
                        <div key={tx.id} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 10, padding: "10px 14px",
                          borderLeft: `3px solid ${tx.category_color ?? "var(--red)"}`,
                        }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: "50%", background: "var(--surface2)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0,
                          }}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {tx.category_icon && <span style={{ marginRight: 5 }}>{tx.category_icon}</span>}
                              {tx.description}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                              {tx.category_name ?? "Sans catégorie"} · {formatDate(tx.date)}
                            </div>
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--red)", flexShrink: 0 }}>
                            {formatEur(tx.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Toutes les transactions du mois */}
                <div>
                  <div style={ST}>Toutes les transactions</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {monthTx.map((tx) => (
                      <div key={tx.id} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
                        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 9,
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: tx.category_color ?? (tx.type === "income" ? "var(--green)" : "var(--red)") }} />
                        <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {tx.category_icon && <span style={{ marginRight: 4 }}>{tx.category_icon}</span>}
                          {tx.description}
                        </div>
                        <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>{formatDate(tx.date)}</span>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13, flexShrink: 0,
                          color: tx.type === "income" ? "var(--green)" : "var(--red)",
                        }}>
                          {tx.type === "income" ? "+" : "−"}{formatEur(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

const TAB_LABELS: Record<Tab, string> = {
  month: "Mois",
  accounts: "Comptes",
  categories: "Catégories",
  stats: "Statistiques",
};

export default function FinancesPage() {
  useDynamicFavicon("💶");

  const [tab, setTab] = useState<Tab>("month");
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    document.title = "Finances — life×hub";
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as Tab | null;
    if (t && t in TAB_LABELS) setTab(t);
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", `?tab=${tab}`);
  }, [tab]);

  useEffect(() => {
    fetch("/api/finances/categories").then((r) => r.json()).then(setCategories);
  }, []);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ margin: "0 0 24px" }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>
          💶 Finances
        </h1>
        <p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 14 }}>
          Revenus, dépenses, épargne et patrimoine
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1.5px solid var(--border)" }}>
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "9px 18px", border: "none", background: "none", cursor: "pointer",
            fontSize: 14, fontWeight: tab === t ? 700 : 400,
            color: tab === t ? "var(--accent)" : "var(--text-muted)",
            borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -2, fontFamily: "inherit",
            transition: "color 0.15s",
          }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "month" && <MonthTab categories={categories} />}
      {tab === "accounts" && <AccountsTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "stats" && <StatsTab categories={categories} />}
    </main>
  );
}
