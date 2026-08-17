"use client";
import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Check } from "lucide-react";

const GLOW_INFLUENCE_RADIUS = 200; // cursor distance at which repulsion kicks in — smaller = get closer first
const GLOW_PUSH_ACCEL = 2.4; // peak shove strength when the cursor is right next to a glow
const GLOW_FRICTION = 0.965; // velocity retained each frame — higher = coasts/decelerates more gradually
const GLOW_MAX_SPEED = 30; // cap so a close cursor can't fling one uncontrollably fast
const GLOW_AMBIENT_SPEED = 0.4; // baseline drift speed — orbs float forever and never fully stop
const GLOW_AMBIENT_JITTER = 0.03; // tiny random nudge each frame so the drift wanders organically
const GLOW_EDGE_MARGIN = 20; // keep each glow's center at least this far inside the panel
const GLOW_BOUNCE = 0.6; // energy kept after bouncing off an edge or another orb (0 = dead stop, 1 = perfect)

type Orb = {
  size: number; // rendered diameter in px
  radius: number; // collision radius (roughly the visible core)
  background: string; // radial-gradient fill
  entranceDelay: string; // stagger for the scale-in animation
  anchor: React.CSSProperties; // CSS resting position, so the first paint is correct with no JS (avoids a flash)
  rest: (rect: DOMRect) => { x: number; y: number }; // resting center within the panel — must match `anchor`
};

/** The two floating showcase orbs. Both are repelled by the cursor and bounce off each other and the edges. */
const ORBS: Orb[] = [
  {
    size: 440,
    radius: 130,
    background: "radial-gradient(circle, rgba(59,130,246,0.16), transparent 70%)",
    entranceDelay: "0s",
    anchor: { top: "-140px", right: "-120px" },
    rest: (rect) => ({ x: rect.width - 100, y: 80 }),
  },
  {
    size: 300,
    radius: 92,
    background: "radial-gradient(circle, rgba(251,191,36,0.13), transparent 70%)",
    entranceDelay: "0.18s",
    anchor: { bottom: "-30px", left: "-20px" },
    rest: (rect) => ({ x: 130, y: rect.height - 120 }),
  },
];

const VALUE_PROPS = [
  { title: "Net worth at a glance", body: "Assets, debt, and the trend in one clear number." },
  {
    title: "Budgets you can trust",
    body: "Category spending tracked against your limits in real time.",
  },
  {
    title: "Every account, unified",
    body: "Chequing, savings, TFSA, RRSP, FHSA, and credit, side by side.",
  },
];

const ACCOUNT_TAGS = ["Chequing", "Savings", "TFSA", "RRSP", "FHSA", "Credit"];

/** Bloom logomark; `size` controls the square badge dimension. */
function BloomMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill="#3b82f6" />
      <path
        d="M8 20V8h5.5a4 4 0 0 1 0 8H8"
        stroke="#000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 16h7a4 4 0 0 1 0 8H8"
        stroke="#000"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Full Google "G" mark used on the sign-in button. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const panelRef = useRef<HTMLDivElement>(null);
  const orbElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const orbStateRef = useRef(
    ORBS.map(() => ({ offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } }))
  );
  const cursorRef = useRef({ x: 0, y: 0, active: false });
  // Orbs stay invisible until the physics effect places them at their random spawn, so no flash.
  const [started, setStarted] = useState(false);

  const [credentialEmail, setCredentialEmail] = useState("");
  const [credentialPassword, setCredentialPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [isCredentialSubmitting, setIsCredentialSubmitting] = useState(false);
  const [isSavedSigningIn, setIsSavedSigningIn] = useState(false);
  const [savedAccount, setSavedAccount] = useState<{ token: string; email: string } | null>(null);

  /** Reads any saved account from localStorage on mount. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("bloom_saved_account");
      if (raw) setSavedAccount(JSON.parse(raw));
    } catch {
      localStorage.removeItem("bloom_saved_account");
    }
  }, []);

  /** Signs in using the saved remember-me token without requiring a password. */
  async function handleSavedSignIn() {
    if (!savedAccount) return;
    setCredentialError(null);
    setIsSavedSigningIn(true);
    try {
      const result = await signIn("credentials", {
        rememberToken: savedAccount.token,
        callbackUrl: "/",
        redirect: false,
      });
      if (result?.error) {
        localStorage.removeItem("bloom_saved_account");
        setSavedAccount(null);
        setCredentialError("Your saved sign-in has expired. Please sign in again.");
      } else if (result?.url) {
        window.location.href = result.url;
      }
    } catch {
      setCredentialError("Something went wrong. Please try again.");
    } finally {
      setIsSavedSigningIn(false);
    }
  }

  /** Clears the saved account and revokes the token server-side. */
  async function handleForgetSavedAccount() {
    if (!savedAccount) return;
    const token = savedAccount.token;
    localStorage.removeItem("bloom_saved_account");
    setSavedAccount(null);
    fetch("/api/remember-revoke", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }

  /** Signs in with email and password, issuing a remember-me token when the checkbox is checked. */
  async function handleCredentialSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCredentialError(null);
    setIsCredentialSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: credentialEmail,
        password: credentialPassword,
        callbackUrl: "/",
        redirect: false,
      });
      if (result?.error) {
        setCredentialError("Invalid email or password. Please try again.");
        return;
      }
      if (rememberMe) {
        const res = await fetch("/api/remember-issue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: credentialEmail, password: credentialPassword }),
        });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem(
            "bloom_saved_account",
            JSON.stringify({ token: data.token, email: credentialEmail })
          );
        }
      }
      if (result?.url) window.location.href = result.url;
    } catch {
      setCredentialError("Something went wrong. Please try again.");
    } finally {
      setIsCredentialSubmitting(false);
    }
  }

  /** Records the cursor position within the panel so the physics loop can repel the orbs. */
  function handlePanelMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    cursorRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      active: true,
    };
  }

  /** Stops repelling when the cursor leaves; orbs keep their momentum and coast to a stop. */
  function handlePanelMouseLeave() {
    cursorRef.current.active = false;
  }

  /** Physics loop: cursor repulsion + momentum, orb-vs-orb elastic collisions, and edge bounce. */
  useEffect(() => {
    const states = orbStateRef.current;

    /** Writes each orb's transform from its offset only; the CSS `anchor` already positions it at rest. */
    function render() {
      states.forEach((state, i) => {
        const el = orbElsRef.current[i];
        if (el) el.style.transform = `translate(${state.offset.x}px, ${state.offset.y}px)`;
      });
    }

    // Spawn each orb at a random spot within the panel, drifting in a random direction.
    const initialPanel = panelRef.current;
    if (initialPanel) {
      const rect = initialPanel.getBoundingClientRect();
      ORBS.forEach((orb, i) => {
        const rest = orb.rest(rect);
        const spawnX = GLOW_EDGE_MARGIN + Math.random() * (rect.width - 2 * GLOW_EDGE_MARGIN);
        const spawnY = GLOW_EDGE_MARGIN + Math.random() * (rect.height - 2 * GLOW_EDGE_MARGIN);
        states[i].offset.x = spawnX - rest.x;
        states[i].offset.y = spawnY - rest.y;
        const angle = Math.random() * Math.PI * 2;
        states[i].velocity.x = Math.cos(angle) * GLOW_AMBIENT_SPEED;
        states[i].velocity.y = Math.sin(angle) * GLOW_AMBIENT_SPEED;
      });
      render();
    }

    // Reveal now that the orbs are positioned — this is what prevents the first-paint flash.
    setStarted(true);

    // Under reduced motion the orbs stay at their random spawn — no drift loop.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = requestAnimationFrame(function step() {
      const panel = panelRef.current;
      if (panel) {
        const rect = panel.getBoundingClientRect();
        const cursor = cursorRef.current;

        // 1. Per orb: cursor repulsion, friction, speed cap, then integrate position.
        ORBS.forEach((orb, i) => {
          const state = states[i];
          const rest = orb.rest(rect);
          const centerX = rest.x + state.offset.x;
          const centerY = rest.y + state.offset.y;

          if (cursor.active) {
            const dx = centerX - cursor.x;
            const dy = centerY - cursor.y;
            const distance = Math.hypot(dx, dy) || 1;
            if (distance < GLOW_INFLUENCE_RADIUS) {
              // Quadratic falloff: the closer the cursor, the sharply faster it accelerates away.
              const proximity = 1 - distance / GLOW_INFLUENCE_RADIUS;
              const push = proximity * proximity * GLOW_PUSH_ACCEL;
              state.velocity.x += (dx / distance) * push;
              state.velocity.y += (dy / distance) * push;
            }
          }

          // Gentle random wander so the drift never looks perfectly straight.
          state.velocity.x += (Math.random() - 0.5) * GLOW_AMBIENT_JITTER;
          state.velocity.y += (Math.random() - 0.5) * GLOW_AMBIENT_JITTER;

          state.velocity.x *= GLOW_FRICTION;
          state.velocity.y *= GLOW_FRICTION;

          // Keep speed within [ambient floor, max]: never fully stops, never flings.
          const speed = Math.hypot(state.velocity.x, state.velocity.y);
          if (speed > GLOW_MAX_SPEED) {
            state.velocity.x = (state.velocity.x / speed) * GLOW_MAX_SPEED;
            state.velocity.y = (state.velocity.y / speed) * GLOW_MAX_SPEED;
          } else if (speed < GLOW_AMBIENT_SPEED) {
            if (speed < 0.0001) {
              const angle = Math.random() * Math.PI * 2;
              state.velocity.x = Math.cos(angle) * GLOW_AMBIENT_SPEED;
              state.velocity.y = Math.sin(angle) * GLOW_AMBIENT_SPEED;
            } else {
              state.velocity.x = (state.velocity.x / speed) * GLOW_AMBIENT_SPEED;
              state.velocity.y = (state.velocity.y / speed) * GLOW_AMBIENT_SPEED;
            }
          }

          state.offset.x += state.velocity.x;
          state.offset.y += state.velocity.y;
        });

        // 2. Elastic collisions between every pair of orbs (equal mass).
        for (let i = 0; i < ORBS.length; i++) {
          for (let j = i + 1; j < ORBS.length; j++) {
            const a = states[i];
            const b = states[j];
            const restA = ORBS[i].rest(rect);
            const restB = ORBS[j].rest(rect);
            const ax = restA.x + a.offset.x;
            const ay = restA.y + a.offset.y;
            const bx = restB.x + b.offset.x;
            const by = restB.y + b.offset.y;

            const dx = bx - ax;
            const dy = by - ay;
            const distance = Math.hypot(dx, dy) || 0.0001;
            const minDistance = ORBS[i].radius + ORBS[j].radius;
            if (distance >= minDistance) continue;

            const nx = dx / distance;
            const ny = dy / distance;

            // Separate them so they no longer overlap (split evenly).
            const overlap = (minDistance - distance) / 2;
            a.offset.x -= nx * overlap;
            a.offset.y -= ny * overlap;
            b.offset.x += nx * overlap;
            b.offset.y += ny * overlap;

            // Exchange velocity along the collision normal (only if closing in).
            const velAlongNormal =
              (b.velocity.x - a.velocity.x) * nx + (b.velocity.y - a.velocity.y) * ny;
            if (velAlongNormal < 0) {
              const impulse = (-(1 + GLOW_BOUNCE) * velAlongNormal) / 2;
              a.velocity.x -= impulse * nx;
              a.velocity.y -= impulse * ny;
              b.velocity.x += impulse * nx;
              b.velocity.y += impulse * ny;
            }
          }
        }

        // 3. Bounce off the panel edges, then paint.
        ORBS.forEach((orb, i) => {
          const state = states[i];
          const rest = orb.rest(rect);
          const minOffsetX = GLOW_EDGE_MARGIN - rest.x;
          const maxOffsetX = rect.width - GLOW_EDGE_MARGIN - rest.x;
          const minOffsetY = GLOW_EDGE_MARGIN - rest.y;
          const maxOffsetY = rect.height - GLOW_EDGE_MARGIN - rest.y;

          if (state.offset.x < minOffsetX) {
            state.offset.x = minOffsetX;
            state.velocity.x = Math.abs(state.velocity.x) * GLOW_BOUNCE;
          } else if (state.offset.x > maxOffsetX) {
            state.offset.x = maxOffsetX;
            state.velocity.x = -Math.abs(state.velocity.x) * GLOW_BOUNCE;
          }
          if (state.offset.y < minOffsetY) {
            state.offset.y = minOffsetY;
            state.velocity.y = Math.abs(state.velocity.y) * GLOW_BOUNCE;
          } else if (state.offset.y > maxOffsetY) {
            state.offset.y = maxOffsetY;
            state.velocity.y = -Math.abs(state.velocity.y) * GLOW_BOUNCE;
          }
        });

        render();
      }
      frame = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className="grid h-screen overflow-hidden lg:grid-cols-2"
      style={{ background: "var(--surface-0)" }}
    >
      {/*
        Branded showcase panel — deliberately fixed-dark (not theme-aware) so the
        split reads intentionally in both light and dark mode. Hidden below lg.
      */}
      <div
        ref={panelRef}
        onMouseMove={handlePanelMouseMove}
        onMouseLeave={handlePanelMouseLeave}
        className="hidden lg:flex"
        style={{
          position: "relative",
          overflow: "hidden",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px",
          borderRight: "1px solid #1f1f1f",
          background: "linear-gradient(160deg, #17120a 0%, #080808 62%)",
          color: "#efefef",
        }}
      >
        {/* Each orb's outer wrapper is driven by the physics loop (transform); inner handles the entrance scale. */}
        {ORBS.map((orb, index) => (
          <div
            key={index}
            ref={(el) => {
              orbElsRef.current[index] = el;
            }}
            aria-hidden
            style={{
              position: "absolute",
              ...orb.anchor,
              width: `${orb.size}px`,
              height: `${orb.size}px`,
              pointerEvents: "none",
              willChange: "transform",
            }}
          >
            <div
              className={started ? "login-glow" : undefined}
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: orb.background,
                animationDelay: orb.entranceDelay,
                opacity: started ? undefined : 0,
              }}
            />
          </div>
        ))}

        <div
          className="fade-up"
          style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px" }}
        >
          <BloomMark size={28} />
          <span style={{ fontWeight: 800, fontSize: "20px", letterSpacing: "-0.4px" }}>Bloom</span>
        </div>

        <div style={{ position: "relative", maxWidth: "440px" }}>
          <h1
            className="fade-up"
            style={{
              fontSize: "34px",
              fontWeight: 800,
              lineHeight: 1.12,
              letterSpacing: "-0.6px",
              marginBottom: "16px",
              animationDelay: "0.08s",
            }}
          >
            Your whole financial life, in one calm view.
          </h1>
          <p
            className="fade-up"
            style={{
              fontSize: "15px",
              lineHeight: 1.55,
              color: "#9898aa",
              marginBottom: "32px",
              animationDelay: "0.16s",
            }}
          >
            A clear view of your net worth, budgets, and cash flow, all in one place.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {VALUE_PROPS.map((prop, index) => (
              <div
                key={prop.title}
                className="fade-up value-prop"
                style={{
                  display: "flex",
                  gap: "12px",
                  animationDelay: `${0.24 + index * 0.08}s`,
                }}
              >
                <span
                  aria-hidden
                  className="value-prop-icon"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "22px",
                    height: "22px",
                    borderRadius: "999px",
                    background: "#3b82f61f",
                    border: "1px solid #3b82f644",
                    color: "#3b82f6",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  <Check size={13} strokeWidth={2.5} />
                </span>
                <div className="value-prop-text">
                  <p
                    className="value-prop-title"
                    style={{ fontSize: "14px", fontWeight: 600, marginBottom: "2px" }}
                  >
                    {prop.title}
                  </p>
                  <p style={{ fontSize: "13px", color: "#888", lineHeight: 1.5 }}>{prop.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div
            className="fade-up"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "32px",
              animationDelay: "0.52s",
            }}
          >
            {ACCOUNT_TAGS.map((tag) => (
              <span
                key={tag}
                className="num"
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.03em",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "#111111",
                  border: "1px solid #1f1f1f",
                  color: "#888",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <p
          className="fade-up"
          style={{
            position: "relative",
            fontSize: "12px",
            color: "#6b6b80",
            animationDelay: "0.6s",
          }}
        >
          Know where you stand, every day.
        </p>
      </div>

      {/* Auth panel — theme-aware. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "360px" }}>
          {/* Logo shown here only when the showcase panel is hidden (small screens). */}
          <div
            className="lg:hidden fade-up"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "28px",
              animationDelay: "0.05s",
            }}
          >
            <BloomMark size={30} />
            <span style={{ fontWeight: 800, fontSize: "22px", letterSpacing: "-0.4px" }}>
              Bloom
            </span>
          </div>

          <h2
            className="fade-up"
            style={{
              fontSize: "24px",
              fontWeight: 800,
              letterSpacing: "-0.4px",
              marginBottom: "6px",
              animationDelay: "0.12s",
            }}
          >
            Welcome back
          </h2>
          <p
            className="fade-up"
            style={{
              fontSize: "14px",
              color: "var(--text-secondary)",
              marginBottom: "28px",
              animationDelay: "0.19s",
            }}
          >
            Sign in to access your accounts.
          </p>

          <div className="fade-up" style={{ animationDelay: "0.26s" }}>
            <button
              type="button"
              className="login-google-button"
              onClick={() => signIn("google", { callbackUrl: "/" })}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                padding: "12px 20px",
                background: "#fff",
                color: "#000",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <GoogleMark />
              Continue with Google
            </button>
          </div>

          <p
            className="fade-up"
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              marginTop: "12px",
              lineHeight: 1.5,
              animationDelay: "0.33s",
            }}
          >
            Secure sign-in with Google. New here? Signing in creates your account automatically.
          </p>

          {/* Saved account — shown when a remember-me token exists */}
          {savedAccount && (
            <div className="fade-up" style={{ marginTop: "16px", animationDelay: "0.33s" }}>
              <button
                type="button"
                disabled={isSavedSigningIn}
                onClick={handleSavedSignIn}
                className="press"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "12px 14px",
                  background: "var(--surface-1, var(--surface-0))",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: isSavedSigningIn ? "not-allowed" : "pointer",
                  opacity: isSavedSigningIn ? 0.7 : 1,
                  color: "inherit",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "#3b82f620",
                      border: "1px solid #3b82f640",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#3b82f6",
                      flexShrink: 0,
                    }}
                  >
                    {savedAccount.email[0].toUpperCase()}
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>
                      Continue as
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        fontWeight: 400,
                      }}
                    >
                      {savedAccount.email}
                    </span>
                  </span>
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: "18px", lineHeight: 1 }}>
                  →
                </span>
              </button>
              <button
                type="button"
                onClick={handleForgetSavedAccount}
                style={{
                  background: "none",
                  border: "none",
                  padding: "6px 2px",
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: "2px",
                }}
              >
                Not you?
              </button>
            </div>
          )}

          {/* Divider */}
          <div
            className="fade-up"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              margin: "20px 0",
              animationDelay: "0.38s",
            }}
          >
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
              or
            </span>
            <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
          </div>

          {/* Email/password form */}
          <form
            className="fade-up"
            onSubmit={handleCredentialSignIn}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              animationDelay: "0.43s",
            }}
          >
            <input
              type="email"
              autoComplete="email"
              required
              value={credentialEmail}
              onChange={(e) => setCredentialEmail(e.target.value)}
              placeholder="Email"
              className="login-input"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--surface-1, var(--surface-0))",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "14px",
                color: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <input
              type="password"
              autoComplete="current-password"
              required
              value={credentialPassword}
              onChange={(e) => setCredentialPassword(e.target.value)}
              placeholder="Password"
              className="login-input"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--surface-1, var(--surface-0))",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "14px",
                color: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                color: "var(--text-secondary)",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: "14px", height: "14px", accentColor: "#3b82f6", cursor: "pointer" }}
              />
              Remember me for 30 days
            </label>

            {credentialError && (
              <p
                style={{
                  fontSize: "13px",
                  color: "#f87171",
                  padding: "8px 12px",
                  background: "#f8717110",
                  border: "1px solid #f8717130",
                  borderRadius: "8px",
                }}
              >
                {credentialError}
              </p>
            )}
            <button
              type="submit"
              disabled={isCredentialSubmitting}
              className="press"
              style={{
                width: "100%",
                padding: "11px 20px",
                background: "var(--surface-0)",
                color: "inherit",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: isCredentialSubmitting ? "not-allowed" : "pointer",
                opacity: isCredentialSubmitting ? 0.7 : 1,
              }}
            >
              {isCredentialSubmitting ? "Signing in…" : "Sign in with email"}
            </button>
          </form>

          <p
            className="fade-up"
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              marginTop: "16px",
              textAlign: "center",
              animationDelay: "0.48s",
            }}
          >
            No account?{" "}
            <Link
              href="/register"
              style={{ color: "#3b82f6", fontWeight: 600, textDecoration: "none" }}
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
