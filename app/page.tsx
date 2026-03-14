import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import DashboardWidgets from "@/app/_components/DashboardWidgets";

export const metadata: Metadata = { title: { absolute: "life×hub — Dashboard" } };

type NavItem = { href: string; icon: string; label: string; active?: boolean };

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Général",
    items: [
      { href: "/", icon: "🏠", label: "Dashboard", active: true },
    ],
  },
  {
    label: "Productivité",
    items: [
      { href: "/pomodoro", icon: "⏱️", label: "Pomodoro" },
      { href: "/projects", icon: "📁", label: "Projets" },
      { href: "/tasks", icon: "✅", label: "Tâches" },
      { href: "/reminders", icon: "🔔", label: "Rappels" },
    ],
  },
  {
    label: "Quotidien",
    items: [
      { href: "/habits", icon: "🎯", label: "Habitudes" },
      { href: "/journal", icon: "📖", label: "Journal" },
      { href: "/petitbambou", icon: "🧘", label: "Petit Bambou" },
      { href: "/shopping", icon: "🛒", label: "Shopping" },
    ],
  },
  {
    label: "Loisirs",
    items: [
      { href: "/library", icon: "📚", label: "Bibliothèque" },
      { href: "/chess", icon: "♟️", label: "Chess" },
    ],
  },
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
        <div style={logoStyle}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em" }}>
            life<span style={{ color: "var(--accent)" }}>×</span>hub
          </span>
        </div>

        {/* Nav groups */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, overflowY: "auto", paddingBottom: 8 }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div style={navGroupLabelStyle}>{group.label}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-nav-item${item.active ? " active" : ""}`}
                >
                  <span style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: item.active ? "rgba(59,126,248,0.15)" : "var(--surface2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, flexShrink: 0,
                    transition: "background 0.13s",
                  }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* User section */}
        <div style={userSectionStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>
              {userEmail[0]?.toUpperCase() ?? "?"}
            </div>
            <div style={emailStyle} title={userEmail}>{userEmail}</div>
          </div>
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
  padding: "20px 0 16px",
  position: "sticky",
  top: 0,
  height: "100vh",
  overflowY: "auto",
};

const logoStyle: React.CSSProperties = {
  padding: "0 16px 16px",
  borderBottom: "1px solid var(--border)",
  marginBottom: 8,
};

const navGroupLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  padding: "10px 16px 4px",
  opacity: 0.7,
};

const userSectionStyle: React.CSSProperties = {
  padding: "12px 16px 0",
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
  flex: 1,
  minWidth: 0,
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
