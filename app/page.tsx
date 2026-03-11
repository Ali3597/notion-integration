"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const integrations = [
  {
    href: "/pomodoro",
    icon: "◉",
    title: "Pomodoro",
    description: "Sessions de travail chronométrées liées à tes projets et tâches.",
    color: "var(--accent)",
  },
  {
    href: "/projects",
    icon: "▦",
    title: "Projets",
    description: "Vue tableau de tous tes projets avec stats de sessions agrégées.",
    color: "var(--accent)",
  },
  {
    href: "/tasks",
    icon: "✓",
    title: "Tâches",
    description: "Toutes les tâches filtrables par statut, priorité et projet.",
    color: "var(--accent)",
  },
  {
    href: "/petitbambou",
    icon: "🎋",
    title: "Petit Bambou",
    description: "Sessions de méditation synchronisées depuis l'app Petit Bambou.",
    color: "var(--accent2)",
  },
  {
    href: "/chess",
    icon: "♟️",
    title: "Chess.com",
    description: "Suivi de progression, ouvertures et records depuis Chess.com.",
    color: "var(--accent)",
  },
  {
    href: "/shopping",
    icon: "🎁",
    title: "Shopping",
    description: "Wishlist et liste de courses avec suivi du budget.",
    color: "var(--green)",
  },
];

interface Overview {
  projects: { total: number; active: number };
  tasks: { total: number; in_progress: number };
  today: { session_count: number; total_minutes: number };
  lastMeditation: { lesson: string | null; date: string | null; streak: number | null } | null;
}

interface ShoppingStats {
  total_non_purchased: number;
  remaining: string;
}

export default function HubPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [shoppingStats, setShoppingStats] = useState<ShoppingStats | null>(null);

  useEffect(() => {
    fetch("/api/overview")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setOverview(d); })
      .catch(() => {});
    fetch("/api/shopping/items")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error && d.stats) {
          setShoppingStats({
            total_non_purchased: d.stats.total_non_purchased ?? 0,
            remaining: d.stats.remaining ?? "0.00",
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <main style={styles.main}>
      <div style={styles.header}>
        <div style={styles.logo}>life×hub</div>
        <p style={styles.subtitle}>Tes outils de productivité en local.</p>
      </div>

      {/* Overview */}
      {overview && (
        <div style={styles.overview}>
          <OverviewCard
            label="Projets actifs"
            value={`${overview.projects.active} / ${overview.projects.total}`}
          />
          <OverviewCard
            label="Tâches en cours"
            value={`${overview.tasks.in_progress} / ${overview.tasks.total}`}
          />
          <OverviewCard
            label="Sessions aujourd'hui"
            value={String(overview.today.session_count)}
            sub={overview.today.total_minutes > 0 ? `${overview.today.total_minutes} min` : undefined}
          />
          <OverviewCard
            label="Dernière méditation"
            value={overview.lastMeditation
              ? new Date(overview.lastMeditation.date!).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
              : "—"}
            sub={overview.lastMeditation?.streak ? `Streak : ${overview.lastMeditation.streak} j` : undefined}
          />
          {shoppingStats && (
            <OverviewCard
              label="À acheter"
              value={`${shoppingStats.total_non_purchased}`}
              sub={`€${shoppingStats.remaining}`}
            />
          )}
        </div>
      )}

      <div style={styles.grid}>
        {integrations.map((item) => (
          <Link key={item.href} href={item.href} style={styles.card}>
            <span style={{ ...styles.cardIcon, color: item.color }}>{item.icon}</span>
            <div style={styles.cardTitle}>{item.title}</div>
            <div style={styles.cardDesc}>{item.description}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}

function OverviewCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={overviewStyles.card}>
      <div style={overviewStyles.value}>{value}</div>
      <div style={overviewStyles.label}>{label}</div>
      {sub && <div style={overviewStyles.sub}>{sub}</div>}
    </div>
  );
}

const overviewStyles: Record<string, React.CSSProperties> = {
  card: {
    background: "var(--surface)", border: "1.5px solid var(--border)",
    borderRadius: 12, padding: "16px 20px", minWidth: 140,
    display: "flex", flexDirection: "column", gap: 4,
    boxShadow: "var(--shadow-sm)",
  },
  value: {
    fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 700, color: "var(--accent)",
  },
  label: { fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" },
  sub: { fontSize: 11, color: "var(--text-muted)" },
};

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh", background: "var(--bg)",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: "48px 24px", gap: 40,
  },
  header: { display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  logo: {
    fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700,
    color: "var(--text)", letterSpacing: "-0.02em",
  },
  subtitle: { fontSize: 15, color: "var(--text-muted)", textAlign: "center" },
  overview: {
    display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center",
  },
  grid: {
    display: "flex", flexWrap: "wrap", gap: 20,
    justifyContent: "center", maxWidth: 860,
  },
  card: {
    display: "flex", flexDirection: "column", gap: 12,
    background: "var(--surface)", border: "1.5px solid var(--border)",
    borderRadius: 16, padding: "28px 32px", width: 240,
    textDecoration: "none", color: "inherit",
    boxShadow: "var(--shadow-md)",
    transition: "transform 0.18s, box-shadow 0.18s, border-color 0.18s",
    cursor: "pointer",
  },
  cardIcon: { fontFamily: "var(--font-mono)", fontSize: 28 },
  cardTitle: { fontSize: 17, fontWeight: 700, color: "var(--text)" },
  cardDesc: { fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 },
};
