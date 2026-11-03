import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Product } from '../../types';
import { downloadText } from '../../lib/assortmentAudit';
import { getProductDisplayCategory } from '../../lib/catalogCategory';
import type { MaterialFact } from '../../lib/categoryEngine';
import { confirmDialog } from '../../lib/dialog';
import { checkAllDescriptions, checkDescription, issueSummary, ISSUE_LABEL, type DescIssue } from '../../lib/descriptionChecks';
import { dossierCsv, findMissingDescriptions, MIN_DESCRIPTION, parseDescriptionsCsv, plainText, type ImportedDescription } from '../../lib/engineDescriptions';
import { hasProductDocs } from '../../lib/productDocsIndex';
import { mergeProductMeta } from '../../lib/productMeta';
import { updateProduct } from '../../lib/products';
import { showToast } from '../../lib/toast';
import { btn, btnPrimary, card } from './ui';


interface ImportRow {
  item: ImportedDescription;
  product: Product | null;
  issues: DescIssue[];
  /** Produkt ma już pełny opis — wczytanie go nadpisze. */
  overwrites: boolean;
}

const statusOf = (r: ImportRow): 'error' | 'warn' | 'ok' => (!r.product || r.issues.some((i) => i.level === 'error') ? 'error' : r.issues.length ? 'warn' : 'ok');

function IssueList({ issues }: { issues: DescIssue[] }) {
  return (
    <ul className="space-y-0.5">
      {issues.map((i, k) => (
        <li key={k} className={`flex gap-1.5 text-xs ${i.level === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
          {i.level === 'error' ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          {i.text}
        </li>
      ))}
    </ul>
  );
}

/**
 * Zakładka „Opisy”: opisy powstają poza katalogiem. Silnik je przyjmuje (wczytanie z pliku z kontrolą przed zapisem)
 * i sprawdza spójność oraz poprawność tych, które już są — niczego sam nie pisze.
 */
export function DescriptionsTab({
  products,
  descriptions,
  loadDescriptions,
  canEdit,
  onPatched,
  facts,
}: {
  products: Product[];
  descriptions: Map<string, string> | null;
  loadDescriptions: () => Promise<Map<string, string>>;
  canEdit: boolean;
  onPatched: (patches: { id: string; patch: Partial<Product> }[]) => void;
  facts: Record<string, MaterialFact>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState<ImportRow[] | null>(null);
  const [withWarnings, setWithWarnings] = useState(false);
  const [codeFilter, setCodeFilter] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);
  const [open, setOpen] = useState<string | null>(null);

  const singles = useMemo(() => products.filter((p) => !p.isGroup && (p.sku ?? '').trim()), [products]);
  const makers = useMemo(() => [...new Set(singles.map((p) => (p.manufacturer ?? '').trim()).filter(Boolean))], [singles]);
  const missing = useMemo(() => (descriptions ? findMissingDescriptions(products, descriptions) : null), [products, descriptions]);
  const checked = useMemo(() => (descriptions ? checkAllDescriptions(products, descriptions, facts, getProductDisplayCategory) : null), [products, descriptions, facts]);
  const summary = useMemo(() => (checked ? issueSummary(checked) : []), [checked]);
  const shown = useMemo(() => (checked ? checked.filter((r) => !codeFilter || r.issues.some((i) => i.code === codeFilter)) : []), [checked, codeFilter]);
  const stamp = new Date().toISOString().slice(0, 10);

  async function load() {
    setLoading(true);
    try {
      await loadDescriptions();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się pobrać opisów', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const items = parseDescriptionsCsv(await file.text());
    if (!items.length) {
      showToast('Plik nie zawiera opisów (potrzebne kolumny SKU i Opis)', 'warn');
      return;
    }
    const current = descriptions ?? (await loadDescriptions().catch(() => new Map<string, string>()));
    const bySku = new Map(singles.map((p) => [(p.sku ?? '').toUpperCase(), p]));
    setImported(
      items.map((item) => {
        const product = bySku.get(item.sku) ?? null;
        const issues = product
          ? checkDescription({ product, description: item.description, category: getProductDisplayCategory(product), makers, fact: facts[item.sku] })
          : [{ level: 'error' as const, code: 'sku', text: `W katalogu nie ma produktu o SKU ${item.sku}.` }];
        return { item, product, issues, overwrites: !!product && plainText(current.get(product.id) ?? product.description ?? '').length >= MIN_DESCRIPTION };
      }),
    );
    setOpen(null);
    setLimit(30);
  }

  const counts = useMemo(() => {
    const c = { ok: 0, warn: 0, error: 0 };
    for (const r of imported ?? []) c[statusOf(r)]++;
    return c;
  }, [imported]);

  async function saveImported() {
    if (!imported) return;
    const rows = imported.filter((r) => r.product && (statusOf(r) === 'ok' || (withWarnings && statusOf(r) === 'warn')));
    if (!rows.length) return;
    const overwrites = rows.filter((r) => r.overwrites).length;
    const ok = await confirmDialog({
      title: 'Zapisz opisy',
      message: `Zapiszę ${rows.length} opisów${overwrites ? `, z czego ${overwrites} nadpisze istniejący pełny opis` : ''}. Pominę ${imported.length - rows.length} z błędami lub ostrzeżeniami. Każdą zmianę da się cofnąć w zakładce Historia produktu.`,
      confirmLabel: 'Zapisz',
      tone: 'warn',
    });
    if (!ok) return;
    setBusy(true);
    const patches: { id: string; patch: Partial<Product> }[] = [];
    let failed = 0;
    for (const r of rows) {
      const p = r.product!;
      try {
        const patch: Partial<Product> = { description: r.item.description, meta: mergeProductMeta(p.meta, r.item.short ? { shortDescription: r.item.short } : {}) };
        await updateProduct(p.id, patch);
        patches.push({ id: p.id, patch });
      } catch {
        failed++;
      }
    }
    if (patches.length) onPatched(patches);
    setBusy(false);
    const saved = new Set(patches.map((x) => x.id));
    setImported((prev) => prev && prev.filter((r) => !(r.product && saved.has(r.product.id))));
    showToast(`Zapisano ${patches.length} opisów${failed ? `, błędy: ${failed}` : ''}`, failed ? 'warn' : 'ok');
  }

  const importShown = imported ?? [];

  return (
    <div className="space-y-4">
      <section className={card}>
        <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">Opisy produktów</h3>
        <p className="mt-1 max-w-3xl text-[13px] text-slate-500">
          Opisy powstają poza katalogiem. Silnik ich nie pisze: przyjmuje gotowe opisy z pliku, sprawdza je przed zapisem (pojemność, cudze marki, zgodność z kategorią i kartą produktu, deklaracje biobójcze, HTML,
          duplikaty) i pilnuje spójności tych, które już są. Błędy blokują zapis, ostrzeżenia zostawiają decyzję Tobie.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {descriptions ? 'Sprawdź ponownie' : 'Sprawdź istniejące opisy'}
          </button>
          {canEdit && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button type="button" className={btn} disabled={busy} onClick={() => fileRef.current?.click()}>
                <FileUp className="h-4 w-4" /> Wczytaj gotowe opisy (CSV)
              </button>
            </>
          )}
          <button type="button" className={btn} disabled={!missing?.length} onClick={() => missing && downloadText(`teczka-do-opisu-${stamp}.csv`, dossierCsv(missing, hasProductDocs, facts), 'text/csv')}>
            <Download className="h-4 w-4" /> Teczka dla autora opisów (CSV)
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Plik do wczytania: kolumny SKU, Opis (tekst lub HTML), opcjonalnie Krótki opis. Teczka zawiera dane produktów bez opisu razem z przeznaczeniem i pH z kart produktów.
        </p>
      </section>

      {imported && (
        <section className={card}>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Wczytano {imported.length} opisów ·{' '}
              <span className="text-emerald-600 dark:text-emerald-400">{counts.ok} poprawnych</span> ·{' '}
              <span className="text-amber-600 dark:text-amber-400">{counts.warn} z ostrzeżeniami</span> · <span className="text-rose-600 dark:text-rose-400">{counts.error} z błędami</span>
            </p>
            <label className="ml-auto flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={withWarnings} onChange={(e) => setWithWarnings(e.target.checked)} /> zapisz także te z ostrzeżeniami
            </label>
            <button type="button" className={btnPrimary} disabled={busy || !canEdit || counts.ok + (withWarnings ? counts.warn : 0) === 0} onClick={() => void saveImported()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Zapisz ({counts.ok + (withWarnings ? counts.warn : 0)})
            </button>
            <button type="button" className={btn} onClick={() => setImported(null)}>
              Odrzuć plik
            </button>
          </div>
          <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10">
            {importShown.slice(0, limit).map((r) => {
              const st = statusOf(r);
              const isOpen = open === r.item.sku;
              return (
                <li key={r.item.sku} className="py-2">
                  <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => setOpen(isOpen ? null : r.item.sku)}>
                    {st === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : st === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {r.item.sku} · {r.product ? r.product.displayName || r.product.name : 'nieznany SKU'}
                      </span>
                      {r.issues.length > 0 && <IssueList issues={r.issues} />}
                      {r.overwrites && <span className="text-xs text-slate-500">nadpisze istniejący pełny opis</span>}
                    </span>
                  </button>
                  {isOpen && (
                    <p className="ml-6 mt-2 whitespace-pre-line rounded-2xl bg-white/70 p-3 text-[13px] text-slate-700 dark:bg-white/5 dark:text-slate-300">{plainText(r.item.description).slice(0, 1200)}</p>
                  )}
                </li>
              );
            })}
          </ul>
          {importShown.length > limit && (
            <button type="button" className={`${btn} mt-3`} onClick={() => setLimit((l) => l + 50)}>
              Pokaż więcej ({importShown.length - limit})
            </button>
          )}
        </section>
      )}

      {checked && (
        <section className={card}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Kontrola istniejących opisów: {checked.length.toLocaleString('pl-PL')} produktów z uwagami · {missing?.length.toLocaleString('pl-PL')} bez pełnego opisu
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => setCodeFilter(null)} className={`rounded-full px-3 py-1 text-xs font-semibold ${!codeFilter ? 'bg-brand-600 text-white' : 'bg-black/[0.06] text-slate-700 dark:bg-white/10 dark:text-slate-300'}`}>
              Wszystkie
            </button>
            {summary.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => {
                  setCodeFilter(s.code === codeFilter ? null : s.code);
                  setLimit(30);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${codeFilter === s.code ? 'bg-brand-600 text-white' : s.level === 'error' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-black/[0.06] text-slate-700 dark:bg-white/10 dark:text-slate-300'}`}
              >
                {s.label} · {s.count}
              </button>
            ))}
            <button
              type="button"
              className={`${btn} ml-auto`}
              onClick={() =>
                downloadText(
                  `kontrola-opisow-${stamp}.csv`,
                  `﻿${['SKU;Nazwa;Poziom;Problem', ...checked.flatMap((r) => r.issues.map((i) => [r.product.sku, r.product.displayName || r.product.name, i.level === 'error' ? 'błąd' : 'ostrzeżenie', `${ISSUE_LABEL[i.code] ?? i.code}: ${i.text}`].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')))].join('\r\n')}`,
                  'text/csv',
                )
              }
            >
              <Download className="h-4 w-4" /> Raport (CSV)
            </button>
          </div>
          <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10">
            {shown.slice(0, limit).map((r) => (
              <li key={r.product.id} className="py-2">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {r.product.sku} · {r.product.displayName || r.product.name}
                </p>
                <IssueList issues={r.issues} />
              </li>
            ))}
            {shown.length === 0 && <li className="py-6 text-center text-sm text-slate-500">Brak uwag w tym widoku.</li>}
          </ul>
          {shown.length > limit && (
            <button type="button" className={`${btn} mt-3`} onClick={() => setLimit((l) => l + 50)}>
              Pokaż więcej ({shown.length - limit})
            </button>
          )}
        </section>
      )}
    </div>
  );
}
