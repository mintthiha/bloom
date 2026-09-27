"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { getAvatarInitials, getAvatarPalette } from "@/lib/initials-avatar";

type InitialsAvatarProps = {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  /** Handle or email used to derive initials and the colour when no name is saved yet. */
  fallbackLabel?: string | null;
  /** The colour the user picked on their profile; null falls back to a name-derived colour. */
  colorChoice?: string | null;
  /** Google profile picture, when the session has one. Falls back to initials if it fails to load. */
  imageUrl?: string | null;
  /** Rendered width/height in pixels. */
  size: number;
  /** Overrides the palette ring, e.g. to highlight the avatar while its menu is open. */
  borderColor?: string;
  /** Accessible label for the image; the initials themselves are hidden from assistive tech. */
  label: string;
};

/**
 * Circular identity avatar: the user's Google picture when available, otherwise their
 * initials on a colour deterministically derived from their name or handle.
 */
export function InitialsAvatar({
  firstName,
  lastName,
  fallbackLabel,
  colorChoice,
  imageUrl,
  size,
  borderColor,
  label,
}: InitialsAvatarProps) {
  const [hasImageFailed, setHasImageFailed] = useState(false);

  /** Lets a new picture retry loading after a previous URL failed. */
  useEffect(() => {
    setHasImageFailed(false);
  }, [imageUrl]);

  const initials = getAvatarInitials(firstName, lastName, fallbackLabel);
  const palette = getAvatarPalette(
    [firstName, lastName].filter(Boolean).join(" ") || (fallbackLabel ?? ""),
    colorChoice
  );

  if (imageUrl && !hasImageFailed) {
    return (
      <img
        src={imageUrl}
        alt={label}
        width={size}
        height={size}
        onError={() => setHasImageFailed(true)}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "999px",
          display: "block",
          objectFit: "cover",
          border: `1px solid ${borderColor ?? "var(--border)"}`,
        }}
      />
    );
  }

  return (
    <div
      aria-hidden={initials ? undefined : true}
      aria-label={initials ? label : undefined}
      role={initials ? "img" : undefined}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "999px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: palette.background,
        border: `1px solid ${borderColor ?? palette.border}`,
        color: palette.text,
        fontSize: `${Math.max(11, Math.round(size * 0.4))}px`,
        fontWeight: 700,
        letterSpacing: "0.5px",
        lineHeight: 1,
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {initials || <User size={Math.max(12, Math.round(size * 0.5))} />}
    </div>
  );
}
