import { Skeleton } from "@/components/Skeleton";

interface CardGridSkeletonProps {
  count?: number;
  imageHeight?: number;
  columns?: string;
}

export function CardGridSkeleton({
  count = 6,
  imageHeight = 112,
  columns = "repeat(auto-fill, minmax(140px, 1fr))",
}: CardGridSkeletonProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: columns, gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 12,
          padding: 14, display: "flex", flexDirection: "column", gap: 10,
          boxShadow: "var(--shadow-sm)",
        }}>
          <Skeleton height={`${imageHeight}px`} borderRadius="8px" />
          <Skeleton height="13px" width="80%" />
          <Skeleton height="11px" width="55%" />
        </div>
      ))}
    </div>
  );
}
