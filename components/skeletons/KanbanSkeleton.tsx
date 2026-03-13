import { Skeleton } from "@/components/Skeleton";

const CARD_HEIGHTS = [72, 56, 88, 64, 72];

function KanbanColumnSkeleton({ cardHeights }: { cardHeights: number[] }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 14,
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Column header */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
        <Skeleton width="50%" height="14px" />
        <Skeleton width="24px" height="18px" borderRadius="10px" style={{ marginLeft: "auto" }} />
      </div>
      {/* Cards */}
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {cardHeights.map((h, i) => (
          <div key={i} style={{
            background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 10,
            padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8,
          }}>
            <Skeleton height="13px" width="85%" />
            <Skeleton height="11px" width="50%" />
            <div style={{ height: h - 60 > 0 ? h - 60 : 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr", height: "60vh", gap: 16, overflow: "hidden" }}>
      <KanbanColumnSkeleton cardHeights={[CARD_HEIGHTS[0], CARD_HEIGHTS[2], CARD_HEIGHTS[4]]} />
      <KanbanColumnSkeleton cardHeights={[CARD_HEIGHTS[1], CARD_HEIGHTS[3]]} />
      <KanbanColumnSkeleton cardHeights={[CARD_HEIGHTS[2], CARD_HEIGHTS[0]]} />
    </div>
  );
}
