"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import type { DBProject, DBSession } from "@/types";

export type Mode = "work" | "break";

export const MODES = {
  work: { label: "Focus", defaultMin: 25, color: "var(--accent)" },
  break: { label: "Pause", defaultMin: 5, color: "var(--accent2)" },
};

type PomodoroContextType = {
  projects: DBProject[];
  sessions: DBSession[];
  todayStats: { session_count: number; total_minutes: number } | null;
  loadingProjects: boolean;
  selectedProject: string;
  mode: Mode;
  secondsLeft: number;
  running: boolean;
  workMin: number;
  breakMin: number;
  sessionCount: number;
  notes: string;
  saving: boolean;
  lastSaved: string | null;
  sessionStart: string | null; // non-null = session active (started but not finished)
  setSelectedProject: (id: string) => void;
  setMode: (m: Mode) => void;
  setWorkMin: (n: number) => void;
  setBreakMin: (n: number) => void;
  setNotes: (s: string) => void;
  handleStart: () => void;
  handlePause: () => void;
  handleReset: () => void;
  handleFinish: () => void;
  handleSkip: () => void;
  loadSessions: () => void;
};

const PomodoroContext = createContext<PomodoroContextType | null>(null);

export function usePomodoroContext() {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error("usePomodoroContext must be used inside PomodoroProvider");
  return ctx;
}

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<DBProject[]>([]);
  const [sessions, setSessions] = useState<DBSession[]>([]);
  const [todayStats, setTodayStats] = useState<{ session_count: number; total_minutes: number } | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [selectedProject, setSelectedProject] = useState("");
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [mode, setMode] = useState<Mode>("work");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  // sessionStart stored as STATE so React re-renders reliably when it changes
  const [sessionStart, setSessionStart] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load projects once
  useEffect(() => {
    fetch("/api/pomodoro/projects")
      .then((r) => r.json())
      .then((data) => { setProjects(Array.isArray(data) ? data : []); setLoadingProjects(false); })
      .catch(() => setLoadingProjects(false));
  }, []);

  const loadSessions = useCallback(() => {
    fetch("/api/pomodoro/sessions")
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch("/api/pomodoro/today-stats")
      .then((r) => r.json())
      .then((data) => setTodayStats(data))
      .catch(() => {});
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Reset timer only when durations/mode change AND no session is active
  // NOTE: `running` intentionally NOT in deps — we don't want to reset on Pause
  useEffect(() => {
    if (!sessionStart) {
      setSecondsLeft(mode === "work" ? workMin * 60 : breakMin * 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workMin, breakMin, mode]);

  const saveSession = useCallback(async (start: string, end: string) => {
    if (!selectedProject) return;
    setSaving(true);
    try {
      await fetch("/api/pomodoro/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: selectedProject, startTime: start, endTime: end, notes }),
      });
      setLastSaved(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
      setNotes("");
      loadSessions();
    } catch {}
    setSaving(false);
  }, [selectedProject, notes, loadSessions]);

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

  // Use a ref for sessionStart inside the interval callback to avoid stale closure
  const sessionStartRef = useRef<string | null>(null);
  useEffect(() => { sessionStartRef.current = sessionStart; }, [sessionStart]);

  const selectedProjectRef = useRef(selectedProject);
  useEffect(() => { selectedProjectRef.current = selectedProject; }, [selectedProject]);

  const handleTimerEndRef = useRef<() => void>(() => {});

  const saveSessionRef = useRef(saveSession);
  useEffect(() => { saveSessionRef.current = saveSession; }, [saveSession]);

  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const workMinRef = useRef(workMin);
  useEffect(() => { workMinRef.current = workMin; }, [workMin]);

  const breakMinRef = useRef(breakMin);
  useEffect(() => { breakMinRef.current = breakMin; }, [breakMin]);

  useEffect(() => {
    handleTimerEndRef.current = () => {
      setRunning(false);
      playSound();
      const currentMode = modeRef.current;
      if (currentMode === "work") {
        setSessionCount((c) => c + 1);
        const start = sessionStartRef.current;
        const proj = selectedProjectRef.current;
        if (proj && start) {
          saveSessionRef.current(start, new Date().toISOString());
        }
      }
      setMode((m) => (m === "work" ? "break" : "work"));
      setSessionStart(null);
      const nextMode = currentMode === "work" ? "break" : "work";
      setSecondsLeft(nextMode === "work" ? workMinRef.current * 60 : breakMinRef.current * 60);
    };
  });

  // Timer tick — stable, no deps that change
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          handleTimerEndRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const handleStart = useCallback(() => {
    if (!selectedProject) return;
    if (mode === "work" && !sessionStart) {
      setSessionStart(new Date().toISOString());
    }
    setRunning(true);
  }, [selectedProject, mode, sessionStart]);

  const handlePause = useCallback(() => {
    setRunning(false);
  }, []);

  // Annuler — discard, no save
  const handleReset = useCallback(() => {
    setRunning(false);
    setSessionStart(null);
    setSecondsLeft(mode === "work" ? workMin * 60 : breakMin * 60);
  }, [mode, workMin, breakMin]);

  // Terminer — save elapsed time
  const handleFinish = useCallback(async () => {
    if (!sessionStart || !selectedProject) {
      setRunning(false);
      setSessionStart(null);
      setSecondsLeft(mode === "work" ? workMin * 60 : breakMin * 60);
      return;
    }
    setRunning(false);
    setSessionCount((c) => c + 1);
    const endTime = new Date().toISOString();
    const start = sessionStart;
    setSessionStart(null);
    setSecondsLeft(mode === "work" ? workMin * 60 : breakMin * 60);
    await saveSession(start, endTime);
  }, [sessionStart, selectedProject, mode, workMin, breakMin, saveSession]);

  const handleSkip = useCallback(() => {
    setRunning(false);
    setSessionStart(null);
    const next: Mode = mode === "work" ? "break" : "work";
    setMode(next);
    setSecondsLeft(next === "work" ? workMin * 60 : breakMin * 60);
  }, [mode, workMin, breakMin]);

  return (
    <PomodoroContext.Provider value={{
      projects, sessions, todayStats, loadingProjects,
      selectedProject, mode, secondsLeft, running,
      workMin, breakMin, sessionCount, notes, saving, lastSaved,
      sessionStart,
      setSelectedProject, setMode, setWorkMin, setBreakMin, setNotes,
      handleStart, handlePause, handleReset, handleFinish, handleSkip, loadSessions,
    }}>
      {children}
    </PomodoroContext.Provider>
  );
}
