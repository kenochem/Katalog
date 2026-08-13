import { FolderPlus, Plus } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Product } from '../types';
import {
  addProductToCollection,
  createCollection,
  loadCollections,
} from '../lib/productCollections';
import { showToast } from '../lib/toast';

interface AddToCollectionMenuProps {
  userKey: string;
  product: Product;
  onChanged?: () => void;
  /** Ikona na karcie vs kafel w podglądzie produktu. */
  layout?: 'icon' | 'tile';
}

export function AddToCollectionMenu({
  userKey,
  product,
  onChanged,
  layout = 'icon',
}: AddToCollectionMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [collections, setCollections] = useState(() => loadCollections(userKey));

  const MENU_W = 224;

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const margin = 8;
    let left = r.left;
    let top = r.bottom + 4;
    left = Math.max(margin, Math.min(left, window.innerWidth - MENU_W - margin));
    const menuH = menuRef.current?.offsetHeight ?? 280;
    if (top + menuH > window.innerHeight - margin) {
      top = Math.max(margin, r.top - menuH - 4);
    }
    setMenuPos({ top, left });
  }, [open, collections.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function reload() {
    setCollections(loadCollections(userKey));
    onChanged?.();
  }

  async function quickCreate() {
    const name = window.prompt('Nazwa nowego folderu:');
    if (!name?.trim()) return;
    try {
      const col = await createCollection(userKey, { name: name.trim(), intent: 'shop-tags' });
      await addProductToCollection(userKey, col.id, product.id);
      reload();
      showToast(`Dodano do „${col.name}”`, 'ok');
      setOpen(false);
    } catch {
      showToast('Nie udało się dodać do folderu', 'error');
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Dodaj do folderu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          setCollections(loadCollections(userKey));
        }}
        className={
          layout === 'tile'
            ? 'flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 py-2.5 text-sm font-medium text-slate-200 transition hover:border-brand-500/40 hover:bg-slate-800'
            : 'rounded-md bg-slate-950/85 p-1 text-slate-200 shadow ring-1 ring-white/10 hover:bg-brand-600 hover:text-white'
        }
      >
        <FolderPlus className={layout === 'tile' ? 'h-4 w-4 shrink-0' : 'h-3.5 w-3.5'} />
        {layout === 'tile' ? 'Do folderu' : null}
      </button>
      {open &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[200]"
              aria-label="Zamknij"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            />
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-[201] w-56 max-h-[min(320px,70vh)] overflow-y-auto rounded-xl border border-slate-600 bg-slate-900 py-1 shadow-2xl ring-1 ring-black/40"
              style={{ top: menuPos.top, left: menuPos.left }}
              onClick={(e) => e.stopPropagation()}
            >
              {collections.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-500">Brak folderów</p>
              ) : (
                collections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      void addProductToCollection(userKey, c.id, product.id)
                        .then(() => {
                          reload();
                          showToast(`Dodano do „${c.name}”`, 'ok');
                          setOpen(false);
                        })
                        .catch(() => showToast('Nie udało się dodać', 'error'));
                    }}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="shrink-0 text-[10px] text-slate-500">{c.productIds.length}</span>
                  </button>
                ))
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => void quickCreate()}
                className="flex w-full items-center gap-2 border-t border-slate-800 px-3 py-2 text-sm text-brand-300 hover:bg-slate-800"
              >
                <Plus className="h-4 w-4 shrink-0" />
                Nowy folder…
              </button>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
