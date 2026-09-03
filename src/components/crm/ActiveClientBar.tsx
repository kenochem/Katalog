import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2, MapPin, Plus, RefreshCw, Search, User, X } from 'lucide-react';
import type { CrmClient } from '../../lib/crm';
import { getClientIcon } from './clientIcons';

interface ActiveClientBarProps {
  clients: CrmClient[];
  activeClient: CrmClient | null;
  onSelect: (client: CrmClient) => void;
  onClear?: () => void;
  openSignal?: number;
  onAddClient?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function ActiveClientBar({
  clients,
  activeClient,
  onSelect,
  onClear,
  openSignal,
  onAddClient,
  onRefresh,
  refreshing,
}: ActiveClientBarProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (openSignal && openSignal > 0) setOpen(true);
  }, [openSignal]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients.slice(0, 40);
    return clients.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        (c.nip || '').includes(q.replace(/\D/g, '')) ||
        (c.legalName || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q),
    );
  }, [clients, query]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
          activeClient
            ? 'border-brand-500/35 bg-brand-500/10 hover:bg-brand-500/15'
            : 'border-dashed border-slate-700 bg-slate-900/60 hover:border-slate-600'
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            activeClient ? 'bg-brand-600/30 text-brand-200' : 'bg-slate-800 text-slate-500'
          }`}
        >
          {activeClient
            ? (() => {
                const Icon = getClientIcon(activeClient.icon);
                return <Icon className="h-5 w-5" />;
              })()
            : <User className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          {activeClient ? (
            <>
              <p className="truncate text-sm font-semibold text-slate-50">
                {activeClient.displayName}
              </p>
              <p className="truncate text-xs text-slate-400">
                {activeClient.nip ? `NIP ${activeClient.nip}` : 'bez NIP'}
                {activeClient.note?.trim() ? ` · ${activeClient.note.trim().slice(0, 40)}` : ''}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-200">Krok 1: wybierz firmę</p>
              <p className="text-xs text-slate-500">Dla kogo składasz to zamówienie?</p>
            </>
          )}
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40"
            aria-label="Zamknij"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
            <div className="space-y-2 border-b border-slate-800 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj: nazwa, NIP, adres…"
                  className="input-field w-full pl-9"
                />
              </div>
              <div className="flex gap-1.5">
                {onAddClient && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onAddClient();
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-500"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Dodaj klienta
                  </button>
                )}
                {onRefresh && (
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    title="Odśwież listę klientów"
                  >
                    {refreshing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
            <ul className="max-h-64 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-slate-500">Brak wyników</li>
              ) : (
                filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(c);
                        setOpen(false);
                        setQuery('');
                      }}
                      className={`group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-slate-800 ${
                        activeClient?.id === c.id ? 'bg-brand-500/10' : ''
                      }`}
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-brand-400 transition-colors group-hover:bg-brand-500/20 group-hover:text-brand-300">
                        {(() => {
                          const Icon = getClientIcon(c.icon);
                          return <Icon className="h-4 w-4" />;
                        })()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {c.displayName}
                        </p>
                        <p className="text-xs text-slate-500">{c.nip || 'bez NIP'}</p>
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>
            {activeClient && onClear && (
              <div className="border-t border-slate-800 p-2">
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                  Usuń przypisanie klienta
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {activeClient?.address && !open && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1">
            <MapPin className="h-3 w-3" />
            {activeClient.address}
          </span>
        </div>
      )}
    </div>
  );
}
