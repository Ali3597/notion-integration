# notion×hub

Plateforme d'intégrations Notion. Connecte tes outils et apps favoris à Notion pour lire et pousser des données automatiquement.

## Intégrations disponibles

| Intégration | Route | Description |
|-------------|-------|-------------|
| Pomodoro | `/pomodoro` | Sessions de travail chronométrées liées aux projets et tâches Notion |
| Petit Bambou | `/petitbambou` | Sync des sessions de méditation vers une base Notion |

## Installation

```bash
npm install
```

## Configuration

Crée un fichier `.env.local` à la racine :

```
# Notion
NOTION_TOKEN=secret_...

# Pomodoro
NOTION_PROJECTS_DB=<database_id>
NOTION_TASKS_DB=<database_id>
NOTION_SESSIONS_DB=<database_id>

# Petit Bambou
NOTION_MEDITATIONS_DB=<database_id>   # créé automatiquement au premier lancement
PB_USER_UUID=<uuid utilisateur PB>
PB_AUTH_TOKEN=<token JWT PB>

# Auth (NextAuth.js v5 — Google OAuth)
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<Google Cloud Console>
GOOGLE_CLIENT_SECRET=<Google Cloud Console>
```

> **Contrainte version** : Next.js doit rester sur `15.2.x`. Les versions 15.3+ cassent `next-auth@beta`.

## Développement

```bash
npm run dev   # http://localhost:3000
```

## Déploiement (Vercel)

1. Push sur GitHub
2. Importe le repo sur [vercel.com](https://vercel.com)
3. Ajoute les variables d'environnement dans les settings du projet
4. Deploy

## Ajouter une nouvelle intégration

1. Crée la page : `app/<nom>/page.tsx`
2. Crée les routes API : `app/api/<nom>/route.ts`
3. Ajoute les types dans `types/index.ts`
4. Référence l'intégration dans le tableau de `app/page.tsx`
