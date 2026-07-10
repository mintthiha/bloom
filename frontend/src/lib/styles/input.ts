import type { CSSProperties } from "react";

/** Shared base style for form text inputs across the app. */
export const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "14px",
  color: "var(--text-primary)",
  fontFamily: "inherit",
};
