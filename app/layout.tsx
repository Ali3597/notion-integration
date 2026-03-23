import type { Metadata } from "next";
import "./globals.css";
import { HomeButton } from "./_components/HomeButton";

export const metadata: Metadata = {
  title: {
    template: "%s — life×hub",
    default: "life×hub",
  },
  description: "Ton hub de productivité en local.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body suppressHydrationWarning>
        {children}
        <HomeButton />
      </body>
    </html>
  );
}
