import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { PomodoroWidget } from "./pomodoro-widget";

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
        <Providers>
          {children}
          <PomodoroWidget />
        </Providers>
      </body>
    </html>
  );
}
