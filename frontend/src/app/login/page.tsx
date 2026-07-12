"use client";
import { useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { Check } from "lucide-react";

// Resting geometry of the showcase glow, mirrored from its inline style below.
const GLOW_REST_CENTER_FROM_RIGHT = 100; // px from the panel's right edge
const GLOW_REST_CENTER_FROM_TOP = 80; // px from the panel's top edge
const GLOW_INFLUENCE_RADIUS = 340; // cursor distance at which repulsion kicks in
const GLOW_PUSH_ACCEL = 1.6; // how hard the cursor shoves the glow each frame
const GLOW_FRICTION = 0.92; // velocity retained each frame — higher = more coasting
const GLOW_EDGE_MARGIN = 20; // keep the glow's center at least this far inside the panel
const GLOW_BOUNCE = 0.6; // velocity kept after bouncing off an edge (0 = dead stop, 1 = perfect)

const VALUE_PROPS = [
  { title: "Net worth at a glance", body: "Assets, debt, and the trend in one clear number." },
  {
    title: "Budgets you can trust",
    body: "Category spending tracked against your limits in real time.",
  },
  {
    title: "Every account, unified",
    body: "Chequing, savings, TFSA, RRSP, FHSA, and credit — together.",
  },
];

const ACCOUNT_TAGS = ["Chequing", "Savings", "TFSA", "RRSP", "FHSA", "Credit"];

/** Bloom logomark; `size` controls the square badge dimension. */
function BloomMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill="#f59e0b" />
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
  const glowRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const cursorRef = useRef({ x: 0, y: 0, active: false });

  /** Records the cursor position within the panel so the physics loop can repel the glow. */
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

  /** Stops repelling when the cursor leaves; the glow keeps its momentum and coasts to a stop. */
  function handlePanelMouseLeave() {
    cursorRef.current.active = false;
  }

  /** Physics loop for the glow: cursor repulsion + momentum (friction). It rests wherever it stops. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = requestAnimationFrame(function step() {
      const panel = panelRef.current;
      const glow = glowRef.current;
      if (panel && glow) {
        const rect = panel.getBoundingClientRect();
        const offset = offsetRef.current;
        const velocity = velocityRef.current;

        // Repel the glow's current center away from the cursor.
        const cursor = cursorRef.current;
        if (cursor.active) {
          const dx = rect.width - GLOW_REST_CENTER_FROM_RIGHT + offset.x - cursor.x;
          const dy = GLOW_REST_CENTER_FROM_TOP + offset.y - cursor.y;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance < GLOW_INFLUENCE_RADIUS) {
            const push = (1 - distance / GLOW_INFLUENCE_RADIUS) * GLOW_PUSH_ACCEL;
            velocity.x += (dx / distance) * push;
            velocity.y += (dy / distance) * push;
          }
        }

        // Friction only — the glow coasts to a stop and stays where you leave it.
        velocity.x *= GLOW_FRICTION;
        velocity.y *= GLOW_FRICTION;

        offset.x += velocity.x;
        offset.y += velocity.y;

        // Bounce off the panel edges so the glow roams the whole panel but never leaves it.
        // Offsets are measured from the rest center, so convert the panel bounds into offset bounds.
        const restX = rect.width - GLOW_REST_CENTER_FROM_RIGHT;
        const restY = GLOW_REST_CENTER_FROM_TOP;
        const minOffsetX = GLOW_EDGE_MARGIN - restX;
        const maxOffsetX = rect.width - GLOW_EDGE_MARGIN - restX;
        const minOffsetY = GLOW_EDGE_MARGIN - restY;
        const maxOffsetY = rect.height - GLOW_EDGE_MARGIN - restY;

        if (offset.x < minOffsetX) {
          offset.x = minOffsetX;
          velocity.x = Math.abs(velocity.x) * GLOW_BOUNCE;
        } else if (offset.x > maxOffsetX) {
          offset.x = maxOffsetX;
          velocity.x = -Math.abs(velocity.x) * GLOW_BOUNCE;
        }
        if (offset.y < minOffsetY) {
          offset.y = minOffsetY;
          velocity.y = Math.abs(velocity.y) * GLOW_BOUNCE;
        } else if (offset.y > maxOffsetY) {
          offset.y = maxOffsetY;
          velocity.y = -Math.abs(velocity.y) * GLOW_BOUNCE;
        }

        glow.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
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
        {/* Outer wrapper is driven by the physics loop (transform); inner handles the entrance scale. */}
        <div
          ref={glowRef}
          aria-hidden
          style={{
            position: "absolute",
            top: "-140px",
            right: "-120px",
            width: "440px",
            height: "440px",
            pointerEvents: "none",
            willChange: "transform",
          }}
        >
          <div
            className="login-glow"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(245,158,11,0.16), transparent 70%)",
            }}
          />
        </div>

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
            A personal banking dashboard that surfaces the signal — net worth, budgets, and cash
            flow — and gets out of the way.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {VALUE_PROPS.map((prop, index) => (
              <div
                key={prop.title}
                className="fade-up"
                style={{
                  display: "flex",
                  gap: "12px",
                  animationDelay: `${0.24 + index * 0.08}s`,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "22px",
                    height: "22px",
                    borderRadius: "999px",
                    background: "#f59e0b1f",
                    border: "1px solid #f59e0b44",
                    color: "#f59e0b",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  <Check size={13} strokeWidth={2.5} />
                </span>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 600, marginBottom: "2px" }}>
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
          Sharp · Minimal · Focused
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
              className="press"
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
              marginTop: "16px",
              lineHeight: 1.5,
              animationDelay: "0.33s",
            }}
          >
            Secure sign-in with Google. New here? Signing in creates your account automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
