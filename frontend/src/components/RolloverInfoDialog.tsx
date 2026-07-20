"use client";
import { useState } from "react";
import { Info } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** One labelled explanation row inside the rollover help dialog. */
function HelpRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: "13px", fontWeight: 700, marginBottom: "2px" }}>{title}</p>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {children}
      </p>
    </div>
  );
}

/**
 * A small "How rollover works" trigger that opens a plain-language explainer of
 * envelope carry-forward, so users understand the toggle without reading code.
 */
export function RolloverInfoDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 0",
          fontSize: "12px",
          fontWeight: 600,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-secondary)",
        }}
      >
        <Info size={14} aria-hidden />
        How rollover works
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <div style={{ padding: "12px 14px" }}>
            <AlertDialogHeader>
              <AlertDialogTitle>How rollover works</AlertDialogTitle>
            </AlertDialogHeader>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "14px", margin: "14px 0" }}
            >
              <HelpRow title="Envelopes, not just caps">
                With rollover on, a budget becomes an envelope: money you don&rsquo;t spend this
                month carries into next month instead of resetting to the limit.
              </HelpRow>
              <HelpRow title="What you have to spend">
                Each month&rsquo;s <strong>available</strong> is your limit plus whatever rolled in
                from last month, plus any money you moved in or out —{" "}
                <span className="num">available = limit + rolled-in + moved</span>.
              </HelpRow>
              <HelpRow title="Overspending is carried forward">
                If you spend more than you have available, the shortfall rolls forward as a negative
                balance and reduces next month&rsquo;s available — you effectively pay it back.
              </HelpRow>
              <HelpRow title="Moving money between envelopes">
                Use <strong>Move money</strong> to shift part of one envelope&rsquo;s available
                balance into another for the current month. You can&rsquo;t move out more than an
                envelope has available.
              </HelpRow>
              <HelpRow title="Off by default">
                Rollover is opt-in per budget. Turning it off reverts that budget to a plain monthly
                cap that resets every month.
              </HelpRow>
            </div>

            <AlertDialogFooter>
              <AlertDialogAction type="button" onClick={() => setOpen(false)}>
                Got it
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
