import { Download, Store } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../types';
import { downloadText } from '../lib/assortmentAudit';
import { flattenCategories, useCategoryRegistry } from '../lib/categoryRegistry';
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

const card = 'rounded-3xl bg-slate-100/70 p-5 dark:bg-white/[0.045]';
const btn =
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';

/**
 * Zakładka Sklep — dwie rzeczy:
 *  1. porównanie katalogu ze sklepem kenochem.com (kategorie i przypisania produktów, czego brakuje po której stronie),
 *  2. silnik uzupełniania kategorii (nazwa + opis + linia produktowa + podobne produkty), który przypisuje pewne
 *     produkty, a niepewne i nierozpoznane zostawia na listach do sprawdzenia.
 */
export function ShopMirrorPanel({ products }: { products: Product[] }) {
  const version = useCategoryRegistry();
  const [file, setFile] = useState<ShopSkuFile | null>(null);
  const [error, setError] = useState('');

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
  const stamp = new Date().toISOString().slice(0, 10);
  const exportItems = plan ? [...plan.changes, ...plan.cleanup] : [];

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

    </div>
  );
}
