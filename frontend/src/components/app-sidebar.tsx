"use client";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Landmark,
  LayoutDashboard,
  Receipt,
  RefreshCw,
  Sparkles,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
} from "@/components/ui/sidebar";

/** Primary navigation destinations, in sidebar order. */
const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/auto-categorize", label: "Auto-categorize", icon: Sparkles },
];

export function AppSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [dueRecurringCount, setDueRecurringCount] = useState(0);

  /** Counts active recurring rules whose next run date is today or in the past. */
  useEffect(() => {
    let cancelled = false;

    async function loadDueRecurringCount() {
      try {
        const rules = await api.listRecurringTransactions();
        if (!cancelled) {
          const now = new Date();
          const count = rules.filter(
            (rule) => rule.active && new Date(rule.nextRunAt) <= now
          ).length;
          setDueRecurringCount(count);
        }
      } catch {
        // Non-critical — badge simply won't show on error
      }
    }

    if (session?.user?.id) {
      loadDueRecurringCount();
    } else {
      setDueRecurringCount(0);
    }

    window.addEventListener("recurring-changed", loadDueRecurringCount);

    return () => {
      cancelled = true;
      window.removeEventListener("recurring-changed", loadDueRecurringCount);
    };
  }, [session?.user?.id]);

  /** Overview is active only on the exact root; other items match their route prefix. */
  function isActive(href: string): boolean {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <Sidebar collapsible="icon" style={{ borderRight: "none" }}>
      <SidebarHeader
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px 12px",
        }}
      >
        <Link
          href="/"
          aria-label="Bloom home"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="#3b82f6" />
              <path
                d="M8 20V8h5.5a4 4 0 0 1 0 8H8"
                stroke="#000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 16h7a4 4 0 0 1 0 8H8"
                stroke="#000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {dueRecurringCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-3px",
                  right: "-3px",
                  width: "9px",
                  height: "9px",
                  borderRadius: "50%",
                  background: "#ef4444",
                  border: "2px solid var(--sidebar-background, #0a0a0a)",
                }}
              />
            )}
          </div>
          <span
            className="group-data-[collapsible=icon]:hidden"
            style={{
              fontWeight: 700,
              fontSize: "16px",
              letterSpacing: "-0.3px",
              whiteSpace: "nowrap",
            }}
          >
            Bloom
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                padding: "8px",
              }}
            >
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className="nav-item"
                    title={label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      minHeight: "44px",
                      borderRadius: "10px",
                      border: active ? "1px solid #3b82f666" : "1px solid var(--border)",
                      background: active ? "#3b82f61a" : "var(--surface-1)",
                      color: active ? "#3b82f6" : "var(--text-secondary)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "none",
                    }}
                  >
                    <Icon size={15} style={{ flexShrink: 0 }} />
                    <span className="group-data-[collapsible=icon]:hidden">{label}</span>
                  </Link>
                );
              })}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
