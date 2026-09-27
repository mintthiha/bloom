"use client";
import { Download } from "lucide-react";

interface ExportDownloadButtonProps {
  icon: React.ReactNode;
  label: string;
  isBusy: boolean;
  isDisabled: boolean;
  onClick: () => void;
}

/** One download pill in the export row; swaps its label while its own format is being prepared. */
export function ExportDownloadButton({
  icon,
  label,
  isBusy,
  isDisabled,
  onClick,
}: ExportDownloadButtonProps) {
  return (
    <button
      type="button"
      className="press"
      onClick={onClick}
      disabled={isDisabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        padding: "9px 14px",
        borderRadius: "10px",
        border: "1px solid var(--border)",
        background: "var(--surface-2)",
        color: "var(--text-secondary)",
        fontSize: "13px",
        fontWeight: 600,
        cursor: isDisabled ? "default" : "pointer",
        opacity: isDisabled && !isBusy ? 0.5 : 1,
      }}
    >
      {isBusy ? <Download size={13} /> : icon}
      {isBusy ? "Exporting…" : label}
    </button>
  );
}
