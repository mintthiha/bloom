"use client";

/** Label + hint wrapper for a secondary control nested under a toggle row. */
export function SettingSubsection({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p style={{ fontSize: "13px", fontWeight: 600, marginBottom: "3px" }}>{label}</p>
      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "10px" }}>{hint}</p>
      {children}
    </div>
  );
}
