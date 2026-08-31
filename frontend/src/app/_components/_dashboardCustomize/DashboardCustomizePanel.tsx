"use client";

import { useState, useEffect, type ReactNode } from "react";
import { getAiSuggestionsEnabled, setAiSuggestionsEnabled } from "@/lib/import-preferences";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { Columns2, Columns3, Rows3, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { useDashboardView } from "@/components/dashboard-view-provider";
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
 * Shared settings row: a title/description block on the left and a control on the right.
 * `interactive` adds the hover highlight (skip it for rows whose control is disabled), and
 * `dimmed` fades the row when its option isn't available yet.
 */
function SettingRow({
  title,
  description,
  descriptionColor,
  control,
  interactive = true,
  dimmed = false,
}: {
  title: string;
  description: string;
  descriptionColor?: string;
  control: ReactNode;
  interactive?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div
      className={interactive ? "customize-row" : undefined}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid var(--border)",
        gap: "12px",
        opacity: dimmed ? 0.6 : 1,
      }}
    >
      <div className="customize-row-label" style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "2px" }}>{title}</p>
        <p style={{ fontSize: "12px", color: descriptionColor ?? "var(--text-secondary)" }}>
          {description}
        </p>
      </div>
      {control}
    </div>
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
    <SettingRow
      title={meta.label}
      description={lockedHint ?? meta.description}
      descriptionColor={isLocked ? "#3b82f6" : undefined}
      interactive={!isLocked}
      dimmed={isLocked}
      control={
        <CardToggle checked={isVisible} onChange={() => toggleCard(cardId)} disabled={isLocked} />
      }
    />
  );
}

/** One layout-density option button; highlights in accent blue when it matches the active view. */
function DensityButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="nav-item"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        minHeight: "40px",
        borderRadius: "10px",
        border: active ? "1px solid #3b82f666" : "1px solid var(--border)",
        background: active ? "#3b82f61a" : "var(--surface-1)",
        color: active ? "#3b82f6" : "var(--text-secondary)",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
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
  const { view, setView } = useDashboardView();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  // Card visibility, collapse-all, and the onboarding checklist only apply to the dashboard.
  const isDashboard = pathname === "/";
  const isAccountPage = pathname.startsWith("/account/");
  const hiddenCount = ALL_CARD_IDS.length - visibleCards.size;
  // True when the user has hidden a card or dragged the layout away from its default order.
  const hasCustomLayout =
    hiddenCount > 0 || cardOrder.some((id, index) => id !== ALL_CARD_IDS[index]);
  const [isChecklistHidden, setIsChecklistHidden] = useState(false);
  const [aiSuggestionsEnabled, setAiSuggestionsEnabledState] = useState(() =>
    getAiSuggestionsEnabled()
  );
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
            aria-label="Customize"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: isMobile ? "6px" : "6px 12px",
              width: isMobile ? "32px" : undefined,
              height: isMobile ? "32px" : undefined,
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-secondary)",
              transition: "border-color 0.15s, color 0.15s",
              flexShrink: 0,
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
        {!isMobile && "Customize"}
        {!isMobile && isDashboard && hiddenCount > 0 && (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: "999px",
              background: "#3b82f622",
              /* blue-400 (not blue-500 #3b82f6) to clear WCAG AA on the faint same-hue tint at 10px */
              color: "#60a5fa",
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
          width: "min(65vw, 22rem)",
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

        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "2px" }}>Layout density</p>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "10px" }}>
              How many columns cards use on wide screens
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              <DensityButton
                icon={<Rows3 size={15} />}
                label="Single"
                active={view === "single"}
                onClick={() => setView("single")}
              />
              <DensityButton
                icon={<Columns2 size={15} />}
                label="Double"
                active={view === "double"}
                onClick={() => setView("double")}
              />
              <DensityButton
                icon={<Columns3 size={15} />}
                label="Triple"
                active={view === "triple"}
                onClick={() => setView("triple")}
              />
            </div>
          </div>
          {isDashboard && (
            <SettingRow
              title="Collapse all cards by on load"
              description="Close every card down to its compact header"
              control={
                <CardToggle
                  checked={allCollapsed}
                  onChange={() => setAllCollapsed(!allCollapsed)}
                />
              }
            />
          )}

          <SettingRow
            title="Ambient background orbs"
            description="Soft glows that drift in the background"
            control={
              <CardToggle checked={orbsEnabled} onChange={() => setOrbsEnabled(!orbsEnabled)} />
            }
          />

          {isAccountPage && (
            <SettingRow
              title="AI category suggestions"
              description="Suggest categories for unrecognized merchants on import"
              control={
                <CardToggle
                  checked={aiSuggestionsEnabled}
                  onChange={() => {
                    const next = !aiSuggestionsEnabled;
                    setAiSuggestionsEnabledState(next);
                    setAiSuggestionsEnabled(next);
                  }}
                />
              }
            />
          )}

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
                <div className="fade-up" style={{ marginTop: "24px" }}>
                  <button
                    type="button"
                    onClick={resetToDefaults}
                    className="reset-button"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "7px",
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "8px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <RotateCcw className="reset-button-icon" size={13} aria-hidden />
                    Reset to defaults
                  </button>
                </div>
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
