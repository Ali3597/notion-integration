/**
 * Garmin Connect — extraction de tokens depuis le navigateur
 *
 * ÉTAPES :
 * 1. Ouvre connect.garmin.com dans ton navigateur et connecte-toi (avec MFA si besoin)
 * 2. Ouvre DevTools (F12) → onglet "Réseau" (Network)
 * 3. Filtre par "connectapi.garmin.com"
 * 4. Clique sur n'importe quelle requête, onglet "En-têtes" (Headers)
 * 5. Copie la valeur du header "Authorization" (commence par "Bearer eyJ...")
 * 6. Colle-la quand ce script le demande
 *
 * Usage : node scripts/garmin-setup.mjs
 */

import readline from "readline";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_DIR = path.join(__dirname, "..", ".garmin");

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

async function main() {
  console.log("🏥 Garmin Connect — Configuration des tokens\n");
  console.log("Pour contourner le MFA, les tokens sont extraits de ton navigateur.\n");
  console.log("══════════════════════════════════════════════════════");
  console.log("ÉTAPES :");
  console.log("  1. Ouvre https://connect.garmin.com dans Chrome/Firefox");
  console.log("  2. Connecte-toi (MFA inclus)");
  console.log("  3. Ouvre DevTools (F12) → onglet Network");
  console.log("  4. Filtre par \"connectapi\" ou recharge la page");
  console.log("  5. Clique sur une requête vers connectapi.garmin.com");
  console.log("  6. Dans \"Request Headers\", copie le header Authorization");
  console.log("     (ex: Bearer eyJhbGciOiJSUzI1NiJ9.eyJ...)");
  console.log("══════════════════════════════════════════════════════\n");

  const raw = await prompt("Colle le header Authorization (ou juste le token Bearer) :\n> ");

  // Strip "Bearer " prefix if present
  const accessToken = raw.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken || accessToken.length < 20) {
    console.error("❌ Token invalide.");
    process.exit(1);
  }

  // Verify the token works by calling the user profile API
  console.log("\n🔍 Vérification du token…");
  let displayName = null;
  let tokenValid = false;
  try {
    const res = await axios.get("https://connectapi.garmin.com/userprofile-service/socialProfile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    displayName = res.data?.displayName ?? res.data?.userName ?? null;
    tokenValid = true;
    console.log(`✅ Token valide ! Connecté en tant que : ${displayName ?? "—"}`);
  } catch (err) {
    console.error("❌ Le token semble invalide ou expiré :", err.message);
    process.exit(1);
  }

  // Build minimal OAuth2 token structure (no refresh token — expires in ~1h)
  // The garmin-connect library will use access_token directly for API calls
  const now = Math.floor(Date.now() / 1000);
  const oauth2Token = {
    scope: "CONNECT",
    jti: "browser-extracted",
    token_type: "Bearer",
    access_token: accessToken,
    refresh_token: "", // no refresh token from browser extraction
    expires_in: 3600,
    refresh_token_expires_in: 7776000,
    expires_at: now + 3600,
    refresh_token_expires_at: now + 7776000,
    last_update_date: new Date().toISOString(),
    expires_date: new Date((now + 3600) * 1000).toISOString(),
  };

  // Minimal OAuth1 token (the library needs it for some calls, but most use OAuth2 bearer)
  const oauth1Token = {
    oauth_token: "browser-extracted",
    oauth_token_secret: "browser-extracted",
  };

  // Save tokens
  if (!fs.existsSync(TOKEN_DIR)) fs.mkdirSync(TOKEN_DIR, { recursive: true });
  fs.writeFileSync(path.join(TOKEN_DIR, "oauth1_token.json"), JSON.stringify(oauth1Token, null, 2));
  fs.writeFileSync(path.join(TOKEN_DIR, "oauth2_token.json"), JSON.stringify(oauth2Token, null, 2));

  // Add .garmin to .gitignore
  const gitignorePath = path.join(__dirname, "..", ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const gi = fs.readFileSync(gitignorePath, "utf8");
    if (!gi.includes(".garmin")) fs.appendFileSync(gitignorePath, "\n.garmin/\n");
  }

  console.log(`\n✅ Tokens sauvegardés dans ${TOKEN_DIR}/`);
  console.log("\n⚠️  Note : le token Bearer expire dans ~1 heure.");
  console.log("   Quand la sync échoue de nouveau (token expiré), relance ce script.");
  console.log("   Conseil : ouvre connect.garmin.com dans ton navigateur le matin");
  console.log("   avant de lancer une sync.\n");
  console.log("🚀 Lance une sync depuis la page /health !");
}

main().catch((err) => {
  console.error("❌ Erreur :", err.message);
  process.exit(1);
});
