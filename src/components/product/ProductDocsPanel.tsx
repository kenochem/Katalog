import { FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmDialog } from '../../lib/dialog';
import { formatSize, listProductDocs, removeProductDoc, uploadProductDoc, type ProductDoc } from '../../lib/productDocs';
import { markProductDocs } from '../../lib/productDocsIndex';
import { showToast } from '../../lib/toast';

const MAX_BYTES = 25 * 1024 * 1024;

/** Zakładka „Materiały”: karty charakterystyki, specyfikacje i ulotki producentów przypięte do produktu. */
export function ProductDocsPanel({ productId, canEdit }: { productId: string; canEdit: boolean }) {
  const [docs, setDocs] = useState<ProductDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listProductDocs(productId);
      setDocs(list);
      markProductDocs(productId, list.length > 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wczytać materiałów');
    }
  }, [productId]);

  useEffect(() => {
    setDocs(null);
    void load();
  }, [load]);

  async function upload(files: File[]) {
    const ok = files.filter((f) => f.size <= MAX_BYTES);
    if (ok.length < files.length) showToast(`Pominięto pliki powyżej ${formatSize(MAX_BYTES)}`, 'error');
    if (!ok.length) return;
    setBusy('upload');
    try {
      for (const f of ok) await uploadProductDoc(productId, f);
      showToast(ok.length === 1 ? 'Dodano materiał' : `Dodano materiały: ${ok.length}`, 'ok');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się wgrać pliku', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(d: ProductDoc) {
    const yes = await confirmDialog({ title: 'Usuń materiał', message: `Usunąć plik „${d.name}”?`, confirmLabel: 'Usuń', tone: 'danger' });
    if (!yes) return;
    setBusy(d.name);
    try {
      await removeProductDoc(productId, d.name);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się usunąć pliku', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void upload([...e.dataTransfer.files]);
          }}
          className={`rounded-2xl border border-dashed p-5 text-center text-sm ${over ? 'border-brand-400 bg-brand-500/10' : 'border-slate-700 text-slate-400'}`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
            className="hidden"
            onChange={(e) => {
              void upload([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          >
            {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Dodaj materiały
          </button>
          <p className="mt-2 text-xs">albo przeciągnij tu pliki (karta charakterystyki, specyfikacja, ulotka; do {formatSize(MAX_BYTES)})</p>
        </div>
      )}
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {!docs && !error && (
        <p className="inline-flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Wczytuję materiały…
        </p>
      )}
      {docs && docs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
          <FileText className="mx-auto mb-2 h-6 w-6 text-slate-500" />
          Ten produkt nie ma jeszcze żadnych materiałów.
        </div>
      )}
      {docs && docs.length > 0 && (
        <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/50">
          {docs.map((d) => (
            <li key={d.name} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="h-4 w-4 shrink-0 text-slate-500" />
              <a href={d.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-brand-300 hover:underline" title={d.name}>
                {d.name}
              </a>
              <span className="shrink-0 text-xs text-slate-500">{d.size ? formatSize(d.size) : ''}</span>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void remove(d)}
                  title="Usuń plik"
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-300 disabled:opacity-30"
                >
                  {busy === d.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
