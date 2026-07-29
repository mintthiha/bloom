"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, User } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { api } from "@/lib/api";

/**
 * Top-right header identity control: an avatar button that opens a dropdown with the
 * user's name/handle, a link to their profile, and sign out. Replaces the profile block
 * and sign-out action that previously lived in the sidebar footer.
 */
export function ProfileMenu() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /** Resets the image-error state when the avatar URL changes so a new source can retry loading. */
  useEffect(() => {
    setAvatarFailed(false);
  }, [session?.user?.image]);

  /**
   * Loads the current user's saved profile so the menu reflects Prisma data
   * instead of relying on the auth session name.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const profile = await api.getProfile();
        if (!cancelled) {
          setFirstName(profile?.firstName ?? null);
          setLastName(profile?.lastName ?? null);
          setUsername(profile?.username ?? null);
        }
      } catch {
        if (!cancelled) {
          setFirstName(null);
          setLastName(null);
          setUsername(null);
        }
      }
    }

    if (session?.user?.id) {
      loadProfile();
    } else {
      setUsername(null);
    }

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  /** Closes the menu when clicking outside it or pressing Escape. */
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!session?.user) return null;

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Your profile";
  const displayHandle = username ? `@${username}` : (session.user.email ?? "");
  const showAvatarImage = Boolean(session.user.image) && !avatarFailed;

  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Account menu"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          borderRadius: "999px",
        }}
      >
        {showAvatarImage ? (
          <img
            src={session.user.image ?? undefined}
            alt={displayName}
            width={32}
            height={32}
            onError={() => setAvatarFailed(true)}
            style={{
              borderRadius: "999px",
              display: "block",
              border: isOpen ? "1px solid #3b82f6" : "1px solid var(--border)",
            }}
          />
        ) : (
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#3b82f622",
              border: isOpen ? "1px solid #3b82f6" : "1px solid #3b82f644",
              color: "#3b82f6",
            }}
          >
            <User size={16} />
          </div>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "220px",
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 16px 40px rgba(0,0,0,0.4)",
            zIndex: 30,
          }}
        >
          <div
            style={{
              padding: "14px 14px 12px",
              borderBottom: "1px solid var(--border)",
              minWidth: 0,
            }}
          >
            <p
              style={{
                fontSize: "13px",
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </p>
            <p
              className="num"
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginTop: "2px",
              }}
            >
              {displayHandle}
            </p>
          </div>

          <div style={{ padding: "6px" }}>
            <Link
              href="/profile"
              role="menuitem"
              className="nav-item"
              onClick={() => setIsOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 10px",
                borderRadius: "8px",
                color: "var(--text-primary)",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <User size={15} style={{ flexShrink: 0 }} />
              Profile
            </Link>
            <button
              type="button"
              role="menuitem"
              className="nav-item"
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                textAlign: "left",
              }}
            >
              <LogOut size={15} style={{ flexShrink: 0 }} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
