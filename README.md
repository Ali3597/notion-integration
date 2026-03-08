Pomodoro × Notion
App Pomodoro connectée à Notion. Lance des sessions chronométrées liées à tes projets et tâches.

Installation
bash
npm install
Configuration
Crée un fichier .env.local à la racine avec :

NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_PROJECTS_DB=31d4ceaf35ec80088347f73348cf98fe
NOTION_TASKS_DB=31d4ceaf35ec80448becf56e3358478b
NOTION_SESSIONS_DB=31d4ceaf35ec80499381d2a52afbc363
Démarrer en local
bash
npm run dev
Ouvre http://localhost:3000

Déployer sur Vercel
Push ce repo sur GitHub
Va sur vercel.com → New Project → importe le repo
Dans les settings du projet → Environment Variables → ajoute les 4 variables
Deploy !
