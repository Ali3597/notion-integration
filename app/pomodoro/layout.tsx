import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pomodoro" };

export default function PomodoroLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
