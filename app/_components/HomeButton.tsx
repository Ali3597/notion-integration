"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HomeButton() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/login") return null;

  return (
    <Link href="/" aria-label="Accueil" className="home-btn">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    </Link>
  );
}
