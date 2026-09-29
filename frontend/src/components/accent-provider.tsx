"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";
import { getAccentHex } from "@/lib/app-accent";
import { subscribeToProfileUpdates } from "@/lib/profile-updates";

const ACCENT_STORAGE_KEY = "bloom-accent";

/**
 * Applies the user's chosen app-wide accent colour to the `--brand-accent` CSS variable on the
 * document root. Caches the resolved colour in localStorage so it applies instantly on the next
 * load (paired with the inline script in layout.tsx that avoids a flash of the default amber),
 * then fetches the saved profile and reacts to profile saves published elsewhere in the app.
 */
export function AccentProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    const cached = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (cached) document.documentElement.style.setProperty("--brand-accent", cached);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;

    async function loadAccent() {
      try {
        const profile = await api.getProfile();
        if (cancelled) return;
        const hex = getAccentHex(profile?.accentColor);
        document.documentElement.style.setProperty("--brand-accent", hex);
        localStorage.setItem(ACCENT_STORAGE_KEY, hex);
      } catch {
        // Keep whatever accent is already applied (default or cached) if the fetch fails.
      }
    }

    loadAccent();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(
    () =>
      subscribeToProfileUpdates((profile) => {
        const hex = getAccentHex(profile.accentColor);
        document.documentElement.style.setProperty("--brand-accent", hex);
        localStorage.setItem(ACCENT_STORAGE_KEY, hex);
      }),
    []
  );

  return children;
}
