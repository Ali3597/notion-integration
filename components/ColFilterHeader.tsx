"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function ColFilterHeader({
  label,
  options,
  value,
  onChange,
  thStyle,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  thStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLTableCellElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const scrollHandler = () => setOpen(false);
    document.addEventListener("mousedown", handler);
    document.addEventListener("scroll", scrollHandler, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("scroll", scrollHandler, true);
    };
  }, [open]);

  function handleToggle() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 2, left: rect.left });
    }
    setOpen((v) => !v);
  }

  const isActive = value !== "";

  const dropdown = open
    ? createPortal(
        <div
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            background: "var(--surface)",
            border: "1.5px solid var(--border)",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            minWidth: 160,
            overflow: "hidden",
            fontWeight: "normal",
            letterSpacing: "normal",
            textTransform: "none",
            fontSize: 12,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              style={{
                padding: "8px 14px",
                cursor: "pointer",
                color: value === opt.value ? "var(--accent)" : "var(--text)",
                fontWeight: value === opt.value ? 600 : 400,
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <th
      ref={ref}
      style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
      onClick={handleToggle}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        {isActive && (
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--accent)",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
        )}
        <span style={{ fontSize: 7, opacity: 0.5 }}>{open ? "▲" : "▼"}</span>
      </span>
      {dropdown}
    </th>
  );
}
