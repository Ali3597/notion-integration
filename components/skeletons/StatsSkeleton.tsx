import { Skeleton } from "@/components/Skeleton";

interface StatsSkeletonProps {
  kpiCount?: number;
}

export function StatsSkeleton({ kpiCount = 4 }: StatsSkeletonProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${kpiCount}, 1fr)`, gap: 12 }}>
        {Array.from({ length: kpiCount }).map((_, i) => (
          <div key={i} style={{
            background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14,
            padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10,
            boxShadow: "var(--shadow-sm)",
          }}>
            <Skeleton height="10px" width="60%" />
            <Skeleton height="28px" width="45%" />
          </div>
        ))}
      </div>
      {/* Chart row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[0, 1].map((i) => (
          <div key={i} style={{
            background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14,
            padding: "20px 24px", boxShadow: "var(--shadow-sm)",
          }}>
            <Skeleton height="13px" width="45%" style={{ marginBottom: 16 }} />
            <Skeleton height="200px" borderRadius="8px" />
          </div>
        ))}
      </div>
    </div>
  );
}
