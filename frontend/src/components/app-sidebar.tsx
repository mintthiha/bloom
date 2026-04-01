"use client";
import Link from "next/link";
import { Settings } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar() {
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

      <SidebarContent />

      <SidebarFooter style={{ padding: "12px 0" }}>
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              className="group-data-[collapsible=icon]:!justify-center"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
              onClick={() => window.location.href = "/settings"}
            >
              <Settings size={16} style={{ flexShrink: 0 }} />
              <span className="group-data-[collapsible=icon]:hidden" style={{ fontWeight: 600, fontSize: "13px", whiteSpace: "nowrap" }}>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
