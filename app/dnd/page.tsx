"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";
import { CustomSelect } from "@/components/CustomSelect";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
  PieChart, Pie, Legend,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "character" | "spells" | "equipment" | "objectives" | "sessions" | "companions" | "stats";
const VALID_TABS: Tab[] = ["character", "spells", "equipment", "objectives", "sessions", "companions", "stats"];

type DndCharacter = {
  id: string;
  name: string;
  class: string | null;
  subclass: string | null;
  race: string | null;
  level: number | null;
  background: string | null;
  alignment: string | null;
  avatar_url: string | null;
  backstory: string | null;
  personality: string | null;
  ideals: string | null;
  bonds: string | null;
  flaws: string | null;
  hp_max: number | null;
  hp_current: number | null;
  ac: number | null;
  speed: number | null;
  proficiency_bonus: number | null;
  force: number | null;
  dexterite: number | null;
  constitution: number | null;
  intelligence: number | null;
  sagesse: number | null;
  charisme: number | null;
  spell_save_dc: number | null;
  spell_attack_bonus: number | null;
  spells_prepared_per_day: number | null;
  skill_proficiencies: string | null; // JSON string[]
  save_proficiencies: string | null; // JSON string[]
  special_abilities: string | null; // JSON {id,name,description}[]
};

type DndSpell = {
  id: string;
  name: string;
  level: number;
  school: string | null;
  casting_time: string | null;
  range: string | null;
  components: string | null;
  duration: string | null;
  description: string | null;
  url: string | null;
  prepared: boolean | null;
};

type DndEquipment = {
  id: string;
  name: string;
  type: string | null;
  description: string | null;
  magical: boolean | null;
  equipped: boolean | null;
  quantity: number | null;
  notes: string | null;
};

type DndObjective = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string | null;
  notes: string | null;
};

type DndSession = {
  id: string;
  title: string;
  session_date: string;
  session_time: string | null;
  status: string | null;
  summary: string | null;
  notes: string | null;
  level_at_session: number | null;
  journal: string | null;
};

type DndCompanion = {
  id: string;
  name: string;
  class: string | null;
  race: string | null;
  level: number | null;
  player_name: string | null;
  description: string | null;
  personality: string | null;
  backstory: string | null;
  relationship: string | null;
  notes: string | null;
  avatar_url: string | null;
  is_companion: boolean | null;
};

// ── Spell slot table (Wizard, PHB) ────────────────────────────────────────────
const SPELL_SLOTS: Record<number, number[]> = {
  1:  [2,0,0,0,0,0,0,0,0],
  2:  [3,2,0,0,0,0,0,0,0],
  3:  [4,3,2,0,0,0,0,0,0],
  4:  [4,3,3,1,0,0,0,0,0],
  5:  [4,3,3,2,1,0,0,0,0],
  6:  [4,3,3,3,1,1,0,0,0],
  7:  [4,3,3,3,2,1,1,0,0],
  8:  [4,3,3,3,2,2,1,1,0],
  9:  [4,3,3,3,2,2,1,1,1],
  10: [4,3,3,3,2,2,2,1,1],
  20: [4,3,3,3,2,2,2,1,1],
};

function getSlotsForLevel(level: number): number[] {
  const key = Object.keys(SPELL_SLOTS).map(Number).filter(k => k <= level).sort((a,b) => b-a)[0] ?? 1;
  return SPELL_SLOTS[key];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statMod(val: number | null): string {
  if (val === null) return "—";
  const mod = Math.floor((val - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function hpColor(current: number, max: number): string {
  const pct = current / max;
  if (pct > 0.6) return "#22c55e";
  if (pct > 0.3) return "#f59e0b";
  return "#ef4444";
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("fr-FR", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DndPage() {
  useDynamicFavicon("🎲");
  useEffect(() => { document.title = "D&D — life×hub"; }, []);

  const [tab, setTab] = useState<Tab>("character");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("tab") as Tab;
    if (VALID_TABS.includes(p)) setTab(p);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }, [tab]);

  // Data states
  const [character, setCharacter] = useState<DndCharacter | null>(null);
  const [spells, setSpells] = useState<DndSpell[]>([]);
  const [equipment, setEquipment] = useState<DndEquipment[]>([]);
  const [objectives, setObjectives] = useState<DndObjective[]>([]);
  const [sessions, setSessions] = useState<DndSession[]>([]);
  const [companions, setCompanions] = useState<DndCompanion[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);

  // Load all data
  const loadAll = useCallback(async () => {
    const [ch, sp, eq, ob, se, co] = await Promise.all([
      fetch("/api/dnd/character").then(r => r.json()),
      fetch("/api/dnd/spells").then(r => r.json()),
      fetch("/api/dnd/equipment").then(r => r.json()),
      fetch("/api/dnd/objectives").then(r => r.json()),
      fetch("/api/dnd/sessions").then(r => r.json()),
      fetch("/api/dnd/companions").then(r => r.json()),
    ]);
    setCharacter(ch);
    setSpells(Array.isArray(sp) ? sp : []);
    setEquipment(Array.isArray(eq) ? eq : []);
    setObjectives(Array.isArray(ob) ? ob : []);
    setSessions(Array.isArray(se) ? se : []);
    setCompanions(Array.isArray(co) ? co : []);
    setLoading(false);
    return ch;
  }, []);

  useEffect(() => {
    loadAll().then(async (ch) => {
      if (!ch && !seeded) {
        setSeeded(true);
        await fetch("/api/dnd/seed", { method: "POST" });
        await loadAll();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const TAB_LABELS: { key: Tab; label: string }[] = [
    { key: "character", label: "Personnage" },
    { key: "spells", label: "Sorts" },
    { key: "equipment", label: "Équipement" },
    { key: "objectives", label: "Quêtes" },
    { key: "sessions", label: "Sessions" },
    { key: "companions", label: "Personnages" },
    { key: "stats", label: "Statistiques" },
  ];

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      <Link href="/" className="btn-back">← Accueil</Link>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 24px" }}>
        <span style={{ fontSize: 28 }}>🎲</span>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>D&amp;D</h1>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Fiche de personnage, sorts, quêtes et sessions</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1.5px solid var(--border)", marginBottom: 28 }}>
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: tab === key ? 600 : 400,
              color: tab === key ? "var(--accent)" : "var(--text-muted)",
              background: "none",
              border: "none",
              borderBottom: tab === key ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1.5,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              transition: "color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)", fontSize: 14 }}>
          Chargement…
        </div>
      ) : (
        <>
          {tab === "character" && <CharacterTab character={character} onUpdate={setCharacter} />}
          {tab === "spells" && <SpellsTab spells={spells} setSpells={setSpells} character={character} onCharacterUpdate={setCharacter} />}
          {tab === "equipment" && <EquipmentTab equipment={equipment} setEquipment={setEquipment} />}
          {tab === "objectives" && <ObjectivesTab objectives={objectives} setObjectives={setObjectives} />}
          {tab === "sessions" && <SessionsTab sessions={sessions} setSessions={setSessions} character={character} />}
          {tab === "companions" && <CompanionsTab companions={companions} setCompanions={setCompanions} />}
          {tab === "stats" && <StatsTab sessions={sessions} spells={spells} objectives={objectives} character={character} />}
        </>
      )}
    </main>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1 — PERSONNAGE
// ══════════════════════════════════════════════════════════════════════════════

// ── Compétences ───────────────────────────────────────────────────────────────

const SKILLS: { name: string; stat: keyof DndCharacter; abbr: string }[] = [
  { name: "Acrobaties",     stat: "dexterite",    abbr: "DEX" },
  { name: "Arcanes",        stat: "intelligence", abbr: "INT" },
  { name: "Athlétisme",     stat: "force",        abbr: "FOR" },
  { name: "Discrétion",     stat: "dexterite",    abbr: "DEX" },
  { name: "Dressage",       stat: "sagesse",      abbr: "SAG" },
  { name: "Escamotage",     stat: "dexterite",    abbr: "DEX" },
  { name: "Histoire",       stat: "intelligence", abbr: "INT" },
  { name: "Intimidation",   stat: "charisme",     abbr: "CHA" },
  { name: "Investigation",  stat: "intelligence", abbr: "INT" },
  { name: "Médecine",       stat: "sagesse",      abbr: "SAG" },
  { name: "Nature",         stat: "intelligence", abbr: "INT" },
  { name: "Perception",     stat: "sagesse",      abbr: "SAG" },
  { name: "Perspicacité",   stat: "sagesse",      abbr: "SAG" },
  { name: "Persuasion",     stat: "charisme",     abbr: "CHA" },
  { name: "Religion",       stat: "intelligence", abbr: "INT" },
  { name: "Représentation", stat: "charisme",     abbr: "CHA" },
  { name: "Survie",         stat: "sagesse",      abbr: "SAG" },
  { name: "Tromperie",      stat: "charisme",     abbr: "CHA" },
];

function SkillsBlock({ local, set }: { local: DndCharacter; set: (field: keyof DndCharacter, value: unknown) => void }) {
  const profBonus = local.proficiency_bonus ?? 0;
  const proficiencies: string[] = (() => {
    try { return JSON.parse(local.skill_proficiencies ?? "[]"); } catch { return []; }
  })();

  const toggle = (skillName: string) => {
    const next = proficiencies.includes(skillName)
      ? proficiencies.filter(s => s !== skillName)
      : [...proficiencies, skillName];
    set("skill_proficiencies", JSON.stringify(next));
  };

  return (
    <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
        Compétences
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {SKILLS.map(({ name, stat, abbr }) => {
          const base = Math.floor(((local[stat] as number | null) ?? 10) - 10) / 2;
          const proficient = proficiencies.includes(name);
          const total = Math.floor(base) + (proficient ? profBonus : 0);
          const sign = total >= 0 ? "+" : "";
          return (
            <div
              key={name}
              onClick={() => toggle(name)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "4px 6px", borderRadius: 6, cursor: "pointer",
                background: proficient ? "rgba(59,126,248,0.06)" : "transparent",
                transition: "background 0.12s",
              }}
              title={proficient ? "Cliquer pour retirer la maîtrise" : "Cliquer pour ajouter la maîtrise"}
            >
              {/* Indicateur maîtrise */}
              <span style={{
                width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                background: proficient ? "var(--accent)" : "transparent",
                border: `1.5px solid ${proficient ? "var(--accent)" : "var(--border)"}`,
                transition: "background 0.15s",
              }} />
              {/* Modificateur */}
              <span style={{
                width: 30, textAlign: "right", fontFamily: "var(--font-mono)",
                fontSize: 12, fontWeight: 700,
                color: total > 0 ? "var(--accent)" : total < 0 ? "#ef4444" : "var(--text-muted)",
                flexShrink: 0,
              }}>
                {sign}{total}
              </span>
              {/* Nom */}
              <span style={{ fontSize: 13, color: "var(--text)", fontWeight: proficient ? 600 : 400, flex: 1 }}>
                {name}
              </span>
              {/* Stat source */}
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {abbr}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SAVES: { name: string; stat: keyof DndCharacter; abbr: string }[] = [
  { name: "Force",         stat: "force",        abbr: "FOR" },
  { name: "Dextérité",     stat: "dexterite",    abbr: "DEX" },
  { name: "Constitution",  stat: "constitution", abbr: "CON" },
  { name: "Intelligence",  stat: "intelligence", abbr: "INT" },
  { name: "Sagesse",       stat: "sagesse",      abbr: "SAG" },
  { name: "Charisme",      stat: "charisme",     abbr: "CHA" },
];

function SavesBlock({ local, set }: { local: DndCharacter; set: (field: keyof DndCharacter, value: unknown) => void }) {
  const profBonus = local.proficiency_bonus ?? 0;
  const proficiencies: string[] = (() => {
    try { return JSON.parse(local.save_proficiencies ?? "[]"); } catch { return []; }
  })();

  const toggle = (name: string) => {
    const next = proficiencies.includes(name)
      ? proficiencies.filter(s => s !== name)
      : [...proficiencies, name];
    set("save_proficiencies", JSON.stringify(next));
  };

  return (
    <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
        Jets de sauvegarde
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {SAVES.map(({ name, stat, abbr }) => {
          const base = Math.floor(((local[stat] as number | null) ?? 10) - 10) / 2;
          const proficient = proficiencies.includes(name);
          const total = Math.floor(base) + (proficient ? profBonus : 0);
          const sign = total >= 0 ? "+" : "";
          return (
            <div
              key={name}
              onClick={() => toggle(name)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "4px 6px", borderRadius: 6, cursor: "pointer",
                background: proficient ? "rgba(59,126,248,0.06)" : "transparent",
                transition: "background 0.12s",
              }}
              title={proficient ? "Cliquer pour retirer la maîtrise" : "Cliquer pour ajouter la maîtrise"}
            >
              <span style={{
                width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                background: proficient ? "var(--accent)" : "transparent",
                border: `1.5px solid ${proficient ? "var(--accent)" : "var(--border)"}`,
                transition: "background 0.15s",
              }} />
              <span style={{
                width: 30, textAlign: "right", fontFamily: "var(--font-mono)",
                fontSize: 12, fontWeight: 700,
                color: total > 0 ? "var(--accent)" : total < 0 ? "#ef4444" : "var(--text-muted)",
                flexShrink: 0,
              }}>
                {sign}{total}
              </span>
              <span style={{ fontSize: 13, color: "var(--text)", fontWeight: proficient ? 600 : 400, flex: 1 }}>
                {name}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {abbr}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Special Abilities Block ────────────────────────────────────────────────────

type SpecialAbility = { id: string; name: string; description: string };

function SpecialAbilitiesBlock({ abilities, onChange }: { abilities: string | null; onChange: (val: string) => void }) {
  const list: SpecialAbility[] = (() => { try { return JSON.parse(abilities ?? "[]"); } catch { return []; } })();

  const update = (next: SpecialAbility[]) => onChange(JSON.stringify(next));

  const add = () => {
    const newId = Date.now().toString();
    update([...list, { id: newId, name: "", description: "" }]);
  };

  const remove = (id: string) => update(list.filter(a => a.id !== id));

  const edit = (id: string, field: "name" | "description", value: string) =>
    update(list.map(a => a.id === id ? { ...a, [field]: value } : a));

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "var(--bg)", border: "1px solid var(--border)",
    borderRadius: 6, padding: "5px 8px", fontSize: 13, color: "var(--text)",
    outline: "none", fontFamily: "var(--font-sans)",
  };

  return (
    <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Capacités spéciales
        </div>
        <button
          onClick={add}
          style={{ fontSize: 12, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 4 }}
        >
          + Ajouter
        </button>
      </div>

      {list.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Aucune capacité spéciale.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map((ability) => (
          <div key={ability.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <input
                value={ability.name}
                onChange={e => edit(ability.id, "name", e.target.value)}
                placeholder="Nom de la capacité…"
                style={{ ...inputStyle, fontWeight: 600, fontSize: 13, flex: 1 }}
              />
              <button
                onClick={() => remove(ability.id)}
                title="Supprimer"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}
              >
                ×
              </button>
            </div>
            <textarea
              value={ability.description}
              onChange={e => edit(ability.id, "description", e.target.value)}
              placeholder="Description…"
              rows={2}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CharacterTab({ character, onUpdate }: { character: DndCharacter | null; onUpdate: (c: DndCharacter) => void }) {
  const [local, setLocal] = useState<DndCharacter | null>(character);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocal(character); }, [character]);

  const save = useCallback((updated: DndCharacter) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch("/api/dnd/character", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) });
      const data = await res.json();
      onUpdate(data);
    }, 1500);
  }, [onUpdate]);

  const set = (field: keyof DndCharacter, value: unknown) => {
    setLocal(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      save(updated as DndCharacter);
      return updated as DndCharacter;
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/dnd/character/avatar", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json();
      setLocal(prev => prev ? { ...prev, avatar_url: url } : prev);
      onUpdate({ ...local!, avatar_url: url });
    }
  };

  if (!local) return <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Chargement du personnage…</div>;

  const hp = local.hp_current ?? 0;
  const hpMax = local.hp_max ?? 1;
  const hpPct = Math.max(0, Math.min(100, (hp / hpMax) * 100));

  const STATS: { key: keyof DndCharacter; label: string; abbr: string }[] = [
    { key: "force", label: "Force", abbr: "FOR" },
    { key: "dexterite", label: "Dextérité", abbr: "DEX" },
    { key: "constitution", label: "Constitution", abbr: "CON" },
    { key: "intelligence", label: "Intelligence", abbr: "INT" },
    { key: "sagesse", label: "Sagesse", abbr: "SAG" },
    { key: "charisme", label: "Charisme", abbr: "CHA" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 28 }}>
      {/* ── Colonne gauche ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Avatar */}
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20, textAlign: "center" }}>
          <div
            onClick={() => avatarInputRef.current?.click()}
            style={{
              width: 120, height: 120, borderRadius: "50%", margin: "0 auto 12px",
              background: local.avatar_url ? "transparent" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              overflow: "hidden", cursor: "pointer", border: "3px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36, color: "#fff", fontWeight: 700,
              position: "relative",
            }}
            title="Cliquer pour changer l'image"
          >
            {local.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={local.avatar_url} alt={local.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              local.name?.[0]?.toUpperCase() ?? "M"
            )}
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{local.name}</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 2 }}>
            {local.class}{local.subclass ? ` — ${local.subclass}` : ""} · Niveau {local.level}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{local.race}{local.background ? ` · ${local.background}` : ""}</div>
          <button
            onClick={() => avatarInputRef.current?.click()}
            style={{ marginTop: 12, fontSize: 11, padding: "5px 12px", borderRadius: 20, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font-sans)" }}
          >
            Changer l&apos;image
          </button>
        </div>

        {/* Stats */}
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>Caractéristiques</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {STATS.map(({ key, label, abbr }) => {
              const val = local[key] as number | null;
              return (
                <div key={key} style={{ background: "var(--surface2)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>{abbr}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>
                    <input
                      type="number"
                      value={val ?? ""}
                      onChange={e => set(key, e.target.value === "" ? null : parseInt(e.target.value, 10))}
                      style={{ width: 72, textAlign: "center", fontSize: 20, fontWeight: 700, background: "none", border: "none", color: "var(--text)", fontFamily: "var(--font-sans)", cursor: "text" }}
                    />
                  </div>
                  <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>{statMod(val)}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PV / CA / Vitesse */}
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>Combat</div>

          {/* PV bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Points de vie</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number"
                  value={local.hp_current ?? ""}
                  onChange={e => set("hp_current", e.target.value === "" ? null : parseInt(e.target.value, 10))}
                  style={{ width: 44, textAlign: "center", fontSize: 13, fontWeight: 600, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontFamily: "var(--font-sans)", padding: "2px 4px", cursor: "text" }}
                />
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>/</span>
                <input
                  type="number"
                  value={local.hp_max ?? ""}
                  onChange={e => set("hp_max", e.target.value === "" ? null : parseInt(e.target.value, 10))}
                  style={{ width: 44, textAlign: "center", fontSize: 13, fontWeight: 600, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontFamily: "var(--font-sans)", padding: "2px 4px", cursor: "text" }}
                />
              </div>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--surface2)", overflow: "hidden" }}>
              <div style={{ width: `${hpPct}%`, height: "100%", background: hpColor(hp, hpMax), borderRadius: 4, transition: "width 0.3s, background 0.3s" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { key: "ac" as keyof DndCharacter, label: "CA" },
              { key: "speed" as keyof DndCharacter, label: "Vitesse" },
              { key: "proficiency_bonus" as keyof DndCharacter, label: "Maîtrise" },
            ].map(({ key, label }) => (
              <div key={key} style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px", textAlign: "center" }}>
                <input
                  type="number"
                  value={(local[key] as number | null) ?? ""}
                  onChange={e => set(key, e.target.value === "" ? null : parseInt(e.target.value, 10))}
                  style={{ width: "100%", textAlign: "center", fontSize: 18, fontWeight: 700, background: "none", border: "none", color: "var(--text)", fontFamily: "var(--font-sans)", cursor: "text" }}
                />
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

      {/* Jets de sauvegarde */}
      <SavesBlock local={local} set={set} />

      {/* Compétences */}
      <SkillsBlock local={local} set={set} />
      </div>{/* fin colonne gauche */}

      {/* ── Colonne droite ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Infos de base */}
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>Informations</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { key: "race" as keyof DndCharacter, label: "Race" },
              { key: "alignment" as keyof DndCharacter, label: "Alignement" },
              { key: "background" as keyof DndCharacter, label: "Historique" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{label}</label>
                <input
                  value={(local[key] as string | null) ?? ""}
                  onChange={e => set(key, e.target.value || null)}
                  style={inputStyle}
                  placeholder={`— ${label} —`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Histoire */}
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>Histoire du personnage</div>
          <textarea
            value={local.backstory ?? ""}
            onChange={e => {
              set("backstory", e.target.value || null);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            ref={el => {
              if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
            }}
            placeholder="Histoire et contexte du personnage…"
            style={{ ...textareaStyle, minHeight: 120, resize: "none", overflow: "hidden" }}
          />
        </div>

        {/* Capacités spéciales */}
        <SpecialAbilitiesBlock abilities={local.special_abilities} onChange={val => set("special_abilities", val)} />

        {/* Traits */}
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>Traits de personnalité</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { key: "personality" as keyof DndCharacter, label: "Personnalité", placeholder: "Traits de caractère…" },
              { key: "ideals" as keyof DndCharacter, label: "Idéaux", placeholder: "Ce en quoi tu crois…" },
              { key: "bonds" as keyof DndCharacter, label: "Liens", placeholder: "Ce qui t'attache au monde…" },
              { key: "flaws" as keyof DndCharacter, label: "Défauts", placeholder: "Tes faiblesses…" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{label}</label>
                <textarea
                  value={(local[key] as string | null) ?? ""}
                  onChange={e => set(key, e.target.value || null)}
                  placeholder={placeholder}
                  style={{ ...textareaStyle, minHeight: 72 }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2 — SORTS
// ══════════════════════════════════════════════════════════════════════════════

function SpellsTab({ spells, setSpells, character, onCharacterUpdate }: { spells: DndSpell[]; setSpells: (s: DndSpell[] | ((prev: DndSpell[]) => DndSpell[])) => void; character: DndCharacter | null; onCharacterUpdate: (c: DndCharacter) => void }) {
  const [spellLevelFilter, setSpellLevelFilter] = useState<number | null>(null);
  const [popover, setPopover] = useState<{ spell: DndSpell; rect: DOMRect } | null>(null);
  const [popoverData, setPopoverData] = useState<DndSpell | null>(null);
  const [popoverLoading, setPopoverLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSpell, setNewSpell] = useState({ name: "", level: 0, url: "" });

  const charLevel = character?.level ?? 1;
  const slots = getSlotsForLevel(charLevel);

  const spellLevels = Array.from(new Set(spells.map(s => s.level))).sort((a, b) => a - b);
  const filtered = spellLevelFilter !== null ? spells.filter(s => s.level === spellLevelFilter) : spells;

  const handleSpellClick = async (spell: DndSpell, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ spell, rect });
    setPopoverData(null);

    if (spell.url) {
      setPopoverLoading(true);
      try {
        const res = await fetch(`/api/dnd/spells/fetch?url=${encodeURIComponent(spell.url)}`);
        const data = await res.json();
        setPopoverData(data);
        // Update spells cache — ne jamais écraser l'id pour éviter les doublons de clé
        const { id: _id, created_at: _ca, ...safeData } = data as DndSpell & { created_at?: unknown };
        setSpells(prev => prev.map(s => s.id === spell.id ? { ...s, ...safeData } : s));
      } catch {
        setPopoverData(spell);
      } finally {
        setPopoverLoading(false);
      }
    } else {
      setPopoverData(spell);
    }
  };

  const closePopover = useCallback(() => { setPopover(null); setPopoverData(null); }, []);

  useEffect(() => {
    if (!popover) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closePopover(); };
    const click = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".spell-popover")) closePopover();
    };
    document.addEventListener("keydown", handler);
    document.addEventListener("mousedown", click);
    return () => { document.removeEventListener("keydown", handler); document.removeEventListener("mousedown", click); };
  }, [popover, closePopover]);

  const togglePrepared = async (spell: DndSpell) => {
    const updated = { ...spell, prepared: !spell.prepared };
    setSpells(spells.map(s => s.id === spell.id ? updated : s));
    await fetch("/api/dnd/spells", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: spell.id, prepared: updated.prepared }) });
  };

  const deleteSpell = async (id: string) => {
    setSpells(spells.filter(s => s.id !== id));
    await fetch(`/api/dnd/spells?id=${id}`, { method: "DELETE" });
  };

  const addSpell = async () => {
    if (!newSpell.name.trim()) return;
    const res = await fetch("/api/dnd/spells", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newSpell) });
    const created = await res.json();
    setSpells([...spells, created].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)));
    setNewSpell({ name: "", level: 0, url: "" });
    setShowAddForm(false);
  };

  const spellDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveSpellStat = (field: keyof DndCharacter, value: number | null) => {
    if (!character) return;
    const updated = { ...character, [field]: value };
    onCharacterUpdate(updated);
    if (spellDebounceRef.current) clearTimeout(spellDebounceRef.current);
    spellDebounceRef.current = setTimeout(async () => {
      const res = await fetch("/api/dnd/character", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
      const data = await res.json();
      onCharacterUpdate(data);
    }, 1500);
  };

  return (
    <div>
      {/* Stats de lanceur de sorts */}
      <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>
          Statistiques de lanceur de sorts
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {([
            { label: "DD de sauvegarde", field: "spell_save_dc" as keyof DndCharacter, prefix: "" },
            { label: "Bonus d'attaque", field: "spell_attack_bonus" as keyof DndCharacter, prefix: "+" },
            { label: "Sorts préparés / jour", field: "spells_prepared_per_day" as keyof DndCharacter, prefix: "" },
          ] as { label: string; field: keyof DndCharacter; prefix: string }[]).map(({ label, field, prefix }) => {
            const val = character?.[field] as number | null | undefined;
            return (
              <div key={label} style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 20px", textAlign: "center", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                  {prefix && val !== null && val !== undefined && (
                    <span style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>{prefix}</span>
                  )}
                  <input
                    type="number"
                    value={val ?? ""}
                    onChange={e => saveSpellStat(field, e.target.value === "" ? null : parseInt(e.target.value, 10))}
                    style={{ width: 80, textAlign: "center", fontSize: 22, fontWeight: 700, background: "none", border: "none", color: "var(--accent)", fontFamily: "var(--font-sans)", cursor: "text" }}
                  />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Emplacements */}
      <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>
          Emplacements de sorts — Niveau {charLevel}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {slots.map((count, idx) => count > 0 && (
            <div key={idx} style={{ background: "var(--surface2)", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 56 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{count}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Niv. {idx + 1}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtres par niveau */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setSpellLevelFilter(null)} style={filterBtn(spellLevelFilter === null)}>Tous</button>
          {spellLevels.map(lvl => (
            <button key={lvl} onClick={() => setSpellLevelFilter(lvl)} style={filterBtn(spellLevelFilter === lvl)}>
              {lvl === 0 ? "Mineurs" : `Niv.${lvl}`}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} style={addBtnStyle}>+ Ajouter un sort</button>
      </div>

      {/* Formulaire ajout */}
      {showAddForm && (
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 2, minWidth: 160 }}>
              <label style={labelStyle}>Nom du sort</label>
              <input value={newSpell.name} onChange={e => setNewSpell(p => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="Ex: Boule de feu" />
            </div>
            <div style={{ minWidth: 80 }}>
              <label style={labelStyle}>Niveau</label>
              <input type="number" min={0} max={9} value={newSpell.level} onChange={e => setNewSpell(p => ({ ...p, level: parseInt(e.target.value) || 0 }))} style={inputStyle} />
            </div>
            <div style={{ flex: 3, minWidth: 200 }}>
              <label style={labelStyle}>URL aidedd.org</label>
              <input value={newSpell.url} onChange={e => setNewSpell(p => ({ ...p, url: e.target.value }))} style={inputStyle} placeholder="https://www.aidedd.org/dnd/sorts.php?vf=..." />
            </div>
            <button onClick={addSpell} style={{ ...addBtnStyle, height: 40, alignSelf: "flex-end" }}>Ajouter</button>
            <button onClick={() => setShowAddForm(false)} style={{ ...cancelBtnStyle, height: 40, alignSelf: "flex-end" }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Liste des sorts groupée */}
      {[...(spellLevelFilter !== null ? [spellLevelFilter] : spellLevels)].map(lvl => {
        const group = filtered.filter(s => s.level === lvl);
        if (group.length === 0) return null;
        return (
          <div key={lvl} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.05em" }}>
              {lvl === 0 ? "Sorts mineurs (tours de magie)" : `Sorts de niveau ${lvl}`}
              {lvl > 0 && slots[lvl - 1] > 0 && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400 }}>· {slots[lvl - 1]} emplacements</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {group.map(spell => (
                <div key={spell.id} style={{
                  background: "var(--surface)",
                  border: "1.5px solid var(--border)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  transition: "border-color 0.15s",
                }}>
                  <button
                    onClick={e => handleSpellClick(spell, e)}
                    style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, color: "var(--text)", fontFamily: "var(--font-sans)" }}
                  >
                    {spell.name}
                  </button>
                  {spell.school && <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--surface2)", padding: "2px 8px", borderRadius: 20 }}>{spell.school}</span>}
                  {spell.prepared && <span style={{ fontSize: 11, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}>Préparé</span>}
                  <button onClick={() => togglePrepared(spell)} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    {spell.prepared ? "Retirer" : "Préparer"}
                  </button>
                  {spell.url && (
                    <a href={spell.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: "var(--accent)", textDecoration: "none" }} title="Voir sur aidedd.org">↗</a>
                  )}
                  <button onClick={() => deleteSpell(spell.id)} style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 4 }} title="Supprimer">✕</button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Popover */}
      {popover && (
        <SpellPopover
          spell={popover.spell}
          data={popoverData}
          loading={popoverLoading}
          rect={popover.rect}
          onClose={closePopover}
        />
      )}
    </div>
  );
}

function SpellPopover({ spell, data, loading, rect, onClose }: {
  spell: DndSpell;
  data: DndSpell | null;
  loading: boolean;
  rect: DOMRect;
  onClose: () => void;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Position: above or below
  const spaceBelow = window.innerHeight - rect.bottom;
  const above = spaceBelow < 380;

  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(rect.left, window.innerWidth - 420),
    width: 400,
    background: "var(--surface)",
    border: "1.5px solid var(--border)",
    borderRadius: 14,
    boxShadow: "var(--shadow-md)",
    zIndex: 9999,
    padding: 20,
    ...(above
      ? { bottom: window.innerHeight - rect.top + 8 }
      : { top: rect.bottom + 8 }),
  };

  const info = data ?? spell;

  return (
    <div ref={popoverRef} className="spell-popover" style={style}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{info.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {info.level === 0 ? "Sort mineur" : `Sort de niveau ${info.level}`}
            {info.school ? ` — ${info.school}` : ""}
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--text-muted)", lineHeight: 1 }}>✕</button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>Chargement depuis aidedd.org…</div>
          <div style={{ width: 24, height: 24, border: "2.5px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
        </div>
      ) : (
        <>
          {(info.casting_time || info.range || info.components || info.duration) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14, background: "var(--surface2)", borderRadius: 8, padding: 10 }}>
              {[
                { label: "Incantation", value: info.casting_time },
                { label: "Portée", value: info.range },
                { label: "Composantes", value: info.components },
                { label: "Durée", value: info.duration },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--text)", marginTop: 1 }}>{value}</div>
                </div>
              ) : null)}
            </div>
          )}

          {info.description && (
            <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.6, maxHeight: 220, overflowY: "auto", whiteSpace: "pre-wrap" }}>
              {info.description}
            </div>
          )}

          {!info.description && !loading && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
              Cliquez sur ↗ pour voir la description complète sur aidedd.org.
            </div>
          )}

          {info.url && (
            <a href={info.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 12, fontSize: 12, color: "var(--accent)", textDecoration: "none", textAlign: "right" }}>
              Voir sur aidedd.org ↗
            </a>
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3 — ÉQUIPEMENT
// ══════════════════════════════════════════════════════════════════════════════

const EQUIPMENT_TYPE_ORDER = ["artefact", "arme", "armure", "consommable", "divers"];
const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  artefact: "Artefacts",
  arme: "Armes",
  armure: "Armures",
  consommable: "Consommables",
  divers: "Divers",
};

function EquipmentTab({ equipment, setEquipment }: { equipment: DndEquipment[]; setEquipment: (e: DndEquipment[]) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", type: "divers", description: "", magical: false, equipped: false, quantity: 1, notes: "" });

  const toggleEquipped = async (item: DndEquipment) => {
    const updated = { ...item, equipped: !item.equipped };
    setEquipment(equipment.map(e => e.id === item.id ? updated : e));
    await fetch("/api/dnd/equipment", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, equipped: updated.equipped }) });
  };

  const deleteItem = async (id: string) => {
    setEquipment(equipment.filter(e => e.id !== id));
    await fetch(`/api/dnd/equipment?id=${id}`, { method: "DELETE" });
  };

  const addItem = async () => {
    if (!newItem.name.trim()) return;
    const res = await fetch("/api/dnd/equipment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newItem) });
    const created = await res.json();
    setEquipment([...equipment, created]);
    setNewItem({ name: "", type: "divers", description: "", magical: false, equipped: false, quantity: 1, notes: "" });
    setShowAddForm(false);
  };

  const grouped = EQUIPMENT_TYPE_ORDER.map(type => ({
    type,
    items: equipment.filter(e => (e.type ?? "divers") === type),
  })).filter(g => g.items.length > 0);
  const ungrouped = equipment.filter(e => !EQUIPMENT_TYPE_ORDER.includes(e.type ?? "divers"));
  if (ungrouped.length > 0) grouped.push({ type: "divers", items: ungrouped });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setShowAddForm(!showAddForm)} style={addBtnStyle}>+ Ajouter un objet</button>
      </div>

      {showAddForm && (
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Nom</label>
              <input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="Nom de l'objet" />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <CustomSelect value={newItem.type} onChange={v => setNewItem(p => ({ ...p, type: v }))} options={["arme","armure","artefact","consommable","divers"].map(v => ({ value: v, label: EQUIPMENT_TYPE_LABELS[v] ?? v }))} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Description</label>
            <textarea value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} style={{ ...textareaStyle, minHeight: 64 }} placeholder="Description…" />
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
              <input type="checkbox" checked={newItem.magical} onChange={e => setNewItem(p => ({ ...p, magical: e.target.checked }))} style={{ cursor: "pointer" }} />
              Objet magique
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
              <input type="checkbox" checked={newItem.equipped} onChange={e => setNewItem(p => ({ ...p, equipped: e.target.checked }))} style={{ cursor: "pointer" }} />
              Équipé
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowAddForm(false)} style={cancelBtnStyle}>Annuler</button>
            <button onClick={addItem} style={addBtnStyle}>Ajouter</button>
          </div>
        </div>
      )}

      {grouped.map(({ type, items }) => (
        <div key={type} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {type === "artefact" ? "✨ " : ""}{EQUIPMENT_TYPE_LABELS[type] ?? type}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(item => {
              const isRings = item.name.toLowerCase().includes("bagues");
              return (
                <div key={item.id} style={{
                  background: "var(--surface)",
                  border: `1.5px solid ${isRings ? "#8b5cf6" : "var(--border)"}`,
                  borderRadius: 12,
                  overflow: "hidden",
                  ...(isRings ? { boxShadow: "0 0 12px rgba(139,92,246,0.15)" } : {}),
                }}>
                  <div
                    style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                      {isRings ? "✨ " : ""}{item.name}
                      {item.quantity && item.quantity > 1 && <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 6 }}>×{item.quantity}</span>}
                    </span>
                    {item.magical && <span style={{ fontSize: 11, color: "#8b5cf6", background: "rgba(139,92,246,0.1)", padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}>Magique</span>}
                    {item.equipped && <span style={{ fontSize: 11, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}>Équipé</span>}
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{expandedId === item.id ? "▲" : "▼"}</span>
                  </div>
                  {expandedId === item.id && (
                    <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", background: "var(--surface2)" }}>
                      {item.description && <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 8, lineHeight: 1.6 }}>{item.description}</p>}
                      {item.notes && <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 10 }}>{item.notes}</p>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => toggleEquipped(item)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                          {item.equipped ? "Déséquiper" : "Équiper"}
                        </button>
                        <button onClick={() => deleteItem(item.id)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 4 — QUÊTES
// ══════════════════════════════════════════════════════════════════════════════

const OBJECTIVE_CATEGORIES = ["principal", "mystère", "secondaire"];
const CATEGORY_LABELS: Record<string, string> = { principal: "Quête principale", mystère: "Mystère", secondaire: "Quête secondaire" };
const STATUS_COLORS: Record<string, string> = { "En cours": "#3b7ef8", "Résolu": "#22c55e", "Abandonné": "#9ca3af" };

function ObjectivesTab({ objectives, setObjectives }: { objectives: DndObjective[]; setObjectives: (o: DndObjective[]) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newObj, setNewObj] = useState({ title: "", description: "", category: "principal", status: "En cours", notes: "" });
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const saveNotes = (obj: DndObjective, notes: string) => {
    if (debounceRefs.current[obj.id]) clearTimeout(debounceRefs.current[obj.id]);
    debounceRefs.current[obj.id] = setTimeout(async () => {
      await fetch("/api/dnd/objectives", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: obj.id, notes }) });
      setObjectives(objectives.map(o => o.id === obj.id ? { ...o, notes } : o));
    }, 1500);
  };

  const toggleStatus = async (obj: DndObjective) => {
    const statuses = ["En cours", "Résolu", "Abandonné"];
    const next = statuses[(statuses.indexOf(obj.status ?? "En cours") + 1) % statuses.length];
    setObjectives(objectives.map(o => o.id === obj.id ? { ...o, status: next } : o));
    await fetch("/api/dnd/objectives", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: obj.id, status: next }) });
  };

  const deleteObj = async (id: string) => {
    setObjectives(objectives.filter(o => o.id !== id));
    await fetch(`/api/dnd/objectives?id=${id}`, { method: "DELETE" });
  };

  const addObj = async () => {
    if (!newObj.title.trim()) return;
    const res = await fetch("/api/dnd/objectives", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newObj) });
    const created = await res.json();
    setObjectives([...objectives, created]);
    setNewObj({ title: "", description: "", category: "principal", status: "En cours", notes: "" });
    setShowAddForm(false);
  };

  const grouped = OBJECTIVE_CATEGORIES.map(cat => ({
    cat,
    items: objectives.filter(o => (o.category ?? "secondaire") === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setShowAddForm(!showAddForm)} style={addBtnStyle}>+ Ajouter un objectif</button>
      </div>

      {showAddForm && (
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Titre</label>
              <input value={newObj.title} onChange={e => setNewObj(p => ({ ...p, title: e.target.value }))} style={inputStyle} placeholder="Titre de l'objectif" />
            </div>
            <div>
              <label style={labelStyle}>Catégorie</label>
              <CustomSelect value={newObj.category} onChange={v => setNewObj(p => ({ ...p, category: v }))} options={OBJECTIVE_CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABELS[c] }))} />
            </div>
            <div>
              <label style={labelStyle}>Statut</label>
              <CustomSelect value={newObj.status} onChange={v => setNewObj(p => ({ ...p, status: v }))} options={["En cours","Résolu","Abandonné"].map(s => ({ value: s, label: s }))} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Description</label>
            <textarea value={newObj.description} onChange={e => setNewObj(p => ({ ...p, description: e.target.value }))} style={{ ...textareaStyle, minHeight: 64 }} placeholder="Description de l'objectif…" />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowAddForm(false)} style={cancelBtnStyle}>Annuler</button>
            <button onClick={addObj} style={addBtnStyle}>Ajouter</button>
          </div>
        </div>
      )}

      {grouped.map(({ cat, items }) => (
        <div key={cat} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {cat === "mystère" ? "❓ " : cat === "principal" ? "⚔️ " : "📜 "}{CATEGORY_LABELS[cat]}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(obj => (
              <div key={obj.id} style={{
                background: "var(--surface)",
                border: `1.5px solid ${cat === "mystère" ? "rgba(139,92,246,0.3)" : "var(--border)"}`,
                borderRadius: 12,
                overflow: "hidden",
                ...(cat === "mystère" ? { background: "rgba(139,92,246,0.03)" } : {}),
              }}>
                <div
                  style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                  onClick={() => setExpandedId(expandedId === obj.id ? null : obj.id)}
                >
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{obj.title}</span>
                  <button
                    onClick={e => { e.stopPropagation(); toggleStatus(obj); }}
                    style={{
                      fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 600,
                      background: `${STATUS_COLORS[obj.status ?? "En cours"]}18`,
                      color: STATUS_COLORS[obj.status ?? "En cours"],
                      border: `1px solid ${STATUS_COLORS[obj.status ?? "En cours"]}40`,
                      cursor: "pointer", fontFamily: "var(--font-sans)",
                    }}
                  >
                    {obj.status ?? "En cours"}
                  </button>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{expandedId === obj.id ? "▲" : "▼"}</span>
                </div>
                {expandedId === obj.id && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", background: "var(--surface2)" }}>
                    {obj.description && <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 12, lineHeight: 1.6 }}>{obj.description}</p>}
                    <label style={labelStyle}>Notes d&apos;avancement</label>
                    <textarea
                      value={editingNotes[obj.id] ?? (obj.notes ?? "")}
                      onChange={e => {
                        const v = e.target.value;
                        setEditingNotes(prev => ({ ...prev, [obj.id]: v }));
                        saveNotes(obj, v);
                      }}
                      placeholder="Indices découverts, avancées…"
                      style={{ ...textareaStyle, minHeight: 80, marginBottom: 10 }}
                    />
                    <button onClick={() => deleteObj(obj.id)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 5 — SESSIONS
// ══════════════════════════════════════════════════════════════════════════════

function SessionsTab({ sessions, setSessions, character }: { sessions: DndSession[]; setSessions: (s: DndSession[]) => void; character: DndCharacter | null }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<Record<string, Partial<DndSession>>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSession, setNewSession] = useState({ title: "", session_date: "", session_time: "", status: "Planifiée", level_at_session: character?.level ?? 1 });
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const today = new Date().toISOString().split("T")[0];

  const upcoming = sessions.filter(s => s.status === "Planifiée").sort((a, b) => a.session_date.localeCompare(b.session_date));
  const past = sessions.filter(s => s.status !== "Planifiée").sort((a, b) => b.session_date.localeCompare(a.session_date));

  const patchSession = (session: DndSession, updates: Partial<DndSession>) => {
    const merged = { ...session, ...updates };
    setSessions(sessions.map(s => s.id === session.id ? merged : s));
    if (debounceRefs.current[session.id]) clearTimeout(debounceRefs.current[session.id]);
    debounceRefs.current[session.id] = setTimeout(async () => {
      await fetch("/api/dnd/sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: session.id, ...updates }) });
    }, 1500);
  };

  const deleteSession = async (id: string) => {
    setSessions(sessions.filter(s => s.id !== id));
    await fetch(`/api/dnd/sessions?id=${id}`, { method: "DELETE" });
  };

  const addSession = async () => {
    if (!newSession.title.trim() || !newSession.session_date) return;
    const res = await fetch("/api/dnd/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newSession) });
    const created = await res.json();
    setSessions([created, ...sessions]);
    setNewSession({ title: "", session_date: "", session_time: "", status: "Planifiée", level_at_session: character?.level ?? 1 });
    setShowAddForm(false);
  };

  const renderSession = (session: DndSession) => {
    const local = { ...session, ...(editingSession[session.id] ?? {}) };
    const days = daysUntil(session.session_date);
    const isExpanded = expandedId === session.id;

    return (
      <div key={session.id} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setExpandedId(isExpanded ? null : session.id)}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{session.title}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              {fmtDate(session.session_date)}
              {session.session_time && ` · ${session.session_time}`}
              {session.level_at_session && ` · Niveau ${session.level_at_session}`}
            </div>
            {session.summary && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 500 }}>{session.summary}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{
              fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 600,
              background: session.status === "Planifiée" ? "rgba(59,126,248,0.1)" : session.status === "Jouée" ? "rgba(34,197,94,0.1)" : "rgba(156,163,175,0.15)",
              color: session.status === "Planifiée" ? "#3b7ef8" : session.status === "Jouée" ? "#22c55e" : "#9ca3af",
            }}>{session.status}</span>
            {session.status === "Planifiée" && (
              <span style={{ fontSize: 11, color: days <= 0 ? "#ef4444" : days <= 3 ? "#f59e0b" : "var(--text-muted)" }}>
                {days === 0 ? "Aujourd'hui" : days < 0 ? `Il y a ${-days}j` : `Dans ${days}j`}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{isExpanded ? "▲" : "▼"}</span>
        </div>

        {isExpanded && (
          <div style={{ borderTop: "1px solid var(--border)", padding: 16, background: "var(--surface2)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Titre</label>
                <input value={local.title} onChange={e => { const v = e.target.value; setEditingSession(p => ({ ...p, [session.id]: { ...p[session.id], title: v } })); patchSession(session, { title: v }); }} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={local.session_date} onChange={e => { const v = e.target.value; setEditingSession(p => ({ ...p, [session.id]: { ...p[session.id], session_date: v } })); patchSession(session, { session_date: v }); }} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Heure</label>
                <input type="time" value={local.session_time ?? ""} onChange={e => { const v = e.target.value; setEditingSession(p => ({ ...p, [session.id]: { ...p[session.id], session_time: v } })); patchSession(session, { session_time: v }); }} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Statut</label>
                <CustomSelect value={local.status ?? "Planifiée"} onChange={v => { setEditingSession(p => ({ ...p, [session.id]: { ...p[session.id], status: v } })); patchSession(session, { status: v }); }} options={["Planifiée","Jouée","Annulée"].map(s => ({ value: s, label: s }))} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Résumé</label>
              <textarea value={local.summary ?? ""} onChange={e => { const v = e.target.value; setEditingSession(p => ({ ...p, [session.id]: { ...p[session.id], summary: v } })); patchSession(session, { summary: v }); }} placeholder="Ce qui s'est passé en bref…" style={{ ...textareaStyle, minHeight: 64 }} />
            </div>
            <div>
              <label style={labelStyle}>Journal de campagne</label>
              <textarea value={local.journal ?? ""} onChange={e => { const v = e.target.value; setEditingSession(p => ({ ...p, [session.id]: { ...p[session.id], journal: v } })); patchSession(session, { journal: v }); }} placeholder="Détails de la session, indices découverts, PNJ rencontrés, décisions prises, réflexions du personnage…" style={{ ...textareaStyle, minHeight: 300 }} />
            </div>
            <div>
              <label style={labelStyle}>Notes personnelles</label>
              <textarea value={local.notes ?? ""} onChange={e => { const v = e.target.value; setEditingSession(p => ({ ...p, [session.id]: { ...p[session.id], notes: v } })); patchSession(session, { notes: v }); }} placeholder="Stratégie, questions pour le MJ, métas…" style={{ ...textareaStyle, minHeight: 80 }} />
            </div>
            <button onClick={() => deleteSession(session.id)} style={{ alignSelf: "flex-start", fontSize: 12, padding: "5px 12px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
              Supprimer cette session
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setShowAddForm(!showAddForm)} style={addBtnStyle}>+ Nouvelle session</button>
      </div>

      {showAddForm && (
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Titre</label>
              <input value={newSession.title} onChange={e => setNewSession(p => ({ ...p, title: e.target.value }))} style={inputStyle} placeholder="Session X — Titre" />
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={newSession.session_date} min={today} onChange={e => setNewSession(p => ({ ...p, session_date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Heure</label>
              <input type="time" value={newSession.session_time} onChange={e => setNewSession(p => ({ ...p, session_time: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Statut</label>
              <CustomSelect value={newSession.status} onChange={v => setNewSession(p => ({ ...p, status: v }))} options={["Planifiée","Jouée","Annulée"].map(s => ({ value: s, label: s }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowAddForm(false)} style={cancelBtnStyle}>Annuler</button>
            <button onClick={addSession} style={addBtnStyle}>Créer</button>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Sessions à venir</div>
          {upcoming.map(renderSession)}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>Sessions passées</div>
          {past.map(renderSession)}
        </div>
      )}

      {sessions.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)", fontSize: 14 }}>
          Aucune session. Planifiez votre prochaine aventure !
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 6 — STATISTIQUES
// ══════════════════════════════════════════════════════════════════════════════

const SCHOOL_COLORS: Record<string, string> = {
  "Nécromancie": "#8b5cf6",
  "Évocation": "#ef4444",
  "Divination": "#3b7ef8",
  "Transmutation": "#22c55e",
  "Illusion": "#ec4899",
  "Enchantement": "#f59e0b",
  "Invocation": "#14b8a6",
  "Abjuration": "#f97316",
  "Universelle": "#9ca3af",
};

function StatsTab({ sessions, spells, objectives, character }: {
  sessions: DndSession[];
  spells: DndSpell[];
  objectives: DndObjective[];
  character: DndCharacter | null;
}) {
  const played = sessions.filter(s => s.status === "Jouée");
  const planned = sessions.filter(s => s.status === "Planifiée");
  const resolved = objectives.filter(o => o.status === "Résolu");

  const firstSession = played.sort((a, b) => a.session_date.localeCompare(b.session_date))[0];
  const daysSinceStart = firstSession
    ? Math.round((new Date().getTime() - new Date(firstSession.session_date + "T00:00:00").getTime()) / 86400000)
    : null;

  const nextSession = [...planned].sort((a, b) => a.session_date.localeCompare(b.session_date))[0];
  const daysToNext = nextSession ? daysUntil(nextSession.session_date) : null;

  // Session timeline
  const timeline = [...played].sort((a, b) => a.session_date.localeCompare(b.session_date)).map((s, i) => ({
    name: `S${i + 1}`,
    title: s.title,
    date: s.session_date,
  }));

  // Level progression
  const levelData = [...played]
    .sort((a, b) => a.session_date.localeCompare(b.session_date))
    .map((s, i) => ({
      name: `S${i + 1}`,
      niveau: s.level_at_session ?? character?.level ?? 1,
    }));

  // Spells by school
  const schoolCounts: Record<string, number> = {};
  spells.forEach(s => {
    const school = s.school ?? "Universelle";
    schoolCounts[school] = (schoolCounts[school] ?? 0) + 1;
  });
  const schoolData = Object.entries(schoolCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Spells by level
  const levelCounts: Record<number, number> = {};
  spells.forEach(s => { levelCounts[s.level] = (levelCounts[s.level] ?? 0) + 1; });
  const charLevel = character?.level ?? 1;
  const slots = getSlotsForLevel(charLevel);
  const spellLevelData = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => (levelCounts[l] ?? 0) > 0 || (l > 0 && l <= 9 && slots[l - 1] > 0)).map(l => ({
    name: l === 0 ? "Mineurs" : `Niv.${l}`,
    sorts: levelCounts[l] ?? 0,
    emplacements: l === 0 ? 0 : (slots[l - 1] ?? 0),
  }));

  // Radar for character stats
  const STATS_RADAR = [
    { stat: "FOR", value: character?.force ?? 10 },
    { stat: "DEX", value: character?.dexterite ?? 10 },
    { stat: "CON", value: character?.constitution ?? 10 },
    { stat: "INT", value: character?.intelligence ?? 10 },
    { stat: "SAG", value: character?.sagesse ?? 10 },
    { stat: "CHA", value: character?.charisme ?? 10 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { icon: "🎲", label: "Sessions jouées", value: `${played.length} / ${sessions.length}` },
          { icon: "📅", label: "Jours de campagne", value: daysSinceStart !== null ? `${daysSinceStart}j` : "—" },
          { icon: "⚔️", label: "Niveau actuel", value: character?.level ?? "—" },
          { icon: "🎯", label: "Quêtes résolues", value: `${resolved.length} / ${objectives.length}` },
        ].map(({ icon, label, value }) => (
          <div key={label} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 22 }}>{icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: "6px 0 2px" }}>{value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Profil radar */}
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Profil de Matshana</div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={STATS_RADAR}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="stat" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
              <Radar name="Caractéristiques" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Prochaine session */}
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Prochaine session</div>
          {nextSession ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{nextSession.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{fmtDate(nextSession.session_date)}{nextSession.session_time ? ` à ${nextSession.session_time}` : ""}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: daysToNext === 0 ? "#22c55e" : daysToNext! <= 3 ? "#f59e0b" : "var(--accent)", margin: "8px 0" }}>
                {daysToNext === 0 ? "Aujourd'hui !" : daysToNext === 1 ? "Demain !" : `J−${daysToNext}`}
              </div>
              {daysToNext! > 1 && (
                <div style={{ height: 6, borderRadius: 3, background: "var(--surface2)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(5, 100 - (daysToNext! / 30) * 100)}%`, height: "100%", background: "var(--accent)", borderRadius: 3, transition: "width 0.3s" }} />
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 14 }}>
              Aucune session planifiée — ajoutons-en une !
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Sorts par école */}
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Sorts par école de magie</div>
          {schoolData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={schoolData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                  {schoolData.map((entry, index) => (
                    <Cell key={index} fill={SCHOOL_COLORS[entry.name] ?? `hsl(${index * 40}, 65%, 55%)`} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
              Les écoles seront chargées depuis aidedd.org au premier survol de chaque sort.
            </div>
          )}
        </div>

        {/* Sorts par niveau */}
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Sorts connus vs emplacements</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={spellLevelData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="sorts" name="Sorts connus" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="emplacements" name="Emplacements" fill="rgba(99,102,241,0.25)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Progression de niveau */}
      {levelData.length > 1 && (
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Évolution du niveau par session</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={levelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis domain={[1, 20]} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="stepAfter" dataKey="niveau" name="Niveau" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Avancement des quêtes */}
      <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Avancement des quêtes</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 10, borderRadius: 5, background: "var(--surface2)", overflow: "hidden" }}>
            <div style={{ width: `${objectives.length > 0 ? (resolved.length / objectives.length) * 100 : 0}%`, height: "100%", background: "#22c55e", borderRadius: 5, transition: "width 0.5s" }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>{resolved.length} / {objectives.length} résolues</span>
        </div>
        {OBJECTIVE_CATEGORIES.map(cat => {
          const items = objectives.filter(o => (o.category ?? "secondaire") === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                {cat === "mystère" ? "❓ " : cat === "principal" ? "⚔️ " : "📜 "}{CATEGORY_LABELS[cat]}
              </div>
              {items.map(o => (
                <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[o.status ?? "En cours"], flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "var(--text)", flex: 1, textDecorationLine: o.status === "Résolu" ? "line-through" : "none", opacity: o.status === "Abandonné" ? 0.5 : 1 }}>{o.title}</span>
                  <span style={{ fontSize: 11, color: STATUS_COLORS[o.status ?? "En cours"] }}>{o.status}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Timeline sessions */}
      {timeline.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Frise chronologique des sessions</div>
          <div style={{ display: "flex", gap: 0, overflowX: "auto", paddingBottom: 8 }}>
            {timeline.map((s, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 80 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                {i < timeline.length - 1 && <div style={{ position: "absolute", width: 70, height: 2, background: "var(--border)", marginLeft: 80, marginTop: 4 }} />}
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginTop: 6 }}>{s.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", maxWidth: 72, lineHeight: 1.3, marginTop: 2 }}>
                  {new Date(s.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 6 — COÉQUIPIERS
// ══════════════════════════════════════════════════════════════════════════════

const RELATIONSHIP_OPTIONS = ["Allié", "Ami", "Méfiant", "Neutre", "Rival"];
const RELATIONSHIP_STYLES: Record<string, { bg: string; color: string }> = {
  "Allié":   { bg: "rgba(34,197,94,0.12)",  color: "#16a34a" },
  "Ami":     { bg: "rgba(59,130,246,0.12)",  color: "#2563eb" },
  "Méfiant": { bg: "rgba(245,158,11,0.12)",  color: "#d97706" },
  "Neutre":  { bg: "rgba(156,163,175,0.12)", color: "#6b7280" },
  "Rival":   { bg: "rgba(239,68,68,0.12)",   color: "#dc2626" },
};

function companionColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 55%, 48%)`;
}

const EMPTY_COMPANION: Omit<DndCompanion, "id"> = {
  name: "", class: null, race: null, level: null, player_name: null,
  description: null, personality: null, backstory: null,
  relationship: null, notes: null, avatar_url: null, is_companion: false,
};

function CompanionsTab({ companions, setCompanions }: {
  companions: DndCompanion[];
  setCompanions: React.Dispatch<React.SetStateAction<DndCompanion[]>>;
}) {
  const [drawer, setDrawer] = useState<DndCompanion | null>(null);
  const [mode, setMode] = useState<"edit" | "create">("edit");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setDrawer({ id: "__new__", ...EMPTY_COMPANION });
    setMode("create");
    setDeleteConfirm(false);
  };

  const openEdit = (c: DndCompanion) => {
    setDrawer(c);
    setMode("edit");
    setDeleteConfirm(false);
  };

  const closeDrawer = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDrawer(null);
  };

  const setField = (field: keyof DndCompanion, value: unknown) => {
    setDrawer(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      if (mode === "edit") {
        // Optimistic update
        setCompanions(cs => cs.map(c => c.id === updated.id ? updated : c));
        // Debounced API call
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          fetch("/api/dnd/companions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
          });
        }, 1500);
      }
      return updated;
    });
  };

  const createCompanion = async () => {
    if (!drawer || !drawer.name.trim()) return;
    const { id: _, ...body } = drawer;
    const res = await fetch("/api/dnd/companions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const created: DndCompanion = await res.json();
    setCompanions(cs => [...cs, created]);
    setDrawer(created);
    setMode("edit");
    setDeleteConfirm(false);
  };

  const deleteCompanion = async () => {
    if (!drawer) return;
    await fetch(`/api/dnd/companions?id=${drawer.id}`, { method: "DELETE" });
    setCompanions(cs => cs.filter(c => c.id !== drawer.id));
    setDrawer(null);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !drawer) return;
    e.target.value = "";
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/dnd/upload", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json();
      setField("avatar_url", url);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button onClick={openCreate} style={addBtnStyle}>+ Ajouter un personnage</button>
      </div>

      {companions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: 14 }}>
          Aucun personnage pour l&apos;instant.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {[true, false].map(isCompGroup => {
            const group = companions.filter(c => !!c.is_companion === isCompGroup).sort((a, b) => a.name.localeCompare(b.name));
            if (group.length === 0) return null;
            return (
              <div key={String(isCompGroup)}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
                  {isCompGroup ? "Compagnons" : "Autres personnages"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {group.map(c => {
            const rel = c.relationship;
            const relStyle = rel ? (RELATIONSHIP_STYLES[rel] ?? RELATIONSHIP_STYLES["Neutre"]) : null;
            const initials = c.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
            return (
              <div
                key={c.id}
                onClick={() => openEdit(c)}
                style={{
                  background: "var(--surface)", border: "1.5px solid var(--border)",
                  borderRadius: 14, padding: 20, cursor: "pointer",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                    background: c.avatar_url ? "transparent" : companionColor(c.name),
                    overflow: "hidden", border: "2px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, color: "#fff", fontWeight: 700,
                  }}>
                    {c.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.avatar_url} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {c.class && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "rgba(99,102,241,0.1)", color: "#6366f1", fontWeight: 600 }}>{c.class}</span>}
                      {c.race && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "var(--surface2)", color: "var(--text-muted)", fontWeight: 500 }}>{c.race}</span>}
                      {c.level && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "var(--surface2)", color: "var(--text-muted)", fontWeight: 500 }}>Niv.{c.level}</span>}
                    </div>
                  </div>
                </div>

                {c.player_name && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>Joueur : {c.player_name}</div>
                )}

                {relStyle && rel && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 10, background: relStyle.bg, color: relStyle.color, fontWeight: 600 }}>{rel}</span>
                  </div>
                )}

                {c.personality && (
                  <div style={{
                    fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
                  }}>{c.personality}</div>
                )}
              </div>
            );
          })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Drawer ── */}
      {drawer && (
        <>
          <div onClick={closeDrawer} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 40 }} />
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: 500,
            background: "var(--bg)", borderLeft: "1.5px solid var(--border)",
            zIndex: 50, overflowY: "auto", padding: "28px 28px 48px",
            display: "flex", flexDirection: "column", gap: 18,
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                {mode === "create" ? "Nouveau coéquipier" : drawer.name || "Coéquipier"}
              </div>
              <button onClick={closeDrawer} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--text-muted)", lineHeight: 1 }}>×</button>
            </div>

            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />

            {/* Avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: drawer.avatar_url ? "transparent" : companionColor(drawer.name || "?"),
                overflow: "hidden", border: "2px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24, color: "#fff", fontWeight: 700, flexShrink: 0,
              }}>
                {drawer.avatar_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={drawer.avatar_url} alt={drawer.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (drawer.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?")}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font-sans)" }}
              >
                Changer l&apos;image
              </button>
            </div>

            {/* Nom */}
            <div>
              <label style={labelStyle}>Nom *</label>
              <input value={drawer.name} onChange={e => setField("name", e.target.value)} style={inputStyle} placeholder="Nom du personnage" />
            </div>

            {/* Classe / Race / Niveau */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 12 }}>
              <div>
                <label style={labelStyle}>Classe</label>
                <input value={drawer.class ?? ""} onChange={e => setField("class", e.target.value || null)} style={inputStyle} placeholder="Guerrier…" />
              </div>
              <div>
                <label style={labelStyle}>Race</label>
                <input value={drawer.race ?? ""} onChange={e => setField("race", e.target.value || null)} style={inputStyle} placeholder="Elfe…" />
              </div>
              <div>
                <label style={labelStyle}>Niveau</label>
                <input
                  type="number" min={1} max={20}
                  value={drawer.level ?? ""}
                  onChange={e => setField("level", e.target.value ? parseInt(e.target.value) : null)}
                  style={inputStyle} placeholder="1"
                />
              </div>
            </div>

            {/* Compagnon */}
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 14px", borderRadius: 8, background: drawer.is_companion ? "rgba(59,126,248,0.07)" : "var(--surface2)", border: `1.5px solid ${drawer.is_companion ? "var(--accent)" : "var(--border)"}`, transition: "all 0.15s" }}>
              <input
                type="checkbox"
                checked={!!drawer.is_companion}
                onChange={e => setField("is_companion", e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Compagnon de Matshana</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Apparaît en haut de la liste</div>
              </div>
            </label>

            {/* Joueur */}
            <div>
              <label style={labelStyle}>Joueur</label>
              <input value={drawer.player_name ?? ""} onChange={e => setField("player_name", e.target.value || null)} style={inputStyle} placeholder="Prénom du joueur…" />
            </div>

            {/* Relation */}
            <div>
              <label style={labelStyle}>Ma relation avec lui / elle</label>
              <CustomSelect
                value={drawer.relationship ?? ""}
                onChange={v => setField("relationship", v || null)}
                options={[{ value: "", label: "— Choisir —" }, ...RELATIONSHIP_OPTIONS.map(r => ({ value: r, label: r }))]}
              />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description physique</label>
              <textarea value={drawer.description ?? ""} onChange={e => setField("description", e.target.value || null)} style={{ ...textareaStyle, minHeight: 72 }} placeholder="Apparence physique…" />
            </div>

            {/* Personnalité */}
            <div>
              <label style={labelStyle}>Personnalité</label>
              <textarea value={drawer.personality ?? ""} onChange={e => setField("personality", e.target.value || null)} style={{ ...textareaStyle, minHeight: 72 }} placeholder="Traits de personnalité, façon d'être…" />
            </div>

            {/* Histoire */}
            <div>
              <label style={labelStyle}>Histoire</label>
              <textarea value={drawer.backstory ?? ""} onChange={e => setField("backstory", e.target.value || null)} style={{ ...textareaStyle, minHeight: 90 }} placeholder="Contexte et histoire du personnage…" />
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={drawer.notes ?? ""} onChange={e => setField("notes", e.target.value || null)} style={{ ...textareaStyle, minHeight: 130 }} placeholder="Notes libres, indices importants, éléments à retenir…" />
            </div>

            {/* Actions */}
            {mode === "create" ? (
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
                <button onClick={closeDrawer} style={cancelBtnStyle}>Annuler</button>
                <button onClick={createCompanion} disabled={!drawer.name.trim()} style={{ ...addBtnStyle, opacity: drawer.name.trim() ? 1 : 0.5 }}>Créer</button>
              </div>
            ) : (
              <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                {deleteConfirm ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)", flex: 1 }}>Confirmer la suppression ?</span>
                    <button onClick={() => setDeleteConfirm(false)} style={cancelBtnStyle}>Annuler</button>
                    <button onClick={deleteCompanion} style={{ ...addBtnStyle, background: "var(--red)" }}>Supprimer</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(true)} style={{ ...cancelBtnStyle, color: "var(--red)", borderColor: "var(--red)" }}>
                    Supprimer ce coéquipier
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 13,
  background: "var(--surface2)",
  border: "1.5px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  fontFamily: "var(--font-sans)",
  cursor: "text",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 13,
  background: "var(--surface2)",
  border: "1.5px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  fontFamily: "var(--font-sans)",
  resize: "vertical",
  lineHeight: 1.6,
  cursor: "text",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 4,
  fontWeight: 500,
};

const addBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 500,
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 13,
  background: "var(--surface2)",
  color: "var(--text-muted)",
  border: "1.5px solid var(--border)",
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
};

function filterBtn(active: boolean): React.CSSProperties {
  return {
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    background: active ? "var(--accent)" : "var(--surface)",
    color: active ? "#fff" : "var(--text-muted)",
    border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 20,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
  };
}
