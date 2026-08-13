import {
  FolderOpen,
  Trash2,
  Plus,
  X,
  Copy,
  Download,
  Pencil,
  ChevronLeft,
  Check,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../types';
import {
  COLLECTION_INTENT_LABELS,
  type CollectionIntent,
  createCollection,
  deleteCollection,
  hydrateCollections,
  isCloudCollectionsAccount,
  loadCollections,
  removeProductFromCollection,
  updateCollection,
} from '../lib/productCollections';
import { exportProductsCsv } from '../lib/catalogExport';
import { showToast } from '../lib/toast';
import { ProductGrid } from './ProductGrid';
import { ProductCard } from './ProductCard';

interface ProductCollectionsViewProps {
  userKey: string;
  products: Product[];
  onOpenProduct: (p: Product) => void;
  hideImages?: boolean;
  showPrices?: boolean;
  onCollectionsChange?: () => void;
}

export function ProductCollectionsView({
  userKey,
  products,
  onOpenProduct,
  hideImages,
  showPrices,
  onCollectionsChange,
}: ProductCollectionsViewProps) {
  const [collections, setCollections] = useState(() => loadCollections(userKey));
  const [hydrating, setHydrating] = useState(isCloudCollectionsAccount(userKey));
  /** null = lista folderów; po wejściu w folder — id. */
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newIntent, setNewIntent] = useState<CollectionIntent>('shop-tags');
  const [editingMeta, setEditingMeta] = useState(false);

  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const active = collections.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    let cancelled = false;
    void hydrateCollections(userKey).then((list) => {
      if (cancelled) return;
      setCollections(list);
      setHydrating(false);
      onCollectionsChange?.();
    });
    return () => {
      cancelled = true;
    };
  }, [userKey, onCollectionsChange]);

  const [editName, setEditName] = useState('');
  const [editIntent, setEditIntent] = useState<CollectionIntent>('shop-tags');
  const [editNote, setEditNote] = useState('');

  useEffect(() => {
    if (!active) {
      setEditName('');
      setEditNote('');
      setEditingMeta(false);
      return;
    }
    setEditName(active.name);
    setEditIntent(active.intent);
    setEditNote(active.note || '');
  }, [active?.id, active?.name, active?.intent, active?.note, active?.updatedAt]);

  const activeProducts = useMemo(() => {
    if (!active) return [];
    return active.productIds
      .map((id) => productMap.get(id))
      .filter((p): p is Product => !!p);
  }, [active, productMap]);

  function refresh() {
    setCollections(loadCollections(userKey));
    onCollectionsChange?.();
  }

  async function saveFolderMeta() {
    if (!active) return;
    const name = editName.trim();
    if (!name) {
      showToast('Nazwa folderu nie może być pusta', 'warn');
      setEditName(active.name);
      return;
    }
    try {
      await updateCollection(userKey, active.id, {
        name,
        intent: editIntent,
        note: editNote.trim(),
      });
      refresh();
      setEditingMeta(false);
      showToast('Zapisano folder', 'ok');
    } catch {
      showToast('Nie udało się zapisać folderu', 'error');
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) {
      showToast('Podaj nazwę folderu', 'warn');
      return;
    }
    try {
      const col = await createCollection(userKey, {
        name,
        note: newNote,
        intent: newIntent,
      });
      setNewName('');
      setNewNote('');
      setShowNew(false);
      setActiveId(col.id);
      refresh();
      showToast(`Folder „${name}” utworzony`, 'ok');
    } catch {
      showToast('Nie udało się utworzyć folderu', 'error');
    }
  }

  async function copySkus(list: Product[]) {
    const text = list.map((p) => p.sku).filter(Boolean).join('\n');
    if (!text) {
      showToast('Brak SKU', 'warn');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Skopiowano ${list.length} SKU`, 'ok');
    } catch {
      showToast('Nie udało się skopiować', 'error');
    }
  }

  function leaveFolder() {
    setActiveId(null);
    setEditingMeta(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Foldery robocze</h2>
          <p className="text-sm text-slate-400">
            Zbieraj produkty pod cel (tagi w sklepie, zdjęcia, promocja). Eksport CSV / lista SKU.
            {isCloudCollectionsAccount(userKey) && (
              <span className="mt-1 block text-xs text-slate-500">
                {hydrating ? 'Synchronizacja folderów…' : 'Foldery zapisane na Twoim koncie (Supabase).'}
              </span>
            )}
          </p>
        </div>
        {!activeId && (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500"
          >
            <Plus className="h-4 w-4" />
            Nowy folder
          </button>
        )}
      </div>

      {showNew && !activeId && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-slate-100">Nowy folder</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-slate-500">Nazwa</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input-field"
                placeholder="np. Tag „Nowość” — marzec"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Cel</span>
              <select
                value={newIntent}
                onChange={(e) => setNewIntent(e.target.value as CollectionIntent)}
                className="input-field"
              >
                {(Object.keys(COLLECTION_INTENT_LABELS) as CollectionIntent[]).map((k) => (
                  <option key={k} value={k}>
                    {COLLECTION_INTENT_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-slate-500">Notatka (np. tagi Shoper)</span>
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="input-field"
                placeholder="np. tag: promo-wiosna, widoczność: tak"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white"
            >
              Utwórz
            </button>
          </div>
        </div>
      )}

      {collections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-600 py-16 text-center">
          <FolderOpen className="mx-auto h-12 w-12 text-slate-500" />
          <p className="mt-3 text-slate-300">Brak folderów</p>
          <p className="mt-1 text-sm text-slate-500">
            W katalogu użyj ikony folderu na karcie produktu.
          </p>
        </div>
      ) : !activeId ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setActiveId(c.id)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 text-left transition hover:border-brand-500/50 hover:bg-slate-800/80"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
                  <FolderOpen className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-100">{c.name}</span>
                  <span className="block text-xs text-slate-500">
                    {COLLECTION_INTENT_LABELS[c.intent]} · {c.productIds.length} produktów
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        active && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={leaveFolder}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
                Foldery
              </button>
              <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-100">
                {active.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingMeta((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm ${
                  editingMeta
                    ? 'border-brand-500/50 bg-brand-500/15 text-brand-300'
                    : 'border-slate-600 text-slate-200 hover:bg-slate-800'
                }`}
                title="Edytuj folder"
              >
                <Pencil className="h-4 w-4" />
                Edytuj
              </button>
              <button
                type="button"
                disabled={activeProducts.length === 0}
                onClick={() => void copySkus(activeProducts)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 disabled:opacity-40"
              >
                <Copy className="h-3.5 w-3.5" />
                SKU
              </button>
              <button
                type="button"
                disabled={activeProducts.length === 0}
                onClick={() => exportProductsCsv(activeProducts, active.name.slice(0, 40))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`Usunąć folder „${active.name}”?`)) return;
                  void deleteCollection(userKey, active.id)
                    .then(() => {
                      refresh();
                      leaveFolder();
                    })
                    .catch(() => showToast('Nie udało się usunąć folderu', 'error'));
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-400 hover:bg-red-950/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Usuń
              </button>
            </div>

            {editingMeta && (
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Nazwa folderu
                    </span>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field text-sm font-medium"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Cel
                    </span>
                    <select
                      value={editIntent}
                      onChange={(e) => setEditIntent(e.target.value as CollectionIntent)}
                      className="input-field text-sm"
                    >
                      {(Object.keys(COLLECTION_INTENT_LABELS) as CollectionIntent[]).map((k) => (
                        <option key={k} value={k}>
                          {COLLECTION_INTENT_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Notatka
                    </span>
                    <input
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="input-field text-sm"
                      placeholder="Tagi, link do Base, termin…"
                    />
                  </label>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditName(active.name);
                      setEditIntent(active.intent);
                      setEditNote(active.note || '');
                      setEditingMeta(false);
                    }}
                    className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300"
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    onClick={saveFolderMeta}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    <Check className="h-4 w-4" />
                    Zapisz
                  </button>
                </div>
              </div>
            )}

            {!editingMeta && active.note && (
              <p className="text-sm text-slate-400">
                <span className="text-slate-500">{COLLECTION_INTENT_LABELS[active.intent]} · </span>
                {active.note}
              </p>
            )}

            {activeProducts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-600 py-12 text-center text-sm text-slate-500">
                Pusty folder — dodaj produkty z katalogu (ikona folderu na karcie).
              </p>
            ) : (
              <ProductGrid
                products={activeProducts}
                resetKey={active.id}
                className="grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                renderItem={(p) => (
                  <div className="relative">
                    <ProductCard
                      product={p}
                      onClick={() => onOpenProduct(p)}
                      hideImages={hideImages}
                      showPrices={showPrices}
                    />
                    <button
                      type="button"
                      title="Usuń z folderu"
                      onClick={() => {
                        void removeProductFromCollection(userKey, active.id, p.id).then(refresh);
                      }}
                      className="absolute right-2 top-2 rounded-lg bg-slate-950/90 p-1.5 text-slate-300 shadow hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              />
            )}
          </div>
        )
      )}
    </div>
  );
}
