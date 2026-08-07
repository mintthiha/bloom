"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

type FreezeButtonProps = {
  accountId: string;
  frozen: boolean;
  onToggled: () => void;
};

export function FreezeButton({ accountId, frozen, onToggled }: FreezeButtonProps) {
  const [freezing, setFreezing] = useState(false);

  /** Toggles the frozen state of the account, notifies the parent to refresh, and toasts the outcome. */
  async function handleToggle() {
    setFreezing(true);
    try {
      if (frozen) await api.unfreeze(accountId);
      else await api.freeze(accountId);
      onToggled();
      toast.success(frozen ? "Account unfrozen" : "Account frozen");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update account");
    } finally {
      setFreezing(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={freezing}
      style={{
        padding: "6px 14px",
        border: `1px solid ${frozen ? "#3b82f640" : "#f8717140"}`,
        background: frozen ? "#3b82f610" : "#f8717110",
        color: frozen ? "#60a5fa" : "#f87171",
        borderRadius: "7px",
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        cursor: freezing ? "not-allowed" : "pointer",
        opacity: freezing ? 0.5 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {freezing ? "…" : frozen ? "Unfreeze" : "Freeze"}
    </button>
  );
}
