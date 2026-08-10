"use client";

import { useState } from "react";

interface CredentialsTableProps {
  columns: string[];
  rows: string[][];
}

export function CredentialsTable({ columns, rows }: CredentialsTableProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            {columns.map((col) => (
              <th key={col} className="text-left font-medium px-4 py-3 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr
              key={rIdx}
              className="border-t border-border hover:bg-muted/30 transition-colors"
            >
              {row.map((cell, cIdx) => {
                const key = `${rIdx}-${cIdx}`;
                const isCopyable =
                  /@/.test(cell) ||
                  /^\+7\d{10}$/.test(cell) ||
                  /^[A-Za-z0-9!@#$%^&*]{6,}$/.test(cell);
                return (
                  <td key={cIdx} className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <span className={isCopyable ? "font-mono" : ""}>{cell}</span>
                      {isCopyable && (
                        <button
                          type="button"
                          onClick={() => handleCopy(cell, key)}
                          className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          aria-label={`Скопировать ${cell}`}
                        >
                          {copied === key ? "Скопировано" : "Копировать"}
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
