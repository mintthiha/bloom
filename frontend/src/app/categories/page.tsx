"use client";
import { Tag } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { CategoryExplorer } from "./_components/_categoryExplorer/CategoryExplorer";

/** Page for managing the user's custom category list: names, colours, and icons. */
export default function CategoriesPage() {
  const { categories, isLoading, refresh } = useCategories();

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 24px" }}>
      <div className="fade-up" style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <Tag size={22} color="var(--brand-accent)" strokeWidth={2} />
          <h1 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.5px" }}>Categories</h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
          The names, colours, and icons Bloom offers everywhere you pick a category — transactions,
          budgets, and auto-categorize rules.
        </p>
      </div>

      <CategoryExplorer categories={categories} isLoading={isLoading} onChanged={refresh} />
    </div>
  );
}
