"use client";

import { GoalList } from "./_components/_goalList/GoalList";

export default function GoalsPage() {
  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 24px 48px",
      }}
    >
      <GoalList />
    </div>
  );
}
