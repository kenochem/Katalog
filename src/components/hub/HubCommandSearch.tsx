import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { HubView } from '../../app/hubNavigation';
import { dispatchHubNavigate } from '../../app/hubNavigation';
import { dispatchAppView } from '../../suite/hubViewMap';
import type { View } from '../../types';

interface HubCommandItem {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function HubCommandSearch({
  open,
  onOpenChange,
  canCrm,
  canOps,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canCrm: boolean;
  canOps: boolean;
}) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const items = useMemo(() => {
    const list: HubCommandItem[] = [
      { id: 'workspace', label: 'Pulpit', run: () => go('workspace') },
      { id: 'catalog', label: 'Katalog produktów', run: () => go('catalog') },
      { id: 'favorites', label: 'Ulubione', run: () => go('favorites') },
      { id: 'warehouse', label: 'Magazyn', run: () => go('warehouse') },
    ];
    if (canCrm) {
      list.push({ id: 'crm', label: 'CRM — handel', run: () => go('crm') });
    }
    if (canOps) {
      list.push({ id: 'ops', label: 'Operacje / finanse', run: () => go('ops') });
      list.push({ id: 'finance', label: 'Finanse — skróty', run: () => go('finance') });
    }
    if (canCrm) {
      list.push({ id: 'orders', label: 'Zamówienia CRM', run: () => go('orders') });
    }
    list.push(
      { id: 'guide', label: 'Baza wiedzy', run: () => go('guide') },
      { id: 'labels', label: 'Etykiety półek', run: () => app('labels') },
      { id: 'progress', label: 'Postęp zdjęć', run: () => app('progress') },
      { id: 'missing', label: 'Produkty bez zdjęć', run: () => app('missing-images') },
      { id: 'comms', label: 'Talk — czat', run: () => go('comms') },
      { id: 'admin', label: 'Panel admin', run: () => go('admin') },
    );
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (i) =>
        i.label.toLowerCase().includes(needle) ||
        i.id.toLowerCase().includes(needle),
    );
  }, [q, canCrm, canOps]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 pt-[max(1rem,env(safe-area-inset-top))] supports-[backdrop-filter]:backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-label="Szybkie przejście"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj sekcji…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="hub-header-btn hub-header-btn--icon inline-flex"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="max-h-[min(60vh,24rem)] overflow-y-auto p-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  item.run();
                  onOpenChange(false);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-500">Brak wyników</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function go(view: HubView) {
  dispatchHubNavigate(view);
}

function app(view: View) {
  dispatchHubNavigate('catalog');
  dispatchAppView(view);
}

export function useHubCommandPaletteHotkey(onOpen: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen]);
}
