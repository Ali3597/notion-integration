"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";
import type { DBRecipe, DBRecipeCategory, DBRecipeIngredient } from "@/types";

// ── Markdown renderer ─────────────────────────────────────────────────────────

function parseInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} style={{ fontFamily: "var(--font-mono)", background: "var(--surface2)", padding: "1px 5px", borderRadius: 3, fontSize: "0.9em" }}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function MarkdownRenderer({ content }: { content: string }) {
  const elements: React.ReactNode[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} style={mdStyles.h3}>{parseInline(line.slice(4))}</h3>);
      i++;
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} style={mdStyles.h2}>{parseInline(line.slice(3))}</h2>);
      i++;
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} style={mdStyles.h1}>{parseInline(line.slice(2))}</h1>);
      i++;
    } else if (/^[-*] /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(<li key={i} style={mdStyles.li}>{parseInline(lines[i].slice(2))}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} style={mdStyles.ul}>{items}</ul>);
    } else if (/^\d+\. /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={i} style={mdStyles.li}>{parseInline(lines[i].replace(/^\d+\. /, ""))}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`} style={mdStyles.ol}>{items}</ol>);
    } else {
      elements.push(<p key={i} style={mdStyles.p}>{parseInline(line)}</p>);
      i++;
    }
  }

  return <div>{elements}</div>;
}

const mdStyles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 18, fontWeight: 700, color: "var(--text)", margin: "20px 0 8px", letterSpacing: "-0.01em" },
  h2: { fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "18px 0 8px", borderBottom: "1px solid var(--border)", paddingBottom: 5 },
  h3: { fontSize: 13, fontWeight: 700, color: "var(--text)", margin: "14px 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" },
  p: { fontSize: 14, lineHeight: 1.7, color: "var(--text)", margin: "6px 0" },
  ul: { paddingLeft: 20, margin: "8px 0", display: "flex", flexDirection: "column", gap: 4 },
  ol: { paddingLeft: 20, margin: "8px 0", display: "flex", flexDirection: "column", gap: 4 },
  li: { fontSize: 14, lineHeight: 1.6, color: "var(--text)" },
};

// ── Constants ─────────────────────────────────────────────────────────────────

const UNITS = ["g", "kg", "ml", "cl", "L", "c.à.s.", "c.à.c.", "pincée", "pcs"];

// ── Ingredient editor row ─────────────────────────────────────────────────────

interface IngredientDraft {
  key: number;
  name: string;
  quantity: string;
  unit: string;
}

function IngredientRow({
  ing, onChange, onRemove,
}: {
  ing: IngredientDraft;
  onChange: (updated: IngredientDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input type="text" placeholder="Ingrédient *" value={ing.name}
        onChange={(e) => onChange({ ...ing, name: e.target.value })}
        style={{ ...ms.input, flex: 3, minWidth: 0 }} />
      <input type="number" placeholder="Qté" value={ing.quantity}
        onChange={(e) => onChange({ ...ing, quantity: e.target.value })}
        min="0" step="any" style={{ ...ms.input, width: 72, flexShrink: 0 }} />
      <select value={ing.unit} onChange={(e) => onChange({ ...ing, unit: e.target.value })}
        style={{ ...ms.select, width: 88, flexShrink: 0 }}>
        <option value="">—</option>
        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
      <button onClick={onRemove} style={ms.btnRemoveIng} title="Supprimer">✕</button>
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────

type ModalTab = "info" | "ingredients" | "steps";

function EditModal({
  recipe,
  categories,
  onClose,
  onSave,
}: {
  recipe: DBRecipe;
  categories: DBRecipeCategory[];
  onClose: () => void;
  onSave: (data: {
    title: string; category_id: string; servings: string;
    steps: string; notes: string;
    ingredients: { name: string; quantity: string; unit: string }[];
  }) => Promise<void>;
}) {
  const [tab, setTab] = useState<ModalTab>("info");
  const [title, setTitle] = useState(recipe.title);
  const [categoryId, setCategoryId] = useState(recipe.category_id ?? "");
  const [servings, setServings] = useState(recipe.servings ? String(recipe.servings) : "");
  const [steps, setSteps] = useState(recipe.steps ?? "");
  const [notes, setNotes] = useState(recipe.notes ?? "");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() => {
    if (recipe.ingredients && recipe.ingredients.length > 0) {
      return recipe.ingredients.map((ing, i) => ({
        key: i, name: ing.name, quantity: ing.quantity ?? "", unit: ing.unit ?? "",
      }));
    }
    return [{ key: 0, name: "", quantity: "", unit: "g" }];
  });
  const [nextKey, setNextKey] = useState(ingredients.length);
  const [saving, setSaving] = useState(false);

  function addIngredient() {
    setIngredients((prev) => [...prev, { key: nextKey, name: "", quantity: "", unit: "g" }]);
    setNextKey((k) => k + 1);
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title, category_id: categoryId, servings,
      steps, notes,
      ingredients: ingredients.filter((i) => i.name.trim()).map(({ name, quantity, unit }) => ({ name, quantity, unit })),
    });
    setSaving(false);
  }

  const TABS: { key: ModalTab; label: string }[] = [
    { key: "info", label: "Infos" },
    { key: "ingredients", label: `Ingrédients${ingredients.filter((i) => i.name.trim()).length > 0 ? ` (${ingredients.filter((i) => i.name.trim()).length})` : ""}` },
    { key: "steps", label: "Étapes" },
  ];

  return (
    <div style={ms.backdrop} onClick={onClose}>
      <div style={ms.modal} onClick={(e) => e.stopPropagation()}>
        <div style={ms.header}>
          <div style={ms.titleText}>Modifier la recette</div>
          <button onClick={onClose} style={ms.closeBtn}>✕</button>
        </div>
        <div style={ms.tabBar}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              ...ms.tabBtn, ...(tab === t.key ? { background: "var(--accent)", color: "#fff" } : {}),
            }}>{t.label}</button>
          ))}
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <div style={ms.body}>
            {tab === "info" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={ms.label}>Titre *</label>
                  <input autoFocus required type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={ms.input} />
                </div>
                <div>
                  <label style={ms.label}>Catégorie</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ ...ms.select, width: "100%" }}>
                    <option value="">— Sans catégorie —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={ms.label}>Portions</label>
                  <input type="number" value={servings} onChange={(e) => setServings(e.target.value)} min="1" style={{ ...ms.input, maxWidth: 160 }} placeholder="4" />
                </div>
              </div>
            )}
            {tab === "ingredients" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 6, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                  <span style={{ ...ms.label, flex: 3, margin: 0 }}>Ingrédient</span>
                  <span style={{ ...ms.label, width: 72, margin: 0, flexShrink: 0 }}>Quantité</span>
                  <span style={{ ...ms.label, width: 88, margin: 0, flexShrink: 0 }}>Unité</span>
                  <span style={{ width: 28, flexShrink: 0 }} />
                </div>
                {ingredients.map((ing) => (
                  <IngredientRow key={ing.key} ing={ing}
                    onChange={(u) => setIngredients((prev) => prev.map((i) => i.key === ing.key ? u : i))}
                    onRemove={() => setIngredients((prev) => prev.filter((i) => i.key !== ing.key))} />
                ))}
                <button type="button" onClick={addIngredient} style={ms.btnAddIngredient}>
                  + Ajouter un ingrédient
                </button>
              </div>
            )}
            {tab === "steps" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={ms.label}>Étapes <span style={{ fontWeight: 400, opacity: 0.6, textTransform: "none", letterSpacing: 0 }}>— Markdown supporté</span></label>
                  <textarea value={steps} onChange={(e) => setSteps(e.target.value)} style={{ ...ms.textarea, minHeight: 240 }} />
                </div>
                <div>
                  <label style={ms.label}>Notes personnelles</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...ms.textarea, minHeight: 80 }} />
                </div>
              </div>
            )}
          </div>
          <div style={ms.footer}>
            <button type="button" onClick={onClose} style={ms.btnSecondary}>Annuler</button>
            <button type="submit" disabled={saving || !title.trim()} style={{ ...ms.btnPrimary, opacity: saving || !title.trim() ? 0.6 : 1 }}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Detail page ───────────────────────────────────────────────────────────────

export default function RecipeDetailPage() {
  useDynamicFavicon("🍳");
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [recipe, setRecipe] = useState<DBRecipe | null>(null);
  const [categories, setCategories] = useState<DBRecipeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    const [rRes, cRes] = await Promise.all([
      fetch(`/api/cuisine/recipes?id=${id}`),
      fetch("/api/cuisine/categories"),
    ]);
    const rData = await rRes.json();
    const cData = await cRes.json();
    if (rData.error) { router.push("/cuisine"); return; }
    setRecipe(rData);
    if (Array.isArray(cData)) setCategories(cData);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (recipe) document.title = `${recipe.title} — life×hub`;
  }, [recipe]);

  async function handleSave(data: {
    title: string; category_id: string; servings: string;
    steps: string; notes: string;
    ingredients: { name: string; quantity: string; unit: string }[];
  }) {
    await fetch(`/api/cuisine/recipes?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setEditOpen(false);
    load();
  }

  async function handleDelete() {
    if (!recipe) return;
    if (!confirm(`Supprimer la recette « ${recipe.title} » ? Cette action est irréversible.`)) return;
    await fetch(`/api/cuisine/recipes?id=${id}`, { method: "DELETE" });
    router.push("/cuisine");
  }

  if (loading) {
    return (
      <main style={styles.main}>
        <div style={{ height: 20, width: 180, background: "var(--surface2)", borderRadius: 6, marginBottom: 32 }} />
        <div style={{ height: 36, width: 320, background: "var(--surface2)", borderRadius: 8 }} />
      </main>
    );
  }

  if (!recipe) return null;

  const hasIngredients = recipe.ingredients && recipe.ingredients.length > 0;

  return (
    <main style={styles.main}>
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <Link href="/cuisine" style={{ color: "var(--accent)", textDecoration: "none", fontSize: 13 }}>
          Cuisine
        </Link>
        <span style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 6px" }}>›</span>
        <span style={{ color: "var(--text-muted)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {recipe.title}
        </span>
      </div>

      {/* Header card */}
      <div style={styles.headerCard}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 40 }}>{recipe.category_icon || "🍳"}</span>
            <div>
              {recipe.category_name && (
                <div style={styles.catBadge}>{recipe.category_name}</div>
              )}
              <h1 style={styles.title}>{recipe.title}</h1>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setEditOpen(true)} style={styles.btnEdit}>✎ Modifier</button>
            <button onClick={handleDelete} style={styles.btnDelete}>Supprimer</button>
          </div>
        </div>

        {/* Stats chips */}
        {recipe.servings && (
          <div style={styles.statsRow}>
            <div style={styles.statChip}>
              <span style={styles.statIcon}>🍽️</span>
              <div>
                <div style={styles.statValue}>{recipe.servings}</div>
                <div style={styles.statLabel}>{recipe.servings > 1 ? "portions" : "portion"}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Body: ingredients + steps */}
      <div style={styles.body}>
        {/* Left: ingredients */}
        {hasIngredients && (
          <div style={styles.ingredientsCard}>
            <h2 style={styles.sectionTitle}>🥄 Ingrédients</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {recipe.ingredients!.map((ing) => (
                <li key={ing.id} style={styles.ingredientRow}>
                  <span style={styles.ingredientBullet} />
                  <span style={styles.ingredientName}>{ing.name}</span>
                  {(ing.quantity || ing.unit) && (
                    <span style={styles.ingredientQty}>
                      {ing.quantity && <strong>{ing.quantity}</strong>}
                      {ing.unit && ` ${ing.unit}`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Right: steps */}
        <div style={styles.stepsCard}>
          {recipe.steps ? (
            <>
              <h2 style={styles.sectionTitle}>📋 Préparation</h2>
              <MarkdownRenderer content={recipe.steps} />
            </>
          ) : (
            <div style={{ color: "var(--text-muted)", fontSize: 13, fontStyle: "italic" }}>
              Aucune étape renseignée.{" "}
              <button onClick={() => setEditOpen(true)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, padding: 0, fontFamily: "var(--font-sans)" }}>
                Ajouter →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {recipe.notes && (
        <div style={styles.notesCard}>
          <h2 style={styles.sectionTitle}>📝 Notes personnelles</h2>
          <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
            {recipe.notes}
          </p>
        </div>
      )}

      {/* Edit modal */}
      {editOpen && (
        <EditModal
          recipe={recipe}
          categories={categories}
          onClose={() => setEditOpen(false)}
          onSave={handleSave}
        />
      )}
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  main: { minHeight: "100vh", background: "var(--bg)", padding: "32px 40px 60px", maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 },
  breadcrumb: { display: "flex", alignItems: "center" },
  headerCard: { background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16, boxShadow: "var(--shadow-sm)" },
  catBadge: { fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(59,126,248,0.12)", color: "var(--accent)", display: "inline-block", marginBottom: 6 },
  title: { fontSize: 26, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2 },
  statsRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  statChip: { display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px" },
  statIcon: { fontSize: 18 },
  statValue: { fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--text)", lineHeight: 1 },
  statLabel: { fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 },
  btnEdit: { padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--surface2)", color: "var(--text-muted)", cursor: "pointer", border: "1.5px solid var(--border)" },
  btnDelete: { padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "rgba(220,38,38,0.08)", color: "var(--red)", cursor: "pointer", border: "1.5px solid rgba(220,38,38,0.15)" },
  body: { display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 14px" },
  ingredientsCard: { background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: "20px 22px", boxShadow: "var(--shadow-sm)", position: "sticky", top: "calc(var(--topnav-height, 0px) + 20px)" },
  ingredientRow: { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border)" },
  ingredientBullet: { width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 },
  ingredientName: { fontSize: 13, color: "var(--text)", flex: 1 },
  ingredientQty: { fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)", flexShrink: 0 },
  stepsCard: { background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: "20px 26px", boxShadow: "var(--shadow-sm)", minHeight: 200 },
  notesCard: { background: "rgba(245,158,11,0.06)", border: "1.5px solid rgba(245,158,11,0.2)", borderRadius: 14, padding: "20px 26px" },
};

// ── Modal styles ──────────────────────────────────────────────────────────────

const ms: Record<string, React.CSSProperties> = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" },
  modal: { background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 18, width: "100%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-md)" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid var(--border)" },
  titleText: { fontSize: 17, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" },
  closeBtn: { background: "none", border: "none", fontSize: 16, color: "var(--text-muted)", cursor: "pointer", padding: "2px 6px", borderRadius: 6 },
  tabBar: { display: "flex", gap: 4, padding: "10px 16px 0", background: "var(--bg)", borderBottom: "1px solid var(--border)" },
  tabBtn: { padding: "7px 18px", borderRadius: "8px 8px 0 0", fontSize: 12, fontWeight: 600, background: "transparent", color: "var(--text-muted)", cursor: "pointer", border: "none", letterSpacing: "0.02em" },
  body: { padding: "20px 24px", overflowY: "auto", flex: 1 },
  footer: { display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--border)" },
  label: { display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 },
  input: { fontSize: 13, padding: "9px 12px", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font-sans)", outline: "none", width: "100%", boxSizing: "border-box" },
  select: { fontSize: 13, padding: "9px 12px", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font-sans)", outline: "none", cursor: "pointer" },
  textarea: { fontSize: 13, padding: "10px 12px", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "var(--font-mono)", resize: "vertical", outline: "none", width: "100%", lineHeight: 1.6, boxSizing: "border-box" },
  btnPrimary: { padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", cursor: "pointer", border: "none" },
  btnSecondary: { padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" },
  btnRemoveIng: { width: 28, height: 28, borderRadius: 6, background: "rgba(220,38,38,0.08)", color: "var(--red)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 },
  btnAddIngredient: { fontSize: 12, fontWeight: 500, color: "var(--accent)", background: "transparent", border: "1.5px dashed var(--border)", borderRadius: 8, cursor: "pointer", padding: "8px 14px", textAlign: "left", marginTop: 2 },
};
