"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─── French locale ─────────────────────────────────────────────────────────

const MONTHS_LONG = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MONTHS_SHORT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc",
];
const DAYS_SHORT = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseDate(str: string | null): { y: number; m: number; d: number } | null {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatFr(str: string | null): string {
  if (!str) return "";
  const p = parseDate(str);
  if (!p) return str;
  return `${p.d} ${MONTHS_LONG[p.m - 1]} ${p.y}`;
}

function todayStr(): string {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

type DayCell = { y: number; m: number; d: number; current: boolean };

function getMonthDays(year: number, month: number): DayCell[] {
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun…6=Sat
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  // Monday-first offset (0=Mon … 6=Sun)
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;

  const days: DayCell[] = [];

  // Pad from previous month
  const pm = month === 1 ? 12 : month - 1;
  const py = month === 1 ? year - 1 : year;
  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ y: py, m: pm, d: prevMonthDays - i, current: false });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ y: year, m: month, d, current: true });
  }

  // Pad next month to complete last row
  const remaining = (7 - (days.length % 7)) % 7;
  const nm = month === 12 ? 1 : month + 1;
  const ny = month === 12 ? year + 1 : year;
  for (let d = 1; d <= remaining; d++) {
    days.push({ y: ny, m: nm, d, current: false });
  }

  return days;
}

// ─── Calendar SVG ──────────────────────────────────────────────────────────

const CalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: "block" }}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

// ─── NavButton ─────────────────────────────────────────────────────────────

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none", border: "none", cursor: "pointer",
        color: "var(--text-muted)", fontSize: 17, padding: "2px 8px",
        borderRadius: 6, lineHeight: 1, fontFamily: "var(--font-sans)",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
    >
      {children}
    </button>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────

export interface DatePickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  minDate?: string | null;
  maxDate?: string | null;
  style?: React.CSSProperties;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function DatePicker({
  value,
  onChange,
  placeholder = "Choisir une date",
  disabled = false,
  clearable = true,
  minDate,
  maxDate,
  style,
}: DatePickerProps) {
  const today = todayStr();
  const parsed = parseDate(value);

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parsed?.y ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsed?.m ?? new Date().getMonth() + 1);
  const [pickerView, setPickerView] = useState<"days" | "months">("days");
  const [openUpward, setOpenUpward] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPickerView("days");
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    // Detect if we should open upward
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 320 && rect.top > 320);
    }
    // Sync view to current value
    if (parsed) {
      setViewYear(parsed.y);
      setViewMonth(parsed.m);
    } else {
      const n = new Date();
      setViewYear(n.getFullYear());
      setViewMonth(n.getMonth() + 1);
    }
    setPickerView("days");
    setOpen((o) => !o);
  };

  // Outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  const selectDay = (y: number, m: number, d: number) => {
    const str = toDateStr(y, m, d);
    if (minDate && str < minDate) return;
    if (maxDate && str > maxDate) return;
    onChange(str);
    close();
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const days = getMonthDays(viewYear, viewMonth);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          padding: "9px 12px", fontSize: 13, fontFamily: "var(--font-sans)",
          background: disabled ? "var(--surface2)" : "var(--bg)",
          border: `1.5px solid ${open ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 8,
          color: value ? "var(--text)" : "var(--text-muted)",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left",
          boxShadow: open ? "0 0 0 3px rgba(59,126,248,0.12)" : "var(--shadow-sm)",
          transition: "border-color 0.18s, box-shadow 0.18s",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span style={{ color: value ? "var(--accent)" : "var(--text-muted)", display: "flex", alignItems: "center" }}>
          <CalIcon />
        </span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value ? formatFr(value) : placeholder}
        </span>
        {clearable && value && !disabled && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            style={{
              color: "var(--text-muted)", fontSize: 12, lineHeight: 1,
              cursor: "pointer", padding: "1px 3px", borderRadius: 4, flexShrink: 0,
            }}
          >
            ✕
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            ...(openUpward ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }),
            left: 0,
            minWidth: 260,
            background: "var(--surface)",
            border: "1.5px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08), var(--shadow-md)",
            zIndex: 9999,
            padding: 12,
          }}
        >
          {pickerView === "days" ? (
            <>
              {/* Month header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <NavBtn onClick={prevMonth}>‹</NavBtn>
                <button
                  type="button"
                  onClick={() => setPickerView("months")}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 700, color: "var(--text)",
                    padding: "3px 10px", borderRadius: 6, fontFamily: "var(--font-sans)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                >
                  {MONTHS_LONG[viewMonth - 1]} {viewYear}
                </button>
                <NavBtn onClick={nextMonth}>›</NavBtn>
              </div>

              {/* Day-of-week headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 2 }}>
                {DAYS_SHORT.map((d) => (
                  <div key={d} style={{
                    textAlign: "center", fontSize: 10, fontWeight: 600,
                    color: "var(--text-muted)", padding: "2px 0", letterSpacing: "0.04em",
                  }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
                {days.map((day, i) => {
                  const str = toDateStr(day.y, day.m, day.d);
                  const isSelected = value === str;
                  const isToday = str === today;
                  const outOfRange = (!!minDate && str < minDate) || (!!maxDate && str > maxDate);
                  const isDisabled = !day.current || outOfRange;

                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => !isDisabled && selectDay(day.y, day.m, day.d)}
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontFamily: "var(--font-sans)",
                        borderRadius: "50%",
                        border: isToday && !isSelected ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                        background: isSelected ? "var(--accent)" : "transparent",
                        color: isSelected
                          ? "#fff"
                          : isToday
                            ? "var(--accent)"
                            : !day.current
                              ? "var(--text-muted)"
                              : "var(--text)",
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        opacity: !day.current ? 0.35 : outOfRange ? 0.3 : 1,
                        fontWeight: isToday || isSelected ? 600 : 400,
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isDisabled && !isSelected)
                          (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          isSelected ? "var(--accent)" : "transparent";
                      }}
                    >
                      {day.d}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Month / Year selector */
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <NavBtn onClick={() => setViewYear((y) => y - 1)}>‹</NavBtn>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{viewYear}</span>
                <NavBtn onClick={() => setViewYear((y) => y + 1)}>›</NavBtn>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                {MONTHS_SHORT.map((label, i) => {
                  const mNum = i + 1;
                  const isSelected = mNum === viewMonth;
                  const isCurrentMonth =
                    mNum === new Date().getMonth() + 1 &&
                    viewYear === new Date().getFullYear();

                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => { setViewMonth(mNum); setPickerView("days"); }}
                      style={{
                        padding: "8px 4px",
                        fontSize: 12,
                        fontFamily: "var(--font-sans)",
                        borderRadius: 8,
                        border: isCurrentMonth && !isSelected
                          ? "1.5px solid var(--accent)"
                          : "1.5px solid transparent",
                        background: isSelected ? "var(--accent)" : "transparent",
                        color: isSelected ? "#fff" : isCurrentMonth ? "var(--accent)" : "var(--text)",
                        cursor: "pointer",
                        fontWeight: isSelected || isCurrentMonth ? 600 : 400,
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          isSelected ? "var(--accent)" : "transparent";
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
