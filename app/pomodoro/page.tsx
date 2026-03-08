"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { NotionProject, NotionTask, NotionSession } from "@/types";

type Mode = "work" | "break";

const MODES = {
  work: { label: "Focus", defaultMin: 25, color: "var(--accent)" },
  break: { label: "Pause", defaultMin: 5, color: "var(--accent2)" },
};

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
  // Selectors
  const [projects, setProjects] = useState<NotionProject[]>([]);
  const [tasks, setTasks] = useState<NotionTask[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<string>("");

  // Timer config
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [mode, setMode] = useState<Mode>("work");
  const [secondsLeft, setSecondsLeft] = useState(workMin * 60);
  const [running, setRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);

  // Session tracking
  const startTimeRef = useRef<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // History
  const [sessions, setSessions] = useState<NotionSession[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Timer ref
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load projects
  useEffect(() => {
    fetch("/api/pomodoro/projects")
      .then((r) => r.json())
      .then((data) => { setProjects(Array.isArray(data) ? data : []); setLoadingProjects(false); })
      .catch(() => setLoadingProjects(false));
  }, []);

  // Load tasks when project changes
  useEffect(() => {
    if (!selectedProject) { setTasks([]); setSelectedTask(""); return; }
    setLoadingTasks(true);
    setSelectedTask("");
    fetch(`/api/pomodoro/tasks?projectId=${selectedProject}`)
      .then((r) => r.json())
      .then((data) => { setTasks(Array.isArray(data) ? data : []); setLoadingTasks(false); })
      .catch(() => setLoadingTasks(false));
  }, [selectedProject]);

  // Load sessions history
  const loadSessions = useCallback(() => {
    fetch("/api/pomodoro/sessions")
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Reset timer when mode or duration changes
  useEffect(() => {
    if (!running) {
      setSecondsLeft(mode === "work" ? workMin * 60 : breakMin * 60);
    }
  }, [workMin, breakMin, mode, running]);

  // Countdown
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current!);
            handleTimerEnd();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const handleTimerEnd = useCallback(() => {
    setRunning(false);
    playSound();
    if (mode === "work") {
      setSessionCount((c) => c + 1);
      if (selectedTask && startTimeRef.current) {
        saveSession(startTimeRef.current, new Date().toISOString());
      }
    }
    setMode((m) => m === "work" ? "break" : "work");
    startTimeRef.current = null;
  }, [mode, selectedTask]);

  const playSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
    } catch {}
  };

  const saveSession = async (start: string, end: string) => {
    if (!selectedTask) return;
    setSaving(true);
    try {
      await fetch("/api/pomodoro/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: selectedTask, startTime: start, endTime: end, notes }),
      });
      setLastSaved(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      setNotes("");
      loadSessions();
    } catch {}
    setSaving(false);
  };

  const handleStart = () => {
    if (!selectedTask) return;
    if (!running) startTimeRef.current = new Date().toISOString();
    setRunning(true);
  };

  const handlePause = () => setRunning(false);

  const handleReset = () => {
    setRunning(false);
    startTimeRef.current = null;
    setSecondsLeft(mode === "work" ? workMin * 60 : breakMin * 60);
  };

  const handleSkip = () => {
    setRunning(false);
    startTimeRef.current = null;
    const next: Mode = mode === "work" ? "break" : "work";
    setMode(next);
    setSecondsLeft(next === "work" ? workMin * 60 : breakMin * 60);
  };

  const total = mode === "work" ? workMin * 60 : breakMin * 60;
  const progress = ((total - secondsLeft) / total) * 100;
  const modeColor = MODES[mode].color;
  const circumference = 2 * Math.PI * 110;
  const strokeDash = circumference - (progress / 100) * circumference;

  return (
    <main style={styles.main}>
      {/* Left panel */}
      <div style={styles.left}>
        <div style={styles.logo}>
          <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>◉</span>
          <span style={{ fontWeight: 600, letterSpacing: "0.05em" }}>pomodoro×notion</span>
        </div>

        <div style={styles.section}>
          <label style={styles.label}>Projet</label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            disabled={loadingProjects || running}
          >
            <option value="">{loadingProjects ? "Chargement..." : "— Sélectionner un projet —"}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div style={styles.section}>
          <label style={styles.label}>Tâche</label>
          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            disabled={!selectedProject || loadingTasks || running}
          >
            <option value="">
              {!selectedProject ? "Sélectionner un projet d'abord" :
                loadingTasks ? "Chargement..." : "— Sélectionner une tâche —"}
            </option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.priority === "High" ? "🔴 " : t.priority === "Medium" ? "🟡 " : "🟢 "}
                {t.name}
              </option>
            ))}
          </select>
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
              <input
                type="number"
                min={1} max={120}
                value={workMin}
                onChange={(e) => setWorkMin(Number(e.target.value))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={styles.labelSmall}>Pause</div>
              <input
                type="number"
                min={1} max={60}
                value={breakMin}
                onChange={(e) => setBreakMin(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div style={styles.statsRow}>
          <div style={styles.stat}>
            <span style={styles.statNum}>{sessionCount}</span>
            <span style={styles.statLabel}>sessions</span>
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
              onClick={() => { if (!running) { setMode(m); startTimeRef.current = null; } }}
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
            <circle
              cx={130} cy={130} r={110}
              fill="none"
              stroke={modeColor}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDash}
              style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s ease" }}
            />
          </svg>
          <div style={styles.timerInner}>
            <div style={{ ...styles.timerTime, color: modeColor }}>
              {pad(Math.floor(secondsLeft / 60))}:{pad(secondsLeft % 60)}
            </div>
            <div style={styles.timerMode}>{MODES[mode].label.toUpperCase()}</div>
            {!selectedTask && (
              <div style={styles.timerWarning}>Sélectionne une tâche</div>
            )}
          </div>
        </div>

        <div style={styles.controls}>
          <button onClick={handleReset} style={styles.btnSecondary} title="Reset">↺</button>
          {running ? (
            <button onClick={handlePause} className="btn-primary" style={{ ...styles.btnPrimary, background: modeColor }}>
              ⏸ Pause
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="btn-primary"
              style={{
                ...styles.btnPrimary,
                background: selectedTask ? modeColor : "var(--border)",
                boxShadow: selectedTask ? "0 4px 14px rgba(59, 126, 248, 0.35), 0 1px 3px rgba(0,0,0,0.1)" : "none",
                color: selectedTask ? "#ffffff" : "var(--text-muted)",
                cursor: selectedTask ? "pointer" : "not-allowed",
              }}
            >
              ▶ Start
            </button>
          )}
          <button onClick={handleSkip} style={styles.btnSecondary} title="Passer">⏭</button>
        </div>
      </div>

      {/* Right panel — History */}
      <div style={styles.right}>
        <div style={styles.sectionTitle}>Dernières sessions</div>
        {sessions.length === 0 ? (
          <div style={styles.empty}>Aucune session encore</div>
        ) : (
          <div style={styles.sessionList}>
            {sessions.map((s) => (
              <div key={s.id} style={styles.sessionCard}>
                <div style={styles.sessionName}>{s.name}</div>
                <div style={styles.sessionMeta}>
                  <span>{formatDate(s.startTime)}</span>
                  <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                    {formatDuration(s.duration)}
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
    alignItems: "center", justifyContent: "center", gap: 32, padding: 48,
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
};
