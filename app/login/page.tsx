import type { Metadata } from "next";
import { signIn } from "@/auth";

export const metadata: Metadata = { title: "Connexion" };

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const isUnauthorized = error === "unauthorized";

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <div style={styles.logo}>notion×hub</div>
        <p style={styles.tagline}>Tes intégrations Notion, centralisées.</p>

        {isUnauthorized && (
          <div style={styles.errorBox}>
            Ce compte Google n'est pas autorisé.
          </div>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button type="submit" style={styles.googleBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continuer avec Google
          </button>
        </form>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "#0a0a0f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 24,
    padding: "48px 40px",
    background: "#111118",
    border: "1px solid #2a2a3a",
    borderRadius: 20,
    width: "100%",
    maxWidth: 380,
  },
  logo: {
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontSize: 24,
    fontWeight: 700,
    color: "#e8ff6b",
    letterSpacing: "-0.02em",
  },
  tagline: {
    fontSize: 14,
    color: "#6b6b85",
    textAlign: "center",
    margin: 0,
  },
  errorBox: {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(248, 113, 113, 0.1)",
    border: "1px solid rgba(248, 113, 113, 0.3)",
    borderRadius: 10,
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
  },
  googleBtn: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "13px 28px",
    background: "#e8ff6b",
    color: "#0a0a0f",
    border: "none",
    borderRadius: 50,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.02em",
    transition: "opacity 0.18s, transform 0.18s",
    fontFamily: "inherit",
  },
};
