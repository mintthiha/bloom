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
import { AppShell } from "@/components/app-shell";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Bloom",
  description: "Simple, modern banking.",
};

// Per-user localStorage keys that must not leak between accounts on a shared browser (dashboard
// layout, onboarding progress, cached name, pinned goal, custom templates). Appearance keys
// (theme, dashboard view, collapse, orbs) are intentionally excluded so they persist across logins.
const PER_USER_STORAGE_KEYS = [
  "bloom_profile_first_name",
  "bloom-account-order",
  "bloom_learn_explored",
  "bloom_dashboard_visible_cards",
  "bloom_dashboard_card_order",
  "bloom_dashboard_explained_cards",
  "bloom_goal_widget_id",
  "bloom_onboarding_dismissed",
  "bloom_onboarding_all_steps_complete",
  "bloom_onboarding_learn_explored",
  "bloom-custom-reward-programs",
  "bloom_saved_account",
];

/**
 * Builds a synchronous head script that clears per-user preferences when a different account is
 * signed in on this browser, so a new (or switched) user gets a genuine fresh-start experience
 * instead of inheriting the previous user's localStorage. Runs before any provider reads storage.
 */
function buildPerUserResetScript(userId: string): string {
  const safeUserId = JSON.stringify(userId).replace(/</g, "\\u003c");
  const keys = JSON.stringify(PER_USER_STORAGE_KEYS).replace(/</g, "\\u003c");
  return `(function(){try{var u=${safeUserId};if(!u)return;if(localStorage.getItem('bloom_active_user')===u)return;${keys}.forEach(function(k){localStorage.removeItem(k)});localStorage.setItem('bloom_active_user',u);}catch(e){}})();`;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id ?? "";

  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        {/* Removes the dark class before first paint if the user has saved light mode */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('bloom-theme')==='light')document.documentElement.classList.remove('dark')}catch(e){}})();`,
          }}
        />
        {/* Resets per-user preferences before providers hydrate when the account has changed */}
        {userId && <script dangerouslySetInnerHTML={{ __html: buildPerUserResetScript(userId) }} />}
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
