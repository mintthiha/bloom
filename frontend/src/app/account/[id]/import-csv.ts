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

export function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
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
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function parseCsvText(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase().replace(/^"|"$/g, "").trim());

  const isRbc = headers.includes("transaction date") && headers.includes("cad$") && headers.includes("cheque number");

  return lines.slice(1).filter(l => l.trim()).map((line) => {
    const values = splitCsvLine(line);
    const raw = Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").replace(/^"|"$/g, "").trim()]));

    if (isRbc) {
      const cadRaw = raw["cad$"] ?? "";
      const cadNum = parseFloat(cadRaw);
      const desc1 = raw["description 1"] ?? "";
      const desc2 = raw["description 2"] ?? "";
      const description = desc1 && desc2 ? `${desc1} - ${desc2}` : (desc1 || desc2 || undefined);
      const row: CsvRow = {
        date: convertRbcDate(raw["transaction date"] ?? ""),
        type: cadNum >= 0 ? "deposit" : "withdrawal",
        amount: Math.abs(cadNum).toFixed(2),
        description: description || undefined,
        merchant: undefined,
        category: undefined,
      };
      if (!row.date || Number.isNaN(new Date(row.date).getTime())) {
        row.error = `Invalid date "${raw["transaction date"] ?? ""}"`;
      } else if (cadRaw === "" || Number.isNaN(cadNum) || cadNum === 0) {
        row.error = `Invalid amount "${cadRaw}"`;
      }
      return row;
    }

    const row: CsvRow = {
      date: raw["date"] ?? "",
      type: raw["type"] ?? "",
      amount: raw["amount"] ?? "",
      description: raw["description"] || undefined,
      merchant: raw["merchant"] || undefined,
      category: raw["category"] || undefined,
    };
    const normalizedType = row.type.toLowerCase();
    const resolvedType = normalizedType === "credit" ? "deposit" : normalizedType === "debit" ? "withdrawal" : normalizedType;
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
