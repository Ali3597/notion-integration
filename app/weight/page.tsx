"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

type WeightEntry = {
  id: string;
  measured_at: string;
  weight: string;
  source: string;
  created_at: string;
};

type WeightStats = {
  last: { weight: number; measured_at: string; id: string } | null;
  total: number;
  stats: {
    all: { min: number; max: number; avg: number; count: number } | null;
    "30d": { min: number; max: number; avg: number; count: number } | null;
    "90d": { min: number; max: number; avg: number; count: number } | null;
    variation_total: number | null;
    variation_7d: number | null;
    slope_30d: number;
  } | null;
  history: { date: string; weight: number }[];
  periods: { "30d": string; "90d": string; "6m": string };
};

type Period = "30d" | "90d" | "6m" | "all";
type Tab = "apercu" | "historique" | "raccourci";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) +
    " à " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function filterByPeriod(
  points: { date: string; weight: number }[],
  period: Period,
  periods: WeightStats["periods"],
): { date: string; weight: number }[] {
  if (period === "all") return points;
  const cutoff = periods[period as keyof typeof periods];
  if (!cutoff) return points;
  return points.filter((p) => p.date.slice(0, 10) >= cutoff);
}

function linearTrendPoints(
  points: { date: string; weight: number }[],
): { date: string; weight: number | null }[] {
  if (points.length < 2) return points.map((p) => ({ ...p, weight: null }));
  const n = points.length;
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.weight);
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sxx = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return points.map((p) => ({ ...p, weight: null }));
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return points.map((p, i) => ({
    date: p.date,
    weight: parseFloat((slope * i + intercept).toFixed(3)),
  }));
}

function getTrend(slope: number): { label: string; color: string; icon: string } {
  if (slope < -0.02) return { label: "En baisse", color: "var(--green)", icon: "↓" };
  if (slope > 0.02) return { label: "En hausse", color: "var(--red)", icon: "↑" };
  return { label: "Stable", color: "var(--text-muted)", icon: "→" };
}

function buildWeeklyDistribution(history: { date: string; weight: number }[]) {
  const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const { date, weight } of history) {
    const dow = new Date(date).getDay(); // 0=Sun
    const idx = dow === 0 ? 6 : dow - 1; // 0=Mon
    sums[idx] += weight;
    counts[idx]++;
  }
  return DAYS.map((name, i) => ({
    name,
    avg: counts[i] > 0 ? Math.round((sums[i] / counts[i]) * 100) / 100 : null,
    count: counts[i],
  }));
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ h = 20 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 8,
      background: "var(--surface2)",
      animation: "skeletonPulse 1.4s ease-in-out infinite",
    }} />
  );
}

// ── Period Toggle ─────────────────────────────────────────────────────────────

function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const opts: { label: string; value: Period }[] = [
    { label: "30j", value: "30d" },
    { label: "90j", value: "90d" },
    { label: "6 mois", value: "6m" },
    { label: "Tout", value: "all" },
  ];
  return (
    <div style={{ display: "flex", gap: 4, background: "var(--surface2)", borderRadius: 8, padding: 3 }}>
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: "4px 10px", borderRadius: 6, border: "none",
            background: value === o.value ? "var(--surface)" : "transparent",
            color: value === o.value ? "var(--text)" : "var(--text-muted)",
            fontWeight: value === o.value ? 600 : 400,
            fontSize: 12, cursor: "pointer", fontFamily: "var(--font-sans)",
            boxShadow: value === o.value ? "var(--shadow-sm)" : "none",
            transition: "all 0.15s",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Weight Chart ──────────────────────────────────────────────────────────────

function WeightChart({ data }: { data: { date: string; weight: number }[] }) {
  if (data.length === 0) return (
    <div style={{
      background: "var(--surface)", border: "1.5px solid var(--border)",
      borderRadius: 12, padding: 32, textAlign: "center",
      color: "var(--text-muted)", fontSize: 13,
    }}>
      Aucune donnée disponible pour cette période
    </div>
  );

  const trendPts = linearTrendPoints(data);
  const combined = data.map((d, i) => ({ ...d, trend: trendPts[i]?.weight ?? null }));

  const vals = data.map((d) => d.weight);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const padding = Math.max((maxVal - minVal) * 0.2, 0.5);

  return (
    <div style={{
      background: "var(--surface)", border: "1.5px solid var(--border)",
      borderRadius: 12, padding: "20px 20px 16px", boxShadow: "var(--shadow-sm)",
    }}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={combined} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => fmtDateShort(d)}
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minVal - padding, maxVal + padding]}
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickLine={false}
            tickFormatter={(v) => `${Number(v).toFixed(1)}`}
          />
          <Tooltip
            formatter={(v: number, name: string) => [
              `${Number(v).toFixed(2)} kg`,
              name === "trend" ? "Tendance" : "Poids",
            ]}
            labelFormatter={(l) => fmtDate(l)}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }}
          />
          <Line
            type="monotone" dataKey="weight" stroke="var(--accent)"
            strokeWidth={2.5} dot={false} name="weight"
          />
          <Line
            type="monotone" dataKey="trend" stroke="var(--accent2)"
            strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="trend"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 16, height: 2, background: "var(--accent)", display: "inline-block" }} /> Poids
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 16, height: 2, background: "var(--accent2)", display: "inline-block" }} /> Tendance
        </span>
      </div>
    </div>
  );
}

// ── Weekly Distribution Chart ─────────────────────────────────────────────────

function WeeklyChart({ history }: { history: { date: string; weight: number }[] }) {
  const data = buildWeeklyDistribution(history);
  const withData = data.filter((d) => d.avg !== null);
  if (withData.length < 2) return null;

  const vals = withData.map((d) => d.avg!);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const padding = Math.max((maxVal - minVal) * 0.5, 0.3);

  return (
    <div style={{
      background: "var(--surface)", border: "1.5px solid var(--border)",
      borderRadius: 12, padding: "20px 20px 16px", boxShadow: "var(--shadow-sm)",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14,
      }}>
        Poids moyen par jour de la semaine
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            domain={[minVal - padding, maxVal + padding]}
            tick={{ fontSize: 9, fill: "var(--text-muted)" }}
            tickLine={false}
            tickFormatter={(v) => `${Number(v).toFixed(1)}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            width={32}
          />
          <Tooltip
            formatter={(v: number, _: string, props: { payload?: { count: number } }) => [
              `${Number(v).toFixed(2)} kg (${props.payload?.count ?? 0} mesures)`,
              "Moyenne",
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }}
          />
          <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
            {data.map((entry, idx) => (
              <Cell
                key={idx}
                fill={entry.avg !== null ? "var(--accent)" : "var(--surface2)"}
                fillOpacity={entry.avg !== null ? 0.75 : 0.2}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── History Table ─────────────────────────────────────────────────────────────

function HistoryTable({
  entries,
  onDelete,
}: {
  entries: WeightEntry[];
  onDelete: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const displayed = showAll ? entries : entries.slice(0, 20);

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette mesure ?")) return;
    setDeleting(id);
    await fetch(`/api/weight/entries?id=${id}`, { method: "DELETE" });
    setDeleting(null);
    onDelete(id);
  }

  return (
    <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--surface2)" }}>
              {["Date", "Heure", "Poids", "Variation"].map((h) => (
                <th key={h} style={{
                  padding: "10px 14px", textAlign: "left", fontWeight: 600,
                  color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase",
                  letterSpacing: "0.06em", borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
              <th style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", width: 36 }} />
            </tr>
          </thead>
          <tbody>
            {displayed.map((entry, i) => {
              const prev = entries[i + 1];
              const diff = prev
                ? parseFloat(entry.weight) - parseFloat(prev.weight)
                : null;
              const d = new Date(entry.measured_at);
              return (
                <tr
                  key={entry.id}
                  style={{ borderBottom: i < displayed.length - 1 ? "1px solid var(--border)" : "none" }}
                >
                  <td style={{ padding: "9px 14px", color: "var(--text)", whiteSpace: "nowrap" }}>
                    {d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td style={{ padding: "9px 14px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "9px 14px", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text)" }}>
                    {parseFloat(entry.weight).toFixed(1)} kg
                  </td>
                  <td style={{ padding: "9px 14px", fontFamily: "var(--font-mono)" }}>
                    {diff !== null ? (
                      <span style={{
                        color: diff < 0 ? "var(--green)" : diff > 0 ? "var(--red)" : "var(--text-muted)",
                        fontWeight: 500,
                      }}>
                        {diff > 0 ? "▲" : diff < 0 ? "▼" : "="} {Math.abs(diff).toFixed(2)} kg
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right" }}>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deleting === entry.id}
                      title="Supprimer"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--text-muted)", fontSize: 14,
                        opacity: deleting === entry.id ? 0.4 : 1, padding: 2,
                      }}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {entries.length > 20 && (
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => setShowAll((s) => !s)}
            style={{
              background: "none", border: "none", color: "var(--accent)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)",
            }}
          >
            {showAll ? "Voir moins ↑" : `Voir tout (${entries.length} mesures) ↓`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shortcut Config ───────────────────────────────────────────────────────────

function ShortcutConfig({
  lastMeasuredAt,
  total,
}: {
  lastMeasuredAt: string | null;
  total: number;
}) {
  const [copied, setCopied] = useState(false);
  const baseUrl = process.env.NEXT_PUBLIC_APP_LOCAL_URL ?? "http://MacBook-Pro-de-Ali.local:3000";
  const url = `${baseUrl}/api/weight/apple-health`;

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{
      background: "rgba(59,126,248,0.04)",
      border: "1.5px solid rgba(59,126,248,0.2)",
      borderRadius: 12,
      padding: "24px 26px",
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
        Configuration du Raccourci iOS
      </h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 20px", lineHeight: 1.6 }}>
        Un Raccourci Apple Santé envoie automatiquement ton poids à cette app dès que tu fermes Renpho Health.
      </p>

      {/* Stats */}
      <div style={{ display: "flex", gap: 24, marginBottom: 20, fontSize: 12, flexWrap: "wrap" }}>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Dernière réception : </span>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>
            {lastMeasuredAt ? fmtDateTime(lastMeasuredAt) : "—"}
          </span>
        </div>
        <div>
          <span style={{ color: "var(--text-muted)" }}>Mesures en base : </span>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>{total}</span>
        </div>
      </div>

      {/* URL */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
          textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
        }}>
          URL à utiliser dans le Raccourci
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <code style={{
            flex: 1, padding: "10px 14px",
            background: "var(--surface)", border: "1.5px solid var(--border)",
            borderRadius: 9, fontSize: 13, fontFamily: "var(--font-mono)",
            color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap", display: "flex", alignItems: "center",
          }}>
            {url}
          </code>
          <button
            onClick={handleCopy}
            style={{
              padding: "10px 18px", borderRadius: 9,
              border: "1.5px solid var(--border)",
              background: copied ? "var(--green)" : "var(--surface)",
              color: copied ? "white" : "var(--text)",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: "var(--font-sans)", transition: "all 0.15s", flexShrink: 0,
            }}
          >
            {copied ? "✓ Copié" : "Copier"}
          </button>
        </div>
      </div>

      {/* Guide */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "18px 20px",
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>
          Guide — Créer le Raccourci
        </div>
        <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          <li style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Ouvrir l&apos;app <strong>Raccourcis</strong> sur iPhone
          </li>
          <li style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Créer un nouveau raccourci
          </li>
          <li style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Ajouter <strong>« URL »</strong> → coller l&apos;URL ci-dessus
          </li>
          <li style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Ajouter <strong>« Obtenir le contenu de l&apos;URL »</strong> (GET) → si pas de valeur → afficher notification{" "}
            <em>« ⚠️ life×hub n&apos;est pas lancé »</em> → arrêter
          </li>
          <li style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Ajouter <strong>« Rechercher des échantillons de santé »</strong> → Type :{" "}
            <strong>Poids corporel</strong> → Trier par date → Limite 1
          </li>
          <li style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Ajouter <strong>« Obtenir le contenu de l&apos;URL »</strong> (POST) → URL : la même → Méthode POST → Corps JSON :{" "}
            <code style={{ fontSize: 11, background: "var(--surface2)", padding: "2px 5px", borderRadius: 4 }}>
              {`{ "measured_at": "[date de la mesure]", "weight": "[valeur en kg]" }`}
            </code>
          </li>
          <li style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Dans <strong>Automatisation</strong> → Application → <strong>Renpho Health</strong> → Est fermée → exécuter ce raccourci
          </li>
        </ol>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WeightPage() {
  useDynamicFavicon("⚖️");

  const [statsData, setStatsData] = useState<WeightStats | null>(null);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("90d");
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tab");
      return (p as Tab) ?? "apercu";
    }
    return "apercu";
  });

  useEffect(() => {
    document.title = "Poids — life×hub";
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [statsRes, entriesRes] = await Promise.all([
      fetch("/api/weight/stats").then((r) => r.json()),
      fetch("/api/weight/entries").then((r) => r.json()),
    ]);
    setStatsData(statsRes.error ? null : statsRes);
    setEntries(Array.isArray(entriesRes) ? entriesRes : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    window.history.replaceState(null, "", `?tab=${tab}`);
  }

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setStatsData((prev) => prev ? { ...prev, total: prev.total - 1 } : prev);
  }

  const s = statsData?.stats;
  const last = statsData?.last;
  const periods = statsData?.periods ?? { "30d": "", "90d": "", "6m": "" };
  const filteredHistory = statsData ? filterByPeriod(statsData.history, period, periods) : [];
  const trend = s ? getTrend(s.slope_30d) : null;

  // Compute 30d variation from entries (oldest entry within last 30 days)
  const var30d = (() => {
    if (!last || entries.length < 2 || !periods["30d"]) return null;
    const cutoff = periods["30d"] + "T00:00:00";
    const oldest30 = [...entries].reverse().find((e) => e.measured_at >= cutoff);
    if (!oldest30 || oldest30.id === last.id) return null;
    return Math.round((parseFloat(String(last.weight)) - parseFloat(oldest30.weight)) * 10) / 10;
  })();

  const TABS: { id: Tab; label: string }[] = [
    { id: "apercu", label: "Aperçu" },
    { id: "historique", label: "Historique" },
    { id: "raccourci", label: "Raccourci iOS" },
  ];

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 28px" }}>
      <Link href="/" className="btn-back">← Accueil</Link>

      {/* Header */}
      <div style={{ margin: "20px 0 24px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", margin: 0, letterSpacing: "-0.02em" }}>
          ⚖️ Poids
        </h1>
        {last && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Dernière mesure : {fmtDate(last.measured_at)} — {Number(last.weight).toFixed(1)} kg
          </p>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "2px solid var(--border)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              padding: "8px 16px", border: "none", background: "none",
              fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? "var(--accent)" : "var(--text-muted)",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -2, cursor: "pointer", fontFamily: "var(--font-sans)",
              transition: "color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Aperçu ── */}
      {activeTab === "apercu" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* KPI Cards */}
          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={90} />)}
            </div>
          ) : !last ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>⚖️</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>Aucune donnée</p>
              <p style={{ fontSize: 13 }}>
                Configure le Raccourci iOS pour envoyer automatiquement ton poids.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
              {/* Poids actuel */}
              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>⚖️ Poids actuel</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: "var(--text)" }}>
                    {Number(last.weight).toFixed(1)}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>kg</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(last.measured_at)}</div>
              </div>

              {/* Variation 30j */}
              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>📉 Variation 30 jours</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700,
                    color: var30d === null ? "var(--text-muted)" : var30d < 0 ? "var(--green)" : var30d > 0 ? "var(--red)" : "var(--text)",
                  }}>
                    {var30d !== null ? `${var30d > 0 ? "+" : ""}${var30d.toFixed(1)}` : "—"}
                  </span>
                  {var30d !== null && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>kg</span>}
                </div>
                <div style={{ fontSize: 11, color: var30d === null ? "var(--text-muted)" : var30d < 0 ? "var(--green)" : var30d > 0 ? "var(--red)" : "var(--text-muted)" }}>
                  {var30d === null ? "Insuffisant" : var30d < 0 ? "Perte" : var30d > 0 ? "Prise" : "Stable"}
                </div>
              </div>

              {/* Variation totale */}
              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>📊 Variation totale</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700,
                    color: s?.variation_total == null ? "var(--text-muted)" : s.variation_total < 0 ? "var(--green)" : s.variation_total > 0 ? "var(--red)" : "var(--text)",
                  }}>
                    {s?.variation_total != null
                      ? `${s.variation_total > 0 ? "+" : ""}${s.variation_total.toFixed(1)}`
                      : "—"}
                  </span>
                  {s?.variation_total != null && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>kg</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>depuis la 1re mesure</div>
              </div>

              {/* Tendance */}
              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>🎯 Tendance</div>
                {trend ? (
                  <>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: trend.color }}>
                      {trend.icon} {trend.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {s && s.slope_30d !== 0
                        ? `${s.slope_30d > 0 ? "+" : ""}${s.slope_30d.toFixed(3)} kg/j (30j)`
                        : "sur 30 jours"}
                    </div>
                  </>
                ) : (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--text-muted)" }}>—</div>
                )}
              </div>
            </div>
          )}

          {/* Weight chart */}
          {!loading && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>Évolution du poids</h2>
                <PeriodToggle value={period} onChange={setPeriod} />
              </div>
              <WeightChart data={filteredHistory} />
            </div>
          )}

          {/* Weekly distribution */}
          {!loading && statsData && statsData.history.length > 6 && (
            <WeeklyChart history={statsData.history} />
          )}
        </div>
      )}

      {/* ── TAB: Historique ── */}
      {activeTab === "historique" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>
            Historique
            <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)", marginLeft: 8 }}>
              {entries.length} mesures
            </span>
          </h2>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={44} />)}
            </div>
          ) : entries.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune mesure enregistrée.</p>
          ) : (
            <HistoryTable entries={entries} onDelete={handleDelete} />
          )}
        </div>
      )}

      {/* ── TAB: Raccourci iOS ── */}
      {activeTab === "raccourci" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>Raccourci iOS</h2>
          <ShortcutConfig
            lastMeasuredAt={last?.measured_at ?? null}
            total={statsData?.total ?? 0}
          />
        </div>
      )}
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const kpiCardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1.5px solid var(--border)",
  borderRadius: 12,
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  boxShadow: "var(--shadow-sm)",
};

const kpiLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};
