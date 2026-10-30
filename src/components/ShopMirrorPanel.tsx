import { Download, Loader2, Play, ShieldCheck, Store } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../types';
import { runBulkEdit } from '../lib/bulkEdit';
import { downloadText } from '../lib/assortmentAudit';
import { flattenCategories, useCategoryRegistry } from '../lib/categoryRegistry';
import { fetchDescriptions, hideCsv, proposalsCsv, researchCsv, runCategoryEngine, summarizeEngine, treeHealth, type EngineRow, type EngineScope } from '../lib/categoryEngineReport';
import { confirmDialog } from '../lib/dialog';
import {
  differencesCsv,
  loadShopSkuMap,
  onlyCatalogCsv,
  onlyShopCsv,
  planMirror,
  redirectsCsv,
  shopCategoryIndex,
  structureChanges,
  structureCsv,
  wooCategoriesCsv,
  type ShopSkuFile,
} from '../lib/shopMirror';
import { showToast } from '../lib/toast';

const card = 'rounded-3xl bg-slate-100/70 p-5 dark:bg-white/[0.045]';
const btn =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';
const btnPrimary = 'inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50';

/**
 * Zakładka Sklep — dwie rzeczy:
 *  1. porównanie katalogu ze sklepem kenochem.com (kategorie i przypisania produktów, czego brakuje po której stronie),
 *  2. silnik uzupełniania kategorii (nazwa + opis + linia produktowa + podobne produkty), który przypisuje pewne
 *     produkty, a niepewne i nierozpoznane zostawia na listach do sprawdzenia.
 */
export function ShopMirrorPanel({
  products,
  canEdit,
  onPatched,
}: {
  products: Product[];
  canEdit: boolean;
  onPatched: (patches: { id: string; patch: Partial<Product> }[]) => void;
}) {
  const version = useCategoryRegistry();
  const [file, setFile] = useState<ShopSkuFile | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [rows, setRows] = useState<EngineRow[] | null>(null);
  const [scope, setScope] = useState<EngineScope>('uzupelnij');

  useEffect(() => {
    let alive = true;
    loadShopSkuMap()
      .then((f) => alive && setFile(f))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Nie udało się wczytać danych sklepu'));
    return () => {
      alive = false;
    };
  }, []);

  const shopCats = useMemo(() => shopCategoryIndex().size, []);
  const catalogCats = useMemo(() => flattenCategories().length, [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const plan = useMemo(() => (file ? planMirror(products, file) : null), [products, file, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const structure = useMemo(() => structureChanges(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => (rows ? summarizeEngine(rows, scope) : null), [rows, scope]);
  const health = useMemo(() => (rows && scope === 'audyt' ? treeHealth(rows) : null), [rows, scope]);
  const stamp = new Date().toISOString().slice(0, 10);
  const exportItems = plan ? [...plan.changes, ...plan.cleanup] : [];

  async function runEngine(next: EngineScope) {
    setScope(next);
    // te same wyniki służą obu trybom — jeśli już policzone, wystarczy zmienić widok
    if (rows) return;
    setProgress('Pobieram opisy produktów…');
    try {
      const ids = products.filter((p) => !p.isGroup).map((p) => p.id);
      const descriptions = await fetchDescriptions(ids, (done, total) => setProgress(`Pobieram opisy produktów ${done}/${total}…`));
      setProgress('Silnik analizuje produkty…');
      // oddajemy sterowanie przeglądarce, żeby pasek postępu zdążył się odświeżyć
      await new Promise((r) => setTimeout(r, 30));
      setRows(runCategoryEngine(products, descriptions, file));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się uruchomić silnika', 'error', 8000);
    } finally {
      setProgress(null);
    }
  }

  async function applyConfident() {
    if (!summary || !canEdit || !summary.changes.length) return;
    const ok = await confirmDialog({
      title: 'Zastosuj pewne decyzje silnika',
      message: `Przypiszę ${summary.changes.length} produktów do kategorii wskazanych przez silnik z pewnością (nazwa, opis, linia produktowa zgodne). Produkty „do sprawdzenia” i „do wyszukania” nie są zmieniane. Całość da się cofnąć w Logi → Operacje masowe.`,
      confirmLabel: 'Zastosuj',
      tone: 'warn',
    });
    if (!ok) return;
    setApplying(true);
    try {
      const byId = new Map(summary.changes.map((r) => [r.id, r]));
      const res = await runBulkEdit(
        summary.changes.map((r) => r.id),
        (id) => {
          const r = byId.get(id)!;
          return { category: r.decision.to!, shopPath: r.toPath };
        },
        'Silnik kategorii: pewne decyzje',
      );
      onPatched(res.patches);
      setRows(null);
      showToast(`Przypisano ${res.updated} produktów${res.failed.length ? ` (błędy: ${res.failed.length})` : ''}. Uruchom silnik ponownie, aby zobaczyć, co zostało.`, res.failed.length ? 'error' : 'ok', 8000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zastosować decyzji', 'error', 8000);
    } finally {
      setApplying(false);
    }
  }

  const kpi = (label: string, value: string | number, tone = '') => (
    <div key={label} className={card}>
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className={`mt-1 text-[28px] font-semibold leading-none tabular-nums text-slate-950 dark:text-slate-50 ${tone}`}>{value}</p>
    </div>
  );
  const warn = 'text-amber-600 dark:text-amber-400';

  return (
    <div className="space-y-4">
      {/* ------------------------------ 1. porównanie ze sklepem ------------------------------ */}
      <section className={card}>
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-950 dark:text-slate-50">
          <Store className="h-4 w-4" /> Porównanie ze sklepem kenochem.com
        </h3>
        <p className="mt-1 text-[13px] text-slate-500">
          Dane sklepu z {file ? new Date(file.fetchedAt).toLocaleString('pl-PL') : '…'} ({file ? Object.keys(file.skus).length : '…'} SKU). Katalog jest wzorem — tu widzisz, czym różni się od sklepu: kategorie, produkty
          i ich przypisania.
        </p>
        {error && <p className="mt-2 text-[13px] text-rose-600">{error}</p>}

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {kpi('Kategorie: sklep / katalog', `${shopCats} / ${catalogCats}`, catalogCats !== shopCats ? warn : '')}
          {kpi('Produkty w obu', plan ? plan.matched : '…')}
          {kpi('Tylko w katalogu', plan ? plan.notInShop : '…', plan?.notInShop ? warn : '')}
          {kpi('Tylko w sklepie', plan ? plan.shopOnly : '…', plan?.shopOnly ? warn : '')}
          {kpi('Inna kategoria niż w sklepie', plan ? plan.changes.length : '…', plan?.changes.length ? warn : '')}
          {kpi('Kategorie do dodania/usunięcia w sklepie', structure.length, structure.length ? warn : '')}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={!plan?.onlyCatalog.length} onClick={() => plan && downloadText(`tylko-w-katalogu-${stamp}.csv`, onlyCatalogCsv(plan.onlyCatalog), 'text/csv')}>
            <Download className="h-4 w-4" /> Tylko w katalogu
          </button>
          <button type="button" className={btn} disabled={!plan?.onlyShop.length} onClick={() => plan && downloadText(`tylko-w-sklepie-${stamp}.csv`, onlyShopCsv(plan.onlyShop), 'text/csv')}>
            <Download className="h-4 w-4" /> Tylko w sklepie
          </button>
          <button type="button" className={btn} disabled={!plan?.changes.length} onClick={() => plan && downloadText(`roznice-kategorii-${stamp}.csv`, differencesCsv(plan.changes), 'text/csv')}>
            <Download className="h-4 w-4" /> Różnice kategorii
          </button>
          <button type="button" className={btn} disabled={!exportItems.length} onClick={() => downloadText(`kategorie-do-importu-woocommerce-${stamp}.csv`, wooCategoriesCsv(exportItems), 'text/csv')}>
            <Download className="h-4 w-4" /> Import do WooCommerce
          </button>
          <button type="button" className={btn} disabled={!structure.length} onClick={() => downloadText(`zmiany-drzewa-${stamp}.csv`, structureCsv(structure), 'text/csv')}>
            <Download className="h-4 w-4" /> Zmiany drzewa
          </button>
          <button type="button" className={btn} disabled={!structure.length} onClick={() => downloadText(`przekierowania-301-${stamp}.csv`, redirectsCsv(), 'text/csv')}>
            <Download className="h-4 w-4" /> Przekierowania 301
          </button>
        </div>

        {plan && plan.changes.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Inna kategoria niż w sklepie ({plan.changes.length.toLocaleString('pl-PL')}){plan.changes.length > 40 ? ' — pierwsze 40' : ''}</p>
            <ul className="divide-y divide-slate-200 dark:divide-white/10">
              {plan.changes.slice(0, 40).map((c) => (
                <li key={c.id} className="py-1.5 text-[13px]">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                    {c.sku} · {c.name}
                  </p>
                  <p className="truncate text-[12px] text-slate-500">
                    katalog: <span className="text-slate-700 dark:text-slate-300">{c.catalog}</span> → sklep: <span className="text-slate-700 dark:text-slate-300">{c.shop}</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ------------------------------ 2. silnik uzupełniania ------------------------------ */}
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-2xl">
            <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">Silnik uzupełniania kategorii</h3>
            <p className="mt-1 text-[13px] text-slate-500">
              Dla każdego produktu bada rodzaj, funkcję z nazwy, opis i sposób użycia, linię produktową oraz podobne produkty i sprawdza, czy się zgadzają. Pewne decyzje można zastosować hurtem; niepewne i bez sygnału
              trafiają na listy do sprawdzenia i do wyszukania w internecie.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={progress !== null || applying} onClick={() => void runEngine('uzupelnij')}>
              {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Uruchom silnik uzupełniania
            </button>
            <button type="button" className={btn} disabled={progress !== null || applying} onClick={() => void runEngine('audyt')}>
              <ShieldCheck className="h-4 w-4" /> Sprawdź poprawność przypisań
            </button>
          </div>
        </div>
        {progress && <p className="mt-3 text-[13px] text-slate-600 dark:text-slate-300">{progress}</p>}

        {summary && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {kpi(scope === 'audyt' ? 'Błędne przypisania (pewne poprawki)' : 'Pewne przypisania', summary.changes.length, summary.changes.length ? 'text-emerald-600 dark:text-emerald-400' : '')}
              {kpi('Do sprawdzenia', summary.review.length, summary.review.length ? warn : '')}
              {kpi('Do wyszukania w necie', summary.research.length, summary.research.length ? warn : '')}
              {kpi('Do ukrycia (niesprzedażowe)', summary.hide.length, summary.hide.length ? warn : '')}
              {kpi(scope === 'audyt' ? 'Przypisane poprawnie' : 'Bez zmian (potwierdzone)', summary.confirmed)}
            </div>
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <button type="button" className={btnPrimary} disabled={!summary.changes.length || applying} onClick={() => void applyConfident()}>
                  {applying && <Loader2 className="h-4 w-4 animate-spin" />} {scope === 'audyt' ? 'Popraw błędne przypisania' : 'Zastosuj pewne zmiany'} ({summary.changes.length})
                </button>
              )}
              <button type="button" className={btn} onClick={() => rows && downloadText(`kategorie-propozycje-${stamp}.csv`, proposalsCsv(rows), 'text/csv')}>
                <Download className="h-4 w-4" /> Propozycje i do sprawdzenia (CSV)
              </button>
              <button type="button" className={btn} disabled={!summary.research.length} onClick={() => downloadText(`do-wyszukania-w-necie-${stamp}.csv`, researchCsv(summary.research), 'text/csv')}>
                <Download className="h-4 w-4" /> Do wyszukania w necie (CSV)
              </button>
              <button type="button" className={btn} disabled={!summary.hide.length} onClick={() => downloadText(`do-ukrycia-${stamp}.csv`, hideCsv(summary.hide), 'text/csv')}>
                <Download className="h-4 w-4" /> Do ukrycia (CSV)
              </button>
            </div>

            {health && (
              <div className="rounded-2xl bg-white/60 p-4 text-[13px] dark:bg-white/5">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Kondycja drzewa kategorii</p>
                <p className="text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Puste po zastosowaniu poprawek ({health.empty.length}):</span> {health.empty.length ? health.empty.join(' · ') : 'brak — każda kategoria ma produkty'}
                </p>
                {health.tiny.length > 0 && (
                  <p className="mt-2 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">Drobnica, do rozważenia scalenia ({health.tiny.length}):</span> {health.tiny.map((t) => `${t.path.split(' › ').pop()} (${t.count})`).join(' · ')}
                  </p>
                )}
                {health.confusable.length > 0 && (
                  <p className="mt-2 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">Kategorie często mylone ze sobą:</span> {health.confusable.map((c) => `${c.a} ⇄ ${c.b} (${c.count})`).join(' · ')}
                  </p>
                )}
              </div>
            )}

            {summary.changes.length > 0 && (
              <div>
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Pewne zmiany{summary.changes.length > 40 ? ' — pierwsze 40' : ''}</p>
                <ul className="divide-y divide-slate-200 dark:divide-white/10">
                  {summary.changes.slice(0, 40).map((r) => (
                    <li key={r.id} className="py-1.5 text-[13px]">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {r.sku} · {r.name}
                      </p>
                      <p className="truncate text-[12px] text-slate-500">
                        {r.decision.from} → <span className="text-slate-700 dark:text-slate-300">{r.decision.to}</span> · {r.decision.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.review.length > 0 && (
              <div>
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">Do sprawdzenia{summary.review.length > 40 ? ' — pierwsze 40' : ''}</p>
                <ul className="divide-y divide-slate-200 dark:divide-white/10">
                  {summary.review.slice(0, 40).map((r) => (
                    <li key={r.id} className="py-1.5 text-[13px]">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                        {r.sku} · {r.name}
                      </p>
                      <p className="truncate text-[12px] text-slate-500">
                        {r.decision.from} → {r.decision.to ?? '?'} · {r.decision.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
