type Props = {
  exploredCount: number;
  totalCount: number;
  nextCardTitle: string | null;
};

/** Progress bar shown at the top of the Learn page tracking how many topics have been expanded. */
export function LearnProgressBar({ exploredCount, totalCount, nextCardTitle }: Props) {
  if (exploredCount === 0) return null;

  const isComplete = exploredCount === totalCount;
  const percentage = Math.round((exploredCount / totalCount) * 100);

  return (
    <div
      style={{
        marginBottom: "28px",
        padding: "14px 18px",
        background: isComplete ? "#22c55e0d" : "var(--surface-1)",
        border: `1px solid ${isComplete ? "#22c55e33" : "var(--border)"}`,
        borderRadius: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "10px",
          gap: "12px",
        }}
      >
        <p style={{ fontSize: "13px", fontWeight: 600, margin: 0 }}>
          {isComplete
            ? "You've completed the Bloom Finance Course!"
            : `You've explored ${exploredCount} of ${totalCount} topics.${nextCardTitle ? ` Next up: ${nextCardTitle}` : ""}`}
        </p>
        <span
          className="num"
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: isComplete ? "#22c55e" : "var(--text-secondary)",
            flexShrink: 0,
          }}
        >
          {percentage}%
        </span>
      </div>

      <div
        style={{
          height: "4px",
          background: "var(--surface-2)",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            background: isComplete ? "#22c55e" : "#3b82f6",
            borderRadius: "999px",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {isComplete && (
        <p style={{ fontSize: "12px", color: "#22c55e", marginTop: "10px", marginBottom: 0 }}>
          Ask Bloom anything about what you learned — the AI chat is below.
        </p>
      )}
    </div>
  );
}
