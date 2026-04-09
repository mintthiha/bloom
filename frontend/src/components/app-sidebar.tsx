"use client";
import { useEffect, useState } from "react";
import { Columns2, LogOut, Rows3 } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useDashboardView } from "@/components/dashboard-view-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { data: session } = useSession();
  const { state } = useSidebar();
  const { view, setView } = useDashboardView();
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  /**
   * Loads the current user's saved profile so the sidebar reflects Prisma data
   * instead of relying on the auth session name.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const profile = await api.getProfile();
        if (!cancelled) {
          setFirstName(profile?.firstName ?? null);
          setLastName(profile?.lastName ?? null);
          setUsername(profile?.username ?? null);
        }
      } catch {
        if (!cancelled) {
          setFirstName(null);
          setLastName(null);
          setUsername(null);
        }
      }
    }

    if (session?.user?.id) {
      loadProfile();
    } else {
      setUsername(null);
    }

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Your profile";
  const displayHandle = username ? `@${username}` : session?.user?.email ?? "";
  const avatarFallback = (displayName[0] ?? "B").toUpperCase();

  return (
    <Sidebar collapsible="icon" style={{ borderRight: "none" }}>
      <SidebarHeader style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "inherit" }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
            <rect width="28" height="28" rx="6" fill="#f59e0b" />
            <path d="M8 20V8h5.5a4 4 0 0 1 0 8H8" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 16h7a4 4 0 0 1 0 8H8" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="group-data-[collapsible=icon]:hidden" style={{ fontWeight: 700, fontSize: "16px", letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>Bloom</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {state !== "collapsed" && (
            <SidebarGroupLabel
              style={{
                justifyContent: "center",
                fontWeight: 900,
                textAlign: "center",
                paddingBottom: "12px",
              }}
            >
              Dashboard View
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: state === "collapsed" ? "1fr" : "1fr 1fr",
                gap: "8px",
                padding: state === "collapsed" ? "0 8px" : "0 8px 8px",
              }}
            >
              <button
                type="button"
                onClick={() => setView("single")}
                title="Single column"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  minHeight: "36px",
                  borderRadius: "10px",
                  border: view === "single" ? "1px solid #f59e0b66" : "1px solid var(--border)",
                  background: view === "single" ? "#f59e0b1a" : "var(--surface-1)",
                  color: view === "single" ? "#f59e0b" : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Rows3 size={15} />
                <span className="group-data-[collapsible=icon]:hidden">Single</span>
              </button>
              <button
                type="button"
                onClick={() => setView("double")}
                title="Two columns"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  minHeight: "36px",
                  borderRadius: "10px",
                  border: view === "double" ? "1px solid #f59e0b66" : "1px solid var(--border)",
                  background: view === "double" ? "#f59e0b1a" : "var(--surface-1)",
                  color: view === "double" ? "#f59e0b" : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Columns2 size={15} />
                <span className="group-data-[collapsible=icon]:hidden">Double</span>
              </button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter style={{ padding: "12px 0" }}>
        {session?.user && (
          <div
            style={{
              padding: state === "collapsed" ? "0 8px 10px" : "0 12px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: state === "collapsed" ? "center" : "flex-start",
            }}
          >
            <Link
              href="/profile"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                minWidth: 0,
                textDecoration: "none",
                color: "inherit",
                padding: state === "collapsed" ? "0" : "10px 12px",
                borderRadius: "14px",
                background: state === "collapsed" ? "transparent" : "var(--surface-1)",
                border: state === "collapsed" ? "none" : "1px solid var(--border)",
                justifyContent: state === "collapsed" ? "center" : "flex-start",
              }}
            >
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={displayName}
                  width={36}
                  height={36}
                  style={{ borderRadius: "999px", flexShrink: 0 }}
                />
              ) : (
                <div
                  className="num"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "999px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f59e0b22",
                    border: "1px solid #f59e0b44",
                    color: "#f59e0b",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  {avatarFallback}
                </div>
              )}

              {state !== "collapsed" && (
                <div style={{ minWidth: 0, overflow: "hidden" }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {displayName}
                  </p>
                  <p className="num" style={{ fontSize: "11px", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {displayHandle}
                  </p>
                </div>
              )}
            </Link>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              className="group-data-[collapsible=icon]:!justify-center"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut size={16} style={{ flexShrink: 0 }} />
              <span className="group-data-[collapsible=icon]:hidden" style={{ fontWeight: 600, fontSize: "13px", whiteSpace: "nowrap" }}>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
