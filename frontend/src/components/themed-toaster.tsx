"use client";
import { Toaster } from "sonner";
import { useTheme } from "./theme-provider";

/** Renders Sonner's Toaster with the resolved app theme so toasts match light/dark mode. */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster position="bottom-center" theme={resolvedTheme} />;
}
