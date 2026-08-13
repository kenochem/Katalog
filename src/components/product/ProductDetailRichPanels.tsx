import { Copy, Check, Sparkles, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { AddToCollectionMenu } from '../AddToCollectionMenu';
import { showToast } from '../../lib/toast';
import { useMemo, useState } from 'react';
import type { Product } from '../../types';
import { CATALOG_LABELS } from '../../types';
import { formatStock, formatPricePln, formatMarginPercent, marginPercent } from '../../lib/format';
import { resolveProductCatalogKind } from '../../lib/catalogKind';
import { buildProductAiContext } from '../../lib/productAiContext';
import { baselinkerLinkLabel, hasBaselinkerLink } from '../../lib/baselinkerLink';
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
}: {
  label: string;
  value: string;
  mono?: boolean;
  prominent?: boolean;
  span?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-0.5 bg-slate-950/50 px-4 py-3 sm:flex-row sm:gap-3 ${
        span ? 'sm:col-span-2' : ''
      }`}
    >
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400 sm:w-32 dark:text-slate-500">
        {label}
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

function FactSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800">
      <p className="border-b border-slate-800 bg-slate-900/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <dl className="grid gap-px bg-slate-800 text-sm sm:grid-cols-2">{children}</dl>
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
  const meta = detail.meta;
  const catalogKind = resolveProductCatalogKind(detail);
  const imageCount =
    (detail.hasImage || detail.customImageUrl || detail.imageUrl ? 1 : 0) +
    (detail.extraImageUrls?.length ?? 0);
  const mfr =
    detail.manufacturer?.trim() &&
    detail.manufacturer.trim().toLowerCase() !== 'wapro'
      ? detail.manufacturer
      : '';

  return (
    <div className="space-y-3">
      <FactSection title="Identyfikacja">
        <DetailRow label="SKU" value={detail.sku} mono prominent />
        {!isGroup && <DetailRow label="EAN" value={detail.ean || '—'} mono prominent />}
        <DetailRow label="ID rekordu" value={detail.id} mono span />
        {hasBaselinkerLink(detail) ? (
          <DetailRow
            label="BaseLinker"
            value={baselinkerLinkLabel(detail) ?? 'Powiązany'}
            mono
          />
        ) : null}
        {meta?.shopCategoryPath ? (
          <DetailRow label="Kategoria sklepu" value={meta.shopCategoryPath} span />
        ) : null}
        <DetailRow label="Katalog" value={CATALOG_LABELS[detail.catalog || 'accessories']} />
        <DetailRow
          label="Typ"
          value={catalogKind === 'shop' ? 'Produkty / sklep' : 'Akcesoria / WAPRO'}
        />
        {isWaproSkeletonProduct(detail) ? (
          <DetailRow
            label="Źródło"
            value="Mag WAPRO — szkielet (SKU, nazwa, ceny; zdjęcie do uzupełnienia)"
            span
          />
        ) : null}
        <DetailRow label="Kategoria" value={detail.category} />
        {mfr ? <DetailRow label="Producent" value={mfr} span /> : null}
        {detail.name !== detail.displayName ? (
          <DetailRow label="Nazwa WAPRO / BL" value={detail.name} span />
        ) : null}
        <DetailRow label="Tytuł oferty" value={detail.displayName} span />
      </FactSection>

      <FactSection title="Magazyn i media">
        <DetailRow
          label="Stan"
          value={
            detail.stockManual
              ? `${formatStock(detail.stock ?? 0)} · ręczny`
              : formatStock(detail.stock ?? 0)
          }
          prominent
        />
        {isGroup && variantCount > 0 ? (
          <DetailRow label="Warianty" value={`${variantCount} pozycji SKU`} />
        ) : null}
        {locationCode ? <DetailRow label="Lokalizacja" value={locationCode} mono span /> : null}
        <DetailRow label="Zdjęcia" value={imageCount > 0 ? `${imageCount} plików` : 'Brak'} />
        {detail.tags?.length ? (
          <DetailRow label="Tagi" value={detail.tags.join(' · ')} span />
        ) : null}
      </FactSection>

      {(meta?.weightKg != null ||
        formatDimensions(meta) ||
        meta?.unit ||
        meta?.vatRate != null) && (
        <FactSection title="Logistyka (BaseLinker)">
          {meta?.weightKg != null ? (
            <DetailRow label="Waga" value={`${meta.weightKg} kg`} />
          ) : null}
          {formatDimensions(meta) ? (
            <DetailRow label="Wymiary" value={formatDimensions(meta)!} mono />
          ) : null}
          {meta?.unit ? <DetailRow label="Jednostka" value={meta.unit} /> : null}
          {meta?.vatRate != null ? (
            <DetailRow label="VAT" value={`${meta.vatRate}%`} />
          ) : null}
        </FactSection>
      )}
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
  const clientIsGross = gross != null;
  const clientAmount = gross ?? saleNet;
  const clientLabel = clientIsGross ? 'Sprzedaż brutto (cena dla klienta)' : 'Sprzedaż netto (cena dla klienta)';
  const clientUnit = clientIsGross ? 'brutto' : 'netto';

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
          {clientLabel}
        </p>
        <p className="catalog-product-price-panel__hero-value mt-0.5 tabular-nums">
          <span className={compact ? 'text-2xl font-bold' : 'text-3xl font-bold'}>
            {formatPricePln(clientAmount)}
          </span>
          <span className="catalog-product-price-panel__hero-unit ml-2 text-sm font-semibold">
            {clientUnit}
          </span>
        </p>
        {clientIsGross && saleNet != null ? (
          <p className="catalog-product-price-panel__netto-line mt-1.5 text-xs tabular-nums">
            Netto:{' '}
            <span className="catalog-product-price-panel__netto-value">
              {formatPricePln(saleNet)}
            </span>
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 border-t border-slate-700/50 sm:grid-cols-3 sm:divide-x sm:divide-slate-700/50 dark:border-slate-700/80 dark:sm:divide-slate-700/80">
        <ProductPriceMetric
          label="Zakup netto"
          value={formatPricePln(purchase)}
          hint="Koszt magazynowy"
        />
        <ProductPriceMetric
          label="Sprzedaż netto"
          value={formatPricePln(saleNet)}
          hint={clientIsGross ? 'Bez VAT' : undefined}
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
  const price = detail.priceSaleGross ?? detail.priceSaleNet;
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
  const shortLead = detail.meta?.shortDescription?.trim();

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
      {shortLead ? (
        <p className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-xs leading-relaxed text-slate-300 line-clamp-3">
          {shortLead}
        </p>
      ) : null}
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
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Krótki opis oferty
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{meta.shortDescription}</p>
        </div>
      ) : null}

      {paramEntries.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
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
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600/90 dark:text-amber-400">
            Notatka wewnętrzna
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-amber-100/90">{meta.internalNote}</p>
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
}: {
  description: string;
  shortDescription?: string;
}) {
  return (
    <div className="space-y-3">
      {shortDescription?.trim() ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Lead / krótki opis
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">{shortDescription}</p>
        </div>
      ) : null}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Opis pełny
        </p>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200 dark:text-slate-300">
          {description.trim() ? description : 'Brak opisu — dodaj w trybie edycji lub importuj z BaseLinker.'}
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
