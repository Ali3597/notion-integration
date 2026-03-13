interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 16, color = "var(--accent)" }: SpinnerProps) {
  const r = (size - 3) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink: 0, animation: "spin 0.7s linear infinite" }}
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeOpacity={0.25}
        strokeWidth={3}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={`${circ * 0.25} ${circ * 0.75}`}
        strokeLinecap="round"
      />
    </svg>
  );
}
