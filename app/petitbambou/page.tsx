"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { PBMetrics } from "@/types";

// ─────────────────────────── Types ────────────────────────────────────────

interface DBStats {
  total_sessions: number;
  total_minutes: number;
  best_streak: number;
  current_streak: number;
}

interface RecentSession {
  id: string;
  lesson: string | null;
  date: string | null;
  duration_min: string | null;
  streak: number | null;
}

interface HistoryRow {
  id: string;
  lesson: string | null;
  date: string | null;
  duration_min: string | null;
  pb_uuid: string | null;
  streak: number | null;
}

interface ByMonth {
  month: string;
  count: number;
  total_minutes: number;
  avg_duration: number;
}

interface ByDow {
  dow: number;
  label: string;
  count: number;
}

interface StreakPoint {
  date: string | null;
  streak: number;
}

interface Analytics {
  byMonth: ByMonth[];
  byDayOfWeek: ByDow[];
  streakHistory: StreakPoint[];
}

type Tab = "apercu" | "historique" | "stats" | "calendrier";

// ─────────────────────────── Helpers ──────────────────────────────────────

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  return `${h}h${m > 0 ? String(m).padStart(2, "0") : ""}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateShort(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

// Format "Jan 24" from "2024-01"
function formatMonthLabel(ym: string) {
  const [year, month] = ym.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  const label = date.toLocaleDateString("fr-FR", { month: "short" });
  const shortYear = String(year).slice(2);
  return `${label.charAt(0).toUpperCase() + label.slice(1).replace(".", "")} ${shortYear}`;
}

// ─────────────────────────── SVG Charts ───────────────────────────────────

const BAR_W = 28;
const BAR_GAP = 10;
const PAD = { top: 32, bottom: 72, left: 48, right: 20 };

function BarChartVertical({
  data,
  valueKey,
  labelKey,
  color,
  unit = "",
}: {
  data: Record<string, unknown>[];
  valueKey: string;
  labelKey: string;
  color: string;
  unit?: string;
}) {
  if (!data.length) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Pas de données</div>;

  const values = data.map((d) => Number(d[valueKey]) || 0);
  const maxVal = Math.max(...values, 1);
  const CHART_H = 260;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const svgW = Math.max(640, data.length * (BAR_W + BAR_GAP) + PAD.left + PAD.right);
  const totalH = CHART_H;

  // 5 Y gridlines
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxVal));

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${svgW} ${totalH}`} style={{ width: "100%", minWidth: 640, height: totalH }} preserveAspectRatio="xMinYMid meet">
        {/* Y grid + labels */}
        {yTicks.map((v) => {
          const y = PAD.top + innerH - (v / maxVal) * innerH;
          return (
            <g key={v}>
              <line x1={PAD.left} y1={y} x2={svgW - PAD.right} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray={v === 0 ? "none" : "4 3"} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">{v}{unit}</text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const val = Number(d[valueKey]) || 0;
          const barH = Math.max(0, (val / maxVal) * innerH);
          const x = PAD.left + i * (BAR_W + BAR_GAP);
          const y = PAD.top + innerH - barH;
          const label = String(d[labelKey] ?? "");

          return (
            <g key={i}>
              {/* Bar */}
              <rect x={x} y={y} width={BAR_W} height={barH} rx={4} fill={color} opacity={0.85} />
              {/* Value above bar */}
              {val > 0 && (
                <text x={x + BAR_W / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight="600" fill={color}>
                  {val}{unit}
                </text>
              )}
              {/* Rotated X label */}
              <text
                x={x + BAR_W / 2}
                y={PAD.top + innerH + 10}
                textAnchor="end"
                fontSize={11}
                fill="var(--text-muted)"
                transform={`rotate(-45, ${x + BAR_W / 2}, ${PAD.top + innerH + 10})`}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BarChartHorizontal({ data, color }: { data: ByDow[]; color: string }) {
  if (!data.length) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Pas de données</div>;

  const maxVal = Math.max(...data.map((d) => d.count), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 0" }}>
      {data.map((d) => (
        <div key={d.dow} style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, fontSize: 13, fontWeight: 600, color: "var(--text)", textAlign: "right", flexShrink: 0 }}>
            {d.label}
          </div>
          <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 6, height: 28, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${(d.count / maxVal) * 100}%`,
                background: color,
                borderRadius: 6,
                opacity: 0.85,
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <div style={{ width: 36, fontSize: 14, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)", textAlign: "right", flexShrink: 0 }}>
            {d.count}
          </div>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data, color }: { data: StreakPoint[]; color: string }) {
  if (!data.length) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Pas de données</div>;

  const values = data.map((d) => d.streak);
  const maxVal = Math.max(...values, 1);
  const pad = { top: 24, bottom: 40, left: 48, right: 20 };
  const svgW = 900;
  const svgH = 300;
  const chartW = svgW - pad.left - pad.right;
  const chartH = svgH - pad.top - pad.bottom;

  const pts = data.map((d, i) => {
    const x = pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = pad.top + chartH - (d.streak / maxVal) * chartH;
    return { x, y, d };
  });

  const polylineStr = pts.map((p) => `${p.x},${p.y}`).join(" ");

  // Area fill path
  const areaPath = [
    `M ${pts[0].x},${pad.top + chartH}`,
    ...pts.map((p) => `L ${p.x},${p.y}`),
    `L ${pts[pts.length - 1].x},${pad.top + chartH}`,
    "Z",
  ].join(" ");

  // Y axis ticks: 5 levels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxVal));

  // X axis: pick ~8 evenly spaced labels
  const xStep = Math.max(1, Math.floor(data.length / 8));
  const xLabels = pts.filter((_, i) => i % xStep === 0 || i === pts.length - 1);

  const fillId = "lineAreaFill";

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", minWidth: 600, height: svgH }} preserveAspectRatio="xMinYMid meet">
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y grid + labels */}
        {yTicks.map((v) => {
          const y = pad.top + chartH - (v / maxVal) * chartH;
          return (
            <g key={v}>
              <line x1={pad.left} y1={y} x2={pad.left + chartW} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray={v === 0 ? "none" : "4 3"} />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">{v}</text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${fillId})`} />

        {/* Line */}
        <polyline points={polylineStr} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* X labels */}
        {xLabels.map(({ x, d }, i) => (
          <text key={i} x={x} y={svgH - 8} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
            {d.date ? d.date.slice(0, 7) : ""}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─────────────────────────── Sub-components ───────────────────────────────

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, textAlign: "center" }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    </div>
  );
}

// ─────────────────────────── Apercu Tab ───────────────────────────────────

function TabApercu() {
  const [pbMetrics, setPbMetrics] = useState<PBMetrics | null>(null);
  const [dbStats, setDbStats] = useState<DBStats | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ pushed: number; errors: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<{ removed: number } | null>(null);
  const [cleanError, setCleanError] = useState<string | null>(null);

  const [recomputing, setRecomputing] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<{ updated: number } | null>(null);
  const [recomputeError, setRecomputeError] = useState<string | null>(null);

  const loadStats = useCallback(() => {
    setLoadingStats(true);
    setStatsError(null);
    fetch("/api/petitbambou/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setStatsError(data.error);
        } else {
          setPbMetrics(data.metrics);
          setDbStats(data.dbStats);
          setRecentSessions(data.recentSessions ?? []);
        }
        setLoadingStats(false);
      })
      .catch(() => {
        setStatsError("Impossible de contacter l'API.");
        setLoadingStats(false);
      });
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function sync(mode: "recent" | "all" | "today" | "week") {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/petitbambou/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) setSyncError(data.error ?? "Erreur de synchronisation.");
      else { setSyncResult(data); loadStats(); }
    } catch {
      setSyncError("Erreur réseau.");
    }
    setSyncing(false);
  }

  async function handleSyncAll() {
    if (!confirm("Synchroniser tout l'historique depuis 2021 ? Cela peut prendre une à deux minutes.")) return;
    await sync("all");
  }

  async function handleCleanup() {
    if (!confirm("Supprimer définitivement les doublons ? Cette action est irréversible.")) return;
    setCleaning(true);
    setCleanResult(null);
    setCleanError(null);
    try {
      const res = await fetch("/api/petitbambou/cleanup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setCleanError(data.error ?? "Erreur");
      else setCleanResult(data);
    } catch {
      setCleanError("Erreur réseau.");
    }
    setCleaning(false);
  }

  async function handleRecomputeStreaks() {
    setRecomputing(true);
    setRecomputeResult(null);
    setRecomputeError(null);
    try {
      const res = await fetch("/api/petitbambou/recompute-streaks", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setRecomputeError(data.error ?? "Erreur");
      else { setRecomputeResult(data); loadStats(); }
    } catch {
      setRecomputeError("Erreur réseau.");
    }
    setRecomputing(false);
  }

  return (
    <>
      {/* Stats from Petit Bambou API */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Statistiques Petit Bambou (live)</div>
        {loadingStats ? (
          <div style={styles.muted}>Chargement...</div>
        ) : statsError ? (
          <div style={styles.error}>{statsError}</div>
        ) : pbMetrics ? (
          <div style={styles.statsGrid}>
            <StatCard icon="🧘" value={String(pbMetrics.nb_lessons)} label="Total séances" />
            <StatCard icon="⏱️" value={formatMinutes(Math.round(pbMetrics.meditation_time / 60))} label="Temps total" />
            <StatCard icon="🔥" value={String(pbMetrics.actual_serie)} label="Streak actuel" />
            <StatCard icon="🏆" value={String(pbMetrics.best_serie)} label="Meilleur streak" />
          </div>
        ) : null}
      </div>

      {/* Stats from local DB */}
      {dbStats && (Number(dbStats.total_sessions) > 0) && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Base locale PostgreSQL</div>
          <div style={styles.statsGrid}>
            <StatCard icon="🧘" value={String(dbStats.total_sessions)} label="Sessions sync" />
            <StatCard icon="⏱️" value={formatMinutes(Number(dbStats.total_minutes))} label="Temps total" />
            <StatCard icon="🔥" value={String(dbStats.current_streak)} label="Streak actuel" />
            <StatCard icon="🏆" value={String(dbStats.best_streak)} label="Meilleur streak" />
          </div>
        </div>
      )}

      {/* Sync */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Synchronisation</div>
        <div style={styles.syncButtons}>
          <button className="btn-primary" style={{ ...styles.btnPrimary, opacity: syncing ? 0.5 : 1 }}
            onClick={() => sync("today")} disabled={syncing}>
            {syncing ? "Sync..." : "Sync aujourd'hui"}
          </button>
          <button className="btn-primary" style={{ ...styles.btnPrimary, opacity: syncing ? 0.5 : 1 }}
            onClick={() => sync("week")} disabled={syncing}>
            {syncing ? "Sync..." : "Sync cette semaine"}
          </button>
          <button className="btn-primary" style={{ ...styles.btnPrimary, opacity: syncing ? 0.5 : 1 }}
            onClick={() => sync("recent")} disabled={syncing}>
            {syncing ? "Sync..." : "Sync 3 derniers mois"}
          </button>
          <button style={{ ...styles.btnSecondary, opacity: syncing ? 0.5 : 1 }}
            onClick={handleSyncAll} disabled={syncing}>
            {syncing ? "En cours..." : "Sync tout l'historique"}
          </button>
        </div>

        {syncResult && (
          <div style={styles.syncSuccess}>
            ✓ {syncResult.pushed} session{syncResult.pushed !== 1 ? "s" : ""} ajoutée{syncResult.pushed !== 1 ? "s" : ""}
            {syncResult.errors > 0 && `, ${syncResult.errors} erreur${syncResult.errors !== 1 ? "s" : ""}`}
          </div>
        )}
        {syncError && <div style={styles.error}>{syncError}</div>}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "flex", flexDirection: "column" as const, gap: 8 }}>
          <div style={styles.labelSmall}>Maintenance</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
            <button style={{ ...styles.btnSecondary, opacity: cleaning ? 0.5 : 1 }}
              onClick={handleCleanup} disabled={cleaning}>
              {cleaning ? "Nettoyage..." : "🧹 Nettoyer les doublons"}
            </button>
            {cleanResult && <span style={styles.syncSuccess}>✓ {cleanResult.removed} doublon{cleanResult.removed !== 1 ? "s" : ""} supprimé{cleanResult.removed !== 1 ? "s" : ""}</span>}
            {cleanError && <span style={styles.error}>{cleanError}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
            <button style={{ ...styles.btnSecondary, opacity: recomputing ? 0.5 : 1 }}
              onClick={handleRecomputeStreaks} disabled={recomputing}>
              {recomputing ? "Calcul en cours..." : "🔄 Recalculer les streaks"}
            </button>
            {recomputeResult && <span style={styles.syncSuccess}>✓ {recomputeResult.updated} session{recomputeResult.updated !== 1 ? "s" : ""} mise{recomputeResult.updated !== 1 ? "s" : ""} à jour</span>}
            {recomputeError && <span style={styles.error}>{recomputeError}</span>}
          </div>
        </div>
      </div>

      {/* Recent sessions */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Dernières sessions (base locale)</div>
        {loadingStats ? (
          <div style={styles.muted}>Chargement...</div>
        ) : recentSessions.length === 0 ? (
          <div style={styles.muted}>Aucune session synchronisée. Lance une sync pour commencer.</div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Leçon</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Durée</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Streak</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s) => (
                  <tr key={s.id} style={styles.tr}>
                    <td style={styles.td}>{formatDate(s.date)}</td>
                    <td style={styles.td}>{s.lesson ?? "—"}</td>
                    <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {s.duration_min ? formatMinutes(Number(s.duration_min)) : "—"}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--accent2)" }}>
                      {s.streak ? `🔥 ${s.streak}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────── Historique Tab ───────────────────────────────

function TabHistorique() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/petitbambou/history")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRows(data);
        else setError(data.error ?? "Erreur");
        setLoading(false);
      })
      .catch(() => {
        setError("Erreur réseau.");
        setLoading(false);
      });
  }, []);

  const filtered = rows.filter((r) =>
    !filter || (r.lesson ?? "").toLowerCase().includes(filter.toLowerCase())
  );

  const totalMinutes = filtered.reduce((acc, r) => acc + (r.duration_min ? Number(r.duration_min) : 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div style={styles.card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 12 }}>
        <div style={styles.sectionTitle}>Historique complet</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!loading && !error && (
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {filtered.length} session{filtered.length !== 1 ? "s" : ""} · {totalHours}h
            </span>
          )}
          <input
            type="text"
            placeholder="Filtrer par leçon..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1.5px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: 13,
              fontFamily: "var(--font-sans)",
              outline: "none",
              width: 200,
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={styles.muted}>Chargement...</div>
      ) : error ? (
        <div style={styles.error}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={styles.muted}>Aucune session trouvée.</div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Leçon</th>
                <th style={styles.th}>PB_UUID</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Durée</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Streak</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} style={styles.tr}>
                  <td style={{ ...styles.td, whiteSpace: "nowrap" as const }}>{formatDateShort(s.date)}</td>
                  <td style={styles.td}>{s.lesson ?? "—"}</td>
                  <td style={{ ...styles.td, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                    {s.pb_uuid ? s.pb_uuid.slice(0, 12) + "…" : "—"}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                    {s.duration_min ? formatMinutes(Number(s.duration_min)) : "—"}
                  </td>
                  <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--accent2)" }}>
                    {s.streak ? `🔥 ${s.streak}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Stats Tab ────────────────────────────────────

function TabStats() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/petitbambou/analytics")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setAnalytics(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Erreur réseau.");
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ ...styles.card, ...styles.muted }}>Chargement des statistiques...</div>;
  if (error) return <div style={{ ...styles.card, ...styles.error }}>{error}</div>;
  if (!analytics) return null;

  const byMonthWithLabel = analytics.byMonth.map((d) => ({
    ...d,
    monthLabel: formatMonthLabel(d.month),
  }));

  return (
    <>
      {/* A) Sessions par mois */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Sessions par mois</div>
        <BarChartVertical
          data={byMonthWithLabel}
          valueKey="count"
          labelKey="monthLabel"
          color="var(--accent)"
        />
      </div>

      {/* B) Durée totale par mois */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Durée totale par mois (min)</div>
        <BarChartVertical
          data={byMonthWithLabel}
          valueKey="total_minutes"
          labelKey="monthLabel"
          color="var(--accent2)"
          unit="min"
        />
      </div>

      {/* C) Sessions par jour de la semaine */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Sessions par jour de la semaine</div>
        <BarChartHorizontal data={analytics.byDayOfWeek} color="var(--accent)" />
      </div>

      {/* D) Évolution du streak */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>Évolution du streak</div>
        <LineChart data={analytics.streakHistory} color="var(--accent2)" />
      </div>
    </>
  );
}

// ─────────────────────────── Calendrier Tab ───────────────────────────────

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function TabCalendrier() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    fetch("/api/petitbambou/history")
      .then((r) => r.json())
      .then((data) => { setRows(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Group sessions by local YYYY-MM-DD
  const byDate = useMemo(() => {
    const map = new Map<string, HistoryRow[]>();
    for (const r of rows) {
      if (!r.date) continue;
      const key = localKey(new Date(r.date));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [rows]);

  const { year, month } = currentDate;
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Monday-first: (getDay() + 6) % 7 → 0=Mon … 6=Sun
  const startPad = (firstOfMonth.getDay() + 6) % 7;

  // Build flat array of cells: null = padding, Date = real day
  const cells: (Date | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  // Pad end to full rows of 7
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = localKey(new Date());

  const prevMonth = () =>
    setCurrentDate(({ year: y, month: m }) =>
      m === 0 ? { year: y - 1, month: 11 } : { year: y, month: m - 1 }
    );
  const nextMonth = () =>
    setCurrentDate(({ year: y, month: m }) =>
      m === 11 ? { year: y + 1, month: 0 } : { year: y, month: m + 1 }
    );

  const monthLabel = firstOfMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  // Stats for this month
  const monthSessions = rows.filter((r) => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const monthMinutes = monthSessions.reduce((s, r) => s + (r.duration_min ? Number(r.duration_min) : 0), 0);
  const activeDays = new Set(monthSessions.map((r) => localKey(new Date(r.date!)))).size;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Month nav + summary */}
      <div style={{ ...calStyles.card, padding: "20px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={prevMonth} style={calStyles.navBtn}>‹</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", textTransform: "capitalize" }}>
              {monthLabel}
            </div>
            {!loading && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                {activeDays} jour{activeDays !== 1 ? "s" : ""} · {monthSessions.length} séance{monthSessions.length !== 1 ? "s" : ""} · {formatMinutes(monthMinutes)}
              </div>
            )}
          </div>
          <button onClick={nextMonth} style={calStyles.navBtn}>›</button>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={calStyles.card}>
        {loading ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Chargement...</div>
        ) : (
          <>
            {/* Day-of-week header */}
            <div style={calStyles.dowRow}>
              {DOW.map((d) => (
                <div key={d} style={calStyles.dowCell}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div style={calStyles.grid}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} style={calStyles.emptyCell} />;
                const key = localKey(day);
                const sessions = byDate.get(key) ?? [];
                const isToday = key === todayKey;
                const hasMed = sessions.length > 0;

                return (
                  <div
                    key={i}
                    style={{
                      ...calStyles.dayCell,
                      background: hasMed ? "rgba(59,126,248,0.07)" : "var(--bg)",
                      border: isToday
                        ? "2px solid var(--accent)"
                        : "1px solid var(--border)",
                    }}
                  >
                    {/* Day number */}
                    <div style={{
                      fontSize: 13,
                      fontWeight: isToday ? 700 : 400,
                      color: isToday ? "var(--accent)" : hasMed ? "var(--text)" : "var(--text-muted)",
                      marginBottom: sessions.length ? 6 : 0,
                      lineHeight: 1,
                    }}>
                      {day.getDate()}
                    </div>

                    {/* Session pills */}
                    {sessions.map((s, si) => (
                      <div key={si} style={calStyles.pill}>
                        <span style={calStyles.pillDuration}>
                          {s.duration_min ? `${Math.round(Number(s.duration_min))}min` : ""}
                        </span>
                        <span style={calStyles.pillLesson}>
                          {s.lesson ?? "Méditation"}
                        </span>
                        {s.streak && s.streak > 1 && (
                          <span style={calStyles.pillStreak}>🔥{s.streak}</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={calStyles.legend}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(59,126,248,0.07)", border: "1px solid var(--border)" }} />
                <span>Jour avec séance</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, border: "2px solid var(--accent)" }} />
                <span>Aujourd'hui</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>🔥N</span>
                <span>Streak du jour</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const calStyles: Record<string, React.CSSProperties> = {
  card: {
    background: "var(--surface)", border: "1.5px solid var(--border)",
    borderRadius: 16, padding: "28px 32px", boxShadow: "var(--shadow-md)",
    display: "flex", flexDirection: "column", gap: 16,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: "50%",
    background: "var(--surface2)", border: "1.5px solid var(--border)",
    fontSize: 22, color: "var(--text)", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    lineHeight: 1,
  },
  dowRow: {
    display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4,
    marginBottom: 4,
  },
  dowCell: {
    textAlign: "center", fontSize: 11, fontWeight: 600,
    color: "var(--text-muted)", letterSpacing: "0.08em",
    textTransform: "uppercase", padding: "6px 0",
  },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4,
  },
  emptyCell: {
    minHeight: 90, borderRadius: 10,
  },
  dayCell: {
    minHeight: 90, borderRadius: 10, padding: "10px 8px",
    display: "flex", flexDirection: "column", gap: 3,
    overflow: "hidden",
  },
  pill: {
    background: "var(--accent)", borderRadius: 5, padding: "3px 6px",
    display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center",
  },
  pillDuration: {
    fontSize: 10, fontWeight: 700, color: "#fff",
    fontFamily: "var(--font-mono)", flexShrink: 0,
  },
  pillLesson: {
    fontSize: 10, color: "rgba(255,255,255,0.85)",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    maxWidth: 100,
  },
  pillStreak: {
    fontSize: 9, color: "rgba(255,255,255,0.9)", flexShrink: 0,
  },
  legend: {
    display: "flex", gap: 20, fontSize: 12,
    color: "var(--text-muted)", paddingTop: 8,
    borderTop: "1px solid var(--border)",
  },
};

// ─────────────────────────── Main Page ────────────────────────────────────

export default function PetitBambouPage() {
  const [tab, setTab] = useState<Tab>("apercu");

  const TABS: { key: Tab; label: string }[] = [
    { key: "apercu", label: "Aperçu" },
    { key: "historique", label: "Historique" },
    { key: "calendrier", label: "Calendrier" },
    { key: "stats", label: "Statistiques" },
  ];

  return (
    <main style={styles.main}>
      <div style={styles.header}>
        <div style={styles.logo}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 28 }}>🎋</span>
          <div>
            <div style={styles.title}>Petit Bambou</div>
            <div style={styles.subtitle}>Sessions de méditation synchronisées depuis l'app Petit Bambou</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabsBar}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...styles.tab,
                ...(tab === t.key
                  ? { background: "var(--accent)", color: "#fff" }
                  : {}),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.content}>
        {tab === "apercu" && <TabApercu />}
        {tab === "historique" && <TabHistorique />}
        {tab === "calendrier" && <TabCalendrier />}
        {tab === "stats" && <TabStats />}
      </div>
    </main>
  );
}

// ─────────────────────────── Styles ───────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  main: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px", gap: 32 },
  header: { width: "100%", maxWidth: 1100, display: "flex", flexDirection: "column", gap: 24 },
  logo: { display: "flex", alignItems: "center", gap: 16 },
  title: { fontSize: 24, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" },
  subtitle: { fontSize: 14, color: "var(--text-muted)", marginTop: 4 },
  tabsBar: { display: "flex", gap: 8, background: "var(--surface)", padding: 4, borderRadius: 50, border: "1px solid var(--border)", alignSelf: "flex-start" },
  tab: { padding: "8px 24px", borderRadius: 50, fontSize: 13, fontWeight: 500, background: "transparent", color: "var(--text-muted)", transition: "all 0.2s", letterSpacing: "0.04em", cursor: "pointer", border: "none" },
  content: { width: "100%", maxWidth: 1100, display: "flex", flexDirection: "column", gap: 24 },
  card: { background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "28px 32px", boxShadow: "var(--shadow-md)", display: "flex", flexDirection: "column", gap: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--text-muted)" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 },
  syncButtons: { display: "flex", gap: 12, flexWrap: "wrap" as const },
  btnPrimary: { padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", cursor: "pointer", transition: "all 0.2s", border: "none" },
  btnSecondary: { padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text)", cursor: "pointer", transition: "all 0.2s" },
  syncSuccess: { fontSize: 13, color: "var(--green)", fontWeight: 500 },
  error: { fontSize: 13, color: "var(--red)" },
  labelSmall: { fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em" },
  muted: { fontSize: 13, color: "var(--text-muted)" },
  tableWrapper: { overflowX: "auto" as const },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "8px 12px", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" },
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "10px 12px", color: "var(--text)", verticalAlign: "top" as const },
};
