/**
 * Slow-drifting, heavily blurred colour fields behind the whole app. The colours derive from the
 * user's accent in CSS (`--extravagant-hue-*`), so the aurora follows whichever accent they picked.
 */
export function AuroraBackdrop() {
  return (
    <div aria-hidden className="extravagant-aurora">
      <div className="extravagant-aurora-blob extravagant-aurora-blob-1" />
      <div className="extravagant-aurora-blob extravagant-aurora-blob-2" />
      <div className="extravagant-aurora-blob extravagant-aurora-blob-3" />
      <div className="extravagant-aurora-blob extravagant-aurora-blob-4" />
    </div>
  );
}
