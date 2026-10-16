import {
  Building2,
  Check,
  CloudDownload,
  CloudUpload,
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '../types';
import {
  EMPTY_PROFILE,
  cleanManufacturerName,
  getManufacturerEntry,
  importManufacturersFromBaselinker,
  manufacturerKey,
  registerManufacturers,
  removeManufacturerAndMove,
  renameManufacturer,
  saveManufacturerProfile,
  sendManufacturersToBaselinker,
  uploadManufacturerLogo,
  useManufacturerRegistry,
  type ManufacturerProfile,
} from '../lib/manufacturerRegistry';
import { effectiveManufacturer, isStaticManufacturer, manufacturerOptions } from '../lib/waproManufacturers';
import { confirmDialog } from '../lib/dialog';
import { showToast } from '../lib/toast';

type Sort = 'name' | 'count' | 'incomplete';

interface Row {
  name: string;
  count: number;
  photos: number;
  stock: number;
  noEan: number;
  wapro: boolean;
  manual: boolean;
  blKnown: boolean;
  inBl: boolean | null;
  hasLogo: boolean;
  hasDesc: boolean;
}

function Avatar({ name, logoUrl, size = 40 }: { name: string; logoUrl?: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-white text-xs font-bold text-slate-500"
      style={{ width: size, height: size }}
    >
      {logoUrl ? <img src={logoUrl} alt="" loading="lazy" className="h-full w-full object-contain p-1" /> : initials}
    </span>
  );
}

export function ManufacturersView({
  products,
  onShowProducts,
  canEdit = true,
}: {
  products: Product[];
  onShowProducts: (manufacturer: string) => void;
  /** false = tylko podgląd (brak uprawnienia „Producenci”). */
  canEdit?: boolean;
}) {
  const registryVersion = useManufacturerRegistry();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('name');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [blNames, setBlNames] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; photos: number; stock: number; noEan: number }>();
    for (const p of products) {
      const m = effectiveManufacturer(p);
      if (!m) continue;
      const k = manufacturerKey(m);
      const s = map.get(k) ?? { count: 0, photos: 0, stock: 0, noEan: 0 };
      s.count++;
      if (p.hasImage) s.photos++;
      s.stock += p.stock ?? 0;
      if (!p.ean?.trim()) s.noEan++;
      map.set(k, s);
    }
    return map;
  }, [products]);

  const rows: Row[] = useMemo(() => {
    const names = manufacturerOptions([...products.map((p) => p.manufacturer ?? ''), ...(blNames ? [...blNames] : [])]).filter(
      (n) => n !== 'Inne',
    );
    return names.map((name) => {
      const k = manufacturerKey(name);
      const reg = getManufacturerEntry(name);
      const s = stats.get(k);
      return {
        name,
        count: s?.count ?? 0,
        photos: s?.photos ?? 0,
        stock: s?.stock ?? 0,
        noEan: s?.noEan ?? 0,
        wapro: isStaticManufacturer(name),
        manual: reg?.source === 'manual',
        blKnown: reg?.blId != null || reg?.source === 'baselinker',
        inBl: blNames ? blNames.has(k) : null,
        hasLogo: !!reg?.logoUrl,
        hasDesc: !!reg?.description,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, blNames, stats, registryVersion]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => !q || r.name.toLowerCase().includes(q));
    if (sort === 'count') list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pl'));
    else if (sort === 'incomplete')
      list.sort(
        (a, b) =>
          Number(a.hasLogo) + Number(a.hasDesc) - (Number(b.hasLogo) + Number(b.hasDesc)) ||
          b.count - a.count,
      );
    return list;
  }, [rows, query, sort]);

  const selected = rows.find((r) => r.name === selectedName) ?? null;
  const missingInBl = rows.filter((r) => (r.inBl === null ? !r.blKnown : !r.inBl));

  async function fetchFromBl() {
    setBusy('fetch');
    try {
      const res = await importManufacturersFromBaselinker();
      setBlNames(res.names);
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
      setBlNames((prev) => new Set([...(prev ?? []), ...names.map(manufacturerKey)]));
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
      setSelectedName(name);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się dodać', 'error', 7000);
    } finally {
      setBusy(null);
    }
  }

  const stat = 'rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2';

  return (
    <div className="catalog-readable-light w-full space-y-4 pb-10">
      <section className="surface-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Porządkowanie katalogu</p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-950 dark:text-slate-50">
              <Building2 className="h-5 w-5" /> Producenci
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-700 dark:text-slate-400">
              Profile marek: logo, opis, dane kontaktowe i notatki. Zmiana nazwy poprawia producenta we wszystkich produktach,
              a lista jest wspólna dla katalogu i BaseLinkera.
            </p>
          </div>
          {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void fetchFromBl()}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {busy === 'fetch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
              Pobierz z BaseLinkera
            </button>
            <button
              type="button"
              disabled={busy !== null || blNames === null || missingInBl.length === 0}
              onClick={() => void sendToBl(missingInBl.map((r) => r.name))}
              title={blNames === null ? 'Najpierw pobierz listę z BaseLinkera' : undefined}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <CloudUpload className="h-4 w-4" />
              Wyślij brakujące do BL ({blNames === null ? '?' : missingInBl.length})
            </button>
          </div>
          )}
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_30rem]">
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj producenta…" className="input-field with-icon" />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input-field !w-auto">
              <option value="name">Nazwa A–Z</option>
              <option value="count">Najwięcej produktów</option>
              <option value="incomplete">Najmniej uzupełnieni</option>
            </select>
          </div>
          {canEdit && (
          <div className="flex gap-2">
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Dodaj
            </button>
          </div>
          )}

          <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/30 dark:shadow-none">
            {shown.map((r) => {
              const reg = getManufacturerEntry(r.name);
              const active = r.name === selectedName;
              return (
                <li key={r.name}>
                  <button
                    type="button"
                    onClick={() => setSelectedName(r.name)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/60 ${
                      active ? 'bg-brand-50/70 dark:bg-brand-500/10' : ''
                    }`}
                  >
                    <Avatar name={r.name} logoUrl={reg?.logoUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-950 dark:text-slate-50">{r.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                        {r.wapro && <span className="rounded-full bg-slate-200 px-1.5 py-0.5 font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">WAPRO</span>}
                        {r.manual && <span className="rounded-full bg-violet-100 px-1.5 py-0.5 font-semibold text-violet-800 dark:bg-violet-500/20 dark:text-violet-200">ręczny</span>}
                        {r.inBl === true || (r.inBl === null && r.blKnown) ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                            <Check className="h-3 w-3" /> BL
                          </span>
                        ) : r.inBl === false ? (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-300">brak w BL</span>
                        ) : null}
                        {!r.hasLogo && <span>bez logo</span>}
                        {!r.hasDesc && <span>bez opisu</span>}
                      </span>
                    </span>
                    <span className="text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
                      <strong className="text-sm text-slate-900 dark:text-slate-100">{r.count}</strong> prod.
                    </span>
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-600 dark:text-slate-400">Brak producentów.</li>}
          </ul>
        </section>

        <aside className="lg:sticky lg:top-3">
          {selected ? (
            <ManufacturerDetail
              key={selected.name}
              row={selected}
              busy={busy !== null}
              onShowProducts={() => onShowProducts(selected.name)}
              onSendToBl={() => void sendToBl([selected.name])}
              onRenamed={(n) => setSelectedName(n)}
              onRemoved={() => setSelectedName(null)}
              statClass={stat}
              registryVersion={registryVersion}
              canEdit={canEdit}
            />
          ) : (
            <div className="surface-panel p-6 text-sm text-slate-700 dark:text-slate-400">
              Wybierz producenta z listy, aby zobaczyć i edytować jego profil: logo, opis, dane kontaktowe, notatki, nazwę.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ManufacturerDetail({
  row,
  busy,
  onShowProducts,
  onSendToBl,
  onRenamed,
  onRemoved,
  statClass,
  registryVersion,
  canEdit,
}: {
  row: Row;
  busy: boolean;
  onShowProducts: () => void;
  onSendToBl: () => void;
  onRenamed: (name: string) => void;
  onRemoved: () => void;
  statClass: string;
  registryVersion: number;
  canEdit: boolean;
}) {
  const reg = getManufacturerEntry(row.name);
  const saved: ManufacturerProfile = useMemo(
    () => ({ ...EMPTY_PROFILE, ...(reg ? { ...reg } : {}) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryVersion, row.name],
  );
  const [form, setForm] = useState<ManufacturerProfile>(saved);
  const [name, setName] = useState(row.name);
  const [working, setWorking] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const moveOptions = useMemo(
    () => manufacturerOptions().filter((n) => manufacturerKey(n) !== manufacturerKey(row.name) && n !== 'Inne'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registryVersion, row.name],
  );
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm((prev) => ({ ...prev, logoUrl: saved.logoUrl }));
  }, [saved.logoUrl]);

  const dirty =
    form.description !== saved.description ||
    form.website !== saved.website ||
    form.email !== saved.email ||
    form.phone !== saved.phone ||
    form.notes !== saved.notes;

  async function save() {
    setWorking('save');
    try {
      await saveManufacturerProfile(row.name, {
        description: form.description,
        website: form.website,
        email: form.email,
        phone: form.phone,
        notes: form.notes,
      });
      showToast('Profil producenta zapisany', 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać', 'error', 7000);
    } finally {
      setWorking(null);
    }
  }

  async function uploadLogo(file: File) {
    setWorking('logo');
    try {
      await uploadManufacturerLogo(row.name, file);
      showToast('Logo zapisane', 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się wgrać logo', 'error', 7000);
    } finally {
      setWorking(null);
    }
  }

  async function removeLogo() {
    setWorking('logo');
    try {
      await saveManufacturerProfile(row.name, { logoUrl: '' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się usunąć logo', 'error', 7000);
    } finally {
      setWorking(null);
    }
  }

  async function rename() {
    const next = cleanManufacturerName(name);
    if (!next || next === row.name) return;
    const ok = await confirmDialog({
      title: 'Zmiana nazwy producenta',
      message: `Zmienić „${row.name}” na „${next}” w ${row.count} produktach? Tej operacji nie cofniesz jednym kliknięciem.`,
      confirmLabel: 'Zmień nazwę',
      tone: 'warn',
    });
    if (!ok) return;
    setWorking('rename');
    try {
      const res = await renameManufacturer(row.name, next);
      showToast(`Zmieniono nazwę (${res.updated} produktów)`, 'ok');
      onRenamed(next);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zmienić nazwy', 'error', 8000);
    } finally {
      setWorking(null);
    }
  }

  async function remove() {
    const ok = await confirmDialog({
      title: 'Usunięcie producenta',
      message:
        row.count > 0
          ? `Usunąć „${row.name}” z listy? Jego ${row.count} produktów przejdzie do: ${moveTo || 'bez producenta'}.`
          : `Usunąć „${row.name}” z listy wyboru?`,
      confirmLabel: 'Usuń',
      tone: 'danger',
    });
    if (!ok) return;
    setWorking('remove');
    try {
      const res = await removeManufacturerAndMove(row.name, moveTo);
      showToast(`Producent usunięty${res.moved ? ` (przeniesiono ${res.moved} produktów)` : ''}`, 'ok');
      onRemoved();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się usunąć', 'error', 7000);
    } finally {
      setWorking(null);
    }
  }

  const label = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400';
  const photoPct = row.count ? Math.round((row.photos / row.count) * 100) : 0;

  return (
    <div className="surface-panel space-y-4 p-4">
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar name={row.name} logoUrl={saved.logoUrl} size={84} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold text-slate-950 dark:text-slate-50">{row.name}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void uploadLogo(f);
              }}
            />
            <button
              type="button"
              disabled={working !== null || !canEdit}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {working === 'logo' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {saved.logoUrl ? 'Zmień logo' : 'Wgraj logo'}
            </button>
            {saved.logoUrl && canEdit && (
              <button
                type="button"
                disabled={working !== null}
                onClick={() => void removeLogo()}
                className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-rose-700 hover:underline disabled:opacity-50 dark:text-rose-300"
              >
                <X className="h-3.5 w-3.5" /> Usuń logo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className={statClass}>
          <p className="text-[10px] uppercase text-slate-500">Produkty</p>
          <p className="text-base font-bold tabular-nums text-slate-100">{row.count}</p>
        </div>
        <div className={statClass}>
          <p className="text-[10px] uppercase text-slate-500">Ze zdjęciem</p>
          <p className="text-base font-bold tabular-nums text-slate-100">{photoPct}%</p>
        </div>
        <div className={statClass}>
          <p className="text-[10px] uppercase text-slate-500">Bez EAN</p>
          <p className="text-base font-bold tabular-nums text-slate-100">{row.noEan}</p>
        </div>
        <div className={statClass}>
          <p className="text-[10px] uppercase text-slate-500">Sztuk w mag.</p>
          <p className="text-base font-bold tabular-nums text-slate-100">{Math.round(row.stock)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onShowProducts}
          disabled={row.count === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          <ExternalLink className="h-4 w-4" /> Pokaż produkty w katalogu
        </button>
        {canEdit && (row.inBl === false || (row.inBl === null && !row.blKnown)) && (
          <button
            type="button"
            disabled={busy}
            onClick={onSendToBl}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <CloudUpload className="h-4 w-4" /> Wyślij do BaseLinkera
          </button>
        )}
      </div>

      <fieldset disabled={!canEdit} className="m-0 min-w-0 space-y-4 border-0 p-0">
      <label className="block">
        <span className={label}>Opis producenta (marka, specyfika, do czego służy asortyment)</span>
        <textarea
          rows={5}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="input-field"
          placeholder="np. Włoski producent chemii samochodowej, linia profesjonalna do myjni ręcznych…"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Strona WWW</span>
          <input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} className="input-field" placeholder="https://" />
        </label>
        <label className="block">
          <span className={label}>E-mail</span>
          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input-field" />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Telefon</span>
          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input-field" />
        </label>
      </div>
      <label className="block">
        <span className={label}>Notatki wewnętrzne (opiekun, warunki zakupu, uwagi)</span>
        <textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="input-field" />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || working !== null}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {working === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Zapisz profil
        </button>
        {dirty && <span className="text-xs text-amber-600 dark:text-amber-300">Niezapisane zmiany</span>}
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Nazwa producenta</p>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-field min-w-0 flex-1" />
          <button
            type="button"
            disabled={working !== null || !cleanManufacturerName(name) || cleanManufacturerName(name) === row.name}
            onClick={() => void rename()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {working === 'rename' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            Zmień
          </button>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400">
          Poprawia nazwę w {row.count} produktach. Jeśli nowa nazwa już istnieje, zmiana jest blokowana. Nazwy w BaseLinkerze nie zmieniamy automatycznie.
        </p>
        <div className="rounded-xl border border-rose-500/30 p-3">
          <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Usuń tego producenta</p>
          {row.count > 0 && (
            <label className="mt-2 block">
              <span className="mb-1 block text-[11px] text-slate-600 dark:text-slate-400">
                Przenieś jego {row.count} produktów do:
              </span>
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="input-field">
                <option value="">— bez producenta —</option>
                {moveOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            disabled={working !== null}
            onClick={() => void remove()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {working === 'remove' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Usuń producenta
          </button>
        </div>

      </div>
      </fieldset>
    </div>
  );
}
