"use client";

import { useState, useEffect, useCallback } from "react";
import type { PBSession, PBMetrics } from "@/types";

function formatDurationSec(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h${m > 0 ? String(m).padStart(2, "0") : ""}`;
}

function formatDate(activityDate: string) {
  const d = new Date(activityDate.replace(" ", "T") + "Z");
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PetitBambouPage() {
  const [metrics, setMetrics] = useState<PBMetrics | null>(null);
  const [recentSessions, setRecentSessions] = useState<PBSession[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    pushed: number;
    errors: number;
    dbCreated?: boolean;
    dbId?: string;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<{ removed: number } | null>(null);
  const [cleanError, setCleanError] = useState<string | null>(null);

  // Premier lancement
  const [dbConfigured, setDbConfigured] = useState(true);
  const [parentPageId, setParentPageId] = useState("");
  const [creatingDb, setCreatingDb] = useState(false);
  const [createdDbId, setCreatedDbId] = useState<string | null>(null);

  const loadStats = useCallback(() => {
    setLoadingStats(true);
    setStatsError(null);
    fetch("/api/petitbambou/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setStatsError(data.error);
        } else {
          setMetrics(data.metrics);
          setRecentSessions(data.recentSessions ?? []);
          setDbConfigured(data.dbConfigured ?? false);
        }
        setLoadingStats(false);
      })
      .catch(() => {
        setStatsError("Impossible de contacter l'API Petit Bambou.");
        setLoadingStats(false);
      });
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function sync(mode: "recent" | "all" | "today" | "week", pPageId?: string) {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/petitbambou/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ...(pPageId ? { parentPageId: pPageId } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error ?? "Erreur de synchronisation.");
      } else {
        setSyncResult(data);
        if (data.dbCreated && data.dbId) {
          setCreatedDbId(data.dbId);
        }
      }
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
    if (!confirm("Supprimer définitivement les doublons de la base Notion ? Cette action est irréversible.")) return;
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

  async function handleCreateDb() {
    if (!parentPageId.trim()) return;
    setCreatingDb(true);
    await sync("recent", parentPageId.trim());
    setCreatingDb(false);
  }

  return (
    <main style={styles.main}>
      {/* Header */}
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
        {/* Stats */}
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Statistiques globales</div>
          {loadingStats ? (
            <div style={styles.muted}>Chargement...</div>
          ) : statsError ? (
            <div style={styles.error}>{statsError}</div>
          ) : metrics ? (
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{metrics.nb_lessons}</div>
                <div style={styles.statLabel}>Total séances</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{formatDurationSec(metrics.meditation_time)}</div>
                <div style={styles.statLabel}>Temps total</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{metrics.actual_serie} 🔥</div>
                <div style={styles.statLabel}>Streak actuel</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{metrics.best_serie} 🏆</div>
                <div style={styles.statLabel}>Meilleur streak</div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Premier lancement — affiché si DB non configurée */}
        {!dbConfigured && (
          <div style={{ ...styles.card, borderColor: "var(--accent)", borderWidth: 2 }}>
            <div style={styles.sectionTitle}>⚙️ Configuration requise — Base Notion</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              La base de données Notion n'est pas encore configurée. Entre l'ID d'une page Notion parente pour la créer automatiquement.
            </p>
            <div style={styles.firstLaunch}>
              <div style={styles.labelSmall}>ID de la page Notion parente</div>
              <input
                type="text"
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={parentPageId}
                onChange={(e) => setParentPageId(e.target.value)}
                style={{ width: "100%" }}
              />
              <button
                className="btn-primary"
                style={{ ...styles.btnPrimary, marginTop: 4, opacity: (!parentPageId.trim() || creatingDb) ? 0.5 : 1 }}
                onClick={handleCreateDb}
                disabled={creatingDb || !parentPageId.trim()}
              >
                {creatingDb ? "Création en cours..." : "Créer la base Méditations"}
              </button>
            </div>
            {createdDbId && (
              <div style={styles.dbIdBox}>
                <div style={styles.labelSmall}>✓ Base créée ! Copie dans <code>.env.local</code> puis redémarre le serveur :</div>
                <code style={styles.dbId}>NOTION_MEDITATIONS_DB={createdDbId}</code>
              </div>
            )}
            {syncError && <div style={styles.error}>{syncError}</div>}
          </div>
        )}

        {/* Sync */}
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Synchronisation Notion</div>
          {!dbConfigured && (
            <div style={styles.muted}>Configure d'abord la base Notion ci-dessus.</div>
          )}
          <div style={styles.syncButtons}>
            <button
              className="btn-primary"
              style={{ ...styles.btnPrimary, opacity: (!dbConfigured || syncing) ? 0.5 : 1 }}
              onClick={() => sync("today")}
              disabled={syncing || !dbConfigured}
            >
              {syncing ? "Sync..." : "Sync aujourd'hui"}
            </button>
            <button
              className="btn-primary"
              style={{ ...styles.btnPrimary, opacity: (!dbConfigured || syncing) ? 0.5 : 1 }}
              onClick={() => sync("week")}
              disabled={syncing || !dbConfigured}
            >
              {syncing ? "Sync..." : "Sync cette semaine"}
            </button>
            <button
              className="btn-primary"
              style={{ ...styles.btnPrimary, opacity: (!dbConfigured || syncing) ? 0.5 : 1 }}
              onClick={() => sync("recent")}
              disabled={syncing || !dbConfigured}
            >
              {syncing ? "Sync..." : "Sync 3 derniers mois"}
            </button>
            <button
              style={{ ...styles.btnSecondary, opacity: (!dbConfigured || syncing) ? 0.5 : 1 }}
              onClick={handleSyncAll}
              disabled={syncing || !dbConfigured}
            >
              {syncing ? "En cours..." : "Sync tout l'historique"}
            </button>
          </div>

          {syncResult && (
            <div style={styles.syncSuccess}>
              ✓ {syncResult.pushed} session{syncResult.pushed !== 1 ? "s" : ""} ajoutée{syncResult.pushed !== 1 ? "s" : ""}
              {syncResult.errors > 0 && `, ${syncResult.errors} erreur${syncResult.errors !== 1 ? "s" : ""}`}
            </div>
          )}
          {dbConfigured && syncError && <div style={styles.error}>{syncError}</div>}

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "flex", flexDirection: "column" as const, gap: 8 }}>
            <div style={styles.labelSmall}>Maintenance</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
              <button
                style={{ ...styles.btnSecondary, opacity: (!dbConfigured || cleaning) ? 0.5 : 1 }}
                onClick={handleCleanup}
                disabled={cleaning || !dbConfigured}
              >
                {cleaning ? "Nettoyage..." : "🧹 Nettoyer les doublons"}
              </button>
              {cleanResult && (
                <span style={styles.syncSuccess}>
                  ✓ {cleanResult.removed} doublon{cleanResult.removed !== 1 ? "s" : ""} supprimé{cleanResult.removed !== 1 ? "s" : ""}
                </span>
              )}
              {cleanError && <span style={styles.error}>{cleanError}</span>}
            </div>
          </div>
        </div>

        {/* Dernières sessions */}
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Dernières sessions</div>
          {loadingStats ? (
            <div style={styles.muted}>Chargement...</div>
          ) : recentSessions.length === 0 ? (
            <div style={styles.muted}>Aucune session récente.</div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Leçon</th>
                    <th style={styles.th}>Programme</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map((s) => (
                    <tr key={s.uuid} style={styles.tr}>
                      <td style={styles.td}>{formatDate(s.activity_date)}</td>
                      <td style={styles.td}>{s.lesson_name}</td>
                      <td style={styles.td}>{s.object_name}</td>
                      <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {formatDurationSec(s.duration)}
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

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "var(--bg)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "48px 24px",
    gap: 32,
  },
  header: {
    width: "100%",
    maxWidth: 800,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "var(--text)",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: 14,
    color: "var(--text-muted)",
    marginTop: 4,
  },
  content: {
    width: "100%",
    maxWidth: 800,
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  card: {
    background: "var(--surface)",
    border: "1.5px solid var(--border)",
    borderRadius: 16,
    padding: "28px 32px",
    boxShadow: "var(--shadow-md)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
  },
  statCard: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "16px",
    textAlign: "center" as const,
  },
  statValue: {
    fontFamily: "var(--font-mono)",
    fontSize: 22,
    fontWeight: 700,
    color: "var(--accent)",
  },
  statLabel: {
    fontSize: 11,
    color: "var(--text-muted)",
    marginTop: 4,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  },
  syncButtons: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap" as const,
  },
  btnPrimary: {
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    background: "var(--accent)",
    color: "#fff",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  btnSecondary: {
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    background: "var(--surface)",
    border: "1.5px solid var(--border)",
    color: "var(--text)",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  syncSuccess: {
    fontSize: 13,
    color: "var(--green)",
    fontWeight: 500,
  },
  error: {
    fontSize: 13,
    color: "var(--red)",
  },
  dbIdBox: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  dbId: {
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--accent)",
    wordBreak: "break-all" as const,
  },
  labelSmall: {
    fontSize: 10,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  },
  firstLaunch: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  muted: {
    fontSize: 13,
    color: "var(--text-muted)",
  },
  tableWrapper: {
    overflowX: "auto" as const,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
  },
  th: {
    textAlign: "left" as const,
    padding: "8px 12px",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
    borderBottom: "1px solid var(--border)",
  },
  tr: {
    borderBottom: "1px solid var(--border)",
  },
  td: {
    padding: "10px 12px",
    color: "var(--text)",
    verticalAlign: "top" as const,
  },
};
