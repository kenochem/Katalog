import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../types';
import { fetchCrmClients, fetchCrmOrders, type CrmClient, type CrmOrder } from '../lib/crm';
import { CRM_INBOX_ENABLED } from '../lib/crmInboxFeature';
import { fetchCrmInboxUnreadCount } from '../lib/crmMail';
import { getOpenLeads, pipelineStats, seedDemoLeads } from '../lib/leadsStore';
import { formatPricePln, marginPercent } from '../lib/format';
import { getOrderDraft, addToOrderDraft, saveOrderDraft } from '../lib/orderDraft';
import { getProductImage } from '../lib/products';
import { showToast } from '../lib/toast';
import { CrmMapRoutesView } from './CrmMapRoutesView';
import { CrmClientsPanel } from './CrmClientsPanel';
import { CrmHistoryPanel } from './CrmHistoryPanel';
import { CrmSubNav, type CrmTab } from './crm/CrmSubNav';
import { CrmTaskHome } from './crm/CrmTaskHome';
import { CrmTaskHeader } from './crm/CrmTaskHeader';
import { CrmCustomerInboxView } from './crm/CrmCustomerInboxView';
import { CrmInboxPausedView } from './crm/CrmInboxPausedView';
import { CrmPipelinePanel } from './crm/CrmPipelinePanel';
import { CrmOrderWorkspace } from './crm/CrmOrderWorkspace';
import { ClientTimelinePanel } from './crm/ClientTimelinePanel';
import {
  ArrowRight,
  History,
  MapPin,
  Percent,
  ShoppingCart,
  Target,
  Users,
} from 'lucide-react';

const COMMISSION_KEY = 'katalog-crm-commission-pct';
const CRM_COMPANY_CONFIG_KEY = 'kenochem-crm-company-config-v1';

type CrmPriorityTone = 'good' | 'warn' | 'info';

interface CrmCompanyConfig {
  quietDays: number;
  defaultPaymentDays: number;
  defaultCreditLimit: number;
  regions: string[];
}

interface CrmPriority {
  id: string;
  title: string;
  detail: string;
  value: string;
  tone: CrmPriorityTone;
  onClick: () => void;
}

const DEFAULT_CRM_COMPANY_CONFIG: CrmCompanyConfig = {
  quietDays: 60,
  defaultPaymentDays: 14,
  defaultCreditLimit: 5000,
  regions: ['Polnoc', 'Poludnie', 'Zachod', 'Wschod'],
};

function loadCommissionPct(): number {
  try {
    const n = Number(localStorage.getItem(COMMISSION_KEY));
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
  } catch {
    /* ignore */
  }
  return 15;
}

function saveCommissionPct(n: number) {
  localStorage.setItem(COMMISSION_KEY, String(n));
}

function loadCrmCompanyConfig(): CrmCompanyConfig {
  try {
    const raw = localStorage.getItem(CRM_COMPANY_CONFIG_KEY);
    if (!raw) return DEFAULT_CRM_COMPANY_CONFIG;
    const parsed = JSON.parse(raw) as Partial<CrmCompanyConfig>;
    return {
      quietDays: normalizeConfigNumber(parsed.quietDays, 60, 7, 365),
      defaultPaymentDays: normalizeConfigNumber(parsed.defaultPaymentDays, 14, 0, 120),
      defaultCreditLimit: normalizeConfigNumber(parsed.defaultCreditLimit, 5000, 0, 1000000),
      regions: normalizeRegions(parsed.regions),
    };
  } catch {
    return DEFAULT_CRM_COMPANY_CONFIG;
  }
}

function saveCrmCompanyConfig(config: CrmCompanyConfig) {
  localStorage.setItem(CRM_COMPANY_CONFIG_KEY, JSON.stringify(config));
}

function normalizeConfigNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeRegions(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : DEFAULT_CRM_COMPANY_CONFIG.regions;
  const regions = raw
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, 12);
  return regions.length ? regions : DEFAULT_CRM_COMPANY_CONFIG.regions;
}

interface CrmHubViewProps {
  authorLabel: string;
  displayLabel: string;
  roleLabel: string;
  products: Product[];
  cloudEnabled: boolean;
  orderCount: number;
  onChanged?: () => void;
  onOpenCatalog?: () => void;
}

export function CrmHubView({
  authorLabel,
  displayLabel,
  roleLabel,
  products,
  cloudEnabled,
  orderCount,
  onChanged,
  onOpenCatalog,
}: CrmHubViewProps) {
  const [tab, setTab] = useState<CrmTab>('hub');
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [orders, setOrders] = useState<CrmOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [commissionPct, setCommissionPct] = useState(loadCommissionPct);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [pipelineTick, setPipelineTick] = useState(0);
  const [clientPickerSignal, setClientPickerSignal] = useState(0);
  const [timelineClient, setTimelineClient] = useState<CrmClient | null>(null);
  const [companyConfig, setCompanyConfig] = useState(loadCrmCompanyConfig);

  async function reload() {
    if (!cloudEnabled) {
      setClients([]);
      setOrders([]);
      return;
    }
    setLoading(true);
    try {
      const [c, o] = await Promise.all([
        fetchCrmClients(),
        fetchCrmOrders(200),
      ]);
      setClients(c);
      setOrders(o);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Nie udało się wczytać CRM',
        'warn',
        4000,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [cloudEnabled]);

  useEffect(() => {
    saveCrmCompanyConfig(companyConfig);
  }, [companyConfig]);

  useEffect(() => {
    const onTab = (e: Event) => {
      const t = (e as CustomEvent<{ tab: CrmTab }>).detail?.tab;
      if (t) setTab(t);
    };
    window.addEventListener('katalog-crm-tab', onTab);
    return () => window.removeEventListener('katalog-crm-tab', onTab);
  }, []);

  useEffect(() => {
    seedDemoLeads();
    setPipelineTick((t) => t + 1);
    const onLeads = () => setPipelineTick((t) => t + 1);
    window.addEventListener('katalog-leads-changed', onLeads);
    return () => window.removeEventListener('katalog-leads-changed', onLeads);
  }, []);

  const pipelineOpen = useMemo(
    () => getOpenLeads().length,
    [pipelineTick],
  );
  const pipelineValue = useMemo(
    () => pipelineStats().pipelineValue,
    [pipelineTick],
  );

  const refreshInboxBadge = () => {
    if (!CRM_INBOX_ENABLED || !cloudEnabled) {
      setInboxUnread(0);
      return;
    }
    void fetchCrmInboxUnreadCount()
      .then(setInboxUnread)
      .catch(() => setInboxUnread(0));
  };

  useEffect(() => {
    refreshInboxBadge();
  }, [cloudEnabled]);

  const productBySku = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) {
      m.set(p.sku.toUpperCase(), p);
      m.set(p.id, p);
    }
    return m;
  }, [products]);

  const [draftSnapshot, setDraftSnapshot] = useState(() => getOrderDraft());

  useEffect(() => {
    setDraftSnapshot(getOrderDraft());
  }, [orderCount]);

  const draft = draftSnapshot;
  const draftQty = draft.items.reduce((s, i) => s + i.quantity, 0);

  const draftTotal = useMemo(() => {
    let sum = 0;
    for (const item of draft.items) {
      const p = productBySku.get(item.sku.toUpperCase());
      const price = item.unitPriceNet ?? p?.priceSaleNet ?? 0;
      sum += price * item.quantity;
    }
    return sum;
  }, [draft.items, productBySku, orderCount]);

  const stats = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthOrders = orders.filter((o) =>
      String(o.createdAt).startsWith(ym),
    );

    let turnover = 0;
    let marginWeighted = 0;
    let marginSum = 0;

    for (const o of monthOrders) {
      for (const item of o.items || []) {
        const qty = Math.max(1, Number(item.quantity) || 1);
        const sale =
          item.unitPriceNet != null && Number.isFinite(item.unitPriceNet)
            ? Number(item.unitPriceNet)
            : productBySku.get(String(item.sku || '').toUpperCase())
                ?.priceSaleNet ?? null;
        const purchase =
          productBySku.get(String(item.sku || '').toUpperCase())
            ?.pricePurchaseNet ?? null;
        if (sale != null) {
          turnover += sale * qty;
          const m = marginPercent(purchase, sale);
          if (m != null) {
            marginWeighted += ((sale - (purchase ?? sale)) / sale) * sale * qty;
            marginSum += sale * qty;
          }
        }
      }
    }

    const marginPct = marginSum > 0 ? (marginWeighted / marginSum) * 100 : null;
    const marginPln = marginSum > 0 ? marginWeighted : null;
    const commissionPln =
      marginPln != null ? (marginPln * commissionPct) / 100 : null;

    return {
      clients: clients.length,
      monthOrders: monthOrders.length,
      turnover,
      marginPct,
      marginPln,
      commissionPln,
    };
  }, [clients, orders, productBySku, commissionPct]);

  function goHub() {
    setTab('hub');
    void reload();
    onChanged?.();
  }

  function pickClientFromInbox(name: string) {
    const c = clients.find(
      (x) => x.displayName.toLowerCase() === name.toLowerCase(),
    );
    if (c) {
      saveOrderDraft({
        ...getOrderDraft(),
        clientName: c.displayName,
        clientId: c.id,
      });
      setTimelineClient(c);
      setTab('clients');
      onChanged?.();
    } else {
      saveOrderDraft({ ...getOrderDraft(), clientName: name, clientId: undefined });
      setTab('order');
      setClientPickerSignal((n) => n + 1);
      onChanged?.();
    }
  }

  function addSkuFromInbox(sku: string) {
    const p = products.find((x) => x.sku.toUpperCase() === sku.toUpperCase());
    if (!p) {
      showToast(`Nie znaleziono SKU ${sku}`, 'warn');
      return;
    }
    addToOrderDraft({
      id: p.id,
      sku: p.sku,
      displayName: p.displayName ?? p.name,
      catalog: p.catalog,
      imageUrl: getProductImage(p) || undefined,
    });
    onChanged?.();
    setTab('order');
    showToast(`Dodano ${p.sku}`, 'ok');
  }

  if (tab === 'routes') {
    return (
      <CrmMapRoutesView
        clients={clients}
        cloudEnabled={cloudEnabled}
        onBack={goHub}
        onClientsChange={setClients}
      />
    );
  }

  return (
    <div className="w-full space-y-4 pb-24">
      {tab === 'hub' && (
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-brand-950/40">
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-stretch lg:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">
                Panel handlowca
              </p>
              <h2 className="truncate text-xl font-semibold text-slate-50 sm:text-2xl">
                {displayLabel}
              </h2>
              <p className="text-sm text-slate-400">{roleLabel}</p>
              {!cloudEnabled && (
                <p className="text-xs text-amber-300/90">
                  Zaloguj się, żeby widzieć klientów i historię z chmury.
                </p>
              )}
              {loading && (
                <p className="text-xs text-slate-500">Odświeżanie danych…</p>
              )}
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:max-w-3xl lg:grid-cols-4">
              <Stat label="Klienci" value={String(stats.clients)} hint="Twoja baza" />
              <Stat
                label="W koszyku"
                value={String(orderCount)}
                hint="pozycje"
                accent={orderCount > 0}
              />
              <Stat
                label="Lejek"
                value={String(pipelineOpen)}
                hint={formatPricePln(pipelineValue)}
                accent={pipelineOpen > 0}
                onClick={() => setTab('pipeline')}
              />
              <Stat
                label="Obrót (mies.)"
                value={formatPricePln(stats.turnover)}
                hint={`marża ${stats.marginPct != null ? `${stats.marginPct.toFixed(1)}%` : '—'}`}
              />
            </div>
          </div>
        </section>
      )}

      {tab !== 'hub' && (
        <CrmSubNav
          active={tab}
          onChange={setTab}
          orderQty={draftQty}
          inboxUnread={inboxUnread}
          pipelineOpen={pipelineOpen}
        />
      )}

      {tab === 'hub' && (
        <div className="space-y-4">
          <CrmOperatingCenter
            cloudEnabled={cloudEnabled}
            clients={clients}
            orders={orders}
            draftQty={draftQty}
            draftTotal={draftTotal}
            inboxUnread={inboxUnread}
            pipelineOpen={pipelineOpen}
            pipelineValue={pipelineValue}
            stats={stats}
            companyConfig={companyConfig}
            onCompanyConfigChange={(patch) =>
              setCompanyConfig((current) => ({ ...current, ...patch }))
            }
            onOrder={() => setTab('order')}
            onPipeline={() => setTab('pipeline')}
            onInbox={() => setTab('inbox')}
            onRoutes={() => setTab('routes')}
            onClients={() => setTab('clients')}
            onHistory={() => setTab('history')}
            onCommission={() => setTab('commission')}
          />
          <CrmTaskHome
            draftQty={draftQty}
            draftTotal={draftTotal}
            inboxUnread={inboxUnread}
            pipelineOpen={pipelineOpen}
            clientCount={clients.length}
            onOrder={() => setTab('order')}
            onPipeline={() => setTab('pipeline')}
            onInbox={() => setTab('inbox')}
            onRoutes={() => setTab('routes')}
            onClients={() => setTab('clients')}
            onHistory={() => setTab('history')}
            onCommission={() => setTab('commission')}
          />
        </div>
      )}

      {tab === 'pipeline' && (
        <div className="space-y-4">
          <CrmTaskHeader
            title="Lejek sprzedaży"
            subtitle="Leady, aktywności, wygrana / porażka — jak w hub platform."
            onBack={goHub}
          />
          <CrmPipelinePanel
            clients={clients}
            onOpenOrder={() => setTab('order')}
          />
        </div>
      )}

      {tab === 'inbox' &&
        (CRM_INBOX_ENABLED ? (
          <CrmCustomerInboxView
            cloudEnabled={cloudEnabled}
            onOpenClient={pickClientFromInbox}
            onOpenOrderSku={addSkuFromInbox}
            onInboxChange={refreshInboxBadge}
          />
        ) : (
          <CrmInboxPausedView />
        ))}

      {tab === 'order' && (
        <CrmOrderWorkspace
          authorLabel={authorLabel}
          products={products}
          clients={clients}
          cloudEnabled={cloudEnabled}
          onChanged={onChanged}
          onClientsChange={setClients}
          onBack={goHub}
          onOpenCatalog={onOpenCatalog}
          clientPickerSignal={clientPickerSignal}
        />
      )}

      {tab === 'clients' && (
        <div className="space-y-4">
          <CrmTaskHeader
            title="Klienci"
            subtitle="Kartoteka, NIP/GUS, notatki — wybierz firmę do zamówienia."
            onBack={goHub}
          />
          <CrmClientsPanel
            cloudEnabled={cloudEnabled}
            onPickClient={(c) => {
              saveOrderDraft({
                ...getOrderDraft(),
                clientName: c.displayName,
                clientId: c.id,
              });
              setTimelineClient(c);
              onChanged?.();
              setTab('order');
            }}
          />
          {timelineClient && (
            <ClientTimelinePanel
              clientId={timelineClient.id}
              clientName={timelineClient.displayName}
            />
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          <CrmTaskHeader
            title="Historia zamówień"
            subtitle="Wczytaj poprzednią ofertę do koszyka."
            onBack={goHub}
          />
          <CrmHistoryPanel
            cloudEnabled={cloudEnabled}
            authorLabel={authorLabel}
            onReuse={(next) => {
              saveOrderDraft(next);
              onChanged?.();
              setTab('order');
            }}
          />
        </div>
      )}

      {tab === 'commission' && (
        <div className="mx-auto max-w-lg space-y-4">
          <CrmTaskHeader
            title="Prowizja od marży"
            subtitle="Szacunek z historii CRM w tym miesiącu + suwak udziału."
            onBack={goHub}
          />
          <label className="block">
            <span className="text-xs text-slate-500">Udział w marży (%)</span>
            <input
              type="range"
              min={0}
              max={50}
              value={commissionPct}
              onChange={(e) => {
                const v = Number(e.target.value);
                setCommissionPct(v);
                saveCommissionPct(v);
              }}
              className="mt-2 w-full accent-brand-500"
            />
            <p className="mt-1 text-center text-2xl font-semibold tabular-nums text-slate-100">
              {commissionPct}%
            </p>
          </label>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
            <p className="text-xs text-emerald-300/80">Szacunek ten miesiąc</p>
            <p className="text-2xl font-semibold tabular-nums text-emerald-200">
              {formatPricePln(stats.commissionPln)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Marża ≈ {formatPricePln(stats.marginPln)} · {stats.monthOrders} zapisów
            </p>
          </div>
        </div>
      )}

      {tab !== 'order' && draftQty > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[55] border-t border-slate-800 bg-slate-950/95 p-3 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={() => setTab('order')}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-brand-600 px-4 py-3.5 text-sm font-semibold text-white"
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Koszyk · {draftQty} poz.
            </span>
            <span className="tabular-nums">{formatPricePln(draftTotal)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function CrmOperatingCenter({
  cloudEnabled,
  clients,
  orders,
  draftQty,
  draftTotal,
  inboxUnread,
  pipelineOpen,
  pipelineValue,
  stats,
  companyConfig,
  onCompanyConfigChange,
  onOrder,
  onPipeline,
  onInbox,
  onRoutes,
  onClients,
  onHistory,
  onCommission,
}: {
  cloudEnabled: boolean;
  clients: CrmClient[];
  orders: CrmOrder[];
  draftQty: number;
  draftTotal: number;
  inboxUnread: number;
  pipelineOpen: number;
  pipelineValue: number;
  stats: {
    clients: number;
    monthOrders: number;
    turnover: number;
    marginPct: number | null;
    marginPln: number | null;
    commissionPln: number | null;
  };
  companyConfig: CrmCompanyConfig;
  onCompanyConfigChange: (patch: Partial<CrmCompanyConfig>) => void;
  onOrder: () => void;
  onPipeline: () => void;
  onInbox: () => void;
  onRoutes: () => void;
  onClients: () => void;
  onHistory: () => void;
  onCommission: () => void;
}) {
  const priorities = useMemo(
    () =>
      buildCrmPriorities({
        cloudEnabled,
        clientCount: clients.length,
        draftQty,
        draftTotal,
        inboxUnread,
        pipelineOpen,
        pipelineValue,
        onOrder,
        onPipeline,
        onInbox,
        onClients,
      }),
    [
      cloudEnabled,
      clients.length,
      draftQty,
      draftTotal,
      inboxUnread,
      onClients,
      onInbox,
      onOrder,
      onPipeline,
      pipelineOpen,
      pipelineValue,
    ],
  );

  const accountRows = useMemo(
    () => buildAccountRows(clients, orders).slice(0, 5),
    [clients, orders],
  );

  const companyLayer = useMemo(
    () => buildCompanyLayerModel(clients, orders, companyConfig),
    [clients, orders, companyConfig],
  );

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-xl shadow-slate-950/20">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">
                Centrum pracy CRM
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-50">
                Co handlowiec ma zrobic teraz
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
                Priorytety sa liczone z koszyka, lejka, inboxa i bazy klientow.
                To ma byc pierwszy ekran do pracy, nie ogolna strona katalogu.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:min-w-[18rem]">
              <MiniCrmMetric label="Zamowienia mies." value={String(stats.monthOrders)} />
              <MiniCrmMetric label="Prowizja est." value={formatPricePln(stats.commissionPln)} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {priorities.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="group min-h-32 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-brand-500/50 hover:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${crmToneClass(item.tone)}`}>
                    {item.value}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-brand-300" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                  {item.detail}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <CrmQuickAction icon={<ShoppingCart className="h-4 w-4" />} label="Nowa oferta" onClick={onOrder} />
            <CrmQuickAction icon={<Target className="h-4 w-4" />} label="Lejek" onClick={onPipeline} />
            <CrmQuickAction icon={<MapPin className="h-4 w-4" />} label="Trasa wizyt" onClick={onRoutes} />
            <CrmQuickAction icon={<Percent className="h-4 w-4" />} label="Prowizja" onClick={onCommission} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Ksiega klientow
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-50">
                Ostatni klienci i ruch
              </h3>
            </div>
            <button
              type="button"
              onClick={onClients}
              className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Klienci
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {accountRows.length ? (
              accountRows.map((row) => (
                <button
                  key={row.name}
                  type="button"
                  onClick={onHistory}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-left transition hover:border-brand-500/40 hover:bg-slate-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">{row.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.orders} zapisow - ostatnio {row.lastSeen}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-50">
                      {formatPricePln(row.value)}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-5 text-center">
                <Users className="mx-auto h-7 w-7 text-slate-600" />
                <p className="mt-2 text-sm font-semibold text-slate-200">
                  Brak historii klientow
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Dodaj klienta lub zapisz pierwsza oferte, a tutaj pojawi sie robocza ksiega.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <CrmQuickAction icon={<Users className="h-4 w-4" />} label="Baza klientow" onClick={onClients} />
            <CrmQuickAction icon={<History className="h-4 w-4" />} label="Historia" onClick={onHistory} />
          </div>
        </div>
      </section>

      <CrmCompanyLayer
        model={companyLayer}
        config={companyConfig}
        onConfigChange={onCompanyConfigChange}
        onOrder={onOrder}
        onRoutes={onRoutes}
        onClients={onClients}
        onHistory={onHistory}
      />
    </div>
  );
}

interface CrmCompanyLayerModel {
  activeClients: number;
  sleepingClients: number;
  prospectClients: number;
  geoReady: number;
  geoMissing: number;
  pendingOrders: number;
  sentOrders: number;
  ordersWithoutClient: number;
  savedValue: number;
  sentValue: number;
  quietExamples: string[];
}

function CrmCompanyLayer({
  model,
  config,
  onConfigChange,
  onOrder,
  onRoutes,
  onClients,
  onHistory,
}: {
  model: CrmCompanyLayerModel;
  config: CrmCompanyConfig;
  onConfigChange: (patch: Partial<CrmCompanyConfig>) => void;
  onOrder: () => void;
  onRoutes: () => void;
  onClients: () => void;
  onHistory: () => void;
}) {
  const regionText = config.regions.join(', ');

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-xl shadow-slate-950/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">
            Model Kenochem
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-50">
            B2B, rejony, wizyty i kontrola zamowien
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
            Ten blok pilnuje klientow, tras handlowcow i zamowien oczekujacych na dalszy krok.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[34rem]">
          <MiniCrmMetric label="Aktywni" value={String(model.activeClients)} />
          <MiniCrmMetric label="Uspieni" value={String(model.sleepingClients)} />
          <MiniCrmMetric label="Prospect" value={String(model.prospectClients)} />
          <MiniCrmMetric label="Na mapie" value={`${model.geoReady}/${model.geoReady + model.geoMissing}`} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-4">
        <button
          type="button"
          onClick={onClients}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-brand-500/50 hover:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              B2B
            </span>
            <Users className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-100">Baza klientow i statusy</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {model.sleepingClients > 0
              ? `${model.sleepingClients} klientow przekroczylo prog ${config.quietDays} dni bez zamowienia.`
              : 'Statusy sa gotowe pod rozdzielenie aktywnych, uspionych i nowych firm.'}
          </p>
          {model.quietExamples.length > 0 && (
            <p className="mt-3 truncate text-xs font-medium text-amber-300">
              {model.quietExamples.join(' / ')}
            </p>
          )}
        </button>

        <button
          type="button"
          onClick={onRoutes}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-brand-500/50 hover:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-lg bg-sky-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
              Rejony
            </span>
            <MapPin className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-100">Trasy i wizyty</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {model.geoReady > 0
              ? `${model.geoReady} klientow ma pozycje do planowania tras.`
              : 'Dodaj lokalizacje klientow, zeby budowac tygodniowe plany wizyt.'}
          </p>
          <p className="mt-3 truncate text-xs font-medium text-slate-300">
            {config.regions.slice(0, 4).join(' / ')}
          </p>
        </button>

        <button
          type="button"
          onClick={onHistory}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-brand-500/50 hover:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-lg bg-amber-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              Kontrola
            </span>
            <History className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-100">Status zamowien</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {model.pendingOrders} zapisanych do akceptacji, {model.sentOrders} wyslanych dalej.
          </p>
          <p className="mt-3 text-xs font-medium text-slate-300">
            Szkice {formatPricePln(model.savedValue)} / wyslane {formatPricePln(model.sentValue)}
          </p>
        </button>

        <button
          type="button"
          onClick={onOrder}
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-brand-500/50 hover:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-lg bg-brand-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-300">
              Flow
            </span>
            <ShoppingCart className="h-4 w-4 text-slate-500" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-100">Zamowienie z wizyty</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Tworzenie zamowienia zostaje w CRM, a katalog jest tylko zagniezdzony w koszyku.
          </p>
          {model.ordersWithoutClient > 0 && (
            <p className="mt-3 text-xs font-medium text-amber-300">
              {model.ordersWithoutClient} zapisow bez przypisanego klienta
            </p>
          )}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.3fr]">
        <CrmConfigField
          label="Klient cichnie po"
          suffix="dni"
          value={config.quietDays}
          min={7}
          max={365}
          onChange={(quietDays) => onConfigChange({ quietDays })}
        />
        <CrmConfigField
          label="Domyslny termin"
          suffix="dni"
          value={config.defaultPaymentDays}
          min={0}
          max={120}
          onChange={(defaultPaymentDays) => onConfigChange({ defaultPaymentDays })}
        />
        <CrmConfigField
          label="Limit startowy"
          suffix="PLN"
          value={config.defaultCreditLimit}
          min={0}
          max={1000000}
          onChange={(defaultCreditLimit) => onConfigChange({ defaultCreditLimit })}
        />
        <label className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Rejony handlowe
          </span>
          <input
            value={regionText}
            onChange={(e) => onConfigChange({ regions: normalizeRegions(e.target.value) })}
            className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-brand-500"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniCrmMetric label="Termin platnosci" value={`${config.defaultPaymentDays} dni`} />
        <MiniCrmMetric label="Brak pozycji mapy" value={String(model.geoMissing)} />
        <MiniCrmMetric label="Do przypisania" value={String(model.ordersWithoutClient)} />
      </div>
    </section>
  );
}

function CrmConfigField({
  label,
  suffix,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 focus-within:border-brand-500">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(normalizeConfigNumber(e.target.value, value, min, max))}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold tabular-nums text-slate-100 outline-none"
        />
        <span className="text-xs font-medium text-slate-500">{suffix}</span>
      </div>
    </label>
  );
}

function buildCompanyLayerModel(
  clients: CrmClient[],
  orders: CrmOrder[],
  config: CrmCompanyConfig,
): CrmCompanyLayerModel {
  const ordersByClient = new Map<string, CrmOrder[]>();

  for (const order of orders) {
    const keys = [
      order.clientId ? `id:${order.clientId}` : '',
      order.clientName ? `name:${order.clientName.toLowerCase()}` : '',
    ].filter(Boolean);
    for (const key of keys) {
      const list = ordersByClient.get(key) ?? [];
      list.push(order);
      ordersByClient.set(key, list);
    }
  }

  let activeClients = 0;
  let sleepingClients = 0;
  let prospectClients = 0;
  let geoReady = 0;
  const quietExamples: string[] = [];
  const quietMs = config.quietDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  for (const client of clients) {
    if (client.lat != null && client.lng != null) geoReady += 1;
    const clientOrders =
      ordersByClient.get(`id:${client.id}`) ??
      ordersByClient.get(`name:${client.displayName.toLowerCase()}`) ??
      [];
    const lastOrderAt = Math.max(
      ...clientOrders
        .map((order) => dateTime(order.createdAt))
        .filter((value): value is number => value != null),
    );

    if (!clientOrders.length || !Number.isFinite(lastOrderAt)) {
      prospectClients += 1;
    } else if (now - lastOrderAt > quietMs) {
      sleepingClients += 1;
      if (quietExamples.length < 3) quietExamples.push(client.displayName);
    } else {
      activeClients += 1;
    }
  }

  let pendingOrders = 0;
  let sentOrders = 0;
  let ordersWithoutClient = 0;
  let savedValue = 0;
  let sentValue = 0;

  for (const order of orders) {
    const value = orderNetValue(order);
    if (order.status === 'saved') {
      pendingOrders += 1;
      savedValue += value;
    } else {
      sentOrders += 1;
      sentValue += value;
    }
    if (!order.clientId) ordersWithoutClient += 1;
  }

  return {
    activeClients,
    sleepingClients,
    prospectClients,
    geoReady,
    geoMissing: Math.max(0, clients.length - geoReady),
    pendingOrders,
    sentOrders,
    ordersWithoutClient,
    savedValue,
    sentValue,
    quietExamples,
  };
}

function orderNetValue(order: CrmOrder): number {
  return (order.items || []).reduce((sum, item) => {
    const price = item.unitPriceNet ?? 0;
    return sum + price * Math.max(1, Number(item.quantity) || 1);
  }, 0);
}

function dateTime(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function buildCrmPriorities({
  cloudEnabled,
  clientCount,
  draftQty,
  draftTotal,
  inboxUnread,
  pipelineOpen,
  pipelineValue,
  onOrder,
  onPipeline,
  onInbox,
  onClients,
}: {
  cloudEnabled: boolean;
  clientCount: number;
  draftQty: number;
  draftTotal: number;
  inboxUnread: number;
  pipelineOpen: number;
  pipelineValue: number;
  onOrder: () => void;
  onPipeline: () => void;
  onInbox: () => void;
  onClients: () => void;
}): CrmPriority[] {
  const priorities: CrmPriority[] = [];

  if (draftQty > 0) {
    priorities.push({
      id: 'draft',
      title: 'Domknij koszyk',
      detail: 'Masz zaczeta oferte lub zamowienie. Warto wyslac albo zapisac historie.',
      value: `${draftQty} poz.`,
      tone: 'warn',
      onClick: onOrder,
    });
  }

  if (CRM_INBOX_ENABLED && inboxUnread > 0) {
    priorities.push({
      id: 'inbox',
      title: 'Odpowiedz klientom',
      detail: 'Inbox ma nieobsluzone wiadomosci, ktore moga zamienic sie w oferty.',
      value: String(inboxUnread),
      tone: 'warn',
      onClick: onInbox,
    });
  }

  if (pipelineOpen > 0) {
    priorities.push({
      id: 'pipeline',
      title: 'Przesun szanse w lejku',
      detail: 'Otwarty lejek wymaga kolejnego kontaktu, oferty albo decyzji.',
      value: formatPricePln(pipelineValue),
      tone: 'info',
      onClick: onPipeline,
    });
  }

  if (!cloudEnabled) {
    priorities.push({
      id: 'cloud',
      title: 'Zaloguj CRM do chmury',
      detail: 'Bez chmury nie bedzie wspolnej historii klientow i zamowien.',
      value: 'lokalnie',
      tone: 'warn',
      onClick: onClients,
    });
  } else if (clientCount === 0) {
    priorities.push({
      id: 'clients',
      title: 'Dodaj pierwszych klientow',
      detail: 'Baza klientow jest pusta, wiec CRM nie ma jeszcze ksiegi pracy.',
      value: '0',
      tone: 'warn',
      onClick: onClients,
    });
  }

  priorities.push({
    id: 'new-order',
    title: 'Utworz oferte',
    detail: 'Wybierz klienta, dodaj produkty z zagniezdzonego katalogu i wyslij.',
    value: draftTotal > 0 ? formatPricePln(draftTotal) : 'start',
    tone: draftQty > 0 ? 'warn' : 'good',
    onClick: onOrder,
  });

  return priorities.slice(0, 5);
}

function buildAccountRows(clients: CrmClient[], orders: CrmOrder[]) {
  const rows = new Map<string, { name: string; value: number; orders: number; lastSeen: string }>();

  for (const client of clients) {
    rows.set(client.displayName, {
      name: client.displayName,
      value: 0,
      orders: 0,
      lastSeen: client.updatedAt ? client.updatedAt.slice(0, 10) : '-',
    });
  }

  for (const order of orders) {
    const name = order.clientName || 'Bez klienta';
    const current =
      rows.get(name) ??
      {
        name,
        value: 0,
        orders: 0,
        lastSeen: order.createdAt ? order.createdAt.slice(0, 10) : '-',
      };
    current.orders += 1;
    current.value += orderNetValue(order);
    if (order.createdAt && order.createdAt.slice(0, 10) > current.lastSeen) {
      current.lastSeen = order.createdAt.slice(0, 10);
    }
    rows.set(name, current);
  }

  return Array.from(rows.values()).sort((a, b) => {
    const byDate = b.lastSeen.localeCompare(a.lastSeen);
    if (byDate !== 0) return byDate;
    return b.value - a.value;
  });
}

function MiniCrmMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-slate-50">{value}</p>
    </div>
  );
}

function CrmQuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-brand-500/50 hover:bg-slate-800"
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function crmToneClass(tone: CrmPriorityTone): string {
  if (tone === 'warn') return 'bg-amber-500/15 text-amber-300';
  if (tone === 'good') return 'bg-emerald-500/15 text-emerald-300';
  return 'bg-sky-500/15 text-sky-300';
}

function Stat({
  label,
  value,
  hint,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2.5 text-left ${
        accent
          ? 'border-emerald-500/35 bg-emerald-500/10'
          : 'border-slate-700/80 bg-slate-950/50'
      } ${onClick ? 'hover:border-emerald-400/50 transition' : ''}`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 truncate text-base font-semibold tabular-nums text-slate-50 sm:text-lg">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 truncate text-[10px] text-slate-500">{hint}</p>
      )}
    </Comp>
  );
}
