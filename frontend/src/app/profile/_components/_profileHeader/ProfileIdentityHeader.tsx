"use client";

import { InitialsAvatar } from "@/components/InitialsAvatar";
import { useIsMobile } from "@/hooks/use-mobile";

type ProfileIdentityHeaderProps = {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
  /** Google profile picture from the session, when one exists. */
  imageUrl: string | null;
};

/**
 * Identity block at the top of the profile page: the initials (or Google) avatar beside the
 * user's saved name and handle, so the page opens with who you are rather than a bare title.
 */
export function ProfileIdentityHeader({
  firstName,
  lastName,
  username,
  email,
  imageUrl,
}: ProfileIdentityHeaderProps) {
  const isMobile = useIsMobile();
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Your profile";
  const displayHandle = username ? `@${username}` : (email ?? "");

  return (
    <div
      className="fade-up"
      style={{
        display: "flex",
        alignItems: "center",
        gap: isMobile ? "14px" : "18px",
        marginBottom: "28px",
      }}
    >
      <InitialsAvatar
        firstName={firstName}
        lastName={lastName}
        fallbackLabel={username ?? email}
        imageUrl={imageUrl}
        size={isMobile ? 56 : 72}
        label={displayName}
      />
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            fontSize: isMobile ? "24px" : "32px",
            fontWeight: 800,
            letterSpacing: "-0.5px",
            marginBottom: "4px",
            overflowWrap: "anywhere",
          }}
        >
          {displayName}
        </h1>
        {displayHandle && (
          <p
            className="num"
            style={{
              color: "var(--text-secondary)",
              fontSize: isMobile ? "13px" : "14px",
              overflowWrap: "anywhere",
            }}
          >
            {displayHandle}
          </p>
        )}
      </div>
    </div>
  );
}
