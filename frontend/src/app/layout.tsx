import type { Metadata } from "next";
import Link from "next/link";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bloom",
  description: "Simple, modern banking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header style={{
            borderBottom: '1px solid var(--border)',
            padding: '0 24px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            background: 'rgba(8,8,8,0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 100,
          }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit' }}>
              {/* Logo mark */}
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="6" fill="#f59e0b"/>
                <path d="M8 20V8h5.5a4 4 0 0 1 0 8H8" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 16h7a4 4 0 0 1 0 8H8" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.3px' }}>Bloom</span>
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e' }} />
              <span className="num" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>All systems operational</span>
            </div>
          </header>
          <Toaster position="bottom-center" theme="dark" />
          <main style={{ flex: 1 }}>{children}</main>
          <footer style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>© 2026 Bloom Financial Inc.</span>
            <span className="num" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>v2.0.0</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
