import Link from "next/link";

const integrations = [
  {
    href: "/pomodoro",
    icon: "◉",
    title: "Pomodoro",
    description: "Sessions de travail chronométrées liées à tes projets et tâches Notion.",
    color: "var(--accent)",
  },
  {
    href: "/petitbambou",
    icon: "🎋",
    title: "Petit Bambou",
    description: "Sessions de méditation synchronisées depuis l'app Petit Bambou.",
    color: "var(--accent2)",
  },
];

export default function HubPage() {
  return (
    <main style={styles.main}>
      <div style={styles.header}>
        <div style={styles.logo}>notion×hub</div>
        <p style={styles.subtitle}>Tes intégrations Notion en un seul endroit.</p>
      </div>

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

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    background: "var(--bg)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 24px",
    gap: 48,
  },
  header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    fontFamily: "var(--font-mono)",
    fontSize: 28,
    fontWeight: 700,
    color: "var(--text)",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    fontSize: 15,
    color: "var(--text-muted)",
    textAlign: "center",
  },
  grid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 20,
    justifyContent: "center",
    maxWidth: 800,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    background: "var(--surface)",
    border: "1.5px solid var(--border)",
    borderRadius: 16,
    padding: "28px 32px",
    width: 240,
    textDecoration: "none",
    color: "inherit",
    boxShadow: "var(--shadow-md)",
    transition: "transform 0.18s, box-shadow 0.18s, border-color 0.18s",
    cursor: "pointer",
  },
  cardIcon: {
    fontFamily: "var(--font-mono)",
    fontSize: 28,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "var(--text)",
  },
  cardDesc: {
    fontSize: 13,
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },
};
