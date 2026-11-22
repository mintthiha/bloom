import { describe, expect, it } from "vitest";
import { buildLinkedAccountsUrl, LINKED_ITEM_QUERY_PARAM } from "./linked-accounts-url";

describe("buildLinkedAccountsUrl", () => {
  it("points at /accounts with the item id in the linked-item param", () => {
    expect(buildLinkedAccountsUrl("item-123")).toBe(
      `/accounts?${LINKED_ITEM_QUERY_PARAM}=item-123`
    );
  });

  it("encodes characters that are unsafe in a query string", () => {
    const url = buildLinkedAccountsUrl("item a&b=c");
    expect(new URL(url, "http://localhost").searchParams.get(LINKED_ITEM_QUERY_PARAM)).toBe(
      "item a&b=c"
    );
  });
});
