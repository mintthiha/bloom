export type CsvRow = {
  date: string;
  type: string;
  amount: string;
  description?: string;
  merchant?: string;
  category?: string;
  error?: string;
};

export const CSV_TEMPLATE = `date,type,amount,description,merchant,category\n2026-01-15,deposit,1500.00,January salary,,Salary\n2026-01-18,withdrawal,85.50,Weekly groceries,Loblaws,Groceries\n`;

/**
 * Known merchant patterns keyed by a regex matched against the description.
 * Checked in order; first match wins.
 */
const MERCHANT_DICTIONARY: [pattern: RegExp, name: string][] = [
  [/\bAMZN\b|Amazon Mktp/i, "Amazon"],
  [/\bSpotify\b/i, "Spotify"],
  [/\bDOLLARAMA\b/i, "Dollarama"],
  [/\bPHARMAPRIX\b/i, "Pharmaprix"],
  [/\bMAXI\b/i, "Maxi"],
  [/WAL[- ]?MART|WALMART/i, "Walmart"],
  [/PETRO[- ]?CANADA/i, "Petro-Canada"],
  [/\bECONOFITNESS\b/i, "Econofitness"],
  [/\bIMPARK\b/i, "Impark"],
  [/\bPOPEYE/i, "Popeyes"],
  [/\bSUBWAY\b/i, "Subway"],
  [/\bPIZZA HUT\b/i, "Pizza Hut"],
  [/\bGOOGLE\b/i, "Google"],
  [/\bNETFLIX\b/i, "Netflix"],
  [/\bAPPLE\.COM\b|APPLE STORE/i, "Apple"],
  [/\bMICROSOFT\b/i, "Microsoft"],
  [/\bLOBLAW/i, "Loblaws"],
  [/\bSUPER C\b/i, "Super C"],
  [/\bCANADIAN TIRE\b/i, "Canadian Tire"],
  [/\bTIM HORTONS\b/i, "Tim Hortons"],
  [/\bSTARBUCKS\b/i, "Starbucks"],
  [/\bMCDONALD/i, "McDonald's"],
  [/\bBURGER KING\b/i, "Burger King"],
  [/\bUBER\b/i, "Uber"],
  [/DOORDASH|DOOR DASH/i, "DoorDash"],
  [/SKIP.*DISHES|SKIPTHEDISHES/i, "SkipTheDishes"],
  [/\bSAQ\b|SOCIETE DES ALCOOLS/i, "SAQ"],
  [/\bCINEPLEX\b/i, "Cineplex"],
  [/\bCINE STARZ\b/i, "Ciné Starz"],
  [/\bAIRBNB\b/i, "Airbnb"],
  [/\bBEST BUY\b/i, "Best Buy"],
  [/\bCOSTCO\b/i, "Costco"],
  [/\bURBAN PLANET\b/i, "Urban Planet"],
  [/\bRTM\b/i, "RTM"],
  [/\bIGA\b/i, "IGA"],
  [/\bHYDRO[- ]?QUEBEC\b/i, "Hydro-Québec"],
  [/\bBELL CANADA\b|\bBELL MOBILITY\b/i, "Bell"],
  [/\bVIDEOTRON\b/i, "Vidéotron"],
  [/\bROGERS\b/i, "Rogers"],
  [/\bTELUS\b/i, "Telus"],
];

/** City/location words that signal the end of a merchant name in a description. */
const CITY_WORDS = new Set([
  "MONTREAL",
  "TORONTO",
  "VANCOUVER",
  "CALGARY",
  "OTTAWA",
  "EDMONTON",
  "WINNIPEG",
  "LAVAL",
  "GATINEAU",
  "BLAINVILLE",
  "WESTMOUNT",
  "STOCKHOLM",
  "CHATEAUGUAY",
  "KIRKLAND",
  "LONGUEUIL",
  "BROSSARD",
  "LASALLE",
  "POINTE",
]);

/** Returns true for descriptions that represent a credit card payment (no merchant). */
function isPaymentDescription(description: string): boolean {
  return /PAYMENT.*THANK|PAI\s*EMENT.*MERCI|REMBOURSEMENT/i.test(description);
}

/**
 * Tries the merchant dictionary first, then falls back to a heuristic that takes
 * the first meaningful words of the description before store numbers or city names.
 */
export function extractMerchant(description: string): string | undefined {
  if (isPaymentDescription(description)) return undefined;

  for (const [pattern, merchantName] of MERCHANT_DICTIONARY) {
    if (pattern.test(description)) return merchantName;
  }

  // Heuristic fallback: walk words until a number, long code, or known city
  const words = description.split(/\s+/);
  const kept: string[] = [];
  for (const word of words) {
    const alphanumOnly = word.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (!alphanumOnly) continue;
    if (/^\d+$/.test(alphanumOnly)) break;
    if (CITY_WORDS.has(alphanumOnly)) break;
    if (alphanumOnly.length >= 8 && /\d/.test(alphanumOnly)) break;
    kept.push(word);
    if (kept.length >= 3) break;
  }

  if (!kept.length) return undefined;

  return kept
    .join(" ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Maps a resolved merchant name to a best-guess expense category using the
 * app's standard category list. Returns undefined for merchants with no clear match.
 */
const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  // Groceries
  Loblaws: "Groceries",
  Maxi: "Groceries",
  IGA: "Groceries",
  "Super C": "Groceries",
  Costco: "Groceries",
  Walmart: "Groceries",
  // Dining
  "Tim Hortons": "Dining",
  Starbucks: "Dining",
  "McDonald's": "Dining",
  "Burger King": "Dining",
  Subway: "Dining",
  "Pizza Hut": "Dining",
  Popeyes: "Dining",
  DoorDash: "Dining",
  SkipTheDishes: "Dining",
  Uber: "Dining",
  // Entertainment
  Netflix: "Entertainment",
  Spotify: "Entertainment",
  Cineplex: "Entertainment",
  "Ciné Starz": "Entertainment",
  Apple: "Entertainment",
  Google: "Entertainment",
  // Shopping
  Amazon: "Shopping",
  Dollarama: "Shopping",
  "Best Buy": "Shopping",
  "Canadian Tire": "Shopping",
  "Urban Planet": "Shopping",
  SAQ: "Shopping",
  Airbnb: "Shopping",
  Microsoft: "Shopping",
  // Healthcare
  Pharmaprix: "Healthcare",
  Econofitness: "Healthcare",
  // Transport
  "Petro-Canada": "Transport",
  Impark: "Transport",
  RTM: "Transport",
  // Utilities
  "Hydro-Québec": "Utilities",
  Bell: "Utilities",
  Vidéotron: "Utilities",
  Rogers: "Utilities",
  Telus: "Utilities",
};

/** Returns the standard category for a known merchant name, or undefined if unrecognized. */
export function lookupMerchantCategory(merchantName: string): string | undefined {
  return MERCHANT_CATEGORY_MAP[merchantName];
}

/**
 * Overrides the category on each row where the merchant matches a user-defined rule.
 * User rules take priority over the built-in merchant→category map.
 * The ruleMap is keyed by lowercase merchant name.
 */
export function applyCategorizationRules(
  rows: CsvRow[],
  ruleMap: Record<string, string>
): CsvRow[] {
  if (Object.keys(ruleMap).length === 0) return rows;
  return rows.map((row) => {
    if (!row.merchant) return row;
    const matchedCategory = ruleMap[row.merchant.toLowerCase()];
    if (matchedCategory) return { ...row, category: matchedCategory };
    return row;
  });
}

/**
 * Maps a display type string (deposit, withdrawal, charge, payment, credit, debit)
 * to the API's DEPOSIT | WITHDRAWAL enum value.
 *
 * For credit card accounts: charge → DEPOSIT (increases balance/debt),
 * payment → WITHDRAWAL (decreases balance/debt).
 */
export function resolveApiType(type: string): "DEPOSIT" | "WITHDRAWAL" {
  switch (type.toLowerCase()) {
    case "deposit":
    case "credit":
    case "charge":
      return "DEPOSIT";
    default:
      return "WITHDRAWAL";
  }
}

export function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

function convertRbcDate(dateStr: string): string {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return dateStr;
  const [month, day, year] = parts;
  return `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
}

export function parseCsvText(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]!).map((h) => h.toLowerCase().replace(/^"|"$/g, "").trim());

  const isRbc =
    headers.includes("transaction date") &&
    headers.includes("cad$") &&
    headers.includes("cheque number");

  // Detect whether this is an RBC credit card export (Visa / Mastercard / Amex)
  let isRbcCredit = false;
  if (isRbc) {
    const firstDataLine = lines.slice(1).find((l) => l.trim());
    if (firstDataLine) {
      const csvAccountType = (splitCsvLine(firstDataLine)[0] ?? "").trim().toLowerCase();
      isRbcCredit =
        csvAccountType === "visa" || csvAccountType === "mastercard" || csvAccountType === "amex";
    }
  }

  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values = splitCsvLine(line);
      const raw = Object.fromEntries(
        headers.map((h, i) => [h, (values[i] ?? "").replace(/^"|"$/g, "").trim()])
      );

      if (isRbc) {
        const cadRaw = raw["cad$"] ?? "";
        const cadNum = parseFloat(cadRaw);
        const desc1 = raw["description 1"] ?? "";
        const desc2 = raw["description 2"] ?? "";
        const description = desc1 && desc2 ? `${desc1} - ${desc2}` : desc1 || desc2 || undefined;

        // Credit card: negative = charge, positive = payment
        // Chequing/savings: positive = deposit, negative = withdrawal
        const type = isRbcCredit
          ? cadNum >= 0
            ? "payment"
            : "charge"
          : cadNum >= 0
            ? "deposit"
            : "withdrawal";

        const rbcMerchant = extractMerchant(desc1);
        const row: CsvRow = {
          date: convertRbcDate(raw["transaction date"] ?? ""),
          type,
          amount: Math.abs(cadNum).toFixed(2),
          description: description || undefined,
          merchant: rbcMerchant,
          category: rbcMerchant ? lookupMerchantCategory(rbcMerchant) : undefined,
        };
        if (!row.date || Number.isNaN(new Date(row.date).getTime())) {
          row.error = `Invalid date "${raw["transaction date"] ?? ""}"`;
        } else if (cadRaw === "" || Number.isNaN(cadNum) || cadNum === 0) {
          row.error = `Invalid amount "${cadRaw}"`;
        }
        return row;
      }

      const csvMerchant = raw["merchant"] || undefined;
      const csvCategory = raw["category"] || undefined;
      const row: CsvRow = {
        date: raw["date"] ?? "",
        type: raw["type"] ?? "",
        amount: raw["amount"] ?? "",
        description: raw["description"] || undefined,
        merchant: csvMerchant,
        category: csvCategory ?? (csvMerchant ? lookupMerchantCategory(csvMerchant) : undefined),
      };
      const normalizedType = row.type.toLowerCase();
      const resolvedType =
        normalizedType === "credit" || normalizedType === "charge"
          ? "deposit"
          : normalizedType === "debit" || normalizedType === "payment"
            ? "withdrawal"
            : normalizedType;
      if (resolvedType !== "deposit" && resolvedType !== "withdrawal") {
        row.error = `Unknown type "${row.type}"`;
      } else if (!row.date || Number.isNaN(new Date(row.date).getTime())) {
        row.error = `Invalid date "${row.date}"`;
      } else if (!row.amount || Number.isNaN(Number(row.amount)) || Number(row.amount) <= 0) {
        row.error = `Invalid amount "${row.amount}"`;
      }
      return row;
    });
}
