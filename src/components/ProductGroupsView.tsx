import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ImageOff, Loader2, Pencil, Search, Wrench, X } from 'lucide-react';
import type { Product } from '../types';
import { getProductImage } from '../lib/products';
import {
  MATERIAL_LABEL,
  TECH_SUBTYPES,
  TECH_TYPES,
  TECH_TYPE_PLURAL,
  subtypeLabel,
  threadKey,
  type Material,
  type TechType,
} from '../lib/techParser';
import {
  buildTechEntries,
  isTechTableMissing,
  saveTechRecords,
  useTechVersion,
  type TechEntry,
} from '../lib/techStore';
import { confirmDialog } from '../lib/dialog';
import { TechTypeIcon } from './TechTypeIcon';
import { EntryEditor } from './TechEditor';
import { showToast } from '../lib/toast';

const PAGE = 120;

interface Props {
  products: Product[];
  canEdit: boolean;
  who: string;
  hideImages?: boolean;
  onOpenProduct: (p: Product) => void;
}

function numericCompare(a: string, b: string): number {
  return a.localeCompare(b, 'pl', { numeric: true, sensitivity: 'base' });
}

/** „Grupy produktów”: elementy techniczne pogrupowane po typie, z filtrami parametrów i zatwierdzaniem opisów. */
export function ProductGroupsView({ products, canEdit, who, hideImages, onOpenProduct }: Props) {
  const ver = useTechVersion();
  const entries = useMemo(() => buildTechEntries(products), [products, ver]);
  const [tab, setTab] = useState<'groups' | 'review'>('groups');
  const [editing, setEditing] = useState<TechEntry | null>(null);

  const proposed = useMemo(() => entries.filter((e) => e.state === 'proposed'), [entries]);

  return (
    <section className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-50">
            <Wrench className="h-5 w-5" /> Grupy produktów
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Elementy techniczne (nyple, trójniki, kolanka, redukcje, dysze) uporządkowane po typie i parametrach. Nazwy z
            WAPRO zostają bez zmian — wyszukiwarka znajdzie produkt także po nazwie waprowej.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-700 p-1 text-sm">
          <TabBtn active={tab === 'groups'} onClick={() => setTab('groups')}>
            Grupy
          </TabBtn>
          {canEdit && (
            <TabBtn active={tab === 'review'} onClick={() => setTab('review')}>
              Do zatwierdzenia ({proposed.length})
            </TabBtn>
          )}
        </div>
      </div>

      {isTechTableMissing() && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Brak tabeli product_tech w bazie — uruchom migration-product-tech.sql w Supabase. Do tego czasu widać tylko
          propozycje z nazw i nie da się ich zatwierdzać.
        </p>
      )}

      {tab === 'groups' || !canEdit ? (
        <GroupsTab
          entries={entries}
          canEdit={canEdit}
          hideImages={hideImages}
          onOpenProduct={onOpenProduct}
          onEdit={setEditing}
        />
      ) : (
        <ReviewTab proposed={proposed} who={who} hideImages={hideImages} onEdit={setEditing} />
      )}

      {editing && <EntryEditor entry={editing} who={who} onClose={() => setEditing(null)} />}
    </section>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 font-medium ${
        active ? 'bg-slate-700 text-slate-50' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function Thumb({ product, hide, type }: { product: Product; hide?: boolean; type?: TechType }) {
  const url = hide ? null : getProductImage(product);
  return url ? (
    <img src={url} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain" />
  ) : (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-600 text-slate-500"
      title="Brak zdjęcia"
    >
      {type ? <TechTypeIcon type={type} className="h-6 w-6" /> : <ImageOff className="h-4 w-4" />}
    </span>
  );
}

// =============================================================================================
// Zakładka „Grupy”
// =============================================================================================

function GroupsTab({
  entries,
  canEdit,
  hideImages,
  onOpenProduct,
  onEdit,
}: {
  entries: TechEntry[];
  canEdit: boolean;
  hideImages?: boolean;
  onOpenProduct: (p: Product) => void;
  onEdit: (e: TechEntry) => void;
}) {
  const [type, setType] = useState<TechType>('nypel');
  const [subtype, setSubtype] = useState('');
  const [material, setMaterial] = useState('');
  const [system, setSystem] = useState('');
  const [end1, setEnd1] = useState('');
  const [end2, setEnd2] = useState('');
  const [threaded, setThreaded] = useState('');
  const [noPhoto, setNoPhoto] = useState(false);
  const [onlyApproved, setOnlyApproved] = useState(false);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const counts = useMemo(() => {
    const out = new Map<TechType, { total: number; noPhoto: number; proposed: number }>();
    for (const t of TECH_TYPES) out.set(t.id, { total: 0, noPhoto: 0, proposed: 0 });
    for (const e of entries) {
      const c = out.get(e.type)!;
      c.total++;
      if (!e.product.hasImage) c.noPhoto++;
      if (e.state === 'proposed') c.proposed++;
    }
    return out;
  }, [entries]);

  const ofType = useMemo(() => entries.filter((e) => e.type === type), [entries, type]);

  const endOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of ofType) for (const t of e.attrs.ends) set.add(threadKey(t));
    return [...set].sort(numericCompare);
  }, [ofType]);

  const materials = useMemo(() => {
    const set = new Set<string>();
    for (const e of ofType) if (e.attrs.material) set.add(e.attrs.material);
    return [...set] as Material[];
  }, [ofType]);

  const systems = useMemo(() => {
    const set = new Set<string>();
    for (const e of ofType) if (e.attrs.system) set.add(e.attrs.system);
    return [...set].sort();
  }, [ofType]);

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return ofType
      .filter((e) => {
        if (onlyApproved && e.state !== 'approved') return false;
        if (subtype && e.subtype !== subtype) return false;
        if (material && e.attrs.material !== material) return false;
        if (system && e.attrs.system !== system) return false;
        if (noPhoto && e.product.hasImage) return false;
        if (threaded === 'yes' && !(e.attrs.ends.length > 0)) return false;
        if (threaded === 'no' && e.attrs.ends.length > 0) return false;
        if (end1 || end2) {
          const keys = e.attrs.ends.map(threadKey);
          for (const k of [end1, end2]) {
            if (!k) continue;
            const i = keys.indexOf(k);
            if (i < 0) return false;
            keys.splice(i, 1); // ten sam gwint na obu końcach wymaga dwóch końcówek
          }
        }
        if (words.length) {
          const hay = `${e.product.sku} ${e.product.name} ${e.displayName} ${e.aliases.join(' ')}`.toLowerCase();
          if (!words.every((w) => hay.includes(w))) return false;
        }
        return true;
      })
      .sort((a, b) => numericCompare(a.displayName, b.displayName) || numericCompare(a.product.sku, b.product.sku));
  }, [ofType, onlyApproved, subtype, material, system, noPhoto, threaded, end1, end2, q]);

  const noPhotoCount = filtered.filter((e) => !e.product.hasImage).length;
  const visible = filtered.slice(0, limit);

  const sel =
    'rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-500';

  function pickType(t: TechType) {
    setType(t);
    setSubtype('');
    setMaterial('');
    setSystem('');
    setEnd1('');
    setEnd2('');
    setThreaded('');
    setLimit(PAGE);
  }

  return (
    <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
      {/* typy */}
      <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
        {TECH_TYPES.map((t) => {
          const c = counts.get(t.id)!;
          const active = t.id === type;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => pickType(t.id)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left ${
                active ? 'border-slate-400 bg-slate-800' : 'border-slate-800 bg-slate-900/50 hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-100">
                <TechTypeIcon type={t.id} className={`h-6 w-6 shrink-0 ${active ? 'text-slate-50' : 'text-slate-400'}`} />
                <span className="flex-1">{t.labelPlural}</span>
                <span className="text-xs font-normal text-slate-400">{c.total}</span>
              </span>
              <span className="mt-0.5 block pl-[34px] text-[11px] text-slate-500">
                {c.noPhoto > 0 ? `${c.noPhoto} bez zdjęcia` : 'wszystkie ze zdjęciem'}
                {c.proposed > 0 ? ` · ${c.proposed} propozycji` : ''}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 space-y-3">
        {/* filtry */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
          <div className="relative min-w-[10rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
              placeholder="Szukaj: nazwa, kod, gwint…"
              className={`${sel} w-full pl-8`}
            />
          </div>
          <select className={sel} value={subtype} onChange={(e) => setSubtype(e.target.value)}>
            <option value="">Wszystkie podtypy</option>
            {TECH_SUBTYPES[type].map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {materials.length > 0 && (
            <select className={sel} value={material} onChange={(e) => setMaterial(e.target.value)}>
              <option value="">Każdy materiał</option>
              {materials.map((m) => (
                <option key={m} value={m}>
                  {MATERIAL_LABEL[m]}
                </option>
              ))}
            </select>
          )}
          {systems.length > 0 && (
            <select className={sel} value={system} onChange={(e) => setSystem(e.target.value)}>
              <option value="">Każdy system / marka</option>
              {systems.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          {endOptions.length > 0 && (
            <>
              <select className={sel} value={end1} onChange={(e) => setEnd1(e.target.value)} title="Gwint na jednym z końców">
                <option value="">{type === 'dysza' ? 'Gwint' : 'Końcówka 1'}</option>
                {endOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              {type !== 'dysza' && (
                <select className={sel} value={end2} onChange={(e) => setEnd2(e.target.value)} title="Gwint na drugim końcu">
                  <option value="">Końcówka 2</option>
                  {endOptions.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
          {type === 'dysza' && (
            <select className={sel} value={threaded} onChange={(e) => setThreaded(e.target.value)}>
              <option value="">Z gwintem i bez</option>
              <option value="yes">Z gwintem</option>
              <option value="no">Bez gwintu</option>
            </select>
          )}
          <label className="flex items-center gap-1.5 text-sm text-slate-300">
            <input type="checkbox" checked={noPhoto} onChange={(e) => setNoPhoto(e.target.checked)} />
            Bez zdjęcia
          </label>
          <label className="flex items-center gap-1.5 text-sm text-slate-300">
            <input type="checkbox" checked={onlyApproved} onChange={(e) => setOnlyApproved(e.target.checked)} />
            Tylko zatwierdzone
          </label>
        </div>

        <p className="text-xs text-slate-400">
          <TechTypeIcon type={type} className="mr-1.5 inline h-4 w-4 align-text-bottom" />
          {TECH_TYPE_PLURAL[type]}: <b className="text-slate-200">{filtered.length}</b> pozycji
          {noPhotoCount > 0 && (
            <>
              {' '}
              · <span className="text-amber-300">{noPhotoCount} bez zdjęcia</span>
            </>
          )}
          {(end1 || end2) && ' · filtr gwintów łączy dowolną kolejność końców'}
        </p>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
            Brak pozycji dla tych filtrów.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
            {visible.map((e) => (
              <li key={e.product.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800/40">
                <button
                  type="button"
                  onClick={() => onOpenProduct(e.product)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Thumb product={e.product} hide={hideImages} type={e.type} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">{e.displayName}</span>
                      {e.state === 'proposed' && (
                        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-300">
                          propozycja
                        </span>
                      )}
                      {e.subtype && type !== 'nypel' && (
                        <span className="text-[11px] text-slate-500">{subtypeLabel(type, e.subtype)}</span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      WAPRO: {e.product.name} · <span className="font-mono">{e.product.sku}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-slate-400">
                    <span className="block">{e.product.stock} szt.</span>
                    {!e.product.hasImage && <span className="text-amber-300">brak zdjęcia</span>}
                  </span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(e)}
                    className="shrink-0 rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
                    title="Edytuj opis techniczny"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {filtered.length > visible.length && (
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="w-full rounded-xl border border-slate-700 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Pokaż więcej ({filtered.length - visible.length})
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================================
// Zakładka „Do zatwierdzenia”
// =============================================================================================

function ReviewTab({
  proposed,
  who,
  hideImages,
  onEdit,
}: {
  proposed: TechEntry[];
  who: string;
  hideImages?: boolean;
  onEdit: (e: TechEntry) => void;
}) {
  const [conf, setConf] = useState<'review' | 'ok' | 'all'>('review');
  const [type, setType] = useState<'all' | TechType>('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return proposed
      .filter((e) => (conf === 'all' ? true : e.confidence === conf))
      .filter((e) => type === 'all' || e.type === type)
      .filter((e) => {
        if (!words.length) return true;
        const hay = `${e.product.sku} ${e.product.name} ${e.displayName}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => numericCompare(a.product.name, b.product.name));
  }, [proposed, conf, type, q]);

  const okCount = proposed.filter((e) => e.confidence === 'ok').length;
  const visible = list.slice(0, limit);

  async function approve(items: TechEntry[], label: string) {
    if (items.length === 0) return;
    if (
      items.length > 1 &&
      !(await confirmDialog({
        title: 'Zatwierdzić opisy techniczne?',
        message: `${label}: ${items.length} pozycji. Nazwy w WAPRO się nie zmieniają.`,
        confirmLabel: 'Zatwierdź',
      }))
    )
      return;
    setBusy(true);
    try {
      await saveTechRecords(
        items.map((e) => ({
          sku: e.product.sku,
          type: e.type,
          subtype: e.subtype,
          attrs: e.attrs,
          displayName: e.displayName,
        })),
        who,
      );
      setSelected(new Set());
      showToast(`Zatwierdzono: ${items.length}`, 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać', 'error', 8000);
    } finally {
      setBusy(false);
    }
  }

  async function reject(e: TechEntry) {
    if (
      !(await confirmDialog({
        title: 'To nie jest element techniczny?',
        message: `„${e.product.name}” zostanie wyłączony z tej listy (nazwa w WAPRO bez zmian).`,
        confirmLabel: 'Wyłącz',
      }))
    )
      return;
    try {
      await saveTechRecords(
        [{ sku: e.product.sku, type: e.type, subtype: e.subtype, attrs: e.attrs, status: 'rejected' }],
        who,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać', 'error', 8000);
    }
  }

  const sel = 'rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100';
  const picked = list.filter((e) => selected.has(e.product.sku));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
        <select className={sel} value={conf} onChange={(e) => setConf(e.target.value as typeof conf)}>
          <option value="review">Do sprawdzenia ({proposed.length - okCount})</option>
          <option value="ok">Pewne ({okCount})</option>
          <option value="all">Wszystkie ({proposed.length})</option>
        </select>
        <select className={sel} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="all">Wszystkie typy</option>
          {TECH_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.labelPlural}
            </option>
          ))}
        </select>
        <div className="relative min-w-[10rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj…"
            className={`${sel} w-full pl-8`}
          />
        </div>
        <button
          type="button"
          disabled={busy || picked.length === 0}
          onClick={() => void approve(picked, 'Zaznaczone')}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Zatwierdź zaznaczone ({picked.length})
        </button>
        <button
          type="button"
          disabled={busy || okCount === 0}
          onClick={() =>
            void approve(
              proposed.filter((e) => e.confidence === 'ok' && (type === 'all' || e.type === type)),
              'Wszystkie pewne',
            )
          }
          className="rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-600/10 disabled:opacity-40"
        >
          Zatwierdź wszystkie pewne
        </button>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
          Nic do zatwierdzenia w tym widoku.
        </p>
      ) : (
        <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
          <li className="flex items-center gap-3 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={visible.length > 0 && visible.every((e) => selected.has(e.product.sku))}
              onChange={(ev) =>
                setSelected((s) => {
                  const n = new Set(s);
                  for (const e of visible) ev.target.checked ? n.add(e.product.sku) : n.delete(e.product.sku);
                  return n;
                })
              }
            />
            Zaznacz widoczne
          </li>
          {visible.map((e) => (
            <li key={e.product.id} className="flex items-start gap-3 px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-3"
                checked={selected.has(e.product.sku)}
                onChange={(ev) =>
                  setSelected((s) => {
                    const n = new Set(s);
                    ev.target.checked ? n.add(e.product.sku) : n.delete(e.product.sku);
                    return n;
                  })
                }
              />
              <Thumb product={e.product} hide={hideImages} type={e.type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-slate-400">
                  WAPRO: {e.product.name} · <span className="font-mono">{e.product.sku}</span>
                </p>
                <p className="text-sm font-semibold text-slate-100">
                  → {e.displayName}{' '}
                  <span className="text-[11px] font-normal text-slate-500">
                    {TECH_TYPE_PLURAL[e.type]} / {subtypeLabel(e.type, e.subtype)}
                  </span>
                </p>
                {e.reasons.length > 0 && (
                  <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-amber-300">
                    <AlertTriangle className="h-3 w-3" />
                    {e.reasons.join(' · ')}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void approve([e], 'Pozycja')}
                  className="rounded-lg border border-emerald-600 p-1.5 text-emerald-300 hover:bg-emerald-600/10"
                  title="Zatwierdź"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(e)}
                  className="rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
                  title="Popraw i zatwierdź"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void reject(e)}
                  className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800"
                  title="To nie jest element techniczny"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.length > visible.length && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="w-full rounded-xl border border-slate-700 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Pokaż więcej ({list.length - visible.length})
        </button>
      )}
    </div>
  );
}
