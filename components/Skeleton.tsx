import React from "react";

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  width = "100%",
  height = "16px",
  borderRadius = "6px",
  className,
  style,
}: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer${className ? ` ${className}` : ""}`}
      style={{ width, height, borderRadius, flexShrink: 0, ...style }}
    />
  );
}
