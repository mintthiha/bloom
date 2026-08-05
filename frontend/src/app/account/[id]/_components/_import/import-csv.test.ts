import { describe, it, expect } from "vitest";
import {
  extractMerchant,
  lookupMerchantCategory,
  applyCategorizationRules,
  resolveApiType,
  splitCsvLine,
  parseCsvText,
  type CsvRow,
} from "./import-csv";

describe("extractMerchant", () => {
  it("returns undefined for credit-card payment descriptions", () => {
    expect(extractMerchant("PAYMENT - THANK YOU")).toBeUndefined();
    expect(extractMerchant("PAIEMENT MERCI")).toBeUndefined();
    expect(extractMerchant("REMBOURSEMENT")).toBeUndefined();
  });

  it("matches a known merchant from the dictionary regardless of surrounding text", () => {
    expect(extractMerchant("STARBUCKS #4021 MONTREAL QC")).toBe("Starbucks");
    expect(extractMerchant("AMZN Mktp CA*1A2B3")).toBe("Amazon");
  });

  it("falls back to leading words, stopping at a numeric token", () => {
    expect(extractMerchant("SOME SHOP 12345 QC")).toBe("Some Shop");
  });

  it("stops the heuristic at a known city word", () => {
    expect(extractMerchant("LOCAL CAFE MONTREAL")).toBe("Local Cafe");
  });

  it("stops at a long alphanumeric code containing a digit", () => {
    expect(extractMerchant("SHOP AB12345678 X")).toBe("Shop");
  });

  it("caps the heuristic at three words", () => {
    expect(extractMerchant("ONE TWO THREE FOUR FIVE")).toBe("One Two Three");
  });

  it("returns undefined when nothing meaningful remains", () => {
    expect(extractMerchant("999 000")).toBeUndefined();
  });
});

describe("lookupMerchantCategory", () => {
  it("maps a known merchant to its category", () => {
    expect(lookupMerchantCategory("Loblaws")).toBe("Groceries");
    expect(lookupMerchantCategory("Netflix")).toBe("Entertainment");
    expect(lookupMerchantCategory("Petro-Canada")).toBe("Transport");
  });

  it("returns undefined for an unknown merchant", () => {
    expect(lookupMerchantCategory("Some Local Shop")).toBeUndefined();
  });
});

describe("applyCategorizationRules", () => {
  const rows: CsvRow[] = [
    {
      date: "2026-01-01",
      type: "withdrawal",
      amount: "10",
      merchant: "Loblaws",
      category: "Groceries",
    },
    { date: "2026-01-02", type: "withdrawal", amount: "20", merchant: "Rando" },
    { date: "2026-01-03", type: "deposit", amount: "30" },
  ];

  it("returns the original array when no rules are supplied", () => {
    expect(applyCategorizationRules(rows, {})).toBe(rows);
  });

  it("overrides the category when the merchant matches a rule (case-insensitive)", () => {
    const result = applyCategorizationRules(rows, { loblaws: "Food" });
    expect(result[0].category).toBe("Food");
  });

  it("leaves rows whose merchant has no rule, or no merchant at all, unchanged", () => {
    const result = applyCategorizationRules(rows, { loblaws: "Food" });
    expect(result[1].category).toBeUndefined();
    expect(result[2]).toEqual(rows[2]);
  });
});

describe("resolveApiType", () => {
  it("maps inflow types to DEPOSIT", () => {
    for (const t of ["deposit", "credit", "charge", "DEPOSIT", "Charge"]) {
      expect(resolveApiType(t)).toBe("DEPOSIT");
    }
  });

  it("maps everything else to WITHDRAWAL", () => {
    for (const t of ["withdrawal", "payment", "debit", "anything"]) {
      expect(resolveApiType(t)).toBe("WITHDRAWAL");
    }
  });
});

describe("splitCsvLine", () => {
  it("splits a simple comma-separated line", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("keeps commas that fall inside quotes", () => {
    expect(splitCsvLine('"a,b",c')).toEqual(["a,b", "c"]);
  });

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(splitCsvLine('"a""b",c')).toEqual(['a"b', "c"]);
  });

  it("emits a trailing empty field", () => {
    expect(splitCsvLine("a,")).toEqual(["a", ""]);
  });
});

describe("parseCsvText — standard Bloom format", () => {
  it("returns an empty array when there is no data row", () => {
    expect(parseCsvText("date,type,amount")).toEqual([]);
  });

  it("parses a valid row and infers category from a known merchant", () => {
    const csv =
      "date,type,amount,description,merchant,category\n2026-01-18,withdrawal,85.50,Weekly groceries,Loblaws,";
    const [row] = parseCsvText(csv);
    expect(row).toMatchObject({
      date: "2026-01-18",
      type: "withdrawal",
      amount: "85.50",
      merchant: "Loblaws",
      category: "Groceries",
    });
    expect(row.error).toBeUndefined();
  });

  it("flags an unknown transaction type", () => {
    const [row] = parseCsvText("date,type,amount\n2026-01-01,teleport,10");
    expect(row.error).toBe('Unknown type "teleport"');
  });

  it("flags an invalid date", () => {
    const [row] = parseCsvText("date,type,amount\nnotadate,deposit,10");
    expect(row.error).toBe('Invalid date "notadate"');
  });

  it("flags a non-positive or non-numeric amount", () => {
    expect(parseCsvText("date,type,amount\n2026-01-01,deposit,0")[0].error).toBe(
      'Invalid amount "0"'
    );
    expect(parseCsvText("date,type,amount\n2026-01-01,deposit,abc")[0].error).toBe(
      'Invalid amount "abc"'
    );
  });

  it("treats credit/charge as deposit and payment/debit as withdrawal for validation", () => {
    expect(parseCsvText("date,type,amount\n2026-01-01,credit,10")[0].error).toBeUndefined();
    expect(parseCsvText("date,type,amount\n2026-01-01,payment,10")[0].error).toBeUndefined();
  });
});

describe("parseCsvText — RBC exports", () => {
  const rbcHeader = "Account Type,Transaction Date,Cheque Number,CAD$,Description 1,Description 2";

  it("parses a chequing export: positive is a deposit, negative a withdrawal", () => {
    const csv = `${rbcHeader}\nChequing,1/15/2026,,1500.00,PAYROLL DEP,\nChequing,1/18/2026,,-85.50,LOBLAWS,STORE 123`;
    const rows = parseCsvText(csv);
    expect(rows[0]).toMatchObject({ date: "2026-01-15", type: "deposit", amount: "1500.00" });
    expect(rows[1]).toMatchObject({
      date: "2026-01-18",
      type: "withdrawal",
      amount: "85.50",
      merchant: "Loblaws",
    });
  });

  it("parses a credit-card export: negative is a charge, positive a payment", () => {
    const csv = `${rbcHeader}\nVisa,1/20/2026,,-42.00,TIM HORTONS,\nVisa,1/25/2026,,100.00,PAYMENT THANK YOU,`;
    const rows = parseCsvText(csv);
    expect(rows[0]).toMatchObject({ type: "charge", amount: "42.00", merchant: "Tim Hortons" });
    expect(rows[1]).toMatchObject({ type: "payment", amount: "100.00" });
    expect(rows[1].merchant).toBeUndefined();
  });

  it("flags an invalid RBC amount", () => {
    const csv = `${rbcHeader}\nChequing,1/15/2026,,,EMPTY AMOUNT,`;
    expect(parseCsvText(csv)[0].error).toContain("Invalid amount");
  });
});
