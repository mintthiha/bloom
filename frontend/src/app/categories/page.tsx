"use client";
import { Tag } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useIsMobile } from "@/hooks/use-mobile";
import { CategoryManagerCard } from "./_components/_categoryList/CategoryManagerCard";

/** Page for managing the user's custom category list: names, colours, and icons. */
export default function CategoriesPage() {
  const { expenseCategories, incomeCategories, isLoading, refresh } = useCategories();
  const isMobile = useIsMobile();

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 24px" }}>
      <div className="fade-up" style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <Tag size={22} color="#f59e0b" strokeWidth={2} />
          <h1 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.5px" }}>Categories</h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
          The names, colours, and icons Bloom offers everywhere you pick a category — transactions,
          budgets, and auto-categorize rules.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        <div className="fade-up fade-up-2">
          <CategoryManagerCard
            eyebrow="Expenses"
            title="Expense categories"
            description="Shown when logging a withdrawal or expense-side transaction."
            type="EXPENSE"
            categories={expenseCategories}
            isLoading={isLoading}
            onChanged={refresh}
          />
        </div>
        <div className="fade-up fade-up-3">
          <CategoryManagerCard
            eyebrow="Income"
            title="Income categories"
            description="Shown when logging a deposit or income-side transaction."
            type="INCOME"
            categories={incomeCategories}
            isLoading={isLoading}
            onChanged={refresh}
          />
        </div>
      </div>
    </div>
  );
}
