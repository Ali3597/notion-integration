"use client";

import { useState } from "react";

interface ImageWithLoaderProps {
  src: string | null | undefined;
  alt: string;
  width: number;
  height: number;
  borderRadius?: string;
  placeholderIcon?: string;
  style?: React.CSSProperties;
}

export function ImageWithLoader({
  src,
  alt,
  width,
  height,
  borderRadius = "8px",
  placeholderIcon = "🖼️",
  style,
}: ImageWithLoaderProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const placeholderStyle: React.CSSProperties = {
    position: "absolute", inset: 0, borderRadius,
    background: "var(--surface2)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: Math.round(Math.min(width, height) * 0.35),
  };

  if (!src || error) {
    return (
      <div style={{ position: "relative", width, height, flexShrink: 0, ...style }}>
        <div style={{ ...placeholderStyle, position: "relative" }}>{placeholderIcon}</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width, height, flexShrink: 0, ...style }}>
      {/* Shimmer placeholder */}
      {!loaded && (
        <div
          className="skeleton-shimmer"
          style={{ ...placeholderStyle, position: "absolute" }}
        />
      )}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{
          position: "absolute", inset: 0, width, height,
          objectFit: "cover", borderRadius, display: "block",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.3s",
          cursor: "inherit",
        }}
      />
    </div>
  );
}
