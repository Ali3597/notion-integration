"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DatePicker } from "@/components/DatePicker";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";

type Birthday = {
  id: string;
  name: string;
  birth_date: string;
  year_known: boolean;
  note: string | null;
  created_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getNextOccurrence(birthDate: string): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [, monthStr, dayStr] = birthDate.split("-");
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);
  const thisYear = new Date(today.getFullYear(), month, day);
  if (thisYear >= today) return thisYear;
  return new Date(today.getFullYear() + 1, month, day);
}

function getDaysUntil(birthDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((getNextOccurrence(birthDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatBirthDate(birthDate: string, yearKnown: boolean): string {
  const [year, monthStr, dayStr] = birthDate.split("-");
  const d = new Date(parseInt(year), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
  const dayLabel = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return yearKnown ? `${dayLabel} ${year}` : dayLabel;
}

function getAge(birthDate: string, yearKnown: boolean): number | null {
  if (!yearKnown) return null;
  const [year] = birthDate.split("-").map(Number);
  return getNextOccurrence(birthDate).getFullYear() - year;
}

function sortBirthdays(a: Birthday, b: Birthday): number {
  return getNextOccurrence(a.birth_date).getTime() - getNextOccurrence(b.birth_date).getTime();
}

const AVATAR_COLORS = [
  "#3b7ef8", "#e84f7b", "#f59e0b", "#10b981",
  "#8b5cf6", "#ef4444", "#06b6d4", "#f97316",
];

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ name, color, size = 46 }: { name: string; color: string; size?: number }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `${color}18`,
      border: `2.5px solid ${color}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.round(size * 0.36), fontWeight: 700, color,
      flexShrink: 0, letterSpacing: "-0.02em", userSelect: "none",
    }}>
      {initials}
    </div>
  );
}

function DaysBadge({ days }: { days: number }) {
  if (days === 0) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: "linear-gradient(135deg, #dc2626 0%, #f87171 100%)",
        color: "white", borderRadius: 20, padding: "5px 13px",
        fontSize: 11, fontWeight: 700,
        boxShadow: "0 3px 10px rgba(220,38,38,0.35)",
        letterSpacing: "0.01em", whiteSpace: "nowrap",
      }}>
        🎂 Aujourd&apos;hui !
      </span>
    );
  }
  if (days === 1) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: "linear-gradient(135deg, #e07b4e 0%, #f59e0b 100%)",
        color: "white", borderRadius: 20, padding: "5px 13px",
        fontSize: 11, fontWeight: 700,
        boxShadow: "0 3px 10px rgba(224,123,78,0.3)",
        whiteSpace: "nowrap",
      }}>
        Demain 🥳
      </span>
    );
  }
  if (days <= 3) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        background: "#fff3e0", color: "#c2410c",
        border: "1.5px solid #fed7aa",
        borderRadius: 20, padding: "4px 12px",
        fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
      }}>
        Dans {days} jours
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        background: "#fefce8", color: "#92400e",
        border: "1.5px solid #fde68a",
        borderRadius: 20, padding: "4px 12px",
        fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
      }}>
        Dans {days} jours ✨
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: "var(--surface2)", color: "var(--text-muted)",
      borderRadius: 20, padding: "4px 10px",
      fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
    }}>
      {days < 60 ? `${days}j` : `${Math.round(days / 30)} mois`}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
      textTransform: "uppercase", color: "var(--text-muted)",
      padding: "4px 2px 8px", display: "flex", alignItems: "center", gap: 8,
    }}>
      <span>{children}</span>
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 14px", background: "var(--bg)",
        borderRadius: 10, border: "1.5px solid var(--border)",
        cursor: "pointer", userSelect: "none",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{label}</span>
      <div style={{
        width: 40, height: 22, borderRadius: 11,
        background: checked ? "var(--accent)" : "var(--surface2)",
        position: "relative", transition: "background 0.2s",
        flexShrink: 0, boxShadow: "inset 0 1px 2px rgba(0,0,0,0.08)",
      }}>
        <span style={{
          position: "absolute", top: 3,
          left: checked ? 21 : 3,
          width: 16, height: 16, borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 4px rgba(0,0,0,0.22)",
          transition: "left 0.2s",
          display: "block",
        }} />
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BirthdaysPage() {
  useDynamicFavicon("🎂");

  const [items, setItems] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Birthday | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredDeleteId, setHoveredDeleteId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formYearKnown, setFormYearKnown] = useState(true);
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Anniversaires — life×hub";
    fetch("/api/birthdays")
      .then((r) => r.json())
      .then((d) => { setItems(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditItem(null);
    setFormName("");
    setFormDate(toLocalDateStr(new Date()));
    setFormYearKnown(true);
    setFormNote("");
    setModalOpen(true);
  }

  function openEdit(item: Birthday) {
    setEditItem(item);
    setFormName(item.name);
    setFormDate(item.birth_date);
    setFormYearKnown(item.year_known);
    setFormNote(item.note || "");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formDate) return;
    setSaving(true);
    let date = formDate;
    if (!formYearKnown) {
      const parts = formDate.split("-");
      date = `1900-${parts[1]}-${parts[2]}`;
    }
    const body = { name: formName.trim(), birth_date: date, year_known: formYearKnown, note: formNote || null };
    try {
      if (editItem) {
        const r = await fetch(`/api/birthdays?id=${editItem.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const updated = await r.json();
        setItems((prev) => [...prev.map((i) => (i.id === editItem.id ? updated : i))].sort(sortBirthdays));
      } else {
        const r = await fetch("/api/birthdays", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const created = await r.json();
        setItems((prev) => [...prev, created].sort(sortBirthdays));
      }
      setModalOpen(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet anniversaire ?")) return;
    await fetch(`/api/birthdays?id=${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
    setModalOpen(false);
  }

  const soonItems = items.filter((i) => getDaysUntil(i.birth_date) <= 7);
  const laterItems = items.filter((i) => getDaysUntil(i.birth_date) > 7);
  const nextDays = items.length > 0 ? getDaysUntil(items[0].birth_date) : null;

  function renderCard(item: Birthday) {
    const days = getDaysUntil(item.birth_date);
    const isToday = days === 0;
    const isSoon = days <= 7;
    const age = getAge(item.birth_date, item.year_known);
    const color = nameToColor(item.name);
    const isHovered = hoveredId === item.id;

    return (
      <div
        key={item.id}
        onClick={() => openEdit(item)}
        onMouseEnter={() => setHoveredId(item.id)}
        onMouseLeave={() => setHoveredId(null)}
        className="clickable-row"
        style={{
          background: isToday
            ? "linear-gradient(135deg, #fffbeb 0%, #fff7f0 100%)"
            : isSoon
            ? "rgba(224,123,78,0.04)"
            : "var(--surface)",
          border: `1.5px solid ${isToday ? "#fde68a" : isSoon ? "rgba(224,123,78,0.25)" : "var(--border)"}`,
          borderRadius: 14,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          cursor: "pointer",
          transition: "box-shadow 0.15s, border-color 0.15s",
          boxShadow: isHovered ? "var(--shadow-md)" : "var(--shadow-sm)",
          ...(isToday ? { borderLeft: `4px solid #f59e0b` } : {}),
        }}
      >
        {/* Avatar */}
        <Avatar name={item.name} color={color} />

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.name}
            </span>
            {age !== null && (
              <span style={{
                fontSize: 12, fontWeight: 600, color: "white",
                background: color + "cc",
                borderRadius: 20, padding: "1px 8px",
                flexShrink: 0,
              }}>
                {age} ans
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>{formatBirthDate(item.birth_date, item.year_known)}</span>
            {item.note && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.note}</span>
              </>
            )}
          </div>
        </div>

        {/* Badge + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <DaysBadge days={days} />
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
            onMouseEnter={(e) => { e.stopPropagation(); setHoveredDeleteId(item.id); }}
            onMouseLeave={(e) => { e.stopPropagation(); setHoveredDeleteId(null); }}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: hoveredDeleteId === item.id ? "#fef2f2" : "transparent",
              border: `1.5px solid ${hoveredDeleteId === item.id ? "#fca5a5" : "transparent"}`,
              color: hoveredDeleteId === item.id ? "var(--red)" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              transition: "background 0.15s, border-color 0.15s, color 0.15s",
              opacity: isHovered ? 1 : 0,
            }}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    );
  }

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "32px 24px" }}>


      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", margin: "20px 0 28px" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", margin: 0, letterSpacing: "-0.02em" }}>
            🎂 Anniversaires
          </h1>
          {!loading && items.length > 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 5 }}>
              {items.length} personne{items.length > 1 ? "s" : ""}
              {nextDays !== null && (
                nextDays === 0
                  ? <> · <span style={{ color: "var(--red)", fontWeight: 600 }}>🎂 Anniversaire aujourd&apos;hui !</span></>
                  : <> · Prochain dans <span style={{ color: "var(--text)", fontWeight: 600 }}>{nextDays} jour{nextDays > 1 ? "s" : ""}</span></>
              )}
            </p>
          )}
        </div>
        <button
          onClick={openCreate}
          className="btn-primary"
          style={{
            padding: "9px 18px", borderRadius: 10,
            background: "var(--accent)", color: "white",
            fontSize: 13, fontWeight: 600, border: "none",
            cursor: "pointer", fontFamily: "var(--font-sans)",
            boxShadow: "0 2px 8px rgba(59,126,248,0.28)",
            transition: "filter 0.15s, transform 0.15s, box-shadow 0.15s",
            flexShrink: 0,
          }}
        >
          + Ajouter
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: 76, borderRadius: 14, background: "var(--surface2)", opacity: 0.7, animation: "skeletonPulse 1.4s ease-in-out infinite" }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🎂</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Aucun anniversaire enregistré</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Ajoutez les anniversaires de vos proches pour ne plus les oublier.</p>
          <button
            onClick={openCreate}
            className="btn-primary"
            style={{
              padding: "10px 22px", borderRadius: 10,
              background: "var(--accent)", color: "white",
              fontSize: 14, fontWeight: 600, border: "none",
              cursor: "pointer", fontFamily: "var(--font-sans)",
              boxShadow: "0 2px 8px rgba(59,126,248,0.28)",
            }}
          >
            + Ajouter le premier
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {soonItems.length > 0 && (
            <>
              <SectionLabel>🔥 Cette semaine</SectionLabel>
              {soonItems.map(renderCard)}
            </>
          )}
          {laterItems.length > 0 && (
            <>
              {soonItems.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <SectionLabel>À venir</SectionLabel>
                </div>
              )}
              {laterItems.map(renderCard)}
            </>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(2px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div style={{
            background: "var(--surface)", borderRadius: 18,
            width: 480, maxWidth: "92vw",
            boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.1)",
          }}>
            {/* Modal header */}
            <div style={{
              padding: "22px 28px 18px",
              borderBottom: "1.5px solid var(--border)",
              display: "flex", alignItems: "center", gap: 12,
              borderRadius: "18px 18px 0 0",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(135deg, #fde68a, #fbbf24)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0,
              }}>
                🎂
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                  {editItem ? "Modifier l'anniversaire" : "Ajouter un anniversaire"}
                </h2>
                {editItem && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>{editItem.name}</p>
                )}
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  marginLeft: "auto", width: 30, height: 30, borderRadius: 8,
                  background: "var(--surface2)", border: "none",
                  color: "var(--text-muted)", cursor: "pointer",
                  fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "22px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Name */}
              <div>
                <label style={labelStyle}>Nom *</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Prénom ou nom de la personne"
                  style={{
                    ...inputStyle,
                    borderColor: focusedField === "name" ? "var(--accent)" : "var(--border)",
                    boxShadow: focusedField === "name" ? "0 0 0 3px rgba(59,126,248,0.15)" : "none",
                  }}
                  autoFocus
                />
              </div>

              {/* Year known toggle */}
              <ToggleSwitch
                checked={formYearKnown}
                onChange={setFormYearKnown}
                label="Année de naissance connue"
              />

              {/* Date */}
              <div>
                <label style={labelStyle}>
                  {formYearKnown ? "Date de naissance *" : "Jour et mois *"}
                </label>
                <DatePicker
                  value={formDate}
                  onChange={(v) => setFormDate(v || "")}
                  placeholder="Sélectionner une date"
                />
                {!formYearKnown && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
                    L&apos;année sélectionnée sera ignorée — seuls le jour et le mois comptent.
                  </p>
                )}
              </div>

              {/* Note */}
              <div>
                <label style={labelStyle}>Note <span style={{ textTransform: "none", fontWeight: 400 }}>(optionnel)</span></label>
                <input
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  onFocus={() => setFocusedField("note")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Ex : Meilleur ami, collègue…"
                  style={{
                    ...inputStyle,
                    borderColor: focusedField === "note" ? "var(--accent)" : "var(--border)",
                    boxShadow: focusedField === "note" ? "0 0 0 3px rgba(59,126,248,0.15)" : "none",
                  }}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div style={{
              padding: "16px 28px 22px",
              borderTop: "1.5px solid var(--border)",
              display: "flex", alignItems: "center", gap: 10,
              borderRadius: "0 0 18px 18px",
            }}>
              {/* Danger zone left */}
              {editItem && (
                <button
                  onClick={() => handleDelete(editItem.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 9,
                    background: "#fef2f2", border: "1.5px solid #fca5a5",
                    color: "var(--red)", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", fontFamily: "var(--font-sans)",
                    transition: "background 0.15s",
                  }}
                >
                  <TrashIcon />
                  Supprimer
                </button>
              )}

              {/* Right buttons */}
              <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                <button
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: "8px 16px", borderRadius: 9,
                    background: "var(--surface2)", border: "1.5px solid var(--border)",
                    color: "var(--text-muted)", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", fontFamily: "var(--font-sans)",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formName.trim() || !formDate}
                  className="btn-primary"
                  style={{
                    padding: "8px 20px", borderRadius: 9,
                    background: saving || !formName.trim() || !formDate ? "var(--surface2)" : "var(--accent)",
                    color: saving || !formName.trim() || !formDate ? "var(--text-muted)" : "white",
                    border: "none", fontSize: 13, fontWeight: 600,
                    cursor: saving || !formName.trim() || !formDate ? "not-allowed" : "pointer",
                    fontFamily: "var(--font-sans)",
                    boxShadow: saving || !formName.trim() || !formDate ? "none" : "0 2px 8px rgba(59,126,248,0.3)",
                    transition: "background 0.15s, box-shadow 0.15s",
                  }}
                >
                  {saving ? "Enregistrement…" : editItem ? "Mettre à jour" : "Ajouter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  marginBottom: 7,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: 9,
  border: "1.5px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 14,
  fontFamily: "var(--font-sans)",
  boxSizing: "border-box",
  transition: "border-color 0.15s, box-shadow 0.15s",
  outline: "none",
};
