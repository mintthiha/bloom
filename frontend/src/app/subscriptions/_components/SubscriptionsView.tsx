"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { api, type SubscriptionSummary } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { SubscriptionsHeader } from "./SubscriptionsHeader";
import { SubscriptionList } from "./SubscriptionList";

/** Loads the subscription summary and renders the headline insight plus the per-subscription list. */
export function SubscriptionsView() {
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  /** Fetches the auto-detected subscription summary for the user. */
  useEffect(() => {
    let cancelled = false;

    async function loadSubscriptions() {
      try {
        const data = await api.getSubscriptions();
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load subscriptions");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSubscriptions();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div className="skeleton" style={{ height: "180px", borderRadius: "14px" }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "16px",
          }}
        >
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="skeleton"
              style={{ height: "150px", borderRadius: "14px" }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!summary || summary.count === 0) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="No subscriptions detected yet"
        description="Once you have a few months of recurring merchant charges, Bloom will group them here and total your monthly cost."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <SubscriptionsHeader summary={summary} />
      <SubscriptionList subscriptions={summary.subscriptions} />
    </div>
  );
}
