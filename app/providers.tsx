"use client";

import { PomodoroProvider } from "@/lib/pomodoro-context";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <PomodoroProvider>{children}</PomodoroProvider>;
}
