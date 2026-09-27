"use client";
import { CollapsibleCard } from "@/components/collapsible-card";
import { ExportDataActions } from "./ExportDataActions";
import { DeleteAccountSection } from "./DeleteAccountSection";

interface AccountDataPanelProps {
  email: string | null;
}

/** Profile-page card holding the whole-account data export and the delete-account danger zone. */
export function AccountDataPanel({ email }: AccountDataPanelProps) {
  return (
    <CollapsibleCard
      className="fade-up"
      eyebrow="Account & Data"
      title="Your data is yours"
      description="Download a copy of everything in Bloom, or close your account for good."
      defaultCollapsed
      style={{ marginTop: "20px" }}
    >
      <ExportDataActions />
      <DeleteAccountSection email={email} />
    </CollapsibleCard>
  );
}
