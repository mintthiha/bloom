"use client";

import type { Subscription } from "@/lib/api";
import { SubscriptionCard } from "./SubscriptionCard";

/** Renders the detected subscriptions in a responsive grid, ordered by monthly cost. */
export function SubscriptionList({ subscriptions }: { subscriptions: Subscription[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "16px",
      }}
    >
      {subscriptions.map((subscription) => (
        <SubscriptionCard key={subscription.merchant} subscription={subscription} />
      ))}
    </div>
  );
}
