import {
  Barcode,
  Boxes,
  Check,
  ChevronRight,
  Copy,
  Factory,
  Fingerprint,
  Hash,
  Image as ImageIcon,
  Layers,
  Link2,
  Loader2,
  MapPin,
  Package,
  Percent,
  Ruler,
  Scale,
  Sparkles,
  Star,
  Tag as TagIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { AddToCollectionMenu } from '../AddToCollectionMenu';
import { showToast } from '../../lib/toast';
import { useMemo, useState } from 'react';
import type { Product } from '../../types';
import {
  customerGrossPrice,
  formatStock,
  formatPricePln,
  formatMarginPercent,
  marginPercent,
} from '../../lib/format';
import { inferProductTypeLabel } from '../../lib/catalogKind';
import { buildProductAiContext } from '../../lib/productAiContext';
import { baselinkerLinkLabel, hasBaselinkerLink } from '../../lib/baselinkerLink';
import { useBaselinkerLinksVersion } from '../../lib/baselinkerLive';
import {
  getProductDisplayCategory,
  getProductSourceCategory,
  productNeedsCategoryDecision,
} from '../../lib/catalogCategory';
import {
  formatDimensions,
  parametersToText,
  isWaproSkeletonProduct,
  type ProductMeta,
} from '../../lib/productMeta';

export function DetailRow({
  label,
  value,
  mono,
  prominent,
  span,
  source,
}: {
  label: string;
  value: string;
  mono?: boolean;
  prominent?: boolean;
  span?: boolean;
  source?: 'wapro' | 'baselinker';
}) {
  const sourceClass =
    source === 'wapro'
      ? 'catalog-source-accent catalog-source-accent--wapro'
      : source === 'baselinker'
        ? 'catalog-source-accent catalog-source-accent--baselinker'
        : '';

  return (
    <div
      className={`flex flex-col gap-0 bg-slate-950/50 px-3 py-1.5 sm:flex-row sm:items-center sm:gap-2 ${sourceClass} ${
        span ? 'sm:col-span-2 xl:col-span-2' : ''
      }`}
    >
      <dt className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:w-28 dark:text-slate-500">
        <span>{label}</span>
        {source ? <SourceBadge source={source} /> : null}
      </dt>
      <dd
        className={`min-w-0 flex-1 break-words text-slate-200 dark:text-slate-100 ${
          mono
            ? prominent
              ? 'font-mono text-base font-medium tracking-wide'
              : 'font-mono text-sm'
            : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

type FactSource = 'wapro' | 'baselinker';

function SourceBadge({ source }: { source: FactSource }) {
  return (
    <span
      className={`catalog-source-badge catalog-source-badge--${source}`}
      title={source === 'wapro' ? 'Dane z WAPRO' : 'Dane z BaseLinker'}
    >
      {source === 'wapro' ? 'W' : 'BL'}
    </span>
  );
}

function copyValue(text: string, what: string) {
  void navigator.clipboard
    ?.writeText(text)
    .then(() => showToast(`Skopiowano ${what}`, 'ok', 1500))
    .catch(() => showToast('Nie udało się skopiować', 'error'));
}

/** Karta sekcji (Identyfikacja, Magazyn…) z nagłówkiem i ikoną. */
function FactCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-sm dark:bg-slate-950/30 dark:shadow-none">
      <header className="flex items-center gap-2 border-b border-slate-800 bg-slate-900/70 px-4 py-2">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Wartość z podpisem (siatka definicji). */
function Field({
  label,
  children,
  source,
  wide,
}: {
  label: string;
  children: ReactNode;
  source?: FactSource;
  wide?: boolean;
}) {
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {source ? <SourceBadge source={source} /> : null}
      </dt>
      <dd className="mt-1 min-w-0 break-words text-sm font-medium text-slate-100">{children}</dd>
    </div>
  );
}

/** Ścieżka kategorii jako okruszki. */
function Crumbs({ path }: { path: string }) {
  const parts = path
    .split(/\s*[>›]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {parts.map((part, i) => (
        <span key={`${part}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-slate-500" />}
          <span className={i === parts.length - 1 ? 'font-semibold text-slate-100' : 'text-slate-400'}>{part}</span>
        </span>
      ))}
    </span>
  );
}

function Tile({
  icon,
  label,
  value,
  sub,
  source,
  tone = 'text-slate-50',
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  source?: FactSource;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <span className="text-slate-500">{icon}</span>
          {label}
        </span>
        {source ? <SourceBadge source={source} /> : null}
      </div>
      <p className={`mt-1 truncate text-lg font-bold tabular-nums ${tone}`}>{value}</p>
      {sub ? <p className="truncate text-[11px] text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function ProductDetailFacts({
  detail,
  locationCode,
  isGroup,
  variantCount = 0,
}: {
  detail: Product;
  locationCode: string;
  isGroup?: boolean;
  variantCount?: number;
}) {
  useBaselinkerLinksVersion();
  const meta = detail.meta;
  const productTypeLabel = inferProductTypeLabel(detail);
  const imageCount =
    (detail.hasImage || detail.customImageUrl || detail.imageUrl ? 1 : 0) +
    (detail.extraImageUrls?.length ?? 0);
  const mfr =
    detail.manufacturer?.trim() &&
    detail.manufacturer.trim().toLowerCase() !== 'wapro'
      ? detail.manufacturer
      : '';
  const isBaselinker = hasBaselinkerLink(detail);
  const isWapro = !isBaselinker || Boolean(meta?.waproImport || meta?.waproSku || detail.waproSalesStats);
  const targetCategory = getProductDisplayCategory(detail);
  const sourceCategory = getProductSourceCategory(detail);
  const stock = detail.stock ?? 0;
  const dims = formatDimensions(meta);
  const showOfferTitle = detail.name !== detail.displayName;
  const blLabel = isBaselinker ? (baselinkerLinkLabel(detail) ?? 'Powiązany') : '';

  return (
    <div className="space-y-3">
      <FactCard title="Identyfikacja" icon={<Fingerprint className="h-4 w-4" />}>
        {/* kody: SKU i EAN jako główne identyfikatory */}
        <div className={`grid gap-3 ${isGroup ? '' : 'sm:grid-cols-2'}`}>
          <button
            type="button"
            onClick={() => copyValue(detail.sku, 'SKU')}
            title="Kliknij, aby skopiować SKU"
            className="group min-w-0 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-left transition hover:border-brand-500/50"
          >
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <Hash className="h-3 w-3" /> SKU {isWapro ? <SourceBadge source="wapro" /> : null}
              <Copy className="ml-auto h-3 w-3 opacity-0 transition group-hover:opacity-100" />
            </span>
            <span className="mt-1 block truncate font-mono text-xl font-semibold tracking-wide text-slate-50">{detail.sku}</span>
          </button>
          {!isGroup && (
            <button
              type="button"
              disabled={!detail.ean}
              onClick={() => detail.ean && copyValue(detail.ean, 'EAN')}
              title={detail.ean ? 'Kliknij, aby skopiować EAN' : 'Brak kodu EAN'}
              className="group min-w-0 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-left transition enabled:hover:border-brand-500/50"
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <Barcode className="h-3 w-3" /> EAN {detail.ean && isBaselinker ? <SourceBadge source="baselinker" /> : null}
                {detail.ean ? <Copy className="ml-auto h-3 w-3 opacity-0 transition group-hover:opacity-100" /> : null}
              </span>
              <span className={`mt-1 block truncate font-mono text-xl tracking-wide ${detail.ean ? 'font-semibold text-slate-50' : 'text-amber-400'}`}>
                {detail.ean || 'brak'}
              </span>
            </button>
          )}
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
          {mfr ? (
            <Field label="Producent" source={isWapro ? 'wapro' : undefined}>
              <span className="inline-flex items-center gap-2">
                <Factory className="h-3.5 w-3.5 text-slate-500" />
                {mfr}
              </span>
            </Field>
          ) : null}
          <Field label="Typ produktu">{productTypeLabel}</Field>
          <Field label="Kategoria docelowa" source={isBaselinker ? 'baselinker' : undefined}>
            {targetCategory}
          </Field>
          {productNeedsCategoryDecision(detail) && sourceCategory !== targetCategory ? (
            <Field label="Kategoria źródłowa" source={isBaselinker ? 'baselinker' : undefined}>
              <span className="text-slate-300">{sourceCategory}</span>
            </Field>
          ) : null}
          {meta?.shopCategoryPath ? (
            <Field label="Ścieżka w sklepie" source="baselinker" wide>
              <Crumbs path={meta.shopCategoryPath} />
            </Field>
          ) : null}
          {isBaselinker ? (
            <Field label="Powiązanie BaseLinker" source="baselinker">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-xs text-sky-200">
                <Link2 className="h-3 w-3" />
                {blLabel}
              </span>
            </Field>
          ) : null}
          {showOfferTitle ? (
            <Field label="Nazwa WAPRO / BL" source={isBaselinker ? 'baselinker' : isWapro ? 'wapro' : undefined} wide>
              <span className="text-slate-300">{detail.name}</span>
            </Field>
          ) : null}
          {showOfferTitle ? (
            <Field label="Tytuł oferty" source={isBaselinker ? 'baselinker' : undefined} wide>
              {detail.displayName}
            </Field>
          ) : null}
          {isWaproSkeletonProduct(detail) ? (
            <Field label="Źródło" wide>
              <span className="text-amber-300">Mag WAPRO — szkielet (SKU, nazwa, ceny; zdjęcie do uzupełnienia)</span>
            </Field>
          ) : null}
          {detail.id !== detail.sku ? (
            <Field label="ID rekordu" wide>
              <button
                type="button"
                onClick={() => copyValue(detail.id, 'ID rekordu')}
                title="Kliknij, aby skopiować"
                className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-400 hover:text-slate-200"
              >
                {detail.id}
                <Copy className="h-3 w-3" />
              </button>
            </Field>
          ) : null}
        </dl>
      </FactCard>

      <FactCard title="Magazyn · media · logistyka" icon={<Boxes className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          <Tile
            icon={<Boxes className="h-3 w-3" />}
            label="Stan"
            value={formatStock(stock)}
            sub={detail.stockManual ? 'ustawiony ręcznie' : stock <= 0 ? 'brak na magazynie' : 'z WAPRO'}
            source="wapro"
            tone={stock <= 0 ? 'text-rose-400' : 'text-emerald-300'}
          />
          {isGroup && variantCount > 0 ? (
            <Tile icon={<Layers className="h-3 w-3" />} label="Warianty" value={variantCount} sub="pozycji SKU" source="wapro" />
          ) : null}
          {locationCode ? <Tile icon={<MapPin className="h-3 w-3" />} label="Lokalizacja" value={locationCode} source="wapro" /> : null}
          <Tile
            icon={<ImageIcon className="h-3 w-3" />}
            label="Zdjęcia"
            value={imageCount > 0 ? imageCount : 'Brak'}
            sub={imageCount > 0 ? 'plików' : 'do uzupełnienia'}
            tone={imageCount > 0 ? 'text-slate-50' : 'text-amber-400'}
          />
          {meta?.weightKg != null ? (
            <Tile icon={<Scale className="h-3 w-3" />} label="Waga" value={`${meta.weightKg} kg`} source="baselinker" />
          ) : null}
          {dims ? <Tile icon={<Ruler className="h-3 w-3" />} label="Wymiary" value={dims} source="baselinker" /> : null}
          {meta?.unit ? <Tile icon={<Package className="h-3 w-3" />} label="Jednostka" value={meta.unit} source="baselinker" /> : null}
          {meta?.vatRate != null ? <Tile icon={<Percent className="h-3 w-3" />} label="VAT" value={`${meta.vatRate}%`} source="baselinker" /> : null}
        </div>
        {detail.tags?.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <TagIcon className="h-3.5 w-3.5 text-slate-500" />
            {detail.tags.map((t) => (
              <span key={t} className="rounded-full border border-slate-700 bg-slate-900/60 px-2.5 py-0.5 text-[11px] text-slate-300">
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </FactCard>
    </div>
  );
}

function ProductPriceMetric({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <p className="catalog-product-price-panel__metric-label text-[10px] font-semibold uppercase">
        {label}
      </p>
      <p
        className={`catalog-product-price-panel__metric-value mt-1 text-sm tabular-nums ${
          accent ? 'catalog-product-price-panel__metric-value--accent text-base font-bold' : ''
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className="catalog-product-price-panel__metric-hint mt-0.5 text-[10px] font-medium">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ProductDetailPricePanelBody({
  detail,
  compact,
}: {
  detail: Product;
  compact: boolean;
}) {
  const margin = marginPercent(detail.pricePurchaseNet, detail.priceSaleNet);
  const gross = detail.priceSaleGross;
  const saleNet = detail.priceSaleNet;
  const purchase = detail.pricePurchaseNet;
  const vatRate = detail.meta?.vatRate ?? 23;
  const clientAmount = customerGrossPrice(gross, saleNet, vatRate);
  const purchaseGross =
    purchase != null ? Math.round(purchase * (1 + vatRate / 100) * 100) / 100 : undefined;
  const clientEstimated = gross == null && saleNet != null && clientAmount != null;

  return (
    <div className={`catalog-product-price-panel overflow-hidden rounded-2xl ${compact ? '' : 'p-1'}`}>
      <div
        className={`border-b border-slate-700/50 px-3 dark:border-slate-700/80 ${
          compact ? 'py-2.5' : 'py-3'
        }`}
      >
        <p className="catalog-product-price-panel__kicker text-[10px] font-bold uppercase">
          Ceny · WAPRO
        </p>
        <p className="catalog-product-price-panel__hero-label mt-2 text-xs font-medium">
          Sprzedaż brutto (cena dla klienta)
        </p>
        <p className="catalog-product-price-panel__hero-value mt-0.5 tabular-nums">
          <span className={compact ? 'text-2xl font-bold' : 'text-3xl font-bold'}>
            {formatPricePln(clientAmount)}
          </span>
          <span className="catalog-product-price-panel__hero-unit ml-2 text-sm font-semibold">
            brutto
          </span>
        </p>
        {saleNet != null ? (
          <p className="catalog-product-price-panel__netto-line mt-1.5 text-xs tabular-nums">
            Netto:{' '}
            <span className="catalog-product-price-panel__netto-value">
              {formatPricePln(saleNet)}
            </span>
            {clientEstimated ? (
              <span className="ml-1 text-[11px] font-medium opacity-75">
                · brutto wyliczone z VAT {vatRate}%
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 border-t border-slate-700/50 sm:grid-cols-4 sm:divide-x sm:divide-slate-700/50 dark:border-slate-700/80 dark:sm:divide-slate-700/80">
        <ProductPriceMetric
          label="Zakup netto"
          value={formatPricePln(purchase)}
          hint="Koszt magazynowy"
        />
        <ProductPriceMetric
          label="Zakup brutto"
          value={formatPricePln(purchaseGross)}
          hint={`Netto + VAT ${vatRate}%`}
        />
        <ProductPriceMetric
          label="Sprzedaż netto"
          value={formatPricePln(saleNet)}
          hint="Bez VAT"
          accent
        />
        <ProductPriceMetric
          label="Marża"
          value={formatMarginPercent(margin)}
          hint="Od sprzedaży netto"
        />
      </div>
    </div>
  );
}

function buildSalesOfferLine(detail: Product): string {
  const price = customerGrossPrice(detail.priceSaleGross, detail.priceSaleNet, detail.meta?.vatRate);
  const bits = [detail.sku, detail.ean?.trim(), detail.displayName];
  if (price != null) bits.push(formatPricePln(price));
  return bits.filter(Boolean).join(' · ');
}

function QuickActionTile({
  children,
  onClick,
  active,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition ${
        active
          ? 'border-amber-500/50 bg-amber-500/10 text-amber-100'
          : 'border-slate-700 bg-slate-900/80 text-slate-200 hover:border-brand-500/40 hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

/** Szybkie akcje sprzedażowe pod cenami (katalog — bez koszyka). */
export function ProductDetailCatalogQuickActions({
  detail,
  isFavorite,
  onToggleFavorite,
  onOpenAiTab,
  collectionUserKey,
  onCollectionsChange,
}: {
  detail: Product;
  isFavorite?: boolean;
  onToggleFavorite?: (productId: string) => void;
  onOpenAiTab?: () => void;
  collectionUserKey?: string;
  onCollectionsChange?: () => void;
}) {
  const [copiedOffer, setCopiedOffer] = useState(false);

  async function copyOfferLine() {
    const text = buildSalesOfferLine(detail);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOffer(true);
      showToast('Skopiowano linię oferty', 'ok');
      setTimeout(() => setCopiedOffer(false), 2000);
    } catch {
      showToast('Nie udało się skopiować', 'error');
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <QuickActionTile
          title="SKU, EAN, nazwa i cena — do maila lub Allegro"
          onClick={() => void copyOfferLine()}
        >
          {copiedOffer ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiedOffer ? 'Skopiowano' : 'Kopiuj ofertę'}
        </QuickActionTile>
        <QuickActionTile title="Kontekst produktu dla ChatGPT / Claude" onClick={onOpenAiTab}>
          <Sparkles className="h-4 w-4 text-violet-400" />
          Materiał AI
        </QuickActionTile>
        {onToggleFavorite ? (
          <QuickActionTile
            title={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
            active={isFavorite}
            onClick={() => onToggleFavorite(detail.id)}
          >
            <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
            Ulubione
          </QuickActionTile>
        ) : null}
        {collectionUserKey ? (
          <AddToCollectionMenu
            userKey={collectionUserKey}
            product={detail}
            onChanged={onCollectionsChange}
            layout="tile"
          />
        ) : null}
      </div>
    </div>
  );
}

export function ProductDetailPriceGrid({
  detail,
  compact = false,
}: {
  detail: Product;
  compact?: boolean;
}) {
  const hasAny =
    detail.pricePurchaseNet != null ||
    detail.priceSaleNet != null ||
    detail.priceSaleGross != null;

  if (!hasAny) {
    return (
      <p className="rounded-xl border border-dashed border-slate-600 px-3 py-2.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
        Brak cen w WAPRO — sync stanów/cen lub uzupełnij ręcznie.
      </p>
    );
  }

  return <ProductDetailPricePanelBody detail={detail} compact={compact} />;
}

export function ProductDetailCommercialExtras({ detail }: { detail: Product }) {
  const meta = detail.meta;
  const paramEntries = meta?.parameters ? Object.entries(meta.parameters) : [];

  return (
    <div className="space-y-3">
      {meta?.shortDescription?.trim() ? (
        <div className="rounded-2xl border border-slate-800 bg-white p-4 dark:bg-slate-950/40">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Krótki opis oferty
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{meta.shortDescription}</p>
        </div>
      ) : null}

      {paramEntries.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-white dark:bg-slate-950/30">
          <p className="border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Parametry produktu
          </p>
          <dl className="divide-y divide-slate-800 text-sm">
            {paramEntries.map(([k, v]) => (
              <div key={k} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[minmax(8rem,12rem)_1fr]">
                <dt className="text-xs font-medium text-slate-500">{k}</dt>
                <dd className="text-slate-200">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {meta?.internalNote?.trim() ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-50 p-4 dark:bg-amber-500/5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600/90 dark:text-amber-400">
            Notatka wewnętrzna
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-amber-950 dark:text-amber-100/90">{meta.internalNote}</p>
        </div>
      ) : null}
    </div>
  );
}

/** Dane + handel w jednej zakładce. */
export function ProductDetailDataPanel({
  detail,
  showPrices,
  pricesInPreview = false,
  locationCode,
  isGroup,
  variantCount = 0,
}: {
  detail: Product;
  showPrices: boolean;
  pricesInPreview?: boolean;
  locationCode: string;
  isGroup?: boolean;
  variantCount?: number;
}) {
  const meta = detail.meta;
  const paramEntries = meta?.parameters ? Object.entries(meta.parameters) : [];
  const hasCommercialExtras =
    !!meta?.shortDescription?.trim() ||
    paramEntries.length > 0 ||
    !!meta?.internalNote?.trim();

  return (
    <div className="space-y-3">
      {showPrices && !pricesInPreview && <ProductDetailPriceGrid detail={detail} />}
      <ProductDetailFacts
        detail={detail}
        locationCode={locationCode}
        isGroup={isGroup}
        variantCount={variantCount}
      />
      {hasCommercialExtras && <ProductDetailCommercialExtras detail={detail} />}
    </div>
  );
}

export function ProductDetailDescPanel({
  description,
  shortDescription,
  loading = false,
  loadError = false,
}: {
  description: string;
  shortDescription?: string;
  loading?: boolean;
  loadError?: boolean;
}) {
  return (
    <div className="space-y-3">
      {shortDescription?.trim() ? (
        <div className="rounded-2xl border border-slate-800 bg-white p-4 dark:bg-slate-950/40">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Lead / krótki opis
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{shortDescription}</p>
        </div>
      ) : null}
      <div className="rounded-2xl border border-slate-800 bg-white p-4 dark:bg-slate-950/40">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Opis pełny
        </p>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200 dark:text-slate-300">
          {loading ? (
            <span className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ładuję pełny opis produktu...
            </span>
          ) : loadError ? (
            'Nie udało się pobrać pełnego opisu z bazy. Spróbuj odświeżyć produkt.'
          ) : description.trim() ? (
            description
          ) : (
            'Brak opisu — dodaj w trybie edycji lub importuj z BaseLinker.'
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductDetailAiPanel({ detail }: { detail: Product }) {
  const text = useMemo(() => buildProductAiContext(detail, detail.meta), [detail]);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4">
        <div className="flex gap-2">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
          <div>
            <p className="text-sm font-semibold text-slate-100">Materiał dla AI</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Skopiuj kontekst do ChatGPT / Claude i poproś o ofertę Allegro, mail lub opis sklepu.
              Zawiera SKU, stany, ceny, opisy i parametry — bez zdjęć.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Skopiowano' : 'Kopiuj kontekst'}
        </button>
      </div>
      <pre className="max-h-[min(50vh,28rem)] overflow-auto rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs leading-relaxed text-slate-300">
        {text}
      </pre>
    </div>
  );
}

export type { ProductMeta };
export { parametersToText, formatDimensions };
