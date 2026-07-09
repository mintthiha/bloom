import type { CardProgram } from "./credit-rewards-math";

const STORAGE_KEY = "bloom-custom-reward-programs";

/** Loads persisted custom reward program templates from localStorage. */
export function loadCustomPrograms(): CardProgram[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CardProgram[]) : [];
  } catch {
    return [];
  }
}

/** Persists the full list of custom reward program templates to localStorage. */
export function saveCustomPrograms(programs: CardProgram[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(programs));
}

/** Generates a collision-resistant ID for a new custom program. */
export function generateCustomProgramId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Returns true if the given program ID belongs to a user-created template. */
export function isCustomProgram(id: string): boolean {
  return id.startsWith("custom-");
}
