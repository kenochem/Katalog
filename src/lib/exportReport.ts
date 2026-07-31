/** Prosty eksport CSV (Excel otwiera bez problemu, UTF-8 BOM). */

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.map(esc).join(';'),
    ...rows.map((r) => r.map(esc).join(';')),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function stampFile(prefix: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${prefix}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.csv`;
}
