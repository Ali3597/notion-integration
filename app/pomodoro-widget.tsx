"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { usePomodoroContext, MODES } from "@/lib/pomodoro-context";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function PomodoroWidget() {
  const pathname = usePathname();
  const {
    running, secondsLeft, mode, workMin, breakMin,
    selectedProject, projects, sessionStart,
    handlePause, handleStart, handleReset, handleFinish,
  } = usePomodoroContext();

  if (pathname === "/pomodoro" || !selectedProject) return null;
  if (!running && !sessionStart) return null;

  const hasActiveSession = sessionStart !== null;

  const modeConfig = MODES[mode];
  const modeColor = modeConfig.color;
  const projectName = projects.find((p) => p.id === selectedProject)?.name ?? "Projet";

  // Mini circular progress (r=28, so circumference ≈ 175.9)
  const totalSec = mode === "work" ? workMin * 60 : breakMin * 60;
  const R = 28;
  const circ = 2 * Math.PI * R;
  const progress = (totalSec - secondsLeft) / totalSec;
  const dash = circ - progress * circ;

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 1000,
      background: "var(--surface)", border: "1.5px solid var(--border)",
      borderRadius: 20, boxShadow: "var(--shadow-md)",
      padding: "16px 20px",
      display: "flex", alignItems: "center", gap: 16,
      minWidth: 240,
    }}>
      {/* Circular timer */}
      <div style={{ position: "relative", width: 68, height: 68, flexShrink: 0 }}>
        <svg width={68} height={68} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={34} cy={34} r={R} fill="none" stroke="var(--surface2)" strokeWidth={5} />
          <circle
            cx={34} cy={34} r={R}
            fill="none"
            stroke={modeColor}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dash}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        {/* Time in center */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 1,
        }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700,
            color: modeColor, lineHeight: 1,
          }}>
            {pad(Math.floor(secondsLeft / 60))}:{pad(secondsLeft % 60)}
          </span>
          <span style={{ fontSize: 8, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
            {modeConfig.label.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Project name + controls */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{
          fontSize: 12, fontWeight: 500, color: "var(--text)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {projectName}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {running ? (
            <button onClick={handlePause} title="Pause" style={btnStyle}>⏸</button>
          ) : (
            <>
              <button onClick={handleReset} title="Annuler" style={{ ...btnStyle, color: "var(--red)" }}>✕</button>
              <button onClick={handleStart} title="Reprendre" style={{ ...btnStyle, background: modeColor, color: "#fff", borderColor: modeColor }}>▶</button>
              <button onClick={handleFinish} title="Terminer" style={{ ...btnStyle, color: "var(--green)" }}>✓</button>
            </>
          )}
          <Link
            href="/pomodoro"
            title="Ouvrir Pomodoro"
            style={{ ...btnStyle, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
            ◉
          </Link>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8,
  background: "var(--surface2)", border: "1px solid var(--border)",
  color: "var(--text-muted)", fontSize: 12, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
