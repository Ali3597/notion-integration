# notion×hub

Plateforme d'intégrations Notion. Connecte tes outils et apps favoris à Notion pour lire et pousser des données automatiquement.

## Intégrations disponibles

| Intégration | Route | Description |
|-------------|-------|-------------|
| Pomodoro | `/pomodoro` | Sessions de travail chronométrées liées aux projets et tâches Notion |

## Installation

```bash
npm install
```

## Configuration

Crée un fichier `.env.local` à la racine :

```
NOTION_TOKEN=secret_...

# Pomodoro
NOTION_PROJECTS_DB=<database_id>
NOTION_TASKS_DB=<database_id>
NOTION_SESSIONS_DB=<database_id>
```

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
