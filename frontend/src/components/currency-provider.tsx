"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";
import { DEFAULT_CURRENCY, parseCurrency } from "@/lib/currency";
import { setActiveCurrency } from "@/lib/format";
import { subscribeToProfileUpdates } from "@/lib/profile-updates";

const CURRENCY_STORAGE_KEY = "bloom-currency";

/**
 * Applies the user's chosen display currency to `formatCurrency` for the rest of the session.
 * Caches the resolved currency in localStorage so it applies instantly on the next load, then
 * fetches the saved profile and reacts to profile saves published elsewhere in the app. No
 * conversion happens here: this only changes which currency amounts are rendered in.
 */
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    const cached = parseCurrency(localStorage.getItem(CURRENCY_STORAGE_KEY));
    if (cached) setActiveCurrency(cached);
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;

    async function loadCurrency() {
      try {
        const profile = await api.getProfile();
        if (cancelled) return;
        const currency = parseCurrency(profile?.currency) ?? DEFAULT_CURRENCY;
        setActiveCurrency(currency);
        localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
      } catch {
        // Keep whatever currency is already applied (default or cached) if the fetch fails.
      }
    }

    loadCurrency();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(
    () =>
      subscribeToProfileUpdates((profile) => {
        const currency = parseCurrency(profile.currency) ?? DEFAULT_CURRENCY;
        setActiveCurrency(currency);
        localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
      }),
    []
  );

  return children;
}
