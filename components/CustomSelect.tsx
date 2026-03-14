"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
  icon?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  required?: boolean;
  onCreateOption?: (label: string) => Promise<void>;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "— Sélectionner —",
  searchable = false,
  disabled = false,
  style,
  required,
  onCreateOption,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const exactMatch = search.trim().length > 0 && options.some(
    (o) => o.value !== "" && o.label.toLowerCase() === search.trim().toLowerCase()
  );
  const showCreate = searchable && !!onCreateOption && search.trim().length > 0 && !exactMatch;

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  const handleCreateOption = async () => {
    if (!onCreateOption) return;
    const label = search.trim();
    close();
    await onCreateOption(label);
  };

  // Close on outside click
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

  // Focus search on open
  useEffect(() => {
    if (open && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open, searchable]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    close();
  };

  const chevronSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238888aa' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`;

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          width: "100%",
          padding: "10px 36px 10px 14px",
          backgroundColor: disabled ? "var(--surface2)" : "var(--surface)",
          border: `1.5px solid ${open ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 10,
          color: selectedOption ? "var(--text)" : "var(--text-muted)",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left",
          backgroundImage: chevronSvg,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
          boxShadow: open ? "0 0 0 3px rgba(59,126,248,0.12)" : "var(--shadow-sm)",
          transition: "border-color 0.18s, box-shadow 0.18s",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          opacity: disabled ? 0.6 : 1,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {selectedOption?.icon && <span>{selectedOption.icon}</span>}
          {selectedOption?.color && (
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: selectedOption.color, flexShrink: 0,
            }} />
          )}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            minWidth: 180,
            background: "var(--surface)",
            border: "1.5px solid var(--border)",
            borderRadius: 10,
            boxShadow: "var(--shadow-md)",
            zIndex: 9999,
            overflow: "hidden",
          }}
        >
          {searchable && (
            <div style={{ padding: "8px 8px 4px" }}>
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  fontSize: 12,
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 7,
                  color: "var(--text)",
                  fontFamily: "var(--font-sans)",
                  cursor: "text",
                }}
              />
            </div>
          )}
          <div style={{ maxHeight: 220, overflowY: "auto", padding: "4px 0" }}>
            {filtered.length === 0 && !showCreate ? (
              <div style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-muted)" }}>
                Aucun résultat
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "9px 14px",
                    fontSize: 13,
                    color: opt.value === value ? "var(--accent)" : "var(--text)",
                    background: opt.value === value ? "rgba(59,126,248,0.07)" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.1s",
                    fontFamily: "var(--font-sans)",
                  }}
                  onMouseEnter={(e) => {
                    if (opt.value !== value)
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--surface2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      opt.value === value ? "rgba(59,126,248,0.07)" : "transparent";
                  }}
                >
                  {opt.icon && <span style={{ fontSize: 14 }}>{opt.icon}</span>}
                  {opt.color && (
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: opt.color, flexShrink: 0,
                    }} />
                  )}
                  <span style={{ flex: 1 }}>{opt.label}</span>
                  {opt.value === value && (
                    <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: "auto" }}>✓</span>
                  )}
                </button>
              ))
            )}
            {showCreate && (
              <button
                type="button"
                onClick={handleCreateOption}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "9px 14px",
                  fontSize: 13,
                  color: "var(--accent)",
                  background: "transparent",
                  borderTop: filtered.length > 0 ? "1px solid var(--border)" : "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(59,126,248,0.07)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                + Créer &ldquo;{search.trim()}&rdquo;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
