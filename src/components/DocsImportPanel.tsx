import { FolderOpen, Loader2, Paperclip, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Product } from '../types';
import { downloadText } from '../lib/assortmentAudit';
import { isImportableDoc, matchDocs, uploadNameFor, type DocMatch } from '../lib/productDocsMatch';
import { listProductDocs, safeDocName, uploadProductDoc } from '../lib/productDocs';
import { refreshDocsIndex } from '../lib/productDocsIndex';
import { showToast } from '../lib/toast';
import { effectiveManufacturer } from '../lib/waproManufacturers';

const card = 'rounded-3xl bg-slate-100/70 p-5 dark:bg-white/[0.045]';
const btn =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';
const btnPrimary = 'inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50';
const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

interface Picked {
  path: string;
  file: File;
}

/** Masowy import materiałów: wybierasz folder z kartami, aplikacja dopasowuje pliki do produktów po nazwie i wgrywa je do zakładek „Materiały”. */
export function DocsImportPanel({ products, canEdit }: { products: Product[]; canEdit: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [result, setResult] = useState<{ matches: DocMatch[]; unmatched: string[]; ambiguous: string[] } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; skipped: number } | null>(null);

  const docProducts = useMemo(
    () =>
      products
        .filter((p) => !p.isGroup && (p.sku ?? '').trim())
        .map((p) => ({ id: p.id, sku: (p.sku ?? '').trim(), name: p.displayName || p.name, maker: effectiveManufacturer(p) })),
    [products],
  );

  function onPick(list: FileList | null) {
    // marka i typ dokumentu wynikają z nazw folderów, więc zostawiamy całą ścieżkę względną; zdjęcia, archiwa i pakiety zbiorcze pomijamy
    const items = [...(list ?? [])]
      .map((file) => ({ path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name, file }))
      .filter((i) => isImportableDoc(i.path));
    setPicked(items);
    setResult(matchDocs(items.map((i) => ({ path: i.path })), docProducts));
  }

  const pairs = result?.matches.reduce((a, m) => a + m.products.length, 0) ?? 0;

  async function run() {
    if (!result) return;
    const byPath = new Map(picked.map((p) => [p.path, p.file]));
    const jobs = result.matches.flatMap((m) => m.products.map((p) => ({ product: p, file: byPath.get(m.path)!, name: uploadNameFor(m.path) })).filter((j) => j.file));
    setProgress({ done: 0, total: jobs.length, skipped: 0 });
    // istniejące pliki produktu o tej samej nazwie i rozmiarze pomijamy — import można bezpiecznie powtarzać
    const existing = new Map<string, Map<string, number>>();
    const ids = [...new Set(jobs.map((j) => j.product.id))];
    for (let i = 0; i < ids.length; i += 6) {
      await Promise.all(
        ids.slice(i, i + 6).map(async (id) => {
          try {
            existing.set(id, new Map((await listProductDocs(id)).map((d) => [d.name, d.size])));
          } catch {
            existing.set(id, new Map());
          }
        }),
      );
    }
    let done = 0;
    let skipped = 0;
    let failed = 0;
    const queue = [...jobs];
    async function worker() {
      for (let j = queue.shift(); j; j = queue.shift()) {
        const same = existing.get(j.product.id)?.get(safeDocName(j.name)) === j.file.size;
        if (same) skipped++;
        else {
          try {
            await uploadProductDoc(j.product.id, j.file, j.name);
          } catch {
            failed++;
          }
        }
        setProgress({ done: ++done, total: jobs.length, skipped });
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    setProgress(null);
    void refreshDocsIndex();
    showToast(`Wgrano ${done - skipped - failed} z ${jobs.length} plików${skipped ? `, pominięto ${skipped} (już były)` : ''}${failed ? `, błędy: ${failed}` : ''}`, failed ? 'warn' : 'ok');
  }

  function reportCsv() {
    const head = ['Plik', 'Status', 'Produkty (SKU)', 'Nazwy produktów'];
    const rows = [
      ...(result?.matches ?? []).map((m) => [m.path, 'dopasowany', m.products.map((p) => p.sku).join(', '), m.products.map((p) => p.name).join(' | ')]),
      ...(result?.ambiguous ?? []).map((p) => [p, 'niejednoznaczny', '', '']),
      ...(result?.unmatched ?? []).map((p) => [p, 'bez dopasowania', '', '']),
    ];
    downloadText('materialy-dopasowanie.csv', String.fromCharCode(0xfeff) + [head, ...rows].map((r) => r.map(q).join(';')).join('\r\n'), 'text/csv');
  }

  return (
    <section className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-center gap-3">
        <Paperclip className="h-5 w-5 text-slate-500" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Materiały produktów: import masowy</h3>
          <p className="text-sm text-slate-500">
            Wybierz folder z kartami charakterystyki (podfoldery to marki, np. „Cid Lines”, „TENZI”). Pliki są dopasowywane do produktów po nazwie i trafiają do zakładki „Materiały” każdego pasującego produktu.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          // @ts-expect-error webkitdirectory nie jest w typach React
          webkitdirectory=""
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = '';
          }}
        />
        <button type="button" className={btn} disabled={!canEdit || progress !== null} onClick={() => inputRef.current?.click()}>
          <FolderOpen className="h-4 w-4" /> Wybierz folder
        </button>
      </div>
      {result && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Plików w folderze', picked.length],
              ['Dopasowane pliki', result.matches.length],
              ['Przypisań do produktów', pairs],
              ['Bez dopasowania', result.unmatched.length + result.ambiguous.length],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl bg-white/70 p-3 dark:bg-white/[0.04]">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">{(value as number).toLocaleString('pl-PL')}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btnPrimary} disabled={!canEdit || !pairs || progress !== null} onClick={() => void run()}>
              {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Wgraj dopasowane ({pairs})
            </button>
            <button type="button" className={btn} onClick={reportCsv}>
              Raport dopasowania (CSV)
            </button>
            {progress && (
              <span className="text-sm text-slate-500">
                Wgrywam {progress.done} / {progress.total}
                {progress.skipped ? ` (pominięto ${progress.skipped})` : ''}…
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Pliki bez dopasowania to zwykle produkty, których nie ma w katalogu. Pliki „niejednoznaczne” pasują do kilku różnych produktów tak samo dobrze — dodaj je ręcznie w zakładce „Materiały”. Powtórny import pomija pliki, które produkt już ma.
          </p>
        </>
      )}
    </section>
  );
}
