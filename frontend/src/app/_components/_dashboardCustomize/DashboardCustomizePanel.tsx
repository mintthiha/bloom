"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  ALL_CARD_IDS,
  CARD_METADATA,
  CardId,
  useDashboardVisibility,
} from "@/components/dashboard-visibility-provider";
import {
  getOnboardingDismissed,
  clearOnboardingDismissed,
  getOnboardingAllStepsComplete,
  clearOnboardingAllStepsComplete,
} from "@/app/_components/_onboardingChecklist/onboarding-storage";

/** Animated pill switch indicating whether a card is visible. */
function CardToggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={disabled ? undefined : onChange}
      style={{
        width: "36px",
        height: "20px",
        borderRadius: "999px",
        background: checked ? "#3b82f6" : "var(--surface-2)",
        border: `1px solid ${checked ? "#3b82f6" : "var(--border)"}`,
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "background 0.2s, border-color 0.2s, opacity 0.2s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "2px",
          left: checked ? "18px" : "2px",
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          background: checked ? "#fff" : "var(--text-muted)",
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

/**
 * One row inside the panel showing the card label, description, and its visibility toggle.
 * When `lockedHint` is set the card can't be shown yet (its data requirement isn't met), so the
 * toggle is disabled and the hint replaces the description.
 */
function CardToggleRow({ cardId, lockedHint }: { cardId: CardId; lockedHint?: string }) {
  const { visibleCards, toggleCard } = useDashboardVisibility();
  const meta = CARD_METADATA[cardId];
  const isVisible = visibleCards.has(cardId);
  const isLocked = Boolean(lockedHint);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid var(--border)",
        gap: "12px",
        opacity: isLocked ? 0.6 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "2px" }}>{meta.label}</p>
        <p style={{ fontSize: "12px", color: isLocked ? "#3b82f6" : "var(--text-secondary)" }}>
          {lockedHint ?? meta.description}
        </p>
      </div>
      <CardToggle checked={isVisible} onChange={() => toggleCard(cardId)} disabled={isLocked} />
    </div>
  );
}

/** Right-side drawer for app-wide appearance settings plus dashboard-only card controls. */
export function DashboardCustomizePanel() {
  const {
    resetToDefaults,
    visibleCards,
    allCollapsed,
    setAllCollapsed,
    orbsEnabled,
    setOrbsEnabled,
    cardOrder,
  } = useDashboardVisibility();
  const pathname = usePathname();
  // Card visibility, collapse-all, and the onboarding checklist only apply to the dashboard.
  const isDashboard = pathname === "/";
  const hiddenCount = ALL_CARD_IDS.length - visibleCards.size;
  // True when the user has hidden a card or dragged the layout away from its default order.
  const hasCustomLayout =
    hiddenCount > 0 || cardOrder.some((id, index) => id !== ALL_CARD_IDS[index]);
  const [isChecklistHidden, setIsChecklistHidden] = useState(false);
  const [accountCount, setAccountCount] = useState<number | null>(null);

  /** Loads the account count so cards that require a minimum number can be locked until it's met. */
  async function refreshAccountCount() {
    try {
      const accounts = await api.listAccounts();
      setAccountCount(accounts.length);
    } catch {
      setAccountCount(null);
    }
  }

  /** Pre-fetches the account count on the dashboard so lock states are ready before the drawer opens. */
  useEffect(() => {
    if (isDashboard) refreshAccountCount();
  }, [isDashboard]);

  /** Returns a hint when a card can't be shown yet because too few accounts exist, otherwise undefined. */
  function lockedHintFor(cardId: CardId): string | undefined {
    const required = CARD_METADATA[cardId].requiresAccounts;
    if (required != null && accountCount != null && accountCount < required) {
      return `Needs ${required}+ accounts`;
    }
    return undefined;
  }

  /** Reads both hide-flags from localStorage on mount to decide whether to show the restore button. */
  useEffect(() => {
    setIsChecklistHidden(getOnboardingDismissed() || getOnboardingAllStepsComplete());
  }, []);

  /** Keeps the restore button visible when the checklist auto-hides after all steps finish or is dismissed. */
  useEffect(() => {
    function handleHidden() {
      setIsChecklistHidden(true);
    }
    window.addEventListener("bloom:onboarding-all-complete", handleHidden);
    window.addEventListener("bloom:onboarding-dismissed", handleHidden);
    return () => {
      window.removeEventListener("bloom:onboarding-all-complete", handleHidden);
      window.removeEventListener("bloom:onboarding-dismissed", handleHidden);
    };
  }, []);

  /** Clears all hide-flags and fires an event so the checklist re-appears immediately. */
  function handleRestoreChecklist() {
    clearOnboardingDismissed();
    clearOnboardingAllStepsComplete();
    setIsChecklistHidden(false);
    window.dispatchEvent(new Event("bloom:onboarding-restored"));
  }

  return (
    <Sheet
      onOpenChange={(open) => {
        if (open && isDashboard) refreshAccountCount();
      }}
    >
      <SheetTrigger
        render={
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          />
        }
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
        Customize
        {isDashboard && hiddenCount > 0 && (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: "999px",
              background: "#3b82f622",
              color: "#3b82f6",
              border: "1px solid #3b82f644",
            }}
          >
            {hiddenCount} hidden
          </span>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        style={{
          overflowY: "auto",
          background: "var(--sidebar)",
          borderLeft: "1px solid var(--border)",
        }}
      >
        <SheetHeader style={{ padding: "28px 24px 16px" }}>
          <SheetTitle style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.4px" }}>
            {isDashboard ? "Customize Dashboard" : "Customize"}
          </SheetTitle>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            {isDashboard
              ? "Choose which cards appear on your dashboard."
              : "Adjust how Bloom looks."}
          </p>
        </SheetHeader>

        <div style={{ padding: "0 24px" }}>
          {isDashboard && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 0",
                borderBottom: "1px solid var(--border)",
                gap: "12px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "2px" }}>
                  Collapse all cards by on load
                </p>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  Close every card down to its compact header
                </p>
              </div>
              <CardToggle checked={allCollapsed} onChange={() => setAllCollapsed(!allCollapsed)} />
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 0",
              borderBottom: "1px solid var(--border)",
              gap: "12px",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "2px" }}>
                Ambient background orbs
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Soft glows that drift in the background
              </p>
            </div>
            <CardToggle checked={orbsEnabled} onChange={() => setOrbsEnabled(!orbsEnabled)} />
          </div>

          {isDashboard && (
            <>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--text-muted)",
                  margin: "20px 0 4px",
                }}
              >
                Cards
              </p>

              {ALL_CARD_IDS.map((cardId) => (
                <CardToggleRow key={cardId} cardId={cardId} lockedHint={lockedHintFor(cardId)} />
              ))}

              {hasCustomLayout && (
                <button
                  type="button"
                  onClick={resetToDefaults}
                  style={{
                    marginTop: "24px",
                    width: "100%",
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "8px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  Reset to defaults
                </button>
              )}

              {isChecklistHidden && (
                <button
                  type="button"
                  onClick={handleRestoreChecklist}
                  style={{
                    marginTop: hasCustomLayout ? "10px" : "24px",
                    width: "100%",
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "8px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  Restore getting started checklist
                </button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
