import { describe, expect, it } from "vitest";
import { findKnownMerchant } from "./known-merchants";

describe("findKnownMerchant", () => {
  it("returns the proper spelling of a chain printed in capitals", () => {
    expect(findKnownMerchant(["WALMART SUPERCENTRE", "123 MAIN ST"])).toBe("Walmart");
  });

  it("recognizes a logo the scanner misread by one character", () => {
    expect(findKnownMerchant(["Wal ks", "almart ><", "Save money. Live better."])).toBe("Walmart");
  });

  it("joins a name the scanner split into two words", () => {
    expect(findKnownMerchant(["WAL MART"])).toBe("Walmart");
    expect(findKnownMerchant(["COST CO WHOLESALE"])).toBe("Costco");
  });

  it("matches names printed with accents, apostrophes, and hyphens", () => {
    expect(findKnownMerchant(["McDONALD'S RESTAURANT #4021"])).toBe("McDonald's");
    expect(findKnownMerchant(["PETRO-CANADA"])).toBe("Petro-Canada");
    expect(findKnownMerchant(["Pharmacie Jean Coutu"])).toBe("Jean Coutu");
    expect(findKnownMerchant(["COUCHE-TARD #1234"])).toBe("Couche-Tard");
  });

  it("allows two misread characters in a long name", () => {
    expect(findKnownMerchant(["SH0PPERS DRUG MAR7"])).toBe("Shoppers Drug Mart");
  });

  it("does not allow two misread characters in a mid-length name", () => {
    expect(findKnownMerchant(["WALNARY"])).toBeNull();
  });

  it("requires a short name to be read exactly, as a whole word", () => {
    expect(findKnownMerchant(["METRO PLUS"])).toBe("Metro");
    expect(findKnownMerchant(["METRA"])).toBeNull();
    expect(findKnownMerchant(["METROPOLITAN CAFE"])).toBeNull();
    expect(findKnownMerchant(["ORIGAMI SUSHI"])).toBeNull();
  });

  it("does not take a longer word for a chain it happens to start with", () => {
    expect(findKnownMerchant(["JOE'S SUPERCENTRE"])).toBeNull();
    expect(findKnownMerchant(["SUPER C"])).toBe("Super C");
  });

  it("prefers the more specific chain when two names fit", () => {
    expect(findKnownMerchant(["HOME HARDWARE BUILDING CENTRE"])).toBe("Home Hardware");
  });

  it("prefers an exact reading on a later line over a misread on an earlier one", () => {
    expect(findKnownMerchant(["WINNER OF BEST GROCER", "SOBEYS"])).toBe("Sobeys");
  });

  it("looks at every line it is given", () => {
    expect(findKnownMerchant(["WELCOME", "THANK YOU", "DOLLARAMA"])).toBe("Dollarama");
  });

  it("returns null when no known chain is printed", () => {
    expect(findKnownMerchant(["CORNER STORE", "(416) 555-0199"])).toBeNull();
    expect(findKnownMerchant([])).toBeNull();
    expect(findKnownMerchant(["", "   "])).toBeNull();
  });
});
