/**
 * Converts an array of objects to a CSV string with proper escaping.
 */
export function arrayToCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; header: string }[]
): string {
  const header = columns.map((c) => `"${c.header}"`).join(",");
  const body = rows.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        const str = val == null ? "" : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [header, ...body].join("\n");
}

/**
 * Triggers a browser download of a CSV file.
 */
export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Fetches and downloads a CSV from an API route.
 */
export async function fetchAndDownloadCSV(
  url: string,
  filename: string
) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const csv = await res.text();
  downloadCSV(csv, filename);
}
