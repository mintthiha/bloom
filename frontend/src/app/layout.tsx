import type { Metadata } from "next";
import React from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "next-auth/react";
import { DashboardViewProvider } from "@/components/dashboard-view-provider";
import { DashboardVisibilityProvider } from "@/components/dashboard-visibility-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Bloom",
  description: "Simple, modern banking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        {/* Removes the dark class before first paint if the user has saved light mode */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('bloom-theme')==='light')document.documentElement.classList.remove('dark')}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <SessionProvider>
            <TooltipProvider>
              <DashboardViewProvider>
                <DashboardVisibilityProvider>
                  <AppShell>{children}</AppShell>
                </DashboardVisibilityProvider>
              </DashboardViewProvider>
            </TooltipProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
