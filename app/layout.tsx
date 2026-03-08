import type { Metadata } from "next";
import "./globals.css";
import { auth, signOut } from "@/auth";

export const metadata: Metadata = {
  title: "notion×hub",
  description: "Tes intégrations Notion, centralisées.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="fr">
      <body suppressHydrationWarning>
        {session && (
          <div style={styles.topBar}>
            <span style={styles.userEmail}>{session.user?.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" style={styles.logoutBtn}>
                Déconnexion
              </button>
            </form>
          </div>
        )}
        {children}
      </body>
    </html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topBar: {
    position: "fixed",
    top: 12,
    right: 16,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  userEmail: {
    fontSize: 12,
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
  },
  logoutBtn: {
    fontSize: 12,
    padding: "6px 14px",
    borderRadius: 50,
    background: "var(--surface)",
    border: "1.5px solid var(--border)",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    boxShadow: "var(--shadow-sm)",
    transition: "border-color 0.15s, color 0.15s",
  },
};
