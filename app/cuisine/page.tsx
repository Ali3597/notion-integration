"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useDynamicFavicon } from "@/hooks/useDynamicFavicon";
import type { DBRecipe, DBRecipeCategory, DBRecipeIngredient } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const UNITS = ["g", "kg", "ml", "cl", "L", "c.à.s.", "c.à.c.", "pincée", "pcs"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6} /g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^[-*] /gm, "")
    .replace(/^\d+\. /gm, "")
    .replace(/\n/g, " ")
    .trim();
}

// ── Ingredient editor row ─────────────────────────────────────────────────────

interface IngredientDraft {
  key: number;
  name: string;
  quantity: string;
  unit: string;
}

function IngredientRow({
  ing,
  onChange,
  onRemove,
}: {
  ing: IngredientDraft;
  onChange: (updated: IngredientDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        type="text"
        placeholder="Ingrédient *"
        value={ing.name}
        onChange={(e) => onChange({ ...ing, name: e.target.value })}
        style={{ ...ms.input, flex: 3, minWidth: 0 }}
      />
      <input
        type="number"
        placeholder="Qté"
        value={ing.quantity}
        onChange={(e) => onChange({ ...ing, quantity: e.target.value })}
        min="0"
        step="any"
        style={{ ...ms.input, width: 72, flexShrink: 0 }}
      />
      <select
        value={ing.unit}
        onChange={(e) => onChange({ ...ing, unit: e.target.value })}
        style={{ ...ms.select, width: 88, flexShrink: 0 }}
      >
        <option value="">—</option>
        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
      <button onClick={onRemove} style={ms.btnRemoveIng} title="Supprimer">✕</button>
    </div>
  );
}

// ── Recipe modal ──────────────────────────────────────────────────────────────

type ModalTab = "info" | "ingredients" | "steps";

interface RecipeModalProps {
  mode: "create" | "edit";
  initial?: DBRecipe | null;
  categories: DBRecipeCategory[];
  onClose: () => void;
  onSave: (data: {
    title: string; category_id: string; servings: string;
    steps: string; notes: string;
    ingredients: { name: string; quantity: string; unit: string }[];
  }) => Promise<void>;
  onCategorySaved: (cat: DBRecipeCategory) => void;
}

function RecipeModal({ mode, initial, categories, onClose, onSave, onCategorySaved }: RecipeModalProps) {
  const [tab, setTab] = useState<ModalTab>("info");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [servings, setServings] = useState(initial?.servings ? String(initial.servings) : "");
  const [steps, setSteps] = useState(initial?.steps ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() => {
    if (initial?.ingredients && initial.ingredients.length > 0) {
      return initial.ingredients.map((ing, i) => ({
        key: i,
        name: ing.name,
        quantity: ing.quantity ?? "",
        unit: ing.unit ?? "",
      }));
    }
    return [{ key: 0, name: "", quantity: "", unit: "g" }];
  });
  const [nextKey, setNextKey] = useState(ingredients.length);
  const [saving, setSaving] = useState(false);

  // New category inline creation
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🍽️");
  const [savingCat, setSavingCat] = useState(false);

  async function handleSaveNewCat() {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    const res = await fetch("/api/cuisine/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim(), icon: newCatIcon }),
    });
    const cat = await res.json();
    if (!cat.error) {
      onCategorySaved(cat);
      setCategoryId(cat.id);
      setShowNewCat(false);
      setNewCatName("");
      setNewCatIcon("🍽️");
    }
    setSavingCat(false);
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { key: nextKey, name: "", quantity: "", unit: "g" }]);
    setNextKey((k) => k + 1);
  }

  function updateIngredient(key: number, updated: IngredientDraft) {
    setIngredients((prev) => prev.map((i) => i.key === key ? updated : i));
  }

  function removeIngredient(key: number) {
    setIngredients((prev) => prev.filter((i) => i.key !== key));
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!title.trim()) { setTab("info"); return; }
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
    { key: "ingredients", label: `Ingrédients${ingredients.filter(i => i.name.trim()).length > 0 ? ` (${ingredients.filter(i => i.name.trim()).length})` : ""}` },
    { key: "steps", label: "Étapes" },
  ];

  return (
    <div style={ms.backdrop} onClick={onClose}>
      <div style={ms.modal} onClick={(e) => e.stopPropagation()}>
        <div style={ms.header}>
          <div style={ms.title}>{mode === "create" ? "Nouvelle recette" : "Modifier la recette"}</div>
          <button onClick={onClose} style={ms.closeBtn}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={ms.tabBar}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              ...ms.tabBtn,
              ...(tab === t.key ? { background: "var(--accent)", color: "#fff" } : {}),
            }}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <div style={ms.body}>

            {/* ── Info tab ── */}
            {tab === "info" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={ms.label}>Titre *</label>
                  <input autoFocus required type="text" value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={ms.input} placeholder="Nom de la recette" />
                </div>

                <div>
                  <label style={ms.label}>Catégorie</label>
                  {!showNewCat ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ ...ms.select, flex: 1 }}>
                        <option value="">— Sans catégorie —</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setShowNewCat(true)} style={ms.btnSecondary}>
                        + Nouvelle
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", background: "var(--bg)", border: "1.5px solid var(--accent)", borderRadius: 8 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input type="text" placeholder="Icône emoji" value={newCatIcon}
                          onChange={(e) => setNewCatIcon(e.target.value)}
                          style={{ ...ms.input, width: 56, textAlign: "center" }} />
                        <input autoFocus type="text" placeholder="Nom de la catégorie *" value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          style={{ ...ms.input, flex: 1 }} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => { setShowNewCat(false); setNewCatName(""); }} style={ms.btnSecondary}>Annuler</button>
                        <button type="button" onClick={handleSaveNewCat} disabled={savingCat || !newCatName.trim()} style={{ ...ms.btnPrimary, opacity: savingCat || !newCatName.trim() ? 0.6 : 1 }}>
                          {savingCat ? "…" : "Créer"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label style={ms.label}>Portions</label>
                  <input type="number" value={servings} onChange={(e) => setServings(e.target.value)}
                    min="1" style={{ ...ms.input, maxWidth: 160 }} placeholder="4" />
                </div>
              </div>
            )}

            {/* ── Ingredients tab ── */}
            {tab === "ingredients" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 6, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                  <span style={{ ...ms.label, flex: 3, margin: 0 }}>Ingrédient</span>
                  <span style={{ ...ms.label, width: 72, margin: 0, flexShrink: 0 }}>Quantité</span>
                  <span style={{ ...ms.label, width: 88, margin: 0, flexShrink: 0 }}>Unité</span>
                  <span style={{ width: 28, flexShrink: 0 }} />
                </div>
                {ingredients.map((ing) => (
                  <IngredientRow
                    key={ing.key}
                    ing={ing}
                    onChange={(updated) => updateIngredient(ing.key, updated)}
                    onRemove={() => removeIngredient(ing.key)}
                  />
                ))}
                <button type="button" onClick={addIngredient} style={ms.btnAddIngredient}>
                  + Ajouter un ingrédient
                </button>
              </div>
            )}

            {/* ── Steps tab ── */}
            {tab === "steps" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={ms.label}>
                    Étapes
                    <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>
                      — Markdown supporté (# Titre, **gras**, - liste)
                    </span>
                  </label>
                  <textarea
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    style={{ ...ms.textarea, minHeight: 240 }}
                    placeholder={`## Préparation\n\n1. Préchauffer le four à 180°C.\n2. Mélanger les ingrédients secs.\n\n## Cuisson\n\n- Enfourner 25 minutes.\n- **Vérifier la cuisson** avec un couteau.`}
                  />
                </div>
                <div>
                  <label style={ms.label}>Notes personnelles</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ ...ms.textarea, minHeight: 80 }}
                    placeholder="Astuces, ajustements, variantes..."
                  />
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

// ── Category manager modal ────────────────────────────────────────────────────

function CategoryManagerModal({
  categories,
  onClose,
  onChanged,
}: {
  categories: DBRecipeCategory[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🍽️");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/cuisine/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), icon }),
    });
    setName(""); setIcon("🍽️");
    onChanged();
    setSaving(false);
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    await fetch(`/api/cuisine/categories?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), icon: editIcon }),
    });
    setEditId(null);
    onChanged();
    setSaving(false);
  }

  async function handleDelete(id: string, catName: string) {
    if (!confirm(`Supprimer la catégorie « ${catName} » ? Les recettes associées ne seront pas supprimées.`)) return;
    await fetch(`/api/cuisine/categories?id=${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div style={ms.backdrop} onClick={onClose}>
      <div style={{ ...ms.modal, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={ms.header}>
          <div style={ms.title}>Gérer les catégories</div>
          <button onClick={onClose} style={ms.closeBtn}>✕</button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Create form */}
          <form onSubmit={handleCreate} style={{ display: "flex", gap: 8 }}>
            <input type="text" value={icon} onChange={(e) => setIcon(e.target.value)}
              style={{ ...ms.input, width: 52, textAlign: "center" }} placeholder="🍽️" />
            <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)}
              style={{ ...ms.input, flex: 1 }} placeholder="Nouvelle catégorie…" />
            <button type="submit" disabled={saving || !name.trim()} style={{ ...ms.btnPrimary, opacity: saving || !name.trim() ? 0.6 : 1 }}>
              Créer
            </button>
          </form>

          {/* Existing categories */}
          {categories.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              {categories.map((cat) => (
                <div key={cat.id}>
                  {editId === cat.id ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="text" value={editIcon} onChange={(e) => setEditIcon(e.target.value)}
                        style={{ ...ms.input, width: 52, textAlign: "center" }} />
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                        style={{ ...ms.input, flex: 1 }} autoFocus />
                      <button type="button" onClick={() => handleUpdate(cat.id)} disabled={saving} style={{ ...ms.btnPrimary, opacity: saving ? 0.6 : 1 }}>✓</button>
                      <button type="button" onClick={() => setEditId(null)} style={ms.btnSecondary}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px" }}>
                      <span style={{ fontSize: 16 }}>{cat.icon || "📂"}</span>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{cat.name}</span>
                      <button type="button" onClick={() => { setEditId(cat.id); setEditName(cat.name); setEditIcon(cat.icon ?? ""); }}
                        style={ms.btnEdit}>✎</button>
                      <button type="button" onClick={() => handleDelete(cat.id, cat.name)} style={ms.btnDelete}>✕</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Recipe card ───────────────────────────────────────────────────────────────

function RecipeCard({ recipe }: { recipe: DBRecipe }) {
  const snippet = recipe.steps ? stripMarkdown(recipe.steps).slice(0, 90) : null;

  return (
    <Link href={`/cuisine/${recipe.id}`} style={{ textDecoration: "none" }}>
      <div style={cardStyles.card}>
        {/* Category + icon */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 22 }}>{recipe.category_icon || "🍳"}</span>
          {recipe.category_name && (
            <span style={cardStyles.catBadge}>{recipe.category_name}</span>
          )}
        </div>

        {/* Title */}
        <h3 style={cardStyles.title}>{recipe.title}</h3>

        {/* Steps snippet */}
        {snippet && (
          <p style={cardStyles.snippet}>{snippet}{snippet.length >= 90 ? "…" : ""}</p>
        )}

        {/* Stats row */}
        <div style={cardStyles.statsRow}>
          {recipe.servings && (
            <span style={cardStyles.stat}>🍽️ {recipe.servings} {recipe.servings > 1 ? "portions" : "portion"}</span>
          )}
          {Number(recipe.ingredient_count ?? 0) > 0 && (
            <span style={cardStyles.stat}>🥄 {recipe.ingredient_count} ingr.</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CuisinePage() {
  useDynamicFavicon("🍳");
  useEffect(() => { document.title = "Cuisine — life×hub"; }, []);

  const [recipes, setRecipes] = useState<DBRecipe[]>([]);
  const [categories, setCategories] = useState<DBRecipeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<DBRecipe | null>(null);
  const [catManagerOpen, setCatManagerOpen] = useState(false);

  async function loadRecipes() {
    const res = await fetch("/api/cuisine/recipes");
    const data = await res.json();
    if (Array.isArray(data)) setRecipes(data);
    setLoading(false);
  }

  async function loadCategories() {
    const res = await fetch("/api/cuisine/categories");
    const data = await res.json();
    if (Array.isArray(data)) setCategories(data);
  }

  useEffect(() => {
    Promise.all([loadRecipes(), loadCategories()]);
  }, []);

  async function handleSave(data: {
    title: string; category_id: string; servings: string;
    steps: string; notes: string;
    ingredients: { name: string; quantity: string; unit: string }[];
  }) {
    if (editingRecipe) {
      await fetch(`/api/cuisine/recipes?id=${editingRecipe.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/cuisine/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setModalOpen(false);
    setEditingRecipe(null);
    loadRecipes();
  }

  // Fetch recipe with full ingredients before opening edit modal
  async function openEditModal(recipe: DBRecipe) {
    const res = await fetch(`/api/cuisine/recipes?id=${recipe.id}`);
    const full = await res.json();
    setEditingRecipe(full);
    setModalOpen(true);
  }

  const filtered = useMemo(() => {
    let result = [...recipes];
    if (selectedCatId) {
      result = result.filter((r) => r.category_id === selectedCatId);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        (r.ingredient_names ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [recipes, selectedCatId, search]);

  // Categories present in current results (for dynamic tab filtering)
  const usedCatIds = useMemo(() => new Set(recipes.map((r) => r.category_id).filter(Boolean)), [recipes]);
  const visibleCats = categories.filter((c) => usedCatIds.has(c.id));

  return (
    <main style={styles.main}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <span style={{ fontSize: 36 }}>🍳</span>
          <div>
            <h1 style={styles.title}>Cuisine</h1>
            <div style={styles.subtitle}>Mes recettes préférées</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => setCatManagerOpen(true)} style={styles.btnSecondary}>
              Catégories
            </button>
            <button onClick={() => { setEditingRecipe(null); setModalOpen(true); }} style={styles.btnPrimary}>
              + Nouvelle recette
            </button>
          </div>
        </div>

        {/* Stats */}
        {!loading && (
          <div style={styles.statsBar}>
            <span style={styles.statChip}>
              <strong style={{ color: "var(--accent)" }}>{recipes.length}</strong> recette{recipes.length !== 1 ? "s" : ""}
            </span>
            {categories.length > 0 && (
              <span style={styles.statChip}>
                <strong style={{ color: "var(--text)" }}>{categories.length}</strong> catégorie{categories.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Category filter tabs */}
      {visibleCats.length > 0 && (
        <div style={styles.catTabs}>
          <button
            onClick={() => setSelectedCatId("")}
            style={{ ...styles.catTab, ...(selectedCatId === "" ? styles.catTabActive : {}) }}
          >
            Toutes
          </button>
          {visibleCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCatId(c.id)}
              style={{ ...styles.catTab, ...(selectedCatId === c.id ? styles.catTabActive : {}) }}
            >
              {c.icon && <span style={{ marginRight: 4 }}>{c.icon}</span>}
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="text"
          placeholder="Rechercher par nom ou ingrédient…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 180, background: "var(--surface)", borderRadius: 14, border: "1.5px solid var(--border)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ fontSize: 48 }}>🍳</span>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 12 }}>
            {recipes.length === 0
              ? "Aucune recette pour l'instant. Ajoutez votre première !"
              : "Aucune recette ne correspond à la recherche."}
          </p>
          {recipes.length === 0 && (
            <button onClick={() => { setEditingRecipe(null); setModalOpen(true); }} style={styles.btnPrimary}>
              + Première recette
            </button>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}

      {/* Modals */}
      {modalOpen && (
        <RecipeModal
          mode={editingRecipe ? "edit" : "create"}
          initial={editingRecipe}
          categories={categories}
          onClose={() => { setModalOpen(false); setEditingRecipe(null); }}
          onSave={handleSave}
          onCategorySaved={(cat) => setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      )}

      {catManagerOpen && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setCatManagerOpen(false)}
          onChanged={async () => { await loadCategories(); }}
        />
      )}
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  main: { minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", gap: 24, padding: "40px 40px 60px", maxWidth: 1200, margin: "0 auto" },
  header: { display: "flex", flexDirection: "column", gap: 12 },
  titleRow: { display: "flex", alignItems: "center", gap: 16 },
  title: { fontSize: 26, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 },
  subtitle: { fontSize: 13, color: "var(--text-muted)", marginTop: 2 },
  statsBar: { display: "flex", gap: 10 },
  statChip: { fontSize: 12, color: "var(--text-muted)", background: "var(--surface)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 20 },
  catTabs: { display: "flex", gap: 6, flexWrap: "wrap" },
  catTab: { padding: "6px 16px", borderRadius: 50, fontSize: 12, fontWeight: 500, background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" },
  catTabActive: { background: "var(--accent)", color: "#fff", border: "1.5px solid var(--accent)" },
  searchInput: { fontSize: 13, padding: "9px 14px", background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "var(--font-sans)", outline: "none", width: 320 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0", gap: 8 },
  btnPrimary: { padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", cursor: "pointer", border: "none" },
  btnSecondary: { padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--surface)", color: "var(--text-muted)", cursor: "pointer", border: "1.5px solid var(--border)" },
};

const cardStyles: Record<string, React.CSSProperties> = {
  card: { background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8, cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s", boxShadow: "var(--shadow-sm)", minHeight: 160 },
  catBadge: { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(59,126,248,0.12)", color: "var(--accent)" },
  title: { fontSize: 16, fontWeight: 700, color: "var(--text)", margin: 0, letterSpacing: "-0.01em", lineHeight: 1.3 },
  snippet: { fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, margin: 0, flex: 1 },
  statsRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: "auto", paddingTop: 4 },
  stat: { fontSize: 11, color: "var(--text-muted)" },
};

// ── Modal styles ──────────────────────────────────────────────────────────────

const ms: Record<string, React.CSSProperties> = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" },
  modal: { background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 18, width: "100%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-md)" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 14px", borderBottom: "1px solid var(--border)" },
  title: { fontSize: 17, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" },
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
  btnEdit: { padding: "3px 8px", borderRadius: 6, fontSize: 13, background: "var(--surface2)", color: "var(--text-muted)", cursor: "pointer", border: "none" },
  btnDelete: { padding: "3px 8px", borderRadius: 6, fontSize: 13, background: "rgba(220,38,38,0.08)", color: "var(--red)", cursor: "pointer", border: "none" },
  btnRemoveIng: { width: 28, height: 28, borderRadius: 6, background: "rgba(220,38,38,0.08)", color: "var(--red)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 },
  btnAddIngredient: { fontSize: 12, fontWeight: 500, color: "var(--accent)", background: "transparent", border: "1.5px dashed var(--border)", borderRadius: 8, cursor: "pointer", padding: "8px 14px", textAlign: "left", marginTop: 2 },
};
