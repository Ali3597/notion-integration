import { Skeleton } from "@/components/Skeleton";

const COL_WIDTHS = [
  ["70%", "55%", "65%", "80%", "60%"],
  ["85%", "70%", "50%", "75%", "90%"],
  ["60%", "80%", "70%", "55%", "65%"],
  ["75%", "65%", "85%", "60%", "70%"],
  ["80%", "55%", "75%", "90%", "50%"],
];

const thStyle: React.CSSProperties = {
  textAlign: "left", padding: "12px 16px", fontSize: 10, fontWeight: 600,
  letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)",
  borderBottom: "1px solid var(--border)", background: "var(--bg)",
};
const tdStyle: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--border)" };

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
}

export function TableSkeleton({ columns = 5, rows = 5 }: TableSkeletonProps) {
  return (
    <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} style={thStyle}>
                <Skeleton width={`${40 + i * 10}%`} height="10px" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri}>
              {Array.from({ length: columns }).map((_, ci) => (
                <td key={ci} style={tdStyle}>
                  <Skeleton width={COL_WIDTHS[ri % COL_WIDTHS.length][ci % 5]} height="14px" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
