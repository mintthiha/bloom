"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { api, Account } from "@/lib/api";
import { ACCOUNT_COLOR_PALETTES, ACCOUNT_ICONS, AccountColor } from "@/lib/constants/account";
import { parseAccountColor } from "@/lib/account-identity";

type AccountAppearanceEditorProps = {
  accountId: string;
  color: string | null;
  icon: string | null;
  onUpdated: (account: Account) => void;
  onError: (message: string) => void;
};

/** Shared swatch sizing/shape for both the colour dots and the emoji buttons. */
const swatchButtonStyle = (isSelected: boolean) => ({
  width: "32px",
  height: "32px",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: isSelected ? "2px solid var(--brand-accent)" : "1px solid var(--border)",
  background: "var(--surface-2)",
  cursor: "pointer",
  padding: 0,
  fontSize: "15px",
});

/**
 * Lets a user pick a custom colour and emoji icon for an account, so accounts that share
 * a type (e.g. several chequing accounts) are still easy to tell apart at a glance.
 * Mirrors the save/cancel flow of {@link NicknameEditor}.
 */
export function AccountAppearanceEditor({
  accountId,
  color,
  icon,
  onUpdated,
  onError,
}: AccountAppearanceEditorProps) {
  const [selectedColor, setSelectedColor] = useState<AccountColor | null>(parseAccountColor(color));
  const [selectedIcon, setSelectedIcon] = useState<string | null>(icon);
  const [saving, setSaving] = useState(false);

  /** Saves the chosen colour/icon via the API and notifies the parent with the updated account. */
  async function handleSave(nextColor: AccountColor | null, nextIcon: string | null) {
    setSaving(true);
    try {
      const updated = await api.updateAccountAppearance(accountId, {
        color: nextColor,
        icon: nextIcon,
      });
      onUpdated(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save account appearance");
    } finally {
      setSaving(false);
    }
  }

  /** Picks a colour (or clears it back to the account type default when re-clicked) and saves immediately. */
  function handleColorSelect(value: AccountColor) {
    const next = selectedColor === value ? null : value;
    setSelectedColor(next);
    handleSave(next, selectedIcon);
  }

  /** Picks an emoji icon (or clears it when re-clicked) and saves immediately. */
  function handleIconSelect(value: string) {
    const next = selectedIcon === value ? null : value;
    setSelectedIcon(next);
    handleSave(selectedColor, next);
  }

  return (
    <div
      className="fade-up fade-up-2"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
        padding: "20px",
        marginBottom: "16px",
        opacity: saving ? 0.7 : 1,
      }}
    >
      <p
        style={{
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-secondary)",
          marginBottom: "6px",
        }}
      >
        Account Appearance
      </p>
      <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "14px" }}>
        Pick a colour and icon to tell this account apart from others of the same type.
      </p>

      <div style={{ marginBottom: "14px" }}>
        <div
          role="radiogroup"
          aria-label="Account colour"
          style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
        >
          {(Object.keys(ACCOUNT_COLOR_PALETTES) as AccountColor[]).map((option) => {
            const palette = ACCOUNT_COLOR_PALETTES[option];
            const isSelected = selectedColor === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={palette.label}
                title={palette.label}
                disabled={saving}
                className="avatar-swatch"
                onClick={() => handleColorSelect(option)}
                style={{
                  ...swatchButtonStyle(isSelected),
                  background: palette.soft,
                  borderColor: isSelected ? palette.color : palette.border,
                }}
              >
                {isSelected && <Check size={14} strokeWidth={3} color={palette.color} />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div
          role="radiogroup"
          aria-label="Account icon"
          style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
        >
          {ACCOUNT_ICONS.map((option) => {
            const isSelected = selectedIcon === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Icon ${option}`}
                disabled={saving}
                className="avatar-swatch"
                onClick={() => handleIconSelect(option)}
                style={swatchButtonStyle(isSelected)}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
