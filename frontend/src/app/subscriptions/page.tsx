"use client";

import { BackToHome } from "@/components/BackToHome";
import { SubscriptionsView } from "./_components/SubscriptionsView";

export default function SubscriptionsPage() {
  return (
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 24px 48px",
      }}
    >
      <BackToHome />
      <SubscriptionsView />
    </div>
  );
}
