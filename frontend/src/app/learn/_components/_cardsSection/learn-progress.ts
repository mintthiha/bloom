const STORAGE_KEY = "bloom_learn_explored";

/** Reads the set of explored card indices from localStorage. */
export function getExploredCardIndices(): Set<number> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed as number[]);
  } catch {
    return new Set();
  }
}

/** Persists a newly explored card index, merging with any already stored. */
export function markCardExplored(index: number): void {
  try {
    const current = getExploredCardIndices();
    current.add(index);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current]));
  } catch {
    // localStorage unavailable — progress simply won't persist
  }
}
