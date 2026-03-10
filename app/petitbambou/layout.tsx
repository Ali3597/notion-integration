import type { Metadata } from "next";

export const metadata: Metadata = { title: "Petit Bambou" };

export default function PetitBambouLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
