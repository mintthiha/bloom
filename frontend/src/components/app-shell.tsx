"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { HeaderSearch } from "@/components/header-search";
import { ProfileMenu } from "@/components/profile-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemedToaster } from "@/components/themed-toaster";
import { AmbientOrb } from "@/components/ambient-orb";
import { DashboardCustomizePanel } from "@/app/_components/_dashboardCustomize/DashboardCustomizePanel";
import { useDashboardVisibility } from "@/components/dashboard-visibility-provider";

/** Routes that render standalone, without the sidebar/header/footer app chrome. */
const CHROMELESS_ROUTES = new Set(["/login"]);

/** Wraps the app in its sidebar/header/footer shell, except on standalone routes like /login. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { orbsEnabled } = useDashboardVisibility();

  if (CHROMELESS_ROUTES.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider
      defaultOpen={false}
      style={
        {
          minHeight: "100vh",
          "--sidebar-width": "14.5rem",
          "--sidebar-width-icon": "3.5rem",
        } as CSSProperties
      }
    >
      <AppSidebar />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            padding: "0 24px",
            height: "56px",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: "16px",
            position: "sticky",
            top: 0,
            background: "var(--header-bg)",
            backdropFilter: "blur(12px)",
            zIndex: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
            <SidebarTrigger />
            <div
              className="header-status"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <div
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: "#22c55e",
                  flexShrink: 0,
                }}
              />
              <span
                className="num"
                style={{ fontSize: "11px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}
              >
                All systems operational
              </span>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
            <HeaderSearch />
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "8px",
            }}
          >
            <DashboardCustomizePanel />
            <ThemeToggle />
            <ProfileMenu />
          </div>
        </header>
        <CommandPalette />
        <ThemedToaster />
        <main style={{ flex: 1, overflowX: "hidden" }}>
          {orbsEnabled && <AmbientOrb />}
          {/* Content sits above the ambient orbs (which render at z-index 0). */}
          <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
        </main>
        <footer
          style={{
            borderTop: "1px solid var(--border)",
            padding: "16px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            © 2026 Bloom Financial Inc.
          </span>
          <span className="num" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            v2.0.0
          </span>
        </footer>
      </div>
    </SidebarProvider>
  );
}
