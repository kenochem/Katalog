import { useMemo, useState } from 'react';
import { ArrowLeft, LayoutGrid, MapPin, Save, Search } from 'lucide-react';
import type { Product, WarehouseLocation } from '../../types';
import {
  formatLocationCode,
  parseLocationCode,
} from '../../lib/warehouseLocation';
import { setProductLocation } from '../../lib/locationStore';
import { showToast } from '../../lib/toast';
import { WarehouseLocationFields } from './WarehouseLocationFields';
import { WarehouseLayoutMiniPreview } from './WarehouseLayoutMiniPreview';
import { useWarehouseLayoutRevision } from './useWarehouseLayoutRevision';
import { ContextHelp } from '../ContextHelp';

interface WarehouseLocationsPanelProps {
  products: Product[];
  onBack: () => void;
  onOpenLayout?: () => void;
  onLocationSaved?: (productId: string, location: WarehouseLocation) => void;
}

type FilterMode = 'all' | 'unassigned' | 'assigned';

function emptyLocation(): WarehouseLocation {
  return {};
}

export function WarehouseLocationsPanel({
  products,
  onBack,
  onOpenLayout,
  onLocationSaved,
}: WarehouseLocationsPanelProps) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<FilterMode>('unassigned');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WarehouseLocation>(emptyLocation());
  const [saving, setSaving] = useState(false);
  const [patches, setPatches] = useState<Record<string, WarehouseLocation>>({});
  const layoutRevision = useWarehouseLayoutRevision();

  const mergedProducts = useMemo(
    () =>
      products.map((p) =>
        patches[p.id] ? { ...p, warehouseLocation: patches[p.id] } : p,
      ),
    [products, patches],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = mergedProducts;
    if (filter === 'unassigned') {
      list = list.filter((p) => !formatLocationCode(p.warehouseLocation));
    } else if (filter === 'assigned') {
      list = list.filter((p) => Boolean(formatLocationCode(p.warehouseLocation)));
    }
    if (query) {
      list = list.filter(
        (p) =>
          p.sku.toLowerCase().includes(query) ||
          p.displayName.toLowerCase().includes(query) ||
          formatLocationCode(p.warehouseLocation).toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query),
      );
    }
    return list.slice(0, 80);
  }, [mergedProducts, q, filter]);

  const selected = mergedProducts.find((p) => p.id === selectedId) ?? null;
  const assignedCount = useMemo(
    () => mergedProducts.filter((p) => formatLocationCode(p.warehouseLocation)).length,
    [mergedProducts],
  );

  function selectProduct(p: Product) {
    setSelectedId(p.id);
    setDraft({ ...(p.warehouseLocation ?? emptyLocation()) });
  }

  async function saveLocation() {
    if (!selected) return;
    setSaving(true);
    try {
      const hasValues = Object.values(draft).some(Boolean);
      await setProductLocation(selected.id, hasValues ? draft : null);
      setPatches((prev) => ({ ...prev, [selected.id]: draft }));
      onLocationSaved?.(selected.id, draft);
      showToast('Zapisano lokalizację', 'ok');
    } catch {
      showToast('Nie udało się zapisać — sprawdź migrację warehouse_location', 'error');
    } finally {
      setSaving(false);
    }
  }

  function applyQuickCode(code: string) {
    if (!code.trim()) return;
    setDraft(parseLocationCode(code));
  }

  return (
    <div className="stock-app mx-auto max-w-[1280px] space-y-4 pb-10">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Magazyn
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-slate-100">
            Regały, sekcje i pojemniki
            <ContextHelp id="warehouseMap" side="left" />
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-500">
            Przypisuj adres magazynowy do SKU — kody z planu hali lub ręcznie (półka, pojemnik).
          </p>
        </div>
        {onOpenLayout && (
          <button
            type="button"
            onClick={onOpenLayout}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
          >
            <LayoutGrid className="h-4 w-4" />
            Plan magazynu
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatChip label="SKU łącznie" value={String(mergedProducts.length)} />
        <StatChip label="Z lokalizacją" value={String(assignedCount)} accent />
        <StatChip
          label="Bez adresu"
          value={String(mergedProducts.length - assignedCount)}
          warn={assignedCount < mergedProducts.length}
        />
      </div>

      <section className="rounded-2xl border border-brand-500/25 bg-brand-50 p-4 text-sm text-slate-800 dark:bg-brand-500/5 dark:text-slate-300">
        <p className="font-semibold text-brand-800 dark:text-brand-200">Drobnica i regały</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-700 dark:text-slate-400">
          <li>
            Kod: <span className="font-mono text-slate-950 dark:text-slate-300">DRO-A-R1-P04-B12</span> (strefa → alejka → regał →
            półka → pojemnik).
          </li>
          <li>Na planie ustaw kody regałów — potem wybierz preset przy SKU lub uzupełnij półkę/pojemnik.</li>
          <li>Lokalizacja trafia na etykietę półkową w kolejce druku.</li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['unassigned', 'Bez lokalizacji'],
            ['assigned', 'Przypisane'],
            ['all', 'Wszystkie'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              filter === id
                ? 'bg-brand-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj SKU, nazwy, kategorii, lokalizacji…"
          className="input-field w-full pl-9"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,280px)]">
        <ul className="max-h-[min(50dvh,520px)] space-y-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/40 dark:shadow-none lg:max-h-[calc(100dvh-16rem)]">
          {filtered.map((p) => {
            const loc = formatLocationCode(p.warehouseLocation);
            const active = selectedId === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => selectProduct(p)}
                  className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm ${
                    active ? 'bg-brand-50 dark:bg-brand-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${loc ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-950 dark:text-slate-100">{p.displayName}</p>
                    <p className="font-mono text-xs text-brand-700 dark:text-brand-300">{p.sku}</p>
                    {loc ? (
                      <p className="mt-0.5 font-mono text-xs text-emerald-400/90">{loc}</p>
                    ) : (
                      <p className="mt-0.5 text-xs text-amber-500/80">Brak adresu</p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
          {selected ? (
            <>
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">{selected.displayName}</p>
              <p className="font-mono text-xs text-brand-700 dark:text-brand-300">{selected.sku}</p>

              <div className="mt-4">
                <WarehouseLocationFields
                  value={draft}
                  onChange={setDraft}
                  onApplyQuickCode={applyQuickCode}
                  layoutRevision={layoutRevision}
                />
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveLocation()}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Zapisuję…' : 'Zapisz lokalizację'}
              </button>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              Wybierz produkt z listy, aby przypisać regał lub pojemnik.
            </p>
          )}
        </div>

        <WarehouseLayoutMiniPreview
          location={selected ? draft : {}}
          layoutRevision={layoutRevision}
          className="min-h-[280px] lg:sticky lg:top-4 lg:max-h-[calc(100dvh-6rem)] lg:self-start"
        />
      </div>
    </div>
  );
}

function StatChip({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-center ${
        accent
          ? 'border-emerald-500/40 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
          : warn
            ? 'border-amber-500/45 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
            : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60'
      }`}
    >
      <p
        className={`text-lg font-bold tabular-nums ${
          accent
            ? 'text-emerald-900 dark:text-emerald-200'
            : warn
              ? 'text-amber-950 dark:text-amber-200'
              : 'text-slate-950 dark:text-slate-50'
        }`}
      >
        {value}
      </p>
      <p
        className={`text-[10px] uppercase tracking-wide ${
          accent
            ? 'text-emerald-800/80 dark:text-slate-500'
            : warn
              ? 'text-amber-900/75 dark:text-slate-500'
              : 'text-slate-600 dark:text-slate-500'
        }`}
      >
        {label}
      </p>
    </div>
  );
}
