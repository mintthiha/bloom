import { Skeleton } from "@/components/ui/skeleton";
import { CSSProperties } from "react";

const cardBase: CSSProperties = {
  background: "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  padding: "20px",
};

/** Skeleton for one learning topic card — icon badge, title, three summary lines, expand hint. */
function LearningCardSkeleton() {
  return (
    <div style={cardBase}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "12px",
        }}
      >
        <Skeleton style={{ width: "34px", height: "34px", borderRadius: "10px", flexShrink: 0 }} />
        <Skeleton style={{ height: "13px", width: "65%" }} />
      </div>
      <Skeleton style={{ height: "12px", width: "100%", marginBottom: "6px" }} />
      <Skeleton style={{ height: "12px", width: "88%", marginBottom: "6px" }} />
      <Skeleton style={{ height: "12px", width: "55%", marginBottom: "14px" }} />
      <Skeleton style={{ height: "11px", width: "30%" }} />
    </div>
  );
}

/** Skeleton for the six learning cards, matching single-view auto-fill or double-view single-column layout. */
function LearningCardsSkeleton({ isDouble }: { isDouble: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isDouble ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "16px",
        marginBottom: isDouble ? 0 : "56px",
      }}
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <LearningCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton for the Ask Bloom AI chat panel — header, message bubbles, input row. */
function ChatSkeleton() {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        borderRadius: "20px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header row */}
      <div
        style={{
          padding: "18px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <Skeleton style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0 }} />
        <Skeleton style={{ height: "14px", width: "100px" }} />
        <Skeleton style={{ height: "12px", width: "90px" }} />
      </div>

      {/* Message bubbles — two simulated exchanges to fill the area naturally */}
      <div
        style={{
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* User bubble (right-aligned) */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Skeleton style={{ height: "38px", width: "55%", borderRadius: "14px 14px 4px 14px" }} />
        </div>
        {/* Assistant bubble (left-aligned, two lines) */}
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <div style={{ width: "72%", display: "flex", flexDirection: "column", gap: "6px" }}>
            <Skeleton style={{ height: "14px", width: "100%", borderRadius: "4px" }} />
            <Skeleton style={{ height: "14px", width: "80%", borderRadius: "4px" }} />
            <Skeleton style={{ height: "14px", width: "60%", borderRadius: "4px" }} />
          </div>
        </div>
        {/* Second user bubble */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Skeleton style={{ height: "38px", width: "40%", borderRadius: "14px 14px 4px 14px" }} />
        </div>
        {/* Thinking indicator */}
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <Skeleton style={{ height: "38px", width: "30%", borderRadius: "14px 14px 14px 4px" }} />
        </div>
      </div>

      {/* Input row */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: "10px",
          alignItems: "flex-end",
        }}
      >
        <Skeleton style={{ flex: 1, height: "40px", borderRadius: "12px" }} />
        <Skeleton style={{ width: "38px", height: "38px", borderRadius: "10px", flexShrink: 0 }} />
      </div>
    </div>
  );
}

type LearnPageSkeletonProps = { isDouble: boolean };

/** Full-page content skeleton for the Learn page, matching both single and double column layouts. */
export function LearnPageSkeleton({ isDouble }: LearnPageSkeletonProps) {
  if (isDouble) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <LearningCardsSkeleton isDouble />
        </div>
        <div style={{ position: "sticky", top: "80px" }}>
          <ChatSkeleton />
        </div>
      </div>
    );
  }

  return (
    <>
      <LearningCardsSkeleton isDouble={false} />
      <ChatSkeleton />
    </>
  );
}
