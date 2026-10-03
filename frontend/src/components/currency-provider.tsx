"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { api, Profile } from "@/lib/api";
import {
  CadExchangeRates,
  Currency,
  DEFAULT_CURRENCY,
  getRateForCurrency,
  parseCurrency,
} from "@/lib/currency";
import { setActiveCurrency } from "@/lib/format";
import { subscribeToProfileUpdates } from "@/lib/profile-updates";

const CURRENCY_STORAGE_KEY = "bloom-currency";
const RATES_STORAGE_KEY = "bloom-currency-rates";

/** Reads the cached currency + exchange rates from localStorage and applies them, if present. */
function applyCachedCurrency(): void {
  const cachedCurrency = parseCurrency(localStorage.getItem(CURRENCY_STORAGE_KEY));
  if (!cachedCurrency) return;
  const cachedRatesJson = localStorage.getItem(RATES_STORAGE_KEY);
  const cachedRates = cachedRatesJson ? (JSON.parse(cachedRatesJson) as CadExchangeRates) : null;
  const rate = cachedRates ? getRateForCurrency(cachedCurrency, cachedRates) : 1;
  setActiveCurrency(cachedCurrency, rate);
}

/**
 * Resolves the chosen currency's CAD conversion rate (fetching cached exchange rates from the
 * backend when the currency isn't CAD), applies it, and caches both for the next load.
 */
async function resolveAndApplyCurrency(currency: Currency): Promise<void> {
  if (currency === "CAD") {
    setActiveCurrency("CAD", 1);
    localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
    localStorage.removeItem(RATES_STORAGE_KEY);
    return;
  }

  const rates = await api.getExchangeRates();
  setActiveCurrency(currency, getRateForCurrency(currency, rates));
  localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(rates));
}

/**
 * Applies the user's chosen display currency (and its CAD conversion rate) to `formatCurrency`
 * for the rest of the session. Caches the resolved currency/rates in localStorage so they apply
 * instantly on the next load, then fetches the saved profile and reacts to profile saves
 * published elsewhere in the app.
 */
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    try {
      applyCachedCurrency();
    } catch {
      // Keep the default currency if the cache is missing or malformed.
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;

    async function loadCurrency() {
      try {
        const profile = await api.getProfile();
        if (cancelled) return;
        await resolveAndApplyCurrency(parseCurrency(profile?.currency) ?? DEFAULT_CURRENCY);
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
      subscribeToProfileUpdates((profile: Profile) => {
        resolveAndApplyCurrency(parseCurrency(profile.currency) ?? DEFAULT_CURRENCY).catch(() => {
          // Keep whatever currency is already applied if the rate fetch fails.
        });
      }),
    []
  );

  return children;
}
