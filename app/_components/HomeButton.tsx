"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function HomeButton() {
  const pathname = usePathname();
  const show = pathname !== "/" && pathname !== "/login";

  useEffect(() => {
    if (show) {
      document.body.classList.add("has-topnav");
    } else {
      document.body.classList.remove("has-topnav");
    }
    return () => {
      document.body.classList.remove("has-topnav");
    };
  }, [show]);

  if (!show) return null;

  return (
    <nav className="top-nav">
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
    </nav>
  );
}
