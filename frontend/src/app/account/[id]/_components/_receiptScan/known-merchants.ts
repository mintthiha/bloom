/**
 * Chains whose receipts open with a logo rather than plain text. A scanner mangles a logo
 * ("almart ><"), so these are recognized by name and reported with their proper spelling.
 */
const KNOWN_MERCHANT_NAMES = [
  "Walmart",
  "Costco",
  "Loblaws",
  "Real Canadian Superstore",
  "No Frills",
  "Sobeys",
  "Safeway",
  "FreshCo",
  "Food Basics",
  "Metro",
  "IGA",
  "Maxi",
  "Super C",
  "Provigo",
  "Farm Boy",
  "Save-On-Foods",
  "Giant Tiger",
  "Dollarama",
  "Shoppers Drug Mart",
  "Pharmaprix",
  "Jean Coutu",
  "Rexall",
  "London Drugs",
  "Canadian Tire",
  "Home Depot",
  "Home Hardware",
  "RONA",
  "IKEA",
  "Best Buy",
  "Staples",
  "Winners",
  "Tim Hortons",
  "McDonald's",
  "Starbucks",
  "Subway",
  "Petro-Canada",
  "Esso",
  "Shell",
  "Couche-Tard",
  "LCBO",
  "SAQ",
];

/** Names shorter than this must be read exactly; one wrong letter in "IGA" or "Metro" is another word. */
const MIN_LENGTH_FOR_ONE_MISREAD = 7;
const MIN_LENGTH_FOR_TWO_MISREADS = 12;
/** The longest known name is three words, and a scanner can split one of them in two. */
const MAX_WORDS_IN_MERCHANT_NAME = 4;

type KnownMerchant = { displayName: string; comparableName: string };
type MerchantMatch = { displayName: string; misreadCount: number; nameLength: number };

/** Splits text into upper-case words without accents or apostrophes, so "McDonald's" is one word. */
function toComparableWords(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ'’]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((word) => word.length > 0);
}

const KNOWN_MERCHANTS: KnownMerchant[] = KNOWN_MERCHANT_NAMES.map((displayName) => ({
  displayName,
  comparableName: toComparableWords(displayName).join(""),
}));

/** How many wrong, missing, or extra characters a scanned name of this length may have. */
function allowedMisreadCount(nameLength: number): number {
  if (nameLength >= MIN_LENGTH_FOR_TWO_MISREADS) return 2;
  return nameLength >= MIN_LENGTH_FOR_ONE_MISREAD ? 1 : 0;
}

/** Counts the single-character edits (insert, delete, replace) that turn one text into the other. */
function countCharacterEdits(firstText: string, secondText: string): number {
  let previousRow = Array.from({ length: secondText.length + 1 }, (_, column) => column);
  for (let row = 1; row <= firstText.length; row += 1) {
    const currentRow = [row];
    for (let column = 1; column <= secondText.length; column += 1) {
      const replacementCost = firstText[row - 1] === secondText[column - 1] ? 0 : 1;
      currentRow.push(
        Math.min(
          previousRow[column - 1]! + replacementCost,
          previousRow[column]! + 1,
          currentRow[column - 1]! + 1
        )
      );
    }
    previousRow = currentRow;
  }
  return previousRow[secondText.length]!;
}

/** Prefers the reading with fewer misread characters, then the longer (more specific) name. */
function isBetterMatch(candidate: MerchantMatch, current: MerchantMatch): boolean {
  if (candidate.misreadCount !== current.misreadCount) {
    return candidate.misreadCount < current.misreadCount;
  }
  return candidate.nameLength > current.nameLength;
}

/** Finds the known chain that a run of scanned words spells, allowing for a few misread characters. */
function matchKnownMerchant(scannedName: string): MerchantMatch | null {
  let bestMatch: MerchantMatch | null = null;
  for (const { displayName, comparableName } of KNOWN_MERCHANTS) {
    const allowedMisreads = allowedMisreadCount(comparableName.length);
    if (Math.abs(scannedName.length - comparableName.length) > allowedMisreads) continue;
    const misreadCount = countCharacterEdits(scannedName, comparableName);
    if (misreadCount > allowedMisreads) continue;
    const match = { displayName, misreadCount, nameLength: comparableName.length };
    if (!bestMatch || isBetterMatch(match, bestMatch)) bestMatch = match;
  }
  return bestMatch;
}

/**
 * Looks for a well-known chain in the lines at the top of a receipt and returns its proper name.
 * Whole words are compared, joined across spaces, so "WAL MART" and "almart" both read as Walmart
 * while "SUPERCENTRE" is never taken for Super C. Returns null when no known chain is printed.
 */
export function findKnownMerchant(headerLines: string[]): string | null {
  let bestMatch: MerchantMatch | null = null;
  for (const headerLine of headerLines) {
    const words = toComparableWords(headerLine);
    for (let firstWordIndex = 0; firstWordIndex < words.length; firstWordIndex += 1) {
      const lastWordLimit = Math.min(words.length, firstWordIndex + MAX_WORDS_IN_MERCHANT_NAME);
      for (
        let endWordIndex = firstWordIndex + 1;
        endWordIndex <= lastWordLimit;
        endWordIndex += 1
      ) {
        const match = matchKnownMerchant(words.slice(firstWordIndex, endWordIndex).join(""));
        if (match && (!bestMatch || isBetterMatch(match, bestMatch))) bestMatch = match;
      }
    }
  }
  return bestMatch ? bestMatch.displayName : null;
}
