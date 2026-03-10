import type { Metadata } from "next";
import "./globals.css";
import { auth, signOut } from "@/auth";

export const metadata: Metadata = {
  title: {
    template: "%s — life×hub",
    default: "life×hub",
  },
  description: "Ton hub de productivité en local.",
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
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <span style={styles.userEmail}>{session.user?.email}</span>
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
    top: 0,
    right: 0,
    width: 260,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    padding: "10px 20px",
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    borderLeft: "1px solid var(--border)",
  },
  userEmail: {
    fontSize: 11,
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  logoutBtn: {
    fontSize: 11,
    padding: "5px 12px",
    borderRadius: 50,
    background: "var(--surface2)",
    border: "1.5px solid var(--border)",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    flexShrink: 0,
    transition: "border-color 0.15s, color 0.15s",
  },
};
