# life×hub

Plateforme de productivité locale. Centralise tes outils en un seul endroit avec une base PostgreSQL locale — aucune dépendance cloud.

## Modules

| Module | Route | Description |
|--------|-------|-------------|
| Projets | `/projects` | Vue tableau de tous les projets avec stats de sessions agrégées ; sous-projets hiérarchiques avec temps total consolidé |
| Tâches | `/tasks` | Toutes les tâches filtrables par statut, priorité et projet |
| Rappels | `/reminders` | Rappels du quotidien avec date limite, badges En retard / Aujourd'hui |
| Habitudes | `/habits` | Suivi quotidien des habitudes avec streaks, calendrier et statistiques Recharts |
| Journal | `/journal` | Entrées de journal et logs horodatés |
| Anniversaires | `/birthdays` | Suivi des anniversaires avec âge et compte à rebours |
| Poids | `/weight` | Historique de poids avec courbe Recharts ; alimentation via iOS Shortcut → Apple Health |
| Petit Bambou | `/petitbambou` | Sync des sessions de méditation depuis l'app PB, streaks, calendrier et stats |
| Shopping | `/shopping` | Wishlist et liste de courses avec suivi du budget |
| Chess.com | `/chess` | Suivi de progression, ouvertures et records depuis Chess.com |
| Bibliothèque | `/library` | Livres, auteurs, séries, genres et notes de lecture — enrichissement Google Books + Open Library |
| D&D | `/dnd` | Fiche de personnage Matshana (Magicien nécromancien niv. 6), sorts, équipement, quêtes, sessions, personnages |

## Stack

- **Next.js 15.2.x** + TypeScript
- **PostgreSQL** local (Homebrew `postgresql@16`)
- **Drizzle ORM** (`drizzle-orm` + `drizzle-kit`)
- **NextAuth.js v5 beta** — Google OAuth (whitelist `a64397573@gmail.com`)

## Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Créer la base de données et pousser le schéma
bash scripts/setup.sh

# 3. Lancer le serveur de développement
npm run dev   # http://localhost:3000
```

> **Prérequis** : PostgreSQL 16 installé via Homebrew (`brew install postgresql@16`), service démarré (`brew services start postgresql@16`).

## Configuration

Crée un fichier `.env.local` à la racine :

```env
# Base de données locale
DATABASE_URL=postgresql://localhost:5432/lifehub

# Auth (NextAuth.js v5 — Google OAuth)
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<Google Cloud Console>
GOOGLE_CLIENT_SECRET=<Google Cloud Console>

# Petit Bambou (optionnel)
PB_USER_UUID=<uuid utilisateur PB>
PB_AUTH_TOKEN=<token JWT issu de l'app mobile PB>

# iCloud Calendar (optionnel — widget dashboard)
ICAL_URL=<URL ICS publique iCloud>

# Google Books (recherche bibliothèque — 1000 req/jour gratuit)
GOOGLE_BOOKS_API_KEY=<Google Cloud Console — API "Books API">

# Chess.com / Notion (optionnel)
NOTION_TOKEN=secret_...
CHESS_USERNAME=<chess.com username>
NOTION_CHESS_PARENT_PAGE_ID=<page_id>
NOTION_CHESS_RATING_DB=<db_id>
NOTION_CHESS_OPENINGS_DB=<db_id>
NOTION_CHESS_DAILY_DB=<db_id>
NOTION_CHESS_PUZZLES_DB=<db_id>
NOTION_CHESS_FORMATS_DB=<db_id>
```

## Schéma de la base

| Table | Colonnes principales |
|-------|---------------------|
| `projects` | id, name, status, type |
| `tasks` | id, name, status, priority, project_id |
| `sessions` | id, name, project_id, start_time, end_time, notes |
| `meditations` | id, lesson, date, duration_min, pb_uuid, streak |
| `shopping_items` | id, name, category, estimated_price, purchased, store_link, notes |
| `reminders` | id, name, due_date, done |
| `project_relations` | parent_id, child_id |
| `authors` | id, name, photo_url |
| `genres` | id, name, icon |
| `series` | id, name, author_id, status |
| `books` | id, title, author_id, genre_id, serie_id, status, rating, image_url, started_at, finished_at |
| `book_notes` | id, title, book_id, content |
| `habits` | id, name, description, icon, color, frequency_type, frequency_days, target_per_period, active |
| `habit_logs` | id, habit_id, completed_date, note |
| `journal_entries` | id, title, pinned |
| `journal_logs` | id, entry_id, content, review_date |
| `birthdays` | id, name, birth_date, year_known, note |
| `weight_entries` | id, measured_at, weight, source |
| `dnd_character` | id, name, class, subclass, race, level, hp_max/current, ac, speed, stats (force…charisme), spell stats, skill/save proficiencies, special_abilities |
| `dnd_spells` | id, name, level, school, casting_time, range, components, duration, description, url, prepared |
| `dnd_equipment` | id, name, type, description, magical, equipped, quantity, notes |
| `dnd_objectives` | id, title, description, category, status, notes |
| `dnd_sessions` | id, title, session_date, session_time, status, summary, notes, level_at_session, journal |
| `dnd_companions` | id, name, class, race, level, player_name, description, personality, backstory, relationship, notes, avatar_url, is_companion |

Pour modifier le schéma : éditer `lib/schema.ts` puis `npm run db:migrate`.

## Commandes utiles

```bash
npm run dev          # Serveur de dev — http://localhost:3000
npm run build        # Build de production
npm run db:migrate   # Pousser le schéma Drizzle vers PostgreSQL
npm run db:studio    # Ouvrir Drizzle Studio (UI base de données)
bash scripts/setup.sh  # Premier lancement : crée la DB + pousse le schéma
```

## Conventions UI

- Styles via CSS custom properties de `globals.css` uniquement (`--bg`, `--surface`, `--accent`, etc.)
- Inline `React.CSSProperties` pour le layout — pas de librairie UI
- Filtres directement dans les en-têtes de colonnes des tableaux (clic sur colonne = dropdown inline)
- Bouton `← Accueil` (`className="btn-back"`) présent sur chaque module ; breadcrumb (ex. "Projets › Nom") sur les sous-pages
- Hover des boutons principaux défini dans `globals.css` (`.btn-primary`, `.btn-back`)
- `button * { cursor: inherit }` dans `globals.css` pour que les enfants de boutons héritent du cursor
- `.clickable-row td { cursor: pointer }` pour les lignes de tableau cliquables
- **Favicon dynamique par module** : hook `useDynamicFavicon(emoji)` dans `hooks/useDynamicFavicon.ts` — dessine l'emoji sur un canvas 32×32 et injecte l'URL en `<link rel="icon">`
- **Titre de l'onglet** : chaque page définit `document.title = "Module — life×hub"` via `useEffect` — sans emoji (déjà dans le favicon)
- **Persistance de l'onglet actif** : `?tab=` dans l'URL via `window.history.replaceState`, état initial lu depuis `window.location.search` — concerne Library, PetitBambou, Habits, Shopping
- **Bibliothèque — enrichissement** : routes serveur `/api/library/search/books` (Google Books + BnF SPARQL) et `/api/library/search/authors` (BnF SPARQL + Open Library). `BookSearchField` : saisie débouncée → dropdown avec couvertures → auto-remplit titre/couverture/auteur/genre. `CoverSearchField` : recherche de couverture de remplacement. `AuthorPhotoSearch` : recherche de photo auteur. Barre de recherche dans chaque onglet (filtrage client-side).
- **Projets — sous-projets** : relation parent/enfant via `project_relations`. Colonne "Temps total" dans la liste = temps propre + temps des enfants. Page projet parent (`/projects/[id]`) : les stats (temps total, graphiques) agrègent les sessions propres + enfants ; bloc "Répartition par sous-projet" avec barre de progression relative.
- **Poids** : iOS Shortcut envoie les données Apple Health via `POST /api/weight/apple-health` (sans auth) — endpoint public exprès pour les raccourcis iOS. Courbe Recharts avec stats (min, max, moy, tendance).
- **D&D** : fiche de personnage Matshana avec autosave 1.5s. Images uploadées via `multipart/form-data` vers `public/uploads/dnd/` (ne pas utiliser base64 — dépasse la limite 1 Mo de Next.js App Router). Sorts enrichis depuis aidedd.org côté serveur et mis en cache en DB. Personnages avec flag `is_companion` pour les trier en tête de liste.

## Ajouter un nouveau module

1. **Schéma** : ajouter la table dans `lib/schema.ts` + `npm run db:migrate`
2. **API** : `app/api/<nom>/route.ts` — importer `db` depuis `@/lib/db`, tables depuis `@/lib/schema`
3. **Page** : `app/<nom>/page.tsx` — inclure `<Link href="/" className="btn-back">← Accueil</Link>`
4. **Types** : ajouter dans `types/index.ts` si nécessaire
5. **Hub** : ajouter une entrée dans le tableau `integrations` de `app/page.tsx`
6. **Overview** : mettre à jour `/api/overview/route.ts` si des stats doivent apparaître sur la home

## Contraintes techniques

- **Next.js doit rester sur `15.2.x`** — les versions 15.3+ cassent `next-auth@beta`
- Pas de linter ni de test runner configurés
- Authentification Google restreinte à `a64397573@gmail.com` (`auth.ts`)
- L'app est **local-only** — aucun déploiement cloud prévu
- `@notionhq/client` est conservé uniquement pour le module Chess (`lib/notion-client.ts`)
