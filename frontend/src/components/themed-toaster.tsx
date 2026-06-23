"use client";
import { Toaster } from "sonner";
import { useTheme } from "./theme-provider";

/** Renders Sonner's Toaster with the active app theme so toasts match light/dark mode. */
export function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="bottom-center" theme={theme} />;
}
