"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { ChessStats } from "@/types";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";

const DB_LABELS: Record<string, string> = {
  NOTION_CHESS_RATING_DB:   "📈 Évolution du Rating",
  NOTION_CHESS_OPENINGS_DB: "♟️ Répertoire d'Ouvertures",
  NOTION_CHESS_DAILY_DB:    "🗓️ Journal Quotidien",
  NOTION_CHESS_PUZZLES_DB:  "🧩 Stats Puzzles",
  NOTION_CHESS_FORMATS_DB:  "⏱️ Analyse par Format",
};

type SyncMode = { type: "months"; value: number } | { type: "period"; value: "week" | "yesterday" };

export default function ChessPage() {
  useDynamicFavicon("♟️");
  useEffect(() => { document.title = "Chess — life×hub"; }, []);
  const [username, setUsername]     = useState<string | null>(null);
  const [stats, setStats]           = useState<ChessStats | null>(null);
  const [dbStatus, setDbStatus]     = useState<Record<string, boolean>>({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [restartRequired, setRestartRequired] = useState(false);

  const [syncMode, setSyncMode]     = useState<SyncMode>({ type: "months", value: 3 });
  const [syncing, setSyncing]       = useState(false);
  const [syncResult, setSyncResult] = useState<any | null>(null);
  const [syncError, setSyncError]   = useState<string | null>(null);

  const loadStats = useCallback(() => {
    setLoadingStats(true);
    setStatsError(null);
    fetch("/api/chess/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setStatsError(data.error);
        } else {
          setUsername(data.username);
          setStats(data.stats);
          setDbStatus(data.dbStatus ?? {});
          if (data.restartRequired) setRestartRequired(true);
        }
        setLoadingStats(false);
      })
      .catch(() => {
        setStatsError("Impossible de contacter l'API Chess.com.");
        setLoadingStats(false);
      });
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const body = syncMode.type === "months"
        ? { months: syncMode.value }
        : { period: syncMode.value };

      const res = await fetch("/api/chess/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) setSyncError(data.error ?? "Erreur de synchronisation.");
      else setSyncResult(data);
    } catch {
      setSyncError("Erreur réseau.");
    }
    setSyncing(false);
  }

  const blitz  = stats?.chess_blitz?.last?.rating;
  const rapid  = stats?.chess_rapid?.last?.rating;
  const puzzle = stats?.tactics?.highest?.rating;

  const allDbConfigured = Object.values(dbStatus).every(Boolean) && Object.keys(dbStatus).length > 0;

  return (
    <main style={styles.main}>
      <Link href="/" className="btn-back">← Accueil</Link>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 28 }}>♟️</span>
          <div>
            <div style={styles.title}>Chess.com</div>
            <div style={styles.subtitle}>
              Suivi de progression, ouvertures et journal depuis Chess.com vers Notion
              {username && <> — <strong>{username}</strong></>}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.content}>

        {/* Restart required banner */}
        {restartRequired && (
          <div style={{ ...styles.card, borderColor: "var(--accent)", borderWidth: 2 }}>
            <div style={styles.sectionTitle}>✅ Bases Notion créées</div>
            <p style={{ fontSize: 13, color: "var(--text)", margin: 0 }}>
              Les 5 bases Notion ont été créées et les IDs ont été écrits dans{" "}
              <code>.env.local</code>. Redémarre le serveur pour finaliser la configuration.
            </p>
            <code style={styles.codeBlock}>npm run dev</code>
          </div>
        )}

        {/* Quick stats */}
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Statistiques Chess.com</div>
          {loadingStats ? (
            <div style={styles.muted}>Chargement...</div>
          ) : statsError ? (
            <div style={styles.error}>{statsError}</div>
          ) : stats ? (
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{blitz ?? "—"}</div>
                <div style={styles.statLabel}>ELO Blitz</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{rapid ?? "—"}</div>
                <div style={styles.statLabel}>ELO Rapid</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{puzzle ?? "—"}</div>
                <div style={styles.statLabel}>Puzzle Rating</div>
              </div>
            </div>
          ) : !restartRequired ? (
            <div style={styles.muted}>Aucune statistique disponible.</div>
          ) : null}
        </div>

        {/* Sync */}
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Synchronisation Notion</div>
          {!allDbConfigured && !restartRequired && (
            <div style={styles.muted}>Configure d'abord les bases Notion ci-dessous.</div>
          )}

          <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
            <div style={styles.labelSmall}>Période à synchroniser</div>
            <div style={styles.syncButtons}>
              {/* Short period buttons */}
              <button
                style={syncMode.type === "period" && syncMode.value === "yesterday"
                  ? { ...styles.btnPrimary }
                  : { ...styles.btnSecondary }}
                onClick={() => setSyncMode({ type: "period", value: "yesterday" })}
                disabled={syncing}
              >
                Hier
              </button>
              <button
                style={syncMode.type === "period" && syncMode.value === "week"
                  ? { ...styles.btnPrimary }
                  : { ...styles.btnSecondary }}
                onClick={() => setSyncMode({ type: "period", value: "week" })}
                disabled={syncing}
              >
                Cette semaine
              </button>
              {/* Month buttons */}
              {([1, 3, 6, 12] as const).map((n) => (
                <button
                  key={n}
                  style={syncMode.type === "months" && syncMode.value === n
                    ? { ...styles.btnPrimary }
                    : { ...styles.btnSecondary }}
                  onClick={() => setSyncMode({ type: "months", value: n })}
                  disabled={syncing}
                >
                  {n} mois
                </button>
              ))}
            </div>

            <button
              className="btn-primary"
              style={{ ...styles.btnPrimary, alignSelf: "flex-start" as const, opacity: (syncing || !allDbConfigured) ? 0.5 : 1 }}
              onClick={handleSync}
              disabled={syncing || !allDbConfigured}
            >
              {syncing ? "Synchronisation en cours..." : "Sync maintenant"}
            </button>
          </div>

          {syncing && (
            <div style={styles.muted}>Téléchargement des parties et mise à jour des modules Notion...</div>
          )}

          {syncResult && (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
              <div style={styles.syncSuccess}>
                ✓ {syncResult.gamesProcessed} partie{syncResult.gamesProcessed !== 1 ? "s" : ""} traitée{syncResult.gamesProcessed !== 1 ? "s" : ""} en {Math.round(syncResult.durationMs / 1000)}s
              </div>
              {syncResult.modules?.length > 0 && (
                <div style={styles.moduleList}>
                  {(syncResult.modules as string[]).map((m: string) => (
                    <span key={m} style={styles.moduleTag}>{m}</span>
                  ))}
                </div>
              )}
              {syncResult.failedModules?.length > 0 && (
                <div style={styles.error}>
                  Modules en erreur : {(syncResult.failedModules as string[]).join(", ")}
                </div>
              )}
            </div>
          )}
          {syncError && <div style={styles.error}>{syncError}</div>}
        </div>

        {/* Setup — DB status */}
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Setup — Bases Notion</div>
          {!allDbConfigured && !restartRequired ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              Ajoute <code>NOTION_CHESS_PARENT_PAGE_ID=&lt;id_page_notion&gt;</code> dans{" "}
              <code>.env.local</code> et recharge cette page — les 5 bases seront créées automatiquement.
            </p>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
              Statut des 5 bases de données Notion.
            </p>
          )}
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Module</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(DB_LABELS).map(([varName, label]) => (
                  <tr key={varName} style={styles.tr}>
                    <td style={styles.td}>{label}</td>
                    <td style={{ ...styles.td, textAlign: "center" }}>
                      {loadingStats ? "…" : (dbStatus[varName] || restartRequired) ? (
                        <span style={{ color: "var(--green)" }}>✅</span>
                      ) : (
                        <span style={{ color: "var(--red)" }}>❌</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  header: { width: "100%", maxWidth: 800 },
  logo: { display: "flex", alignItems: "center", gap: 16 },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "var(--text)",
    letterSpacing: "-0.02em",
  },
  subtitle: { fontSize: 14, color: "var(--text-muted)", marginTop: 4 },
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
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 },
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
  syncButtons: { display: "flex", gap: 8, flexWrap: "wrap" as const },
  btnPrimary: {
    padding: "9px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    background: "var(--accent)",
    color: "#fff",
    border: "1.5px solid var(--accent)",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  btnSecondary: {
    padding: "9px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    background: "var(--surface)",
    border: "1.5px solid var(--border)",
    color: "var(--text)",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  syncSuccess: { fontSize: 13, color: "var(--green)", fontWeight: 500 },
  error: { fontSize: 13, color: "var(--red)" },
  muted: { fontSize: 13, color: "var(--text-muted)" },
  labelSmall: {
    fontSize: 10,
    color: "var(--text-muted)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
  },
  moduleList: { display: "flex", flexWrap: "wrap" as const, gap: 8 },
  moduleTag: {
    fontSize: 12,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "3px 8px",
    color: "var(--text)",
  },
  codeBlock: {
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    color: "var(--accent)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "8px 12px",
  },
  tableWrapper: { overflowX: "auto" as const },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
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
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "10px 12px", color: "var(--text)", verticalAlign: "top" as const },
};
