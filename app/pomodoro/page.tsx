"use client";

import Link from "next/link";
import { usePomodoroContext, MODES } from "@/lib/pomodoro-context";
import type { Mode } from "@/lib/pomodoro-context";
import { CustomSelect } from "@/components/CustomSelect";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatDuration(min: number | null) {
  if (!min) return "—";
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${min % 60 > 0 ? pad(min % 60) : ""}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export default function PomodoroPage() {
  const {
    projects, sessions, todayStats, loadingProjects,
    selectedProject, mode, secondsLeft, running,
    workMin, breakMin, sessionCount, notes, saving, lastSaved,
    sessionStart,
    setSelectedProject, setMode, setWorkMin, setBreakMin, setNotes,
    handleStart, handlePause, handleReset, handleFinish, handleSkip,
    loadSessions,
  } = usePomodoroContext();

  async function handleDeleteSession(id: string) {
    await fetch(`/api/pomodoro/sessions?id=${id}`, { method: "DELETE" });
    loadSessions();
  }

  const hasActiveSession = sessionStart !== null;

  const total = mode === "work" ? workMin * 60 : breakMin * 60;
  const progress = ((total - secondsLeft) / total) * 100;
  const modeColor = MODES[mode].color;
  const circumference = 2 * Math.PI * 110;
  const strokeDash = circumference - (progress / 100) * circumference;

  return (
    <main style={styles.main}>
      <Link href="/" className="btn-back">← Accueil</Link>
      {/* Left panel */}
      <div style={styles.left}>
        <div style={styles.logo}>
          <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>◉</span>
          <span style={{ fontWeight: 600, letterSpacing: "0.05em" }}>pomodoro</span>
        </div>

        <div style={styles.section}>
          <label style={styles.label}>Projet</label>
          <CustomSelect
            value={selectedProject}
            onChange={setSelectedProject}
            disabled={loadingProjects || running}
            placeholder={loadingProjects ? "Chargement..." : "— Sélectionner un projet —"}
            searchable
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>

        <div style={styles.section}>
          <label style={styles.label}>Notes de session</label>
          <textarea
            placeholder="Ce que tu as fait, bloquants..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <div style={styles.section}>
          <label style={styles.label}>Durées (minutes)</label>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={styles.labelSmall}>Focus</div>
              <input type="number" min={1} max={120} value={workMin}
                onChange={(e) => setWorkMin(Number(e.target.value))} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={styles.labelSmall}>Pause</div>
              <input type="number" min={1} max={60} value={breakMin}
                onChange={(e) => setBreakMin(Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div style={styles.statsRow}>
          {todayStats && (
            <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
              <div style={styles.stat}>
                <span style={styles.statNum}>{todayStats.session_count}</span>
                <span style={styles.statLabel}>aujourd'hui</span>
              </div>
              <div style={styles.stat}>
                <span style={styles.statNum}>{todayStats.total_minutes}</span>
                <span style={styles.statLabel}>min</span>
              </div>
            </div>
          )}
          <div style={styles.stat}>
            <span style={styles.statNum}>{sessionCount}</span>
            <span style={styles.statLabel}>cette session</span>
          </div>
          {lastSaved && (
            <div style={styles.stat}>
              <span style={{ ...styles.statNum, color: "var(--green)", fontSize: 12 }}>
                ✓ sauvegardé à {lastSaved}
              </span>
            </div>
          )}
          {saving && (
            <div style={styles.stat}>
              <span style={{ ...styles.statNum, color: "var(--text-muted)", fontSize: 12 }}>
                Sauvegarde...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Center — Timer */}
      <div style={styles.center}>
        <div style={styles.modeTabs}>
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { if (!running) { setMode(m); } }}
              style={{
                ...styles.modeTab,
                ...(mode === m ? { background: modeColor, color: "#fff" } : {}),
              }}
            >
              {MODES[m].label}
            </button>
          ))}
        </div>

        <div style={styles.timerWrapper}>
          <svg width={260} height={260} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={130} cy={130} r={110} fill="none" stroke="var(--surface2)" strokeWidth={8} />
            <circle cx={130} cy={130} r={110} fill="none" stroke={modeColor} strokeWidth={8}
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDash}
              style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }} />
          </svg>
          <div style={styles.timerInner}>
            <div style={{ ...styles.timerTime, color: modeColor }}>
              {pad(Math.floor(secondsLeft / 60))}:{pad(secondsLeft % 60)}
            </div>
            <div style={styles.timerMode}>{MODES[mode].label.toUpperCase()}</div>
            {!selectedProject && <div style={styles.timerWarning}>Sélectionne un projet</div>}
          </div>
        </div>

        <div style={styles.controls}>
          {running ? (
            <button onClick={handlePause} className="btn-primary"
              style={{ ...styles.btnPrimary, background: modeColor }}>
              ⏸ Pause
            </button>
          ) : hasActiveSession ? (
            // Paused mid-session: show Annuler / Reprendre / Terminer
            <>
              <button onClick={handleReset} style={styles.btnDanger}>
                ✕ Annuler
              </button>
              <button onClick={handleStart} className="btn-primary"
                style={{ ...styles.btnPrimary, background: modeColor }}>
                ▶ Reprendre
              </button>
              <button onClick={handleFinish} style={styles.btnSuccess}>
                ✓ Terminer
              </button>
            </>
          ) : (
            <>
              <button onClick={handleReset} style={styles.btnSecondary} title="Reset">↺</button>
              <button onClick={handleStart} className="btn-primary"
                style={{
                  ...styles.btnPrimary,
                  background: selectedProject ? modeColor : "var(--border)",
                  boxShadow: selectedProject ? "0 4px 14px rgba(59, 126, 248, 0.35), 0 1px 3px rgba(0,0,0,0.1)" : "none",
                  color: selectedProject ? "#ffffff" : "var(--text-muted)",
                  cursor: selectedProject ? "pointer" : "not-allowed",
                }}>
                ▶ Start
              </button>
              <button onClick={handleSkip} style={styles.btnSecondary} title="Passer">⏭</button>
            </>
          )}
        </div>

        {/* Recent sessions table */}
        {sessions.length > 0 && (
          <div style={styles.sessionsTable}>
            <div style={styles.sectionTitle}>Dernières sessions</div>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Projet</th>
                    <th style={styles.th}>Début</th>
                    <th style={styles.th}>Fin</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Durée</th>
                    <th style={{ ...styles.th, width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} style={styles.tr}>
                      <td style={styles.td}>{s.project_name ?? s.name ?? "—"}</td>
                      <td style={styles.td}>{formatDate(s.start_time)}</td>
                      <td style={styles.td}>{formatDate(s.end_time)}</td>
                      <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                        {formatDuration(s.duration_min)}
                      </td>
                      <td style={{ ...styles.td, textAlign: "center" }}>
                        <button
                          onClick={() => handleDeleteSession(s.id)}
                          title="Supprimer"
                          style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer", padding: "2px 6px", borderRadius: 6, lineHeight: 1 }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.07)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — session cards */}
      <div style={styles.right}>
        <div style={styles.sectionTitle}>Sessions récentes</div>
        {sessions.length === 0 ? (
          <div style={styles.empty}>Aucune session encore</div>
        ) : (
          <div style={styles.sessionList}>
            {sessions.map((s) => (
              <div key={s.id} style={styles.sessionCard}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                  <div style={styles.sessionName}>{s.project_name ?? s.name ?? "Session"}</div>
                  <button
                    onClick={() => handleDeleteSession(s.id)}
                    title="Supprimer"
                    style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", padding: "1px 4px", borderRadius: 5, flexShrink: 0, lineHeight: 1 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--red)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.07)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                  >✕</button>
                </div>
                <div style={styles.sessionMeta}>
                  <span>{formatDate(s.start_time)}</span>
                  <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                    {formatDuration(s.duration_min)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { display: "flex", minHeight: "100vh", background: "var(--bg)" },
  left: {
    width: 280, minWidth: 280,
    background: "var(--surface)",
    borderRight: "1px solid var(--border)",
    padding: "28px 24px",
    display: "flex", flexDirection: "column", gap: 24,
  },
  logo: {
    display: "flex", alignItems: "center", gap: 10,
    fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--text)", marginBottom: 4,
  },
  section: { display: "flex", flexDirection: "column", gap: 8 },
  label: {
    fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
    textTransform: "uppercase", color: "var(--text-muted)",
  },
  labelSmall: {
    fontSize: 10, color: "var(--text-muted)", marginBottom: 4,
    textTransform: "uppercase", letterSpacing: "0.08em",
  },
  statsRow: {
    display: "flex", flexDirection: "column", gap: 8,
    marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border)",
  },
  stat: { display: "flex", alignItems: "center", gap: 8 },
  statNum: { fontFamily: "var(--font-mono)", fontSize: 20, color: "var(--accent)", fontWeight: 700 },
  statLabel: { fontSize: 12, color: "var(--text-muted)" },
  center: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "flex-start", gap: 32, padding: 48, paddingTop: 48,
  },
  modeTabs: {
    display: "flex", gap: 8, background: "var(--surface)",
    padding: 4, borderRadius: 50, border: "1px solid var(--border)",
  },
  modeTab: {
    padding: "8px 24px", borderRadius: 50, fontSize: 13, fontWeight: 500,
    background: "transparent", color: "var(--text-muted)",
    transition: "all 0.2s", letterSpacing: "0.04em", cursor: "pointer",
  },
  timerWrapper: { position: "relative", width: 260, height: 260 },
  timerInner: {
    position: "absolute", inset: 0, display: "flex",
    flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
  },
  timerTime: {
    fontFamily: "var(--font-mono)", fontSize: 52, fontWeight: 700,
    letterSpacing: "-0.02em", lineHeight: 1,
  },
  timerMode: { fontSize: 11, letterSpacing: "0.15em", color: "var(--text-muted)", fontWeight: 600 },
  timerWarning: { fontSize: 11, color: "var(--red)", marginTop: 4 },
  controls: { display: "flex", alignItems: "center", gap: 16 },
  btnPrimary: {
    padding: "14px 40px", borderRadius: 50, fontSize: 15, fontWeight: 700,
    letterSpacing: "0.04em", transition: "all 0.2s", color: "#ffffff", cursor: "pointer",
    boxShadow: "0 4px 14px rgba(59, 126, 248, 0.35), 0 1px 3px rgba(0,0,0,0.1)",
  },
  btnSecondary: {
    width: 44, height: 44, borderRadius: "50%",
    background: "var(--surface)", border: "1.5px solid var(--border)",
    color: "var(--text-muted)", fontSize: 18,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.2s", cursor: "pointer", boxShadow: "var(--shadow-sm)",
  },
  btnDanger: {
    padding: "12px 22px", borderRadius: 50, fontSize: 14, fontWeight: 600,
    background: "rgba(220,38,38,0.08)", border: "1.5px solid rgba(220,38,38,0.2)",
    color: "var(--red)", cursor: "pointer", transition: "all 0.2s",
  },
  btnSuccess: {
    padding: "12px 22px", borderRadius: 50, fontSize: 14, fontWeight: 600,
    background: "rgba(22,163,74,0.08)", border: "1.5px solid rgba(22,163,74,0.2)",
    color: "var(--green)", cursor: "pointer", transition: "all 0.2s",
  },
  right: {
    width: 260, minWidth: 260, background: "var(--surface)",
    borderLeft: "1px solid var(--border)", padding: "56px 20px 28px",
    display: "flex", flexDirection: "column", gap: 16, overflowY: "auto",
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
    textTransform: "uppercase", color: "var(--text-muted)",
  },
  empty: { fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginTop: 32 },
  sessionList: { display: "flex", flexDirection: "column", gap: 8 },
  sessionCard: {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 10, padding: "12px 14px",
    display: "flex", flexDirection: "column", gap: 6, boxShadow: "var(--shadow-sm)",
  },
  sessionName: {
    fontSize: 12, fontWeight: 500, color: "var(--text)",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  sessionMeta: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" },
  sessionsTable: {
    width: "100%", maxWidth: 700,
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 12, padding: "20px 24px",
    display: "flex", flexDirection: "column", gap: 12,
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left", padding: "8px 12px", fontSize: 10,
    fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
    color: "var(--text-muted)", borderBottom: "1px solid var(--border)",
  },
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "10px 12px", color: "var(--text)", verticalAlign: "top" },
};
