"use client";

import { useState, useEffect, useMemo } from "react";

// ─────────────────────────── Types ────────────────────────────────────────

interface ShoppingItem {
  id: string;
  name: string;
  category: string | null;
  estimated_price: string | null;
  purchased: boolean;
  store_link: string | null;
  notes: string | null;
  created_at: string | null;
}

interface Stats {
  total: number;
  budget_total: string;
  spent: string;
  remaining: string;
  total_non_purchased?: number;
}

type Tab = "general" | "categories";
type SortKey = "date" | "name" | "price";
type StatusFilter = "all" | "unpurchased" | "purchased";

const CATEGORIES = ["Sport", "Plaisir", "Cadeau", "Habits", "Autre"];

// ─────────────────────────── Helpers ──────────────────────────────────────

function categoryBadgeStyle(cat: string | null): React.CSSProperties {
  switch (cat) {
    case "Sport":
      return { background: "rgba(59,126,248,0.15)", color: "var(--accent)" };
    case "Plaisir":
      return { background: "rgba(232,79,123,0.15)", color: "var(--accent2)" };
    case "Cadeau":
      return { background: "rgba(22,163,74,0.15)", color: "var(--green)" };
    case "Habits":
      return { background: "rgba(234,179,8,0.15)", color: "#b45309" };
    default:
      return { background: "rgba(136,136,170,0.15)", color: "var(--text-muted)" };
  }
}

function formatPrice(price: string | null): string {
  if (price == null) return "—";
  const n = parseFloat(price);
  if (isNaN(n)) return "—";
  return `€${n.toFixed(2)}`;
}

function formatStoreLink(url: string | null): { label: string; href: string } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const full = parsed.hostname + parsed.pathname;
    return { label: full.length > 30 ? full.slice(0, 30) + "…" : full, href: url };
  } catch {
    return { label: url.length > 30 ? url.slice(0, 30) + "…" : url, href: url };
  }
}

function applyFiltersAndSort(
  items: ShoppingItem[],
  statusFilter: StatusFilter,
  search: string,
  sortKey: SortKey
): ShoppingItem[] {
  let result = [...items];

  if (statusFilter === "unpurchased") result = result.filter((i) => !i.purchased);
  if (statusFilter === "purchased") result = result.filter((i) => i.purchased);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter((i) => i.name.toLowerCase().includes(q));
  }

  result.sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name);
    if (sortKey === "price") {
      return (parseFloat(b.estimated_price ?? "0") || 0) - (parseFloat(a.estimated_price ?? "0") || 0);
    }
    // date DESC
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db_ = b.created_at ? new Date(b.created_at).getTime() : 0;
    return db_ - da;
  });

  return result;
}

// ─────────────────────────── Modal ────────────────────────────────────────

interface ModalProps {
  mode: "create" | "edit";
  initial?: Partial<ShoppingItem>;
  onClose: () => void;
  onSave: (data: Partial<ShoppingItem>) => Promise<void>;
}

function ItemModal({ mode, initial, onClose, onSave }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Autre");
  const [price, setPrice] = useState(initial?.estimated_price ?? "");
  const [storeLink, setStoreLink] = useState(initial?.store_link ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [purchased, setPurchased] = useState(initial?.purchased ?? false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      category: category || null,
      estimated_price: price !== "" ? price : null,
      store_link: storeLink !== "" ? storeLink : null,
      notes: notes !== "" ? notes : null,
      purchased,
    });
    setSaving(false);
  }

  return (
    <div style={modalStyles.backdrop} onClick={onClose}>
      <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.title}>
          {mode === "create" ? "Nouvel article" : "Modifier l'article"}
        </div>
        <form onSubmit={handleSubmit} style={modalStyles.form}>
          <label style={modalStyles.label}>Nom *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            style={modalStyles.input}
            placeholder="Nom de l'article"
          />

          <label style={modalStyles.label}>Catégorie</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={modalStyles.select}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <label style={modalStyles.label}>Prix estimé (€)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            step="0.01"
            min="0"
            style={modalStyles.input}
            placeholder="0.00"
          />

          <label style={modalStyles.label}>Store Link (URL)</label>
          <input
            type="text"
            value={storeLink}
            onChange={(e) => setStoreLink(e.target.value)}
            style={modalStyles.input}
            placeholder="https://..."
          />

          <label style={modalStyles.label}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={modalStyles.textarea}
            rows={3}
            placeholder="Notes optionnelles..."
          />

          <label style={{ ...modalStyles.label, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={purchased}
              onChange={(e) => setPurchased(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            Acheté
          </label>

          <div style={modalStyles.actions}>
            <button type="button" onClick={onClose} style={modalStyles.btnCancel}>
              Annuler
            </button>
            <button type="submit" disabled={saving} style={{ ...modalStyles.btnSave, opacity: saving ? 0.6 : 1 }}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const modalStyles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "var(--surface)", border: "1.5px solid var(--border)",
    borderRadius: 16, padding: "32px 36px", width: 480, maxWidth: "95vw",
    boxShadow: "var(--shadow-md)", display: "flex", flexDirection: "column", gap: 16,
  },
  title: { fontSize: 18, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" },
  input: {
    fontSize: 13, padding: "10px 14px",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    borderRadius: 8, color: "var(--text)", fontFamily: "var(--font-sans)",
    outline: "none",
  },
  select: {
    fontSize: 13, padding: "10px 14px",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    borderRadius: 8, color: "var(--text)",
  },
  textarea: {
    fontSize: 13, padding: "10px 14px",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    borderRadius: 8, color: "var(--text)", fontFamily: "var(--font-sans)",
    resize: "vertical", outline: "none",
  },
  actions: { display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 },
  btnCancel: {
    padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: "var(--surface2)", border: "1.5px solid var(--border)",
    color: "var(--text)", cursor: "pointer",
  },
  btnSave: {
    padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: "var(--accent)", color: "#fff", cursor: "pointer", border: "none",
  },
};

// ─────────────────────────── Items Table ──────────────────────────────────

interface ItemsTableProps {
  items: ShoppingItem[];
  onTogglePurchased: (item: ShoppingItem) => void;
  onEdit: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
  onNewItem: () => void;
  showCategory?: boolean;
}

function ItemsTable({ items, onTogglePurchased, onEdit, onDelete, onNewItem, showCategory = true }: ItemsTableProps) {
  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Item</th>
            {showCategory && <th style={styles.th}>Catégorie</th>}
            <th style={{ ...styles.th, textAlign: "right" }}>Prix estimé</th>
            <th style={{ ...styles.th, textAlign: "center" }}>Acheté</th>
            <th style={styles.th}>Store Link</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={showCategory ? 6 : 5} style={styles.emptyCell}>Aucun article</td>
            </tr>
          ) : (
            items.map((item) => {
              const link = formatStoreLink(item.store_link);
              const rowOpacity = item.purchased ? 0.5 : 1;
              return (
                <tr key={item.id} style={{ ...styles.tr, opacity: rowOpacity }}>
                  <td style={{ ...styles.td, fontWeight: 500 }}>
                    <span style={item.purchased ? { textDecoration: "line-through" } : {}}>
                      {item.name}
                    </span>
                  </td>
                  {showCategory && (
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...categoryBadgeStyle(item.category) }}>
                        {item.category ?? "Autre"}
                      </span>
                    </td>
                  )}
                  <td style={{ ...styles.td, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                    {formatPrice(item.estimated_price)}
                  </td>
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={item.purchased}
                      onChange={() => onTogglePurchased(item)}
                      style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--accent)" }}
                    />
                  </td>
                  <td style={styles.td}>
                    {link ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer"
                        style={{ color: "var(--accent)", textDecoration: "none", fontSize: 12 }}>
                        {link.label}
                      </a>
                    ) : "—"}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button style={styles.btnEdit} onClick={() => onEdit(item)} title="Modifier">✎</button>
                      <button style={styles.btnDelete}
                        onClick={() => { if (confirm(`Supprimer "${item.name}" ?`)) onDelete(item.id); }}
                        title="Supprimer">✕</button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
          <tr>
            <td colSpan={showCategory ? 6 : 5} style={{ padding: "8px 16px" }}>
              <button onClick={onNewItem} style={styles.btnNewItem}>+ New item</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────── Main Page ────────────────────────────────────

export default function ShoppingPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("general");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);

  // Expanded groups for category view
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const load = async () => {
    try {
      const res = await fetch("/api/shopping/items");
      const data = await res.json();
      if (!data.error) {
        setItems(data.items);
        setStats(data.stats);
        // Default all groups to expanded
        const groups: Record<string, boolean> = {};
        for (const item of data.items as ShoppingItem[]) {
          const key = item.category ?? "Autre";
          groups[key] = true;
        }
        setExpandedGroups((prev) => {
          const merged = { ...groups };
          for (const k of Object.keys(prev)) {
            merged[k] = prev[k];
          }
          return merged;
        });
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredItems = useMemo(
    () => applyFiltersAndSort(items, statusFilter, search, sortKey),
    [items, statusFilter, search, sortKey]
  );

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const item of filteredItems) {
      const key = item.category ?? "Autre";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [filteredItems]);

  async function handleTogglePurchased(item: ShoppingItem) {
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => i.id === item.id ? { ...i, purchased: !i.purchased } : i)
    );
    await fetch(`/api/shopping/items?id=${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purchased: !item.purchased }),
    });
    load(); // refresh stats
  }

  async function handleDelete(id: string) {
    await fetch(`/api/shopping/items?id=${id}`, { method: "DELETE" });
    load();
  }

  async function handleSaveModal(data: Partial<ShoppingItem>) {
    if (editingItem) {
      await fetch(`/api/shopping/items?id=${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/shopping/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setModalOpen(false);
    setEditingItem(null);
    load();
  }

  function openCreate() {
    setEditingItem(null);
    setModalOpen(true);
  }

  function openEdit(item: ShoppingItem) {
    setEditingItem(item);
    setModalOpen(true);
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "general", label: "Général" },
    { key: "categories", label: "Par catégorie" },
  ];

  return (
    <main style={styles.main}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <span style={{ fontSize: 28 }}>🎁</span>
          <div>
            <h1 style={styles.title}>Shopping</h1>
            <div style={styles.subtitle}>Wishlist et liste de courses avec suivi du budget</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabsBar}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...styles.tab,
                ...(tab === t.key ? { background: "var(--accent)", color: "#fff" } : {}),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards — always visible */}
      {stats && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>🛒</div>
            <div style={styles.statValue}>{stats.total}</div>
            <div style={styles.statLabel}>Total articles</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>💰</div>
            <div style={styles.statValue}>€{stats.budget_total}</div>
            <div style={styles.statLabel}>Budget estimé</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>✅</div>
            <div style={styles.statValue}>€{stats.spent}</div>
            <div style={styles.statLabel}>Déjà acheté</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statIcon}>⏳</div>
            <div style={styles.statValue}>€{stats.remaining}</div>
            <div style={styles.statLabel}>Reste à dépenser</div>
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div style={styles.filtersBar}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          style={styles.filterSelect}
        >
          <option value="all">Tous</option>
          <option value="unpurchased">Non acheté</option>
          <option value="purchased">Acheté</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={styles.filterSelect}
        >
          <option value="date">Trier par : Date</option>
          <option value="name">Trier par : Nom</option>
          <option value="price">Trier par : Prix</option>
        </select>
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.filterInput}
        />
      </div>

      {/* Content */}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.muted}>Chargement...</div>
        ) : tab === "general" ? (
          <ItemsTable
            items={filteredItems}
            onTogglePurchased={handleTogglePurchased}
            onEdit={openEdit}
            onDelete={handleDelete}
            onNewItem={openCreate}
            showCategory={true}
          />
        ) : (
          /* Par catégorie */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {grouped.size === 0 ? (
              <div style={styles.muted}>Aucun article</div>
            ) : (
              Array.from(grouped.entries()).map(([catKey, catItems]) => {
                const subtotal = catItems.reduce(
                  (sum, i) => sum + (parseFloat(i.estimated_price ?? "0") || 0),
                  0
                );
                const isExpanded = expandedGroups[catKey] !== false;

                return (
                  <div key={catKey} style={styles.catGroup}>
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(catKey)}
                      style={styles.catHeader}
                    >
                      <span style={{ fontSize: 12 }}>{isExpanded ? "▼" : "▶"}</span>
                      <span style={{ ...styles.badge, ...categoryBadgeStyle(catKey) }}>
                        {catKey}
                      </span>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                        ({catItems.length} article{catItems.length !== 1 ? "s" : ""})
                      </span>
                      <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: "auto" }}>
                        Sous-total : <strong style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>€{subtotal.toFixed(2)}</strong>
                      </span>
                    </button>

                    {/* Expanded sub-table */}
                    {isExpanded && (
                      <ItemsTable
                        items={catItems}
                        onTogglePurchased={handleTogglePurchased}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                        onNewItem={openCreate}
                        showCategory={false}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <ItemModal
          mode={editingItem ? "edit" : "create"}
          initial={editingItem ?? undefined}
          onClose={() => { setModalOpen(false); setEditingItem(null); }}
          onSave={handleSaveModal}
        />
      )}
    </main>
  );
}

// ─────────────────────────── Styles ───────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh", background: "var(--bg)",
    display: "flex", flexDirection: "column",
    alignItems: "stretch", padding: "48px 40px", gap: 28,
    maxWidth: 1200, margin: "0 auto",
  },
  header: {
    display: "flex", flexDirection: "column", gap: 20,
  },
  logo: { display: "flex", alignItems: "center", gap: 16 },
  title: {
    fontSize: 24, fontWeight: 700, color: "var(--text)",
    letterSpacing: "-0.02em", margin: 0,
  },
  subtitle: { fontSize: 14, color: "var(--text-muted)", marginTop: 4 },
  tabsBar: {
    display: "flex", gap: 8, background: "var(--surface)",
    padding: 4, borderRadius: 50, border: "1px solid var(--border)",
    alignSelf: "flex-start",
  },
  tab: {
    padding: "8px 24px", borderRadius: 50, fontSize: 13, fontWeight: 500,
    background: "transparent", color: "var(--text-muted)",
    transition: "all 0.2s", letterSpacing: "0.04em",
    cursor: "pointer", border: "none",
  },
  statsGrid: {
    display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16,
  },
  statCard: {
    background: "var(--bg)", border: "1px solid var(--border)",
    borderRadius: 12, padding: 16, textAlign: "center",
  },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: {
    fontFamily: "var(--font-mono)", fontSize: 22,
    fontWeight: 700, color: "var(--accent)",
  },
  statLabel: {
    fontSize: 11, color: "var(--text-muted)",
    marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em",
  },
  filtersBar: {
    display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
  },
  filterSelect: {
    fontSize: 13, padding: "8px 12px",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    borderRadius: 8, color: "var(--text)",
  },
  filterInput: {
    fontSize: 13, padding: "8px 12px",
    background: "var(--bg)", border: "1.5px solid var(--border)",
    borderRadius: 8, color: "var(--text)",
    fontFamily: "var(--font-sans)", outline: "none", width: 200,
  },
  content: { display: "flex", flexDirection: "column", gap: 16 },
  tableWrapper: {
    background: "var(--surface)", border: "1.5px solid var(--border)",
    borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-md)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left", padding: "12px 16px", fontSize: 10,
    fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
    color: "var(--text-muted)", borderBottom: "1px solid var(--border)",
    background: "var(--bg)",
  },
  tr: { borderBottom: "1px solid var(--border)" },
  td: { padding: "12px 16px", color: "var(--text)", verticalAlign: "middle" },
  emptyCell: {
    padding: "32px 16px", textAlign: "center",
    color: "var(--text-muted)", fontSize: 13,
  },
  badge: {
    display: "inline-block", padding: "3px 8px", borderRadius: 6,
    fontSize: 11, fontWeight: 600,
  },
  actions: { display: "flex", gap: 6 },
  btnEdit: {
    padding: "4px 8px", borderRadius: 6, fontSize: 13,
    background: "var(--surface2)", color: "var(--text-muted)", cursor: "pointer",
    border: "none",
  },
  btnDelete: {
    padding: "4px 8px", borderRadius: 6, fontSize: 13,
    background: "rgba(220,38,38,0.08)", color: "var(--red)", cursor: "pointer",
    border: "none",
  },
  btnNewItem: {
    fontSize: 13, fontWeight: 500, color: "var(--accent)",
    background: "transparent", border: "none", cursor: "pointer",
    padding: "4px 0",
  },
  muted: { fontSize: 13, color: "var(--text-muted)" },
  catGroup: {
    background: "var(--surface)", border: "1.5px solid var(--border)",
    borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-md)",
  },
  catHeader: {
    width: "100%", display: "flex", alignItems: "center", gap: 12,
    padding: "14px 20px", background: "transparent", border: "none",
    cursor: "pointer", borderBottom: "1px solid var(--border)",
    color: "var(--text)", fontSize: 14, fontWeight: 600,
  },
};
