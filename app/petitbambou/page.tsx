"use client";

import { useState, useEffect, useCallback } from "react";
import type { PBMetrics } from "@/types";

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

export default function PetitBambouPage() {
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
    <main style={styles.main}>
      <div style={styles.header}>
        <div style={styles.logo}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 28 }}>🎋</span>
          <div>
            <div style={styles.title}>Petit Bambou</div>
            <div style={styles.subtitle}>Sessions de méditation synchronisées depuis l'app Petit Bambou</div>
          </div>
        </div>
      </div>

      <div style={styles.content}>
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
      </div>
    </main>
  );
}

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, textAlign: "center" }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px", gap: 32 },
  header: { width: "100%", maxWidth: 800 },
  logo: { display: "flex", alignItems: "center", gap: 16 },
  title: { fontSize: 24, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" },
  subtitle: { fontSize: 14, color: "var(--text-muted)", marginTop: 4 },
  content: { width: "100%", maxWidth: 800, display: "flex", flexDirection: "column", gap: 24 },
  card: { background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "28px 32px", boxShadow: "var(--shadow-md)", display: "flex", flexDirection: "column", gap: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "var(--text-muted)" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 },
  syncButtons: { display: "flex", gap: 12, flexWrap: "wrap" as const },
  btnPrimary: { padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", cursor: "pointer", transition: "all 0.2s" },
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
