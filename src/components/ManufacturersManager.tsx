import { Check, CloudDownload, CloudUpload, Loader2, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../types';
import { fetchBlManufacturers } from '../lib/baselinkerApi';
import {
  cleanManufacturerName,
  getRegistry,
  importManufacturersFromBaselinker,
  registerManufacturers,
  sendManufacturersToBaselinker,
  useManufacturerRegistry,
} from '../lib/manufacturerRegistry';
import { WAPRO_MANUFACTURERS, effectiveManufacturer, manufacturerOptions } from '../lib/waproManufacturers';
import { showToast } from '../lib/toast';

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Zarządzanie producentami: lista wspólna, dodawanie nowych, pobieranie z BaseLinkera i wysyłanie tam. */
export function ManufacturersManager({ products, onClose }: { products: Product[]; onClose: () => void }) {
  const registryVersion = useManufacturerRegistry();
  const [blNames, setBlNames] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState<'fetch' | 'send' | 'add' | null>(null);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const m = effectiveManufacturer(p);
      if (!m) continue;
      map.set(key(m), (map.get(key(m)) || 0) + 1);
    }
    return map;
  }, [products]);

  const rows = useMemo(() => {
    const registry = getRegistry();
    const regByKey = new Map(registry.map((r) => [key(r.name), r]));
    const wapro = new Set(WAPRO_MANUFACTURERS.map((m) => key(m)));
    const names = manufacturerOptions([...products.map((p) => p.manufacturer ?? ''), ...(blNames ? [...blNames] : [])]);
    return names
      .filter((n) => n !== 'Inne')
      .map((name) => {
        const k = key(name);
        const reg = regByKey.get(k);
        return {
          name,
          wapro: wapro.has(k),
          manual: reg?.source === 'manual',
          blKnown: reg?.blId != null || reg?.source === 'baselinker',
          inBl: blNames ? blNames.has(k) : null,
          count: counts.get(k) ?? 0,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, blNames, counts, registryVersion]);

  const shown = rows.filter((r) => !query.trim() || r.name.toLowerCase().includes(query.trim().toLowerCase()));
  const missingInBl = rows.filter((r) => (r.inBl === null ? !r.blKnown : !r.inBl));

  async function fetchFromBl() {
    setBusy('fetch');
    try {
      const list = await fetchBlManufacturers();
      setBlNames(new Set(list.map((m) => key(m.name))));
      const res = await importManufacturersFromBaselinker();
      showToast(`BaseLinker: ${res.total} producentów, nowych w katalogu: ${res.added}`, 'ok', 5000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się pobrać producentów', 'error', 7000);
    } finally {
      setBusy(null);
    }
  }

  async function sendToBl(names: string[]) {
    if (!names.length) return;
    setBusy('send');
    try {
      const res = await sendManufacturersToBaselinker(names);
      setBlNames((prev) => new Set([...(prev ?? []), ...names.map(key)]));
      setSelected(new Set());
      showToast(`BaseLinker: utworzono ${res.created}, już istniało ${res.existing}`, 'ok', 5000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się wysłać producentów', 'error', 7000);
    } finally {
      setBusy(null);
    }
  }

  async function addNew() {
    const name = cleanManufacturerName(draft);
    if (!name) return;
    setBusy('add');
    try {
      const added = await registerManufacturers([{ name }], 'manual');
      showToast(added ? `Dodano producenta „${name}”` : `„${name}” już jest na liście`, added ? 'ok' : 'info');
      setDraft('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się dodać', 'error', 7000);
    } finally {
      setBusy(null);
    }
  }

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const badge = 'rounded-full px-2 py-0.5 text-[10px] font-semibold';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-2 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="text-base font-bold text-slate-50">Producenci</h3>
            <p className="text-xs text-slate-400">
              Lista wspólna dla wszystkich: WAPRO + dodani ręcznie + z BaseLinkera. Producenta wybierzesz w edycji produktu.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-800 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addNew()}
              placeholder="Nowy producent / marka"
              className="input-field min-w-0 flex-1"
            />
            <button
              type="button"
              disabled={!draft.trim() || busy !== null}
              onClick={() => void addNew()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Dodaj
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void fetchFromBl()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
            >
              {busy === 'fetch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
              Pobierz z BaseLinkera
            </button>
            <button
              type="button"
              disabled={busy !== null || selected.size === 0}
              onClick={() => void sendToBl([...selected])}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
            >
              {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
              Wyślij zaznaczonych do BaseLinkera ({selected.size})
            </button>
            <button
              type="button"
              disabled={busy !== null || blNames === null || missingInBl.length === 0}
              onClick={() => void sendToBl(missingInBl.map((r) => r.name))}
              title={blNames === null ? 'Najpierw pobierz listę z BaseLinkera' : undefined}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
            >
              <CloudUpload className="h-4 w-4" />
              Wyślij wszystkie brakujące ({blNames === null ? '?' : missingInBl.length})
            </button>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj producenta…"
            className="input-field"
          />
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-slate-800 overflow-y-auto">
          {shown.map((r) => (
            <li key={r.name} className="flex items-center gap-3 px-4 py-2">
              <input
                type="checkbox"
                checked={selected.has(r.name)}
                onChange={() => toggle(r.name)}
                aria-label={`Zaznacz ${r.name}`}
                className="h-4 w-4"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">{r.name}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                {r.wapro && <span className={`${badge} bg-slate-700 text-slate-200`}>WAPRO</span>}
                {r.manual && <span className={`${badge} bg-violet-500/20 text-violet-200`}>ręczny</span>}
                {r.inBl === true || (r.inBl === null && r.blKnown) ? (
                  <span className={`${badge} inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300`}>
                    <Check className="h-3 w-3" /> BL
                  </span>
                ) : r.inBl === false ? (
                  <span className={`${badge} bg-amber-500/20 text-amber-300`}>brak w BL</span>
                ) : null}
              </span>
              <span className="w-16 text-right text-xs tabular-nums text-slate-400">{r.count} prod.</span>
            </li>
          ))}
          {shown.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">Brak producentów.</li>}
        </ul>
      </div>
    </div>
  );
}
