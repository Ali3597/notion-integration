"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { DBBook, DBAuthor, DBGenre, DBSerie, DBBookNote } from "@/types";
import { CustomSelect } from "@/components/CustomSelect";

// ─────────────────────────── Constants ────────────────────────────────────

type MainTab = "library" | "authors" | "genres" | "series" | "notes";
type BookStatus = "En cours" | "Souhait" | "Pas Lu" | "Lu";
const BOOK_STATUSES: BookStatus[] = ["En cours", "Souhait", "Pas Lu", "Lu"];
const SERIE_STATUSES = ["En cours", "Terminé", "Abandonné"];

// ─────────────────────────── Star Rating ──────────────────────────────────

function StarRating({ value, onChange, readonly }: { value: number | null; onChange?: (n: number | null) => void; readonly?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value ?? 0;
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            fontSize: 14, cursor: readonly ? "default" : "pointer",
            color: n <= display ? "#f59e0b" : "var(--border)",
            transition: "color 0.1s",
          }}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(null)}
          onClick={() => {
            if (readonly || !onChange) return;
            onChange(value === n ? null : n);
          }}
        >
          {n <= display ? "★" : "☆"}
        </span>
      ))}
    </span>
  );
}

// ─────────────────────────── Book cover placeholder ───────────────────────

function BookCover({ imageUrl, title, size = "card" }: { imageUrl: string | null; title: string; size?: "card" | "drawer" }) {
  const w = size === "drawer" ? 100 : 80;
  const h = size === "drawer" ? 140 : 112;
  const [loaded, setLoaded] = useState(false);
  const initials = title.split(" ").slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
  const placeholder = (
    <div style={{
      position: "absolute", inset: 0, borderRadius: 6,
      background: "linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size === "drawer" ? 22 : 18, fontWeight: 700, letterSpacing: 1,
      opacity: loaded ? 0 : 1, transition: "opacity 0.3s",
    }}>
      {initials || "?"}
    </div>
  );
  if (imageUrl) {
    return (
      <div style={{ position: "relative", width: w, height: h, flexShrink: 0, cursor: "inherit" }}>
        {placeholder}
        <img src={imageUrl} alt={title} loading="eager"
          onLoad={() => setLoaded(true)}
          style={{ position: "absolute", inset: 0, width: w, height: h, objectFit: "cover", borderRadius: 6, display: "block", opacity: loaded ? 1 : 0, transition: "opacity 0.3s", cursor: "inherit" }} />
      </div>
    );
  }
  return (
    <div style={{
      width: w, height: h, borderRadius: 6, flexShrink: 0,
      background: "linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size === "drawer" ? 22 : 18, fontWeight: 700, letterSpacing: 1,
      cursor: "inherit",
    }}>
      {initials || "?"}
    </div>
  );
}

// ─────────────────────────── Status badge ─────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  const color = status === "En cours" ? "rgba(59,126,248,0.12)" : status === "Lu" ? "rgba(22,163,74,0.12)" : status === "Terminé" ? "rgba(22,163,74,0.12)" : status === "Abandonné" ? "rgba(220,38,38,0.1)" : "rgba(136,136,170,0.12)";
  const text = status === "En cours" ? "var(--accent)" : status === "Lu" || status === "Terminé" ? "var(--green)" : status === "Abandonné" ? "var(--red)" : "var(--text-muted)";
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: color, color: text }}>
      {status ?? "—"}
    </span>
  );
}

// ─────────────────────────── Drawer wrapper ───────────────────────────────

function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 400 }} onClick={onClose} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 480, maxWidth: "95vw",
        background: "var(--surface)", borderLeft: "1.5px solid var(--border)",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.12)", zIndex: 401,
        display: "flex", flexDirection: "column", overflowY: "auto",
      }}>
        {children}
      </div>
    </>
  );
}

// ─────────────────────────── Modal wrapper ────────────────────────────────

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, padding: "28px 32px", width: 520, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-md)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────── Form helpers ─────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
      <label style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: 13, padding: "9px 12px", background: "var(--bg)", border: "1.5px solid var(--border)",
  borderRadius: 8, color: "var(--text)", fontFamily: "var(--font-sans)", outline: "none", width: "100%",
};

const selectStyle: React.CSSProperties = {
  fontSize: 13, padding: "9px 12px", background: "var(--bg)", border: "1.5px solid var(--border)",
  borderRadius: 8, color: "var(--text)", width: "100%",
};

// ─────────────────────────── Book Drawer ──────────────────────────────────

function BookDrawer({ book, authors, genres, seriesList, onClose, onUpdate }: {
  book: DBBook; authors: DBAuthor[]; genres: DBGenre[]; seriesList: DBSerie[];
  onClose: () => void; onUpdate: () => void;
}) {
  const [title, setTitle] = useState(book.title);
  const [authorId, setAuthorId] = useState(book.author_id ?? "");
  const [genreId, setGenreId] = useState(book.genre_id ?? "");
  const [serieId, setSerieId] = useState(book.serie_id ?? "");
  const [status, setStatus] = useState(book.status ?? "Pas Lu");
  const [rating, setRating] = useState<number | null>(book.rating);
  const [imageUrl, setImageUrl] = useState(book.image_url ?? "");
  const [startedAt, setStartedAt] = useState(book.started_at ?? "");
  const [finishedAt, setFinishedAt] = useState(book.finished_at ?? "");
  const [saving, setSaving] = useState(false);

  const [notes, setNotes] = useState<DBBookNote[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");

  const loadNotes = useCallback(async () => {
    const res = await fetch(`/api/library/notes?book_id=${book.id}`);
    const data = await res.json();
    if (Array.isArray(data)) setNotes(data);
  }, [book.id]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/library/books?id=${book.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, author_id: authorId || null, genre_id: genreId || null, serie_id: serieId || null, status, rating, image_url: imageUrl || null, started_at: startedAt || null, finished_at: finishedAt || null }),
    });
    setSaving(false);
    onUpdate();
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;
    await fetch("/api/library/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newNoteTitle.trim(), book_id: book.id, content: newNoteContent || null }),
    });
    setNewNoteTitle(""); setNewNoteContent(""); setAddingNote(false);
    loadNotes();
  }

  async function handleSaveNote(id: string) {
    await fetch(`/api/library/notes?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editNoteContent }),
    });
    setEditingNoteId(null);
    loadNotes();
  }

  async function handleDeleteNote(id: string) {
    if (!confirm("Supprimer cette note ?")) return;
    await fetch(`/api/library/notes?id=${id}`, { method: "DELETE" });
    loadNotes();
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", flex: 1, marginRight: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.title}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "var(--text-muted)", cursor: "pointer", padding: "2px 6px" }}>✕</button>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <BookCover imageUrl={book.image_url} title={book.title} size="drawer" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <StatusBadge status={status} />
            <StarRating value={rating} onChange={setRating} />
            {book.author_name && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{book.author_name}</div>}
            {book.genre_name && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{book.genre_name}</div>}
            {book.serie_name && <div style={{ fontSize: 12, color: "var(--accent)" }}>Série : {book.serie_name}</div>}
          </div>
        </div>

        <Field label="Titre">
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Auteur">
          <CustomSelect
            value={authorId}
            onChange={setAuthorId}
            placeholder="— Aucun —"
            searchable
            options={[{ value: "", label: "— Aucun —" }, ...authors.map((a) => ({ value: a.id, label: a.name }))]}
          />
        </Field>
        <Field label="Genre">
          <CustomSelect
            value={genreId}
            onChange={setGenreId}
            placeholder="— Aucun —"
            options={[{ value: "", label: "— Aucun —" }, ...genres.map((g) => ({ value: g.id, label: g.name }))]}
          />
        </Field>
        <Field label="Série">
          <CustomSelect
            value={serieId}
            onChange={setSerieId}
            placeholder="— Aucune —"
            options={[{ value: "", label: "— Aucune —" }, ...seriesList.map((s) => ({ value: s.id, label: s.name }))]}
          />
        </Field>
        <Field label="Statut">
          <CustomSelect
            value={status}
            onChange={setStatus}
            options={BOOK_STATUSES.map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="URL couverture">
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} style={inputStyle} placeholder="https://..." />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Début">
            <input type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Fin">
            <input type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} style={inputStyle} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving}
            style={{ flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", cursor: "pointer", border: "none", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
          {status !== "Lu" && (
            <button onClick={() => { setStatus("Lu"); setFinishedAt(new Date().toISOString().slice(0, 10)); }}
              style={{ padding: "9px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(22,163,74,0.1)", color: "var(--green)", cursor: "pointer", border: "1.5px solid rgba(22,163,74,0.3)", whiteSpace: "nowrap" }}>
              ✓ Marquer Lu
            </button>
          )}
        </div>

        {/* Notes */}
        <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Notes ({notes.length})</div>
            <button onClick={() => setAddingNote((v) => !v)}
              style={{ fontSize: 12, fontWeight: 500, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>
              {addingNote ? "Annuler" : "+ Ajouter"}
            </button>
          </div>

          {addingNote && (
            <form onSubmit={handleAddNote} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, background: "var(--bg)", borderRadius: 8, padding: 12, border: "1px solid var(--border)" }}>
              <input value={newNoteTitle} onChange={(e) => setNewNoteTitle(e.target.value)} placeholder="Titre de la note" style={inputStyle} autoFocus />
              <textarea value={newNoteContent} onChange={(e) => setNewNoteContent(e.target.value)} placeholder="Contenu (optionnel)..." rows={3}
                style={{ ...inputStyle, resize: "vertical" }} />
              <button type="submit" style={{ alignSelf: "flex-end", padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>
                Ajouter
              </button>
            </form>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notes.map((note) => (
              <div key={note.id} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", flex: 1 }}>{note.title}</div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => { setEditingNoteId(note.id); setEditNoteContent(note.content ?? ""); }}
                      style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--surface2)", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>✎</button>
                    <button onClick={() => handleDeleteNote(note.id)}
                      style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", color: "var(--red)" }}>✕</button>
                  </div>
                </div>
                {editingNoteId === note.id ? (
                  <div style={{ marginTop: 8 }}>
                    <textarea value={editNoteContent} onChange={(e) => setEditNoteContent(e.target.value)} rows={4}
                      style={{ ...inputStyle, resize: "vertical", marginBottom: 6 }} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleSaveNote(note.id)}
                        style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>Sauver</button>
                      <button onClick={() => setEditingNoteId(null)}
                        style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, background: "var(--surface2)", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>Annuler</button>
                    </div>
                  </div>
                ) : note.content ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>{note.content}</div>
                ) : null}
              </div>
            ))}
            {notes.length === 0 && !addingNote && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "12px 0" }}>Aucune note</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────── Tab: Ma Bibliothèque ─────────────────────────

function TabLibrary({ books, authors, genres, seriesList, onUpdate }: {
  books: DBBook[]; authors: DBAuthor[]; genres: DBGenre[]; seriesList: DBSerie[]; onUpdate: () => void;
}) {
  const [subTab, setSubTab] = useState<BookStatus>("En cours");
  const [selectedBook, setSelectedBook] = useState<DBBook | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", author_id: "", genre_id: "", serie_id: "", status: "Pas Lu" as string, image_url: "", started_at: "", finished_at: "" });
  const [saving, setSaving] = useState(false);

  const filtered = books.filter((b) => b.status === subTab);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    await fetch("/api/library/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, author_id: form.author_id || null, genre_id: form.genre_id || null, serie_id: form.serie_id || null, image_url: form.image_url || null, started_at: form.started_at || null, finished_at: form.finished_at || null }),
    });
    setForm({ title: "", author_id: "", genre_id: "", serie_id: "", status: "Pas Lu", image_url: "", started_at: "", finished_at: "" });
    setSaving(false);
    setAddOpen(false);
    onUpdate();
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Supprimer "${title}" ?`)) return;
    await fetch(`/api/library/books?id=${id}`, { method: "DELETE" });
    if (selectedBook?.id === id) setSelectedBook(null);
    onUpdate();
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", padding: 4, borderRadius: 50, border: "1px solid var(--border)" }}>
          {BOOK_STATUSES.map((s) => {
            const count = books.filter((b) => b.status === s).length;
            return (
              <button key={s} onClick={() => setSubTab(s)} style={{
                padding: "6px 14px", borderRadius: 50, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer",
                background: subTab === s ? "var(--accent)" : "transparent",
                color: subTab === s ? "#fff" : "var(--text-muted)",
              }}>
                {s} {count > 0 && <span style={{ fontSize: 10, marginLeft: 2, opacity: 0.8 }}>({count})</span>}
              </button>
            );
          })}
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}
          style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>
          + Ajouter un livre
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: 13 }}>Aucun livre dans cette catégorie</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
          {filtered.map((book) => (
            <div key={book.id} onClick={() => setSelectedBook(book)}
              style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 12, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, transition: "border-color 0.15s, box-shadow 0.15s", boxShadow: "var(--shadow-sm)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)"; }}>
              <BookCover imageUrl={book.image_url} title={book.title} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", lineHeight: 1.3, marginBottom: 3 }}>{book.title}</div>
                {book.author_name && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{book.author_name}</div>}
                {book.rating && <StarRating value={book.rating} readonly />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Book drawer */}
      <Drawer open={!!selectedBook} onClose={() => setSelectedBook(null)}>
        {selectedBook && (
          <BookDrawer
            book={selectedBook} authors={authors} genres={genres} seriesList={seriesList}
            onClose={() => setSelectedBook(null)}
            onUpdate={() => { onUpdate(); setSelectedBook(null); }}
          />
        )}
      </Drawer>

      {/* Add book modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Ajouter un livre">
        <form onSubmit={handleAdd}>
          <Field label="Titre *">
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={inputStyle} autoFocus required />
          </Field>
          <Field label="Auteur">
            <CustomSelect
              value={form.author_id}
              onChange={(v) => setForm((f) => ({ ...f, author_id: v }))}
              placeholder="— Aucun —"
              searchable
              options={[{ value: "", label: "— Aucun —" }, ...authors.map((a) => ({ value: a.id, label: a.name }))]}
            />
          </Field>
          <Field label="Genre">
            <CustomSelect
              value={form.genre_id}
              onChange={(v) => setForm((f) => ({ ...f, genre_id: v }))}
              placeholder="— Aucun —"
              options={[{ value: "", label: "— Aucun —" }, ...genres.map((g) => ({ value: g.id, label: g.name }))]}
            />
          </Field>
          <Field label="Série">
            <CustomSelect
              value={form.serie_id}
              onChange={(v) => setForm((f) => ({ ...f, serie_id: v }))}
              placeholder="— Aucune —"
              options={[{ value: "", label: "— Aucune —" }, ...seriesList.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </Field>
          <Field label="Statut">
            <CustomSelect
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v }))}
              options={BOOK_STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </Field>
          <Field label="URL couverture">
            <input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} style={inputStyle} placeholder="https://..." />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Début"><input type="date" value={form.started_at} onChange={(e) => setForm((f) => ({ ...f, started_at: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Fin"><input type="date" value={form.finished_at} onChange={(e) => setForm((f) => ({ ...f, finished_at: e.target.value }))} style={inputStyle} /></Field>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={() => setAddOpen(false)} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text)", cursor: "pointer" }}>Annuler</button>
            <button type="submit" disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "..." : "Ajouter"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─────────────────────────── Tab: Auteurs ─────────────────────────────────

function TabAuthors({ authors, books, onUpdate }: { authors: DBAuthor[]; books: DBBook[]; onUpdate: () => void }) {
  const [selected, setSelected] = useState<DBAuthor | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState(""); const [photoUrl, setPhotoUrl] = useState(""); const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState(""); const [editPhoto, setEditPhoto] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/library/authors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), photo_url: photoUrl || null }) });
    setName(""); setPhotoUrl(""); setSaving(false); setAddOpen(false); onUpdate();
  }

  async function handleSaveEdit(id: string) {
    await fetch(`/api/library/authors?id=${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName, photo_url: editPhoto || null }) });
    setEditId(null); onUpdate();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    await fetch(`/api/library/authors?id=${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    onUpdate();
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn-primary" onClick={() => setAddOpen(true)} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>+ Ajouter un auteur</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
        {authors.map((a) => {
          const initials = a.name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
          const bCount = books.filter((b) => b.author_id === a.id).length;
          return (
            <div key={a.id} onClick={() => setSelected(a)}
              style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12, padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center", boxShadow: "var(--shadow-sm)", transition: "border-color 0.15s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}>
              {a.photo_url ? (
                <img src={a.photo_url} alt={a.name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 700 }}>{initials}</div>
              )}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{a.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{bCount} livre{bCount !== 1 ? "s" : ""}</div>
              </div>
            </div>
          );
        })}
      </div>

      <Drawer open={!!selected} onClose={() => setSelected(null)}>
        {selected && (() => {
          const authorBooks = books.filter((b) => b.author_id === selected.id);
          const initials = selected.name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{selected.name}</div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 18, color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                  {selected.photo_url ? <img src={selected.photo_url} alt={selected.name} style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover" }} />
                    : <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24, fontWeight: 700 }}>{initials}</div>}
                  <div>
                    {editId === selected.id ? (
                      <>
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inputStyle, marginBottom: 6 }} />
                        <input value={editPhoto} onChange={(e) => setEditPhoto(e.target.value)} style={inputStyle} placeholder="URL photo" />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={() => handleSaveEdit(selected.id)} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>Sauver</button>
                          <button onClick={() => setEditId(null)} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, background: "var(--surface2)", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>Annuler</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>{authorBooks.length} livre{authorBooks.length !== 1 ? "s" : ""}</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => { setEditId(selected.id); setEditName(selected.name); setEditPhoto(selected.photo_url ?? ""); }} style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, background: "var(--surface2)", border: "1.5px solid var(--border)", cursor: "pointer", color: "var(--text-muted)" }}>✎ Modifier</button>
                          <button onClick={() => handleDelete(selected.id, selected.name)} style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", color: "var(--red)" }}>Supprimer</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Livres</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {authorBooks.map((b) => (
                    <div key={b.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <BookCover imageUrl={b.image_url} title={b.title} size="card" />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{b.title}</div>
                        <StatusBadge status={b.status} />
                      </div>
                    </div>
                  ))}
                  {authorBooks.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun livre</div>}
                </div>
              </div>
            </>
          );
        })()}
      </Drawer>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Ajouter un auteur">
        <form onSubmit={handleAdd}>
          <Field label="Nom *"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus required /></Field>
          <Field label="URL photo"><input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} style={inputStyle} placeholder="https://..." /></Field>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setAddOpen(false)} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text)", cursor: "pointer" }}>Annuler</button>
            <button type="submit" disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>{saving ? "..." : "Ajouter"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─────────────────────────── Tab: Genres ──────────────────────────────────

function TabGenres({ genres, books, onUpdate }: { genres: DBGenre[]; books: DBBook[]; onUpdate: () => void }) {
  const [selected, setSelected] = useState<DBGenre | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState(""); const [icon, setIcon] = useState(""); const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null); const [editName, setEditName] = useState(""); const [editIcon, setEditIcon] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/library/genres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), icon: icon || null }) });
    setName(""); setIcon(""); setSaving(false); setAddOpen(false); onUpdate();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer le genre "${name}" ?`)) return;
    await fetch(`/api/library/genres?id=${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    onUpdate();
  }

  const GENRE_COLORS = ["rgba(59,126,248,0.12)", "rgba(232,79,123,0.12)", "rgba(22,163,74,0.12)", "rgba(234,179,8,0.12)", "rgba(136,136,170,0.12)", "rgba(249,115,22,0.12)"];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn-primary" onClick={() => setAddOpen(true)} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>+ Ajouter un genre</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
        {genres.map((g, i) => {
          const bCount = books.filter((b) => b.genre_id === g.id).length;
          return (
            <div key={g.id} onClick={() => setSelected(g)}
              style={{ background: GENRE_COLORS[i % GENRE_COLORS.length], border: "1.5px solid var(--border)", borderRadius: 12, padding: "20px 16px", cursor: "pointer", textAlign: "center", transition: "border-color 0.15s, box-shadow 0.15s", boxShadow: "var(--shadow-sm)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-md)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)"; }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{g.icon || "📖"}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{g.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{bCount} livre{bCount !== 1 ? "s" : ""}</div>
            </div>
          );
        })}
      </div>

      <Drawer open={!!selected} onClose={() => setSelected(null)}>
        {selected && (() => {
          const genreBooks = books.filter((b) => b.genre_id === selected.id);
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{selected.name}</div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 18, color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ padding: "20px 24px" }}>
                {editId === selected.id ? (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input value={editIcon} onChange={(e) => setEditIcon(e.target.value)} style={{ ...inputStyle, width: 60, textAlign: "center", fontSize: 20 }} placeholder="🖊️" />
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={async () => { await fetch(`/api/library/genres?id=${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName, icon: editIcon || null }) }); setEditId(null); onUpdate(); }} style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>Sauver</button>
                      <button onClick={() => setEditId(null)} style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, background: "var(--surface2)", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button onClick={() => { setEditId(selected.id); setEditName(selected.name); setEditIcon(selected.icon ?? ""); }} style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, background: "var(--surface2)", border: "1.5px solid var(--border)", cursor: "pointer", color: "var(--text-muted)" }}>✎ Modifier</button>
                    <button onClick={() => handleDelete(selected.id, selected.name)} style={{ padding: "5px 10px", borderRadius: 6, fontSize: 11, background: "rgba(220,38,38,0.08)", border: "none", cursor: "pointer", color: "var(--red)" }}>Supprimer</button>
                  </div>
                )}
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Livres ({genreBooks.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {genreBooks.map((b) => (
                    <div key={b.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <BookCover imageUrl={b.image_url} title={b.title} size="card" />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{b.title}</div>
                        {b.author_name && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{b.author_name}</div>}
                        <StatusBadge status={b.status} />
                      </div>
                    </div>
                  ))}
                  {genreBooks.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun livre</div>}
                </div>
              </div>
            </>
          );
        })()}
      </Drawer>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Ajouter un genre">
        <form onSubmit={handleAdd}>
          <Field label="Icône">
            <input value={icon} onChange={(e) => setIcon(e.target.value)} style={{ ...inputStyle, fontSize: 20, textAlign: "center" }} placeholder="🖊️" />
          </Field>
          <Field label="Nom *"><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus required /></Field>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setAddOpen(false)} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text)", cursor: "pointer" }}>Annuler</button>
            <button type="submit" disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>{saving ? "..." : "Ajouter"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─────────────────────────── Tab: Séries ──────────────────────────────────

function TabSeries({ seriesList, books, authors, onUpdate }: { seriesList: DBSerie[]; books: DBBook[]; authors: DBAuthor[]; onUpdate: () => void }) {
  const [selected, setSelected] = useState<DBSerie | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", author_id: "", status: "" });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch("/api/library/series", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name.trim(), author_id: form.author_id || null, status: form.status || null }) });
    setForm({ name: "", author_id: "", status: "" }); setSaving(false); setAddOpen(false); onUpdate();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer la série "${name}" ?`)) return;
    await fetch(`/api/library/series?id=${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    onUpdate();
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <button className="btn-primary" onClick={() => setAddOpen(true)} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>+ Ajouter une série</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Nom</th>
              <th style={thStyle}>Auteur</th>
              <th style={thStyle}>Livres</th>
              <th style={thStyle}>État</th>
              <th style={{ ...thStyle, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {seriesList.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Aucune série</td></tr>
            ) : seriesList.map((s) => {
              const serieBooks = books.filter((b) => b.serie_id === s.id);
              return (
                <tr key={s.id} className="clickable-row" style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  onClick={() => setSelected(s)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,126,248,0.03)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{s.author_name ?? "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {serieBooks.map((b) => (
                        <span key={b.id} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "pointer" }}>{b.title}</span>
                      ))}
                      {serieBooks.length === 0 && <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}><StatusBadge status={s.status} /></td>
                  <td style={{ padding: "12px 16px" }}>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id, s.name); }} style={{ padding: "3px 7px", borderRadius: 5, fontSize: 11, background: "rgba(220,38,38,0.08)", color: "var(--red)", border: "none", cursor: "pointer" }}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Drawer open={!!selected} onClose={() => setSelected(null)}>
        {selected && (() => {
          const serieBooks = books.filter((b) => b.serie_id === selected.id);
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{selected.name}</div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", fontSize: 18, color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
                  <StatusBadge status={selected.status} />
                  {selected.author_name && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>par {selected.author_name}</span>}
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Livres de la série ({serieBooks.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {serieBooks.map((b) => (
                    <div key={b.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", background: "var(--bg)", borderRadius: 8, border: "1px solid var(--border)" }}>
                      <BookCover imageUrl={b.image_url} title={b.title} size="card" />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{b.title}</div>
                        <StatusBadge status={b.status} />
                        {b.rating && <StarRating value={b.rating} readonly />}
                      </div>
                    </div>
                  ))}
                  {serieBooks.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Aucun livre dans cette série</div>}
                </div>
              </div>
            </>
          );
        })()}
      </Drawer>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Ajouter une série">
        <form onSubmit={handleAdd}>
          <Field label="Nom *"><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} autoFocus required /></Field>
          <Field label="Auteur">
            <CustomSelect
              value={form.author_id}
              onChange={(v) => setForm((f) => ({ ...f, author_id: v }))}
              placeholder="— Aucun —"
              searchable
              options={[{ value: "", label: "— Aucun —" }, ...authors.map((a) => ({ value: a.id, label: a.name }))]}
            />
          </Field>
          <Field label="État">
            <CustomSelect
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v }))}
              placeholder="— Aucun —"
              options={[{ value: "", label: "— Aucun —" }, ...SERIE_STATUSES.map((s) => ({ value: s, label: s }))]}
            />
          </Field>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setAddOpen(false)} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text)", cursor: "pointer" }}>Annuler</button>
            <button type="submit" disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>{saving ? "..." : "Ajouter"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─────────────────────────── Tab: Notes ───────────────────────────────────

function TabNotes({ notes, books, onUpdate }: { notes: DBBookNote[]; books: DBBook[]; onUpdate: () => void }) {
  const [selectedNote, setSelectedNote] = useState<DBBookNote | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [form, setForm] = useState({ title: "", book_id: "", content: "" });
  const [saving, setSaving] = useState(false);
  const [filterBookId, setFilterBookId] = useState("");

  const filtered = filterBookId ? notes.filter((n) => n.book_id === filterBookId) : notes;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.book_id) return;
    setSaving(true);
    await fetch("/api/library/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.title.trim(), book_id: form.book_id, content: form.content || null }) });
    setForm({ title: "", book_id: "", content: "" }); setSaving(false); setAddOpen(false); onUpdate();
  }

  async function handleSave() {
    if (!selectedNote) return;
    await fetch(`/api/library/notes?id=${selectedNote.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editTitle, content: editContent }) });
    onUpdate();
    setSelectedNote(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette note ?")) return;
    await fetch(`/api/library/notes?id=${id}`, { method: "DELETE" });
    if (selectedNote?.id === id) setSelectedNote(null);
    onUpdate();
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <CustomSelect
          value={filterBookId}
          onChange={setFilterBookId}
          placeholder="Tous les livres"
          searchable
          style={{ width: "auto", minWidth: 180 }}
          options={[{ value: "", label: "Tous les livres" }, ...books.map((b) => ({ value: b.id, label: b.title }))]}
        />
        <button className="btn-primary" onClick={() => setAddOpen(true)} style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>+ Ajouter une note</button>
      </div>
      <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Titre</th>
              <th style={thStyle}>Livre</th>
              <th style={thStyle}>Aperçu</th>
              <th style={{ ...thStyle, width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Aucune note</td></tr>
            ) : filtered.map((note) => (
              <tr key={note.id} className="clickable-row" style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => { setSelectedNote(note); setEditTitle(note.title); setEditContent(note.content ?? ""); }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(59,126,248,0.03)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                <td style={{ padding: "12px 16px", fontWeight: 600, maxWidth: 180 }}>{note.title}</td>
                <td style={{ padding: "12px 16px", color: "var(--text-muted)", maxWidth: 140 }}>{note.book_title ?? "—"}</td>
                <td style={{ padding: "12px 16px", color: "var(--text-muted)", fontSize: 12, maxWidth: 240 }}>
                  {note.content ? note.content.slice(0, 150) + (note.content.length > 150 ? "…" : "") : <span style={{ fontStyle: "italic" }}>Aucun contenu</span>}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }} style={{ padding: "3px 7px", borderRadius: 5, fontSize: 11, background: "rgba(220,38,38,0.08)", color: "var(--red)", border: "none", cursor: "pointer" }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={!!selectedNote} onClose={() => setSelectedNote(null)}>
        {selectedNote && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, flex: 1, marginRight: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedNote.title}</div>
              <button onClick={() => setSelectedNote(null)} style={{ background: "none", border: "none", fontSize: 18, color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              {selectedNote.book_title && <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 500 }}>📚 {selectedNote.book_title}</div>}
              <Field label="Titre">
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Contenu">
                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={16}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} placeholder="Contenu de la note..." />
              </Field>
              <button onClick={handleSave} style={{ padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>Enregistrer</button>
            </div>
          </>
        )}
      </Drawer>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Ajouter une note">
        <form onSubmit={handleAdd}>
          <Field label="Titre *"><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={inputStyle} autoFocus required /></Field>
          <Field label="Livre *">
            <CustomSelect
              value={form.book_id}
              onChange={(v) => setForm((f) => ({ ...f, book_id: v }))}
              placeholder="— Sélectionner un livre —"
              searchable
              required
              options={[{ value: "", label: "— Sélectionner un livre —" }, ...books.map((b) => ({ value: b.id, label: b.title }))]}
            />
          </Field>
          <Field label="Contenu">
            <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={5} style={{ ...inputStyle, resize: "vertical" }} placeholder="Contenu de la note..." />
          </Field>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setAddOpen(false)} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, background: "var(--surface2)", border: "1.5px solid var(--border)", color: "var(--text)", cursor: "pointer" }}>Annuler</button>
            <button type="submit" disabled={saving} style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>{saving ? "..." : "Ajouter"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─────────────────────────── Main Page ────────────────────────────────────

export default function LibraryPage() {
  const [tab, setTab] = useState<MainTab>("library");
  const [booksList, setBooksList] = useState<DBBook[]>([]);
  const [authorsList, setAuthorsList] = useState<DBAuthor[]>([]);
  const [genresList, setGenresList] = useState<DBGenre[]>([]);
  const [seriesList, setSeriesList] = useState<DBSerie[]>([]);
  const [notesList, setNotesList] = useState<DBBookNote[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [b, a, g, s, n] = await Promise.all([
        fetch("/api/library/books").then((r) => r.json()),
        fetch("/api/library/authors").then((r) => r.json()),
        fetch("/api/library/genres").then((r) => r.json()),
        fetch("/api/library/series").then((r) => r.json()),
        fetch("/api/library/notes").then((r) => r.json()),
      ]);
      if (Array.isArray(b)) setBooksList(b);
      if (Array.isArray(a)) setAuthorsList(a);
      if (Array.isArray(g)) setGenresList(g);
      if (Array.isArray(s)) setSeriesList(s);
      if (Array.isArray(n)) setNotesList(n);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const TABS: { key: MainTab; label: string; count?: number }[] = [
    { key: "library", label: "Ma Bibliothèque", count: booksList.length },
    { key: "authors", label: "Auteurs", count: authorsList.length },
    { key: "genres", label: "Genres", count: genresList.length },
    { key: "series", label: "Séries", count: seriesList.length },
    { key: "notes", label: "Notes", count: notesList.length },
  ];

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 40px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1200, margin: "0 auto" }}>
      <Link href="/" className="btn-back">← Accueil</Link>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 28 }}>📚</span>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>Bibliothèque</h1>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{booksList.length} livres · {authorsList.length} auteurs · {seriesList.length} séries</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, background: "var(--surface)", padding: 4, borderRadius: 12, border: "1px solid var(--border)", alignSelf: "flex-start", boxShadow: "var(--shadow-sm)" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
            background: tab === t.key ? "var(--accent)" : "transparent",
            color: tab === t.key ? "#fff" : "var(--text-muted)",
            transition: "all 0.15s",
          }}>
            {t.label}{t.count !== undefined && t.count > 0 ? <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.8 }}>({t.count})</span> : ""}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)" }}>Chargement...</div>
      ) : (
        <>
          {tab === "library" && <TabLibrary books={booksList} authors={authorsList} genres={genresList} seriesList={seriesList} onUpdate={loadAll} />}
          {tab === "authors" && <TabAuthors authors={authorsList} books={booksList} onUpdate={loadAll} />}
          {tab === "genres" && <TabGenres genres={genresList} books={booksList} onUpdate={loadAll} />}
          {tab === "series" && <TabSeries seriesList={seriesList} books={booksList} authors={authorsList} onUpdate={loadAll} />}
          {tab === "notes" && <TabNotes notes={notesList} books={booksList} onUpdate={loadAll} />}
        </>
      )}
    </main>
  );
}

// ─────────────────────────── Shared styles ────────────────────────────────

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "12px 16px", fontSize: 10, fontWeight: 600,
  letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)",
  borderBottom: "1px solid var(--border)", background: "var(--bg)",
};
