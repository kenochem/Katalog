import { Loader2, Plus, Save, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../../types';
import { runBulkEdit } from '../../lib/bulkEdit';
import { confirmDialog } from '../../lib/dialog';
import {
  cleanSupplierName,
  EMPTY_SUPPLIER_PROFILE,
  getSupplierEntry,
  getSupplierRegistry,
  loadSupplierRegistry,
  registerSuppliers,
  removeSupplier,
  saveSupplierProfile,
  supplierKey,
  supplierTableMissing,
  useSupplierRegistry,
  type SupplierProfile,
} from '../../lib/supplierRegistry';
import { effectiveSupplier, supplierBrands, supplierOverview, supplierStats, SUPPLIER_FROM_MANUFACTURER } from '../../lib/suppliers';
import { showToast } from '../../lib/toast';
import { effectiveManufacturer } from '../../lib/waproManufacturers';
import { Bar, btn, btnPrimary, card, field, FilterBar, FilterField, inner, Pill, SectionHead, Stat, toneBox } from './ui';

type Sort = 'count' | 'name';
type Show = 'all' | 'registered' | 'unregistered' | 'distributors';

const pl = (n: number) => n.toLocaleString('pl-PL');
const PLACEHOLDER_MAKER = /^(wapro|inne)$/i;

interface Entry {
  name: string;
  count: number;
  sameAsManufacturer: number;
  noManufacturer: number;
  registered: boolean;
}

/**
 * Dostawcy: od kogo mamy towar. Dostawca wynika z WAPRO (docelowo osobne pole produktu) i bywa inny niż producent —
 * np. MERSA jest dystrybutorem wielu marek. Tu widać, jak się pokrywają, i prowadzi się profil każdego dostawcy.
 */
export function SuppliersTab({ products, canEdit, onPatched }: { products: Product[]; canEdit: boolean; onPatched: (patches: { id: string; patch: Partial<Product> }[]) => void }) {
  const registryVersion = useSupplierRegistry();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('count');
  const [show, setShow] = useState<Show>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<SupplierProfile>(EMPTY_SUPPLIER_PROFILE);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadSupplierRegistry();
  }, []);

  const singles = useMemo(() => products.filter((p) => !p.isGroup), [products]);
  const stats = useMemo(() => supplierStats(products, effectiveManufacturer), [products]);
  const overview = useMemo(() => supplierOverview(products, effectiveManufacturer), [products]);

  const entries = useMemo<Entry[]>(() => {
    const reg = getSupplierRegistry();
    const removed = new Set(reg.filter((r) => r.removed).map((r) => supplierKey(r.name)));
    const registered = new Set(reg.filter((r) => !r.removed).map((r) => supplierKey(r.name)));
    const map = new Map<string, Entry>();
    for (const s of stats) {
      const k = supplierKey(s.name);
      if (removed.has(k) && s.count === 0) continue;
      map.set(k, { name: s.name, count: s.count, sameAsManufacturer: s.sameAsManufacturer, noManufacturer: s.noManufacturer, registered: registered.has(k) });
    }
    for (const r of reg) {
      const k = supplierKey(r.name);
      if (!r.removed && !map.has(k)) map.set(k, { name: r.name, count: 0, sameAsManufacturer: 0, noManufacturer: 0, registered: true });
    }
    return [...map.values()];
  }, [stats, registryVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    const rows = entries.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false;
      if (show === 'registered' && !e.registered) return false;
      if (show === 'unregistered' && e.registered) return false;
      if (show === 'distributors' && !(e.count >= 5 && e.sameAsManufacturer / e.count < 0.5)) return false;
      return true;
    });
    return rows.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, 'pl') : b.count - a.count));
  }, [entries, q, show, sort]);

  const maxCount = Math.max(1, ...entries.map((e) => e.count));
  const current = selected ? entries.find((e) => supplierKey(e.name) === supplierKey(selected)) ?? null : null;
  const brands = useMemo(() => (current ? supplierBrands(products, current.name, effectiveManufacturer) : []), [products, current]);

  useEffect(() => {
    if (!current) return;
    const entry = getSupplierEntry(current.name);
    setDraft(entry ? { ...EMPTY_SUPPLIER_PROFILE, ...entry } : EMPTY_SUPPLIER_PROFILE);
  }, [current?.name, registryVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const unregistered = entries.filter((e) => !e.registered).length;
  const fromMaker = useMemo(() => singles.filter((p) => !effectiveSupplier(p) && (p.manufacturer ?? '').trim() && !PLACEHOLDER_MAKER.test(p.manufacturer.trim())), [singles]);
  const noSupplierPct = overview.products ? Math.round((100 * overview.withoutSupplier) / overview.products) : 0;
  const sharePct = overview.withSupplier ? Math.round((100 * overview.sameAsManufacturer) / overview.withSupplier) : 0;

  async function guard(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać', 'error', 8000);
    } finally {
      setBusy(false);
    }
  }

  const importFromProducts = () =>
    guard(async () => {
      const added = await registerSuppliers(entries.filter((e) => !e.registered).map((e) => e.name), 'produkty');
      showToast(added ? `Dodano do rejestru: ${added} dostawców` : 'Wszyscy dostawcy są już w rejestrze', added ? 'ok' : 'info');
    });

  const addNew = () =>
    guard(async () => {
      const name = cleanSupplierName(newName);
      if (!name) return;
      await registerSuppliers([name], 'manual');
      setNewName('');
      setSelected(name);
    });

  const backfill = async () => {
    if (!fromMaker.length) return;
    const ok = await confirmDialog({
      title: 'Utworzenie dostawców',
      message: `W WAPRO grupa produktu to dostawca, więc dziś pole „producent” często zawiera dostawcę. Zapisać je także jako dostawcę w ${fromMaker.length} produktach? Producenta nie zmieniam — poprawisz go osobno. Da się cofnąć w Logi → Operacje masowe.`,
      confirmLabel: 'Utwórz dostawców',
      tone: 'warn',
    });
    if (!ok) return;
    await guard(async () => {
      const res = await runBulkEdit(
        fromMaker.map((p) => p.id),
        { supplier: SUPPLIER_FROM_MANUFACTURER },
        'Utworzenie dostawców z producentów',
      );
      onPatched(res.patches);
      showToast(`Zapisano dostawców: ${res.updated}${res.failed.length ? `, błędy: ${res.failed.length}` : ''}`, res.failed.length ? 'warn' : 'ok', 6000);
    });
  };

  const save = () =>
    current &&
    guard(async () => {
      await saveSupplierProfile(current.name, draft);
      showToast('Zapisano profil dostawcy', 'ok');
    });

  const hide = async () => {
    if (!current) return;
    const ok = await confirmDialog({ title: 'Ukryj dostawcę', message: `„${current.name}” zniknie z rejestru. Produkty zachowają wpis w polu dostawcy.`, confirmLabel: 'Ukryj', tone: 'warn' });
    if (!ok) return;
    await guard(async () => {
      await removeSupplier(current.name);
      setSelected(null);
    });
  };

  const text = (key: keyof SupplierProfile, label: string, type = 'text') => (
    <FilterField label={label}>
      <input
        type={type}
        className={`${field} w-full normal-case`}
        disabled={!canEdit}
        value={draft[key] ?? ''}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value }))}
      />
    </FilterField>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Dostawców" value={pl(entries.length)} hint="Różne nazwy w polu dostawcy produktów i w rejestrze" />
        <Stat label="Produkty z dostawcą" value={pl(overview.withSupplier)} tone="ok" />
        <Stat label="Bez dostawcy" value={`${pl(overview.withoutSupplier)} (${noSupplierPct}%)`} tone={overview.withoutSupplier ? 'warn' : undefined} />
        <Stat label="Dostawca = producent" value={`${sharePct}%`} hint="Odsetek produktów, w których dostawca i producent to ta sama firma" />
        <Stat label="Dystrybutorzy" value={pl(overview.distributors)} hint="Dostawcy z wieloma markami (min. 5 produktów, mniej niż połowa pod własną marką)" />
      </div>

      {supplierTableMissing() && (
        <div className={`rounded-2xl border p-4 text-[13px] ${toneBox.info}`}>
          <p className="font-semibold text-slate-900 dark:text-slate-50">Rejestr dostawców czeka na migrację</p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Lista poniżej powstaje z pola dostawcy w produktach. Aby zapisywać profile (kontakt, NIP, czas dostawy), uruchom w Supabase (SQL Editor) plik <span className="font-mono">supabase/migration-catalog-suppliers.sql</span>.
          </p>
        </div>
      )}

      <section className={`${card} space-y-3`}>
        <SectionHead
          title="Dostawcy"
          hint="Dostawca to źródło towaru z WAPRO; producent to marka na opakowaniu. Często są tym samym, ale nie zawsze."
          actions={
            canEdit && (
              <>
                {fromMaker.length > 0 && (
                  <button type="button" className={btn} disabled={busy} onClick={() => void backfill()} title="Przepisuje obecnego producenta do pola dostawcy tam, gdzie dostawca jest pusty">
                    <Truck className="h-4 w-4" /> Utwórz dostawców z producentów ({pl(fromMaker.length)})
                  </button>
                )}
                {unregistered > 0 && (
                  <button type="button" className={btn} disabled={busy || supplierTableMissing()} onClick={() => void importFromProducts()}>
                    Dodaj do rejestru ({pl(unregistered)})
                  </button>
                )}
              </>
            )
          }
        />
        <FilterBar
          query={query}
          onQuery={setQuery}
          placeholder="Szukaj dostawcy…"
          activeFilters={(show !== 'all' ? 1 : 0) + (sort !== 'count' ? 1 : 0)}
          onReset={() => {
            setShow('all');
            setSort('count');
          }}
          extra={
            <>
              <FilterField label="Pokaż">
                <select className={field} value={show} onChange={(e) => setShow(e.target.value as Show)}>
                  <option value="all">Wszystkich</option>
                  <option value="registered">Z profilem w rejestrze</option>
                  <option value="unregistered">Bez profilu</option>
                  <option value="distributors">Dystrybutorów (wiele marek)</option>
                </select>
              </FilterField>
              <FilterField label="Sortuj">
                <select className={field} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="count">Według liczby produktów</option>
                  <option value="name">Alfabetycznie</option>
                </select>
              </FilterField>
            </>
          }
          actions={
            canEdit && (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addNew();
                }}
              >
                <input className={`${field} w-44`} placeholder="Nowy dostawca…" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <button type="submit" className={btn} disabled={busy || !newName.trim() || supplierTableMissing()}>
                  <Plus className="h-4 w-4" /> Dodaj
                </button>
              </form>
            )
          }
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <ul className="max-h-[34rem] divide-y divide-black/10 overflow-y-auto rounded-2xl border border-black/10 dark:divide-white/10 dark:border-white/10">
            {list.map((e) => {
              const active = current && supplierKey(current.name) === supplierKey(e.name);
              const same = e.count ? Math.round((100 * e.sameAsManufacturer) / e.count) : 0;
              return (
                <li key={supplierKey(e.name)}>
                  <button type="button" onClick={() => setSelected(e.name)} className={`block w-full px-3.5 py-2.5 text-left transition ${active ? 'bg-brand-600/10' : 'hover:bg-black/[0.04] dark:hover:bg-white/5'}`}>
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{e.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">{pl(e.count)} prod.</span>
                    </span>
                    <Bar value={Math.round((100 * e.count) / maxCount)} className="mt-1.5" />
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {e.count > 0 && <Pill tone="neutral">{same >= 80 ? 'własna marka' : same <= 20 ? 'wiele marek' : `${same}% własnej marki`}</Pill>}
                      {!e.registered && <Pill tone="info">bez profilu</Pill>}
                      {e.noManufacturer > 0 && <Pill tone="warn">{e.noManufacturer} bez producenta</Pill>}
                    </span>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">{entries.length ? 'Żaden dostawca nie pasuje do filtrów.' : 'Brak dostawców — produkty nie mają jeszcze pola dostawcy.'}</li>}
          </ul>

          <div>
            {!current ? (
              <div className={`${inner} flex h-full min-h-[10rem] items-center justify-center p-6 text-center text-sm text-slate-500`}>Wybierz dostawcę z listy, aby zobaczyć jego marki i profil.</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-semibold text-slate-950 dark:text-slate-50">{current.name}</h4>
                  <p className="text-xs text-slate-500">
                    {pl(current.count)} produktów · {pl(brands.length)} {brands.length === 1 ? 'marka' : 'marek'}
                  </p>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Marki jego produktów</p>
                  {brands.length === 0 ? (
                    <p className="text-sm text-slate-500">Brak produktów przypisanych do tego dostawcy.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {brands.slice(0, 8).map((b) => (
                        <li key={b.brand} className="text-[13px]">
                          <span className="flex justify-between gap-3">
                            <span className={`truncate ${b.brand.toLowerCase() === current.name.toLowerCase() ? 'font-semibold text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-200'}`}>{b.brand}</span>
                            <span className="tabular-nums text-slate-500">{pl(b.count)}</span>
                          </span>
                          <Bar value={Math.round((100 * b.count) / Math.max(1, current.count))} className="mt-0.5" />
                        </li>
                      ))}
                      {brands.length > 8 && <li className="text-xs text-slate-500">…i {brands.length - 8} innych marek</li>}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Profil dostawcy</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {text('contactPerson', 'Osoba kontaktowa')}
                    {text('phone', 'Telefon')}
                    {text('email', 'E-mail', 'email')}
                    {text('website', 'Strona www')}
                    {text('nip', 'NIP')}
                    {text('waproCode', 'Kod w WAPRO')}
                    {text('leadTimeDays', 'Czas dostawy (dni)', 'number')}
                    {text('minOrderNet', 'Min. zamówienie netto (zł)', 'number')}
                  </div>
                  <label className="mt-3 flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Notatki
                    <textarea className={`${field} w-full normal-case`} rows={3} disabled={!canEdit} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
                  </label>
                </div>

                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btnPrimary} disabled={busy || supplierTableMissing()} onClick={() => void save()}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Zapisz profil
                    </button>
                    {current.registered && (
                      <button type="button" className={btn} disabled={busy} onClick={() => void hide()}>
                        Ukryj na liście
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
