import { describe, expect, it } from "vitest";
import { parseReceiptText } from "./receipt-text-parser";

const TODAY = new Date(2026, 9, 11, 15, 0, 0);

/** Parses receipt text as if it were scanned on the fixed test day. */
function parse(receiptText: string) {
  return parseReceiptText(receiptText, TODAY);
}

const GROCERY_RECEIPT = `
WALMART SUPERCENTRE
123 MAIN ST, TORONTO ON
(416) 555-0199
GST# 12345 6789 RT0001
2026-10-09 14:32
BANANAS 062639312345 1.48 J
MILK 2% 4L 5.49
DISH SOAP 3.97 H
PAPER TOWEL 6PK 8.99 H
SUBTOTAL 19.93
HST 13% 1.68
TOTAL 21.61
VISA 21.61
CHANGE 0.00
`;

/** The text a real scan produced for a low-resolution Walmart receipt, misreads included. */
const SCANNED_WALMART_RECEIPT = `
Wal ks
almart ><
Save money. Live better.
(813) 932-0562
Manager COLLEEN BRICKEY
8885 N FLORIDA AVE
TAMPA FL 33604
ST# 5221 OP# 00001061 TE# 06 TR# 05332
BREAD 007225003712 F 2.88 N
BREAD 007226003712 F 2.88 N
GV PNT BUTTR 007874237003 F 3.84 N
GV PNT BUTTR 007874237003 F 3.84N
GV PNT BUTTR 007874237003 F 3.84 N
GV PNT BUTTR 007874237003 F 3.84 N
GV PARM 1602 007874201510 F 4.98 0
GV CHNK CHKN 007874206784 F 1.98 N
GV CHNK CHKN 007874206784 F 1.98 N
12 CT NITRIL 073191913822 2.78 X
FOLGERS 002550000377 F 10.48 N
SC TWIST UP 007874222682 F 0.84 X
EGGS 060638871459 F 1.88 0
SUBTOTAL 46.04
TAX 1 7.000 % 0.26
TOTAL 46.30
DEBIT TEND 46.30
CHANGE DUE 0.00
EFT DEBIT PAY FROM PRIMARY
ACCOUNT : 5269
46.30 TOTAL PURCHASE
PAYMENT DECLINED DEBIT NOT AVAILABLE
11/06/11 02:21:54
EFT DEBIT PAY FROM PRIMARY
ACCOUNT : 5259
46.30 TOTAL PURCHASE
REF # 131000195280
NETWORK ID. 0071 APPR CODE 297664
11/06/11 02:22:54
# ITEMS SOLD 13
TC# 0432 2121 1642 2401 9590
| EE VE 800 ER OE OO er Oo
`;

describe("parseReceiptText", () => {
  describe("a typical English grocery receipt", () => {
    const receipt = parse(GROCERY_RECEIPT);

    it("reads the store as the chain it belongs to", () => {
      expect(receipt.merchant).toBe("Walmart");
    });

    it("reads the purchase date", () => {
      expect(receipt.date).toBe("2026-10-09");
    });

    it("reads the total, not the subtotal or the payment line", () => {
      expect(receipt.total).toBe(21.61);
    });

    it("reads the tax", () => {
      expect(receipt.taxTotal).toBe(1.68);
    });

    it("reads each purchase, dropping product codes and tax flags from the names", () => {
      expect(receipt.lineItems).toEqual([
        { name: "BANANAS", amount: 1.48 },
        { name: "MILK 2% 4L", amount: 5.49 },
        { name: "DISH SOAP", amount: 3.97 },
        { name: "PAPER TOWEL 6PK", amount: 8.99 },
      ]);
    });

    it("finds no discounts", () => {
      expect(receipt.discountTotal).toBe(0);
    });
  });

  describe("a real scanned receipt with a logo and one-letter tax flags", () => {
    const receipt = parse(SCANNED_WALMART_RECEIPT);

    it("recognizes the chain behind a mangled logo", () => {
      expect(receipt.merchant).toBe("Walmart");
    });

    it("reads every purchase, including the ones whose tax flag scanned as a zero", () => {
      expect(receipt.lineItems).toEqual([
        { name: "BREAD", amount: 2.88 },
        { name: "BREAD", amount: 2.88 },
        { name: "GV PNT BUTTR", amount: 3.84 },
        { name: "GV PNT BUTTR", amount: 3.84 },
        { name: "GV PNT BUTTR", amount: 3.84 },
        { name: "GV PNT BUTTR", amount: 3.84 },
        { name: "GV PARM", amount: 4.98 },
        { name: "GV CHNK CHKN", amount: 1.98 },
        { name: "GV CHNK CHKN", amount: 1.98 },
        { name: "12 CT NITRIL", amount: 2.78 },
        { name: "FOLGERS", amount: 10.48 },
        { name: "SC TWIST UP", amount: 0.84 },
        { name: "EGGS", amount: 1.88 },
      ]);
    });

    it("reads a total and tax that the purchases add up to", () => {
      const itemsTotalInCents = receipt.lineItems.reduce(
        (runningCents, lineItem) => runningCents + Math.round(lineItem.amount * 100),
        0
      );
      expect(receipt.total).toBe(46.3);
      expect(receipt.taxTotal).toBe(0.26);
      expect(itemsTotalInCents + 26).toBe(4630);
    });

    it("reads the two-digit-year date as the latest day it could be", () => {
      expect(receipt.date).toBe("2011-11-06");
    });
  });

  describe("a French receipt", () => {
    const receipt = parse(`
Reçu de caisse
PHARMACIE DU VILLAGE
09 oct. 2026
SHAMPOOING 7,99 $
LAIT 2% 4,49 $
SOUS-TOTAL 12,48 $
TPS 5% 0,40 $
TVQ 9,975% 0,80 $
TOTAL 13,68 $
INTERAC 13,68 $
`);

    it("reads decimal-comma prices with a trailing dollar sign", () => {
      expect(receipt.lineItems).toEqual([
        { name: "SHAMPOOING", amount: 7.99 },
        { name: "LAIT 2%", amount: 4.49 },
      ]);
      expect(receipt.total).toBe(13.68);
    });

    it("adds up both sales taxes", () => {
      expect(receipt.taxTotal).toBe(1.2);
    });

    it("reads a French month name", () => {
      expect(receipt.date).toBe("2026-10-09");
    });

    it("skips the receipt heading when looking for the store name", () => {
      expect(receipt.merchant).toBe("PHARMACIE DU VILLAGE");
    });
  });

  describe("line items", () => {
    it("names a priced code-only line after the product line above it", () => {
      const receipt = parse(`ORGANIC BANANAS\n062639312345 1.99\nTOTAL 1.99`);
      expect(receipt.lineItems).toEqual([{ name: "ORGANIC BANANAS", amount: 1.99 }]);
    });

    it("names a priced weight line after the product line above it", () => {
      const receipt = parse(`BANANAS\n0.850 kg @ $1.74/kg 1.48\nTOTAL 1.48`);
      expect(receipt.lineItems).toEqual([{ name: "BANANAS", amount: 1.48 }]);
    });

    it("ignores a quantity note under an item that already carried the price", () => {
      const receipt = parse(`YOGURT 3.98\n2 @ 1.99\nBREAD 2.50\nTOTAL 6.48`);
      expect(receipt.lineItems).toEqual([
        { name: "YOGURT", amount: 3.98 },
        { name: "BREAD", amount: 2.5 },
      ]);
    });

    it("does not read a trailing weight as a price", () => {
      const receipt = parse(`BANANAS 0.85 KG\n@ 1.74/KG 1.48\nTOTAL 1.48`);
      expect(receipt.lineItems).toEqual([{ name: "BANANAS 0.85 KG", amount: 1.48 }]);
    });

    it("reads a price whose tax flag scanned as a lone zero", () => {
      const receipt = parse(`EGGS 1.88 0\nTOTAL 1.88`);
      expect(receipt.lineItems).toEqual([{ name: "EGGS", amount: 1.88 }]);
    });

    it("does not read a three-decimal quantity ending in zero as a price", () => {
      const receipt = parse(`REGULAR FUEL 45.230\nFUEL SALE 65.99\nTOTAL 65.99`);
      expect(receipt.lineItems).toEqual([{ name: "FUEL SALE", amount: 65.99 }]);
    });

    it("drops the one-letter flag printed after a product code", () => {
      const receipt = parse(`BREAD 007225003712 F 2.88 N\nTOTAL 2.88`);
      expect(receipt.lineItems).toEqual([{ name: "BREAD", amount: 2.88 }]);
    });

    it("keeps a one-letter word that is part of the product name", () => {
      const receipt = parse(`VITAMIN D 4.99\nGRADE A EGGS 060538871459 3.49\nTOTAL 8.48`);
      expect(receipt.lineItems).toEqual([
        { name: "VITAMIN D", amount: 4.99 },
        { name: "GRADE A EGGS", amount: 3.49 },
      ]);
    });

    it("keeps a priced line with no readable name as a generic item", () => {
      const receipt = parse(`4.99\nTOTAL 4.99`);
      expect(receipt.lineItems).toEqual([{ name: "Item", amount: 4.99 }]);
    });

    it("stops collecting items at the totals, so payment lines are never purchases", () => {
      const receipt = parse(`COFFEE 4.50\nTOTAL 4.50\nCASH 5.00\nCHANGE 0.50\nGIFT WRAP 2.00`);
      expect(receipt.lineItems).toEqual([{ name: "COFFEE", amount: 4.5 }]);
    });

    it("does not mistake a product with TOTAL in its name for the total", () => {
      const receipt = parse(`COLGATE TOTAL 4.99\nFLOSS 2.00\nTOTAL 6.99`);
      expect(receipt.lineItems).toEqual([
        { name: "COLGATE TOTAL", amount: 4.99 },
        { name: "FLOSS", amount: 2 },
      ]);
      expect(receipt.total).toBe(6.99);
    });

    it("skips loyalty and savings lines printed among the items", () => {
      const receipt = parse(`COFFEE 4.50\nYOU SAVED 1.00\nPOINTS EARNED 45.00\nTOTAL 4.50`);
      expect(receipt.lineItems).toEqual([{ name: "COFFEE", amount: 4.5 }]);
    });

    it("skips zero-priced lines", () => {
      const receipt = parse(`FREE SAMPLE 0.00\nCOFFEE 4.50\nTOTAL 4.50`);
      expect(receipt.lineItems).toEqual([{ name: "COFFEE", amount: 4.5 }]);
    });

    it("reads a comma thousands separator", () => {
      const receipt = parse(`LAPTOP 1,299.99\nTOTAL 1,299.99`);
      expect(receipt.lineItems).toEqual([{ name: "LAPTOP", amount: 1299.99 }]);
      expect(receipt.total).toBe(1299.99);
    });

    it("truncates a very long item name to 60 characters", () => {
      const receipt = parse(`${"A".repeat(80)} 1.00\nTOTAL 1.00`);
      expect(receipt.lineItems[0]!.name).toHaveLength(60);
    });
  });

  describe("discounts", () => {
    it("counts a negative amount before the totals as a discount, in either minus position", () => {
      const receipt = parse(`SHIRT 20.00\nMEMBER PRICE -2.00\nPROMO 1.50-\nTOTAL 16.50`);
      expect(receipt.lineItems).toEqual([{ name: "SHIRT", amount: 20 }]);
      expect(receipt.discountTotal).toBe(3.5);
    });

    it("counts a coupon line as a discount even without a minus sign", () => {
      const receipt = parse(`SHIRT 20.00\nCOUPON 5.00\nTOTAL 15.00`);
      expect(receipt.lineItems).toEqual([{ name: "SHIRT", amount: 20 }]);
      expect(receipt.discountTotal).toBe(5);
    });
  });

  describe("totals and tax", () => {
    it("returns a null total when no total line was read", () => {
      const receipt = parse(`COFFEE 4.50\nMUFFIN 3.00`);
      expect(receipt.total).toBeNull();
      expect(receipt.lineItems).toHaveLength(2);
    });

    it("reads a total whose amount wrapped onto the next line", () => {
      const receipt = parse(`COFFEE 4.50\nTOTAL\n$4.50\nVISA 4.50`);
      expect(receipt.total).toBe(4.5);
      expect(receipt.lineItems).toEqual([{ name: "COFFEE", amount: 4.5 }]);
    });

    it("takes the larger amount when the total is printed again after a tip", () => {
      const receipt = parse(`BURGER 20.00\nTOTAL 22.60\nTIP 4.00\nTOTAL 26.60`);
      expect(receipt.total).toBe(26.6);
    });

    it("reads TOTAL even when the scanner turned its letters into digits", () => {
      const receipt = parse(`COFFEE 4.50\nT0TA1 4.50`);
      expect(receipt.total).toBe(4.5);
    });

    it("recognizes other wordings of the total", () => {
      expect(parse(`COFFEE 4.50\nAMOUNT DUE 4.50`).total).toBe(4.5);
      expect(parse(`CAFÉ 4,50\nMONTANT À PAYER 4,50 $`).total).toBe(4.5);
    });

    it("ignores informational totals such as savings and item counts", () => {
      const receipt = parse(`COFFEE 4.50\nTOTAL 4.50\nTOTAL SAVINGS 12.00\nTOTAL ITEMS 1.00`);
      expect(receipt.total).toBe(4.5);
    });

    it("prefers a printed tax total over adding the individual taxes again", () => {
      const receipt = parse(`BOOK 20.00\nGST 1.00\nPST 1.40\nTOTAL TAX 2.40\nTOTAL 22.40`);
      expect(receipt.taxTotal).toBe(2.4);
      expect(receipt.total).toBe(22.4);
    });

    it("does not treat a tax registration header as the start of the totals", () => {
      const receipt = parse(`CORNER STORE\nHST# 12345 6789\nCOFFEE 4.50\nHST 0.59\nTOTAL 5.09`);
      expect(receipt.lineItems).toEqual([{ name: "COFFEE", amount: 4.5 }]);
      expect(receipt.taxTotal).toBe(0.59);
    });
  });

  describe("dates", () => {
    it.each([
      ["year-first with dashes", "2026-10-09", "2026-10-09"],
      ["year-first with slashes", "2026/10/09 14:32", "2026-10-09"],
      ["an English month name after the day", "9 Oct 2026", "2026-10-09"],
      ["an English month name before the day", "October 9, 2026", "2026-10-09"],
      ["a hyphenated month abbreviation with a two-digit year", "09-OCT-26", "2026-10-09"],
      ["a French month name", "9 août 2026", "2026-08-09"],
      ["an unambiguous day-first date", "25/09/2026", "2026-09-25"],
      ["an unambiguous month-first date", "09/25/2026", "2026-09-25"],
      ["a two-digit year-first date", "26/09/25", "2026-09-25"],
    ])("reads %s", (_description, printedDate, expectedDate) => {
      expect(parse(`STORE\n${printedDate}\nCOFFEE 4.50`).date).toBe(expectedDate);
    });

    it("reads an ambiguous date as the most recent day that is not in the future", () => {
      // Scanned on Oct 11: "10/11" as November 10 would be in the future, so it is October 11.
      expect(parse(`STORE\n10/11/2026`).date).toBe("2026-10-11");
      // Both readings are past: October 9 is more recent than September 10.
      expect(parse(`STORE\n09/10/2026`).date).toBe("2026-10-09");
    });

    it("accepts a receipt dated today", () => {
      expect(parse(`STORE\n2026-10-11`).date).toBe("2026-10-11");
    });

    it.each([
      ["a future date", "2026-10-12"],
      ["a day that does not exist", "2026-02-30"],
      ["a year before 2000", "1999-05-05"],
      ["no date at all", "COFFEE 4.50"],
    ])("returns a null date for %s", (_description, printedText) => {
      expect(parse(`STORE\n${printedText}`).date).toBeNull();
    });

    it("skips an implausible date and uses a later plausible one", () => {
      expect(parse(`STORE\nEXPIRES 2031-01-01\nDATE 2026-10-01`).date).toBe("2026-10-01");
    });
  });

  describe("merchant", () => {
    it("prefers a known chain over an earlier line that merely reads as words", () => {
      expect(parse(`Wal ks\nalmart ><\nBREAD 2.88`).merchant).toBe("Walmart");
    });

    it("keeps the printed name of a store that is not a known chain", () => {
      expect(parse(`JOE'S SUPERCENTRE\nCOFFEE 4.50`).merchant).toBe("JOE'S SUPERCENTRE");
    });

    it("skips numeric header lines to find the store name", () => {
      expect(parse(`#00123 4567\nCORNER STORE\nCOFFEE 4.50`).merchant).toBe("CORNER STORE");
    });

    it("returns null when the top of the receipt has no name-like line", () => {
      expect(parse(`4.50\n12345\n2026-10-09`).merchant).toBeNull();
    });

    it("does not use a priced line as the store name", () => {
      expect(parse(`COFFEE 4.50\nTOTAL 4.50`).merchant).toBeNull();
    });

    it("only looks at the first six lines", () => {
      const receipt = parse(`1\n2\n3\n4\n5\n6\nLATE STORE NAME`);
      expect(receipt.merchant).toBeNull();
    });
  });

  it("returns an empty receipt for blank text", () => {
    expect(parse("   \n\n")).toEqual({
      merchant: null,
      date: null,
      total: null,
      taxTotal: 0,
      discountTotal: 0,
      lineItems: [],
    });
  });
});
