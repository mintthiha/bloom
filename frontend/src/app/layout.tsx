import type { Metadata } from "next";
import React from "react";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { auth } from "@/auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "next-auth/react";
import { DashboardViewProvider } from "@/components/dashboard-view-provider";
import { DashboardVisibilityProvider } from "@/components/dashboard-visibility-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { AccentProvider } from "@/components/accent-provider";
import { AppShell } from "@/components/app-shell";
import { ACTIVE_USER_STORAGE_KEY, PER_USER_STORAGE_KEYS } from "@/lib/per-user-storage";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Bloom",
  description: "Simple, modern banking.",
};

/**
 * Builds a synchronous head script that clears per-user preferences when a different account is
 * signed in on this browser, so a new (or switched) user gets a genuine fresh-start experience
 * instead of inheriting the previous user's localStorage. Runs before any provider reads storage.
 */
function buildPerUserResetScript(userId: string): string {
  const safeUserId = JSON.stringify(userId).replace(/</g, "\\u003c");
  const keys = JSON.stringify(PER_USER_STORAGE_KEYS).replace(/</g, "\\u003c");
  const activeUserKey = JSON.stringify(ACTIVE_USER_STORAGE_KEY);
  return `(function(){try{var u=${safeUserId};if(!u)return;if(localStorage.getItem(${activeUserKey})===u)return;${keys}.forEach(function(k){localStorage.removeItem(k)});localStorage.setItem(${activeUserKey},u);}catch(e){}})();`;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id ?? "";

  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        {/* Removes the dark class before first paint if the resolved theme (saved preference, or system when unset/"system") is light */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('bloom-theme');var isLight=t==='light'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: light)').matches);if(isLight)document.documentElement.classList.remove('dark')}catch(e){}})();`,
          }}
        />
        {/* Applies the cached app accent colour before first paint to avoid a flash of the default amber */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var a=localStorage.getItem('bloom-accent');if(a)document.documentElement.style.setProperty('--brand-accent',a)}catch(e){}})();`,
          }}
        />
        {/* Resets per-user preferences before providers hydrate when the account has changed */}
        {userId && <script dangerouslySetInnerHTML={{ __html: buildPerUserResetScript(userId) }} />}
      </head>
      <body>
        <ThemeProvider>
          <SessionProvider>
            <AccentProvider>
              <TooltipProvider>
                <DashboardViewProvider>
                  <DashboardVisibilityProvider>
                    <AppShell>{children}</AppShell>
                  </DashboardVisibilityProvider>
                </DashboardViewProvider>
              </TooltipProvider>
            </AccentProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
