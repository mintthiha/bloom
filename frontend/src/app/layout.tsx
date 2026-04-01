import type { Metadata } from "next";
import React from "react";
import { Toaster } from "sonner";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Bloom",
  description: "Simple, modern banking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <body>
        <TooltipProvider>
          <SidebarProvider style={{ minHeight: "100vh", "--sidebar-width": "8rem", "--sidebar-width-icon": "3.5rem" } as React.CSSProperties}>
            <AppSidebar />
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
              <header style={{
                borderBottom: "1px solid var(--border)",
                padding: "0 24px",
                height: "56px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "sticky",
                top: 0,
                background: "rgba(8,8,8,0.85)",
                backdropFilter: "blur(12px)",
                zIndex: 20,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <SidebarTrigger />
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e" }} />
                    <span className="num" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>All systems operational</span>
                  </div>
                </div>
              </header>
              <Toaster position="bottom-center" theme="dark" />
              <main style={{ flex: 1 }}>{children}</main>
              <footer style={{ borderTop: "1px solid var(--border)", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>© 2026 Bloom Financial Inc.</span>
                <span className="num" style={{ fontSize: "11px", color: "var(--text-muted)" }}>v2.0.0</span>
              </footer>
            </div>
          </SidebarProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
