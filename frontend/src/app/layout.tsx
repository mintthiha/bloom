import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bloom",
  description: "Fictional banking demo — Pulse platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-[#1e1e1e] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-amber-500 rounded-sm flex items-center justify-center">
                <span className="text-black text-xs font-bold num">N</span>
              </div>
              <span className="font-bold tracking-wider text-sm uppercase">Bloom</span>
            </div>
            <span className="text-[#6b6b6b] text-xs num">DEMO ENVIRONMENT</span>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
