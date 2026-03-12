import Link from "next/link";
import { auth, signOut } from "@/auth";
import DashboardWidgets from "@/app/_components/DashboardWidgets";

const navItems = [
  { href: "/", icon: "🏠", label: "Dashboard", active: true },
  { href: "/pomodoro", icon: "⏱️", label: "Pomodoro" },
  { href: "/projects", icon: "📁", label: "Projets" },
  { href: "/tasks", icon: "✅", label: "Tâches" },
  { href: "/reminders", icon: "🔔", label: "Rappels" },
  { href: "/petitbambou", icon: "🧘", label: "Petit Bambou" },
  { href: "/shopping", icon: "🛒", label: "Shopping" },
  { href: "/library", icon: "📚", label: "Bibliothèque" },
  { href: "/chess", icon: "♟️", label: "Chess" },
];

export default async function DashboardPage() {
  const session = await auth();
  const userEmail = session?.user?.email ?? "";
  const firstName = session?.user?.name?.split(" ")[0] ?? userEmail.split("@")[0].replace(/[0-9]/g, "");
  const userName = firstName || "vous";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* ── Sidebar ── */}
      <aside style={sidebarStyle}>
        {/* Logo */}
        <div style={logoStyle}>life×hub</div>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={item.active ? activeNavItemStyle : navItemStyle}
            >
              <span style={{ fontSize: 15, width: 22, textAlign: "center" }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div style={userSectionStyle}>
          <div style={emailStyle} title={userEmail}>{userEmail}</div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" style={logoutBtnStyle}>
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        <DashboardWidgets userName={userName} />
      </main>
    </div>
  );
}

const sidebarStyle: React.CSSProperties = {
  width: 220,
  minWidth: 220,
  minHeight: "100vh",
  background: "#eeeef8",
  borderRight: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  padding: "24px 0 20px",
  position: "sticky",
  top: 0,
  height: "100vh",
  overflowY: "auto",
};

const logoStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 18,
  fontWeight: 700,
  color: "var(--text)",
  letterSpacing: "-0.02em",
  padding: "0 20px 20px",
  borderBottom: "1px solid var(--border)",
  marginBottom: 12,
};

const navItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 20px",
  fontSize: 13,
  fontWeight: 400,
  color: "var(--text-muted)",
  textDecoration: "none",
  borderRight: "3px solid transparent",
};

const activeNavItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 20px",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--accent)",
  textDecoration: "none",
  background: "rgba(59, 126, 248, 0.1)",
  borderRight: "3px solid var(--accent)",
};

const userSectionStyle: React.CSSProperties = {
  padding: "16px 20px 0",
  borderTop: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const emailStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const logoutBtnStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "6px 12px",
  borderRadius: 50,
  background: "var(--surface)",
  border: "1.5px solid var(--border)",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontFamily: "var(--font-sans)",
  width: "100%",
};
