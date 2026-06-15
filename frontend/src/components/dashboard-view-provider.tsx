"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

type DashboardView = "single" | "double";

type DashboardViewContextValue = {
  view: DashboardView;
  setView: (view: DashboardView) => void;
};

const STORAGE_KEY = "bloom_dashboard_view";

const DashboardViewContext = createContext<DashboardViewContextValue>({
  view: "double",
  setView: () => {},
});

export function DashboardViewProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<DashboardView>("double");

  useEffect(() => {
    const storedView = window.localStorage.getItem(STORAGE_KEY);
    if (storedView === "single" || storedView === "double") {
      setView(storedView);
    }
  }, []);

  const updateView = (nextView: DashboardView) => {
    setView(nextView);
    window.localStorage.setItem(STORAGE_KEY, nextView);
  };

  const value = useMemo(() => ({ view, setView: updateView }), [view]);

  return (
    <DashboardViewContext.Provider value={value}>
      {children}
    </DashboardViewContext.Provider>
  );
}

/** Returns the stored view preference plus an effectiveView that collapses to single on mobile. */
export function useDashboardView() {
  const context = useContext(DashboardViewContext);
  const isMobile = useIsMobile();
  const effectiveView: DashboardView = isMobile ? "single" : context.view;
  return { view: context.view, effectiveView, setView: context.setView };
}
