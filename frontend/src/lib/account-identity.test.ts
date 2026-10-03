import { describe, expect, it } from "vitest";
import { Account } from "@/lib/api";
import { parseAccountColor, resolveAccountAppearance } from "@/lib/account-identity";

/** Builds a minimal account fixture, overriding only the fields a test cares about. */
function makeAccount(overrides?: Partial<Account>): Account {
  return {
    id: "a-1",
    ownerName: "Jane Doe",
    nickname: null,
    accountType: "CHEQUING",
    balance: 100,
    frozen: false,
    isLinked: false,
    plaidAccountId: null,
    plaidItemId: null,
    institutionName: null,
    color: null,
    icon: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseAccountColor", () => {
  it("returns null for unset or unrecognized values", () => {
    expect(parseAccountColor(null)).toBeNull();
    expect(parseAccountColor(undefined)).toBeNull();
    expect(parseAccountColor("ORANGE")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(parseAccountColor("blue")).toBe("BLUE");
  });
});

describe("resolveAccountAppearance", () => {
  it("falls back to the account type's palette and no icon when nothing is customized", () => {
    const appearance = resolveAccountAppearance(makeAccount({ accountType: "SAVINGS" }));
    expect(appearance.label).toBe("Savings");
    expect(appearance.color).toBe("#22c55e");
    expect(appearance.icon).toBeNull();
  });

  it("uses the custom colour when one is set", () => {
    const appearance = resolveAccountAppearance(makeAccount({ color: "VIOLET" }));
    expect(appearance.color).toBe("#a78bfa");
  });

  it("uses the type's default colour when the stored colour is unrecognized", () => {
    const appearance = resolveAccountAppearance(
      makeAccount({ accountType: "CREDIT", color: "ORANGE" })
    );
    expect(appearance.color).toBe("#ef4444");
  });

  it("surfaces the custom icon when one is set", () => {
    const appearance = resolveAccountAppearance(makeAccount({ icon: "🏦" }));
    expect(appearance.icon).toBe("🏦");
  });
});
