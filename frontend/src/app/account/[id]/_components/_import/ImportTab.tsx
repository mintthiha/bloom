"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { CsvRow, CSV_TEMPLATE, parseCsvText, resolveApiType } from "./import-csv";

type ImportTabProps = {
  accountId: string;
  onSuccess: (imported: number) => void;
  onError: (message: string) => void;
};

export function ImportTab({ accountId, onSuccess, onError }: ImportTabProps) {
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);

  function handleCsvFile(file: File | null) {
    setCsvRows([]);
    setCsvParseError(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const rows = parseCsvText(text);
        if (rows.length === 0) { setCsvParseError("No data rows found in file."); return; }
        setCsvRows(rows);
      } catch {
        setCsvParseError("Failed to parse CSV.");
      }
    };
    reader.readAsText(file);
  }

  async function handleImportCsv() {
    const valid = csvRows.filter(r => !r.error);
    if (valid.length === 0) return;
    setCsvImporting(true);
    try {
      const rows = valid.map(r => ({
        type: resolveApiType(r.type),
        amount: Number(r.amount),
        date: r.date,
        description: r.description,
        merchant: r.merchant,
        category: r.category,
      }));
      const result = await api.importCsv(accountId, rows);
      onSuccess(result.imported);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setCsvImporting(false);
    }
  }

  const validCount = csvRows.filter(r => !r.error).length;
  const errorCount = csvRows.length - validCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Upload a CSV with columns: <span className="num" style={{ color: 'var(--text-primary)' }}>date, type, amount, description, merchant, category</span>.
        Type accepts <span className="num">deposit</span>, <span className="num">withdrawal</span>, <span className="num">charge</span>, <span className="num">payment</span>, <span className="num">credit</span>, or <span className="num">debit</span>.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '9px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)',
          borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Choose file
          <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => handleCsvFile(e.target.files?.[0] ?? null)} />
        </label>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`}
          download="bloom-import-template.csv"
          style={{ fontSize: '12px', color: '#f59e0b', textDecoration: 'none', fontWeight: 600 }}
        >
          Download template
        </a>
      </div>

      {csvParseError && <p style={{ fontSize: '12px', color: '#f87171' }}>{csvParseError}</p>}

      {csvRows.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {csvRows.length} row{csvRows.length !== 1 ? "s" : ""} parsed
              {errorCount > 0 && <span style={{ color: '#f87171', marginLeft: '8px' }}>{errorCount} with errors</span>}
            </span>
            {validCount > 0 && (
              <button
                onClick={handleImportCsv}
                disabled={csvImporting}
                style={{
                  padding: '8px 16px', background: '#f59e0b', color: '#000',
                  border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                  cursor: csvImporting ? 'not-allowed' : 'pointer', opacity: csvImporting ? 0.5 : 1,
                }}
              >
                {csvImporting ? "Importing..." : `Import ${validCount} transaction${validCount !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {["Date", "Type", "Amount", "Category", "Merchant", "Description", ""].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '10px', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvRows.map((row, i) => (
                  <tr key={i} style={{ background: row.error ? '#f8717108' : 'transparent' }}>
                    <td className="num" style={{ padding: '7px 8px', color: row.error ? '#f87171' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>{row.date}</td>
                    <td style={{ padding: '7px 8px', color: row.error ? '#f87171' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>{row.type}</td>
                    <td className="num" style={{ padding: '7px 8px', color: row.error ? '#f87171' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>{row.amount}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.category ?? "—"}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.merchant ?? "—"}</td>
                    <td style={{ padding: '7px 8px', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description ?? "—"}</td>
                    <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                      {row.error
                        ? <span style={{ color: '#f87171', fontSize: '11px' }}>{row.error}</span>
                        : <span style={{ color: '#22c55e', fontSize: '11px' }}>✓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
