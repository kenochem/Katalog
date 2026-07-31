import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Briefcase,
  CalendarDays,
  ChevronRight,
  MapPin,
  Percent,
  Route,
  ShoppingCart,
  Users,
  History,
  Sparkles,
} from 'lucide-react';
import type { Product } from '../types';
import {
  fetchCrmClients,
  fetchCrmOrders,
  type CrmClient,
  type CrmOrder,
} from '../lib/crm';
import { formatPricePln, marginPercent } from '../lib/format';
import { showToast } from '../lib/toast';
import { CrmOrderView } from './CrmOrderView';
import { CrmMapRoutesView } from './CrmMapRoutesView';

type CrmTool =
  | 'hub'
  | 'workspace'
  | 'routes'
  | 'reminders'
  | 'commission';

const COMMISSION_KEY = 'katalog-crm-commission-pct';

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

interface CrmHubViewProps {
  authorLabel: string;
  displayLabel: string;
  roleLabel: string;
  products: Product[];
  cloudEnabled: boolean;
  orderCount: number;
  onChanged?: () => void;
}

export function CrmHubView({
  authorLabel,
  displayLabel,
  roleLabel,
  products,
  cloudEnabled,
  orderCount,
  onChanged,
}: CrmHubViewProps) {
  const [tool, setTool] = useState<CrmTool>('hub');
  const [workspaceTab, setWorkspaceTab] = useState<
    'current' | 'clients' | 'history'
  >('current');
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [orders, setOrders] = useState<CrmOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [commissionPct, setCommissionPct] = useState(loadCommissionPct);

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

  const productBySku = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) {
      m.set(p.sku.toUpperCase(), p);
      m.set(p.id, p);
    }
    return m;
  }, [products]);

  const stats = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthOrders = orders.filter((o) =>
      String(o.createdAt).startsWith(ym),
    );
    const quotes = orders.filter((o) => o.kind === 'quote');
    const sales = orders.filter((o) => o.kind !== 'quote');

    let turnover = 0;
    let marginSum = 0;
    let marginWeighted = 0;

    for (const o of monthOrders) {
      for (const item of o.items || []) {
        const qty = Math.max(1, Number(item.quantity) || 1);
        const sale =
          item.unitPriceNet != null && Number.isFinite(item.unitPriceNet)
            ? Number(item.unitPriceNet)
            : productBySku.get(String(item.sku || '').toUpperCase())
                ?.priceSaleNet ??
              productBySku.get(item.productId)?.priceSaleNet ??
              null;
        const purchase =
          productBySku.get(String(item.sku || '').toUpperCase())
            ?.pricePurchaseNet ??
          productBySku.get(item.productId)?.pricePurchaseNet ??
          null;
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
    const marginPln =
      marginSum > 0 ? marginWeighted : null;
    const commissionPln =
      marginPln != null ? (marginPln * commissionPct) / 100 : null;

    return {
      clients: clients.length,
      monthOrders: monthOrders.length,
      quotesOpen: quotes.length,
      salesCount: sales.length,
      turnover,
      marginPct,
      marginPln,
      commissionPln,
      orderDraft: orderCount,
    };
  }, [clients, orders, productBySku, commissionPct, orderCount]);

  function openWorkspace(tab: 'current' | 'clients' | 'history') {
    setWorkspaceTab(tab);
    setTool('workspace');
  }

  if (tool === 'workspace') {
    return (
      <div className="space-y-3 pb-8">
        <button
          type="button"
          onClick={() => {
            setTool('hub');
            void reload();
            onChanged?.();
          }}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← Panel CRM
        </button>
        <CrmOrderView
          authorLabel={authorLabel}
          products={products}
          cloudEnabled={cloudEnabled}
          onChanged={onChanged}
          initialTab={workspaceTab}
        />
      </div>
    );
  }

  if (tool === 'routes') {
    return (
      <CrmMapRoutesView
        clients={clients}
        cloudEnabled={cloudEnabled}
        onBack={() => {
          setTool('hub');
          void reload();
        }}
        onClientsChange={setClients}
      />
    );
  }

  if (tool === 'reminders') {
    return (
      <SoonCrm
        title="Przypomnienia"
        blurb="Ważne daty: ważność ofert, follow-upy, urodziny kontaktów, terminy dostaw — powiadomienia w PWA."
        onBack={() => setTool('hub')}
      />
    );
  }

  if (tool === 'commission') {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-8">
        <button
          type="button"
          onClick={() => setTool('hub')}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← Panel CRM
        </button>
        <h2 className="text-lg font-semibold text-slate-100">
          Prowizja od marży
        </h2>
        <p className="text-sm text-slate-400">
          Procent od marży obrotu (szacunek z historii zamówień/ofert w tym
          miesiącu). Ustawienie lokalne na tym urządzeniu — docelowo z profilu
          handlowca w bazie (ustala szef).
        </p>
        <label className="block">
          <span className="text-xs text-slate-500">
            Udział handlowca w marży (%)
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={commissionPct}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              const v = Math.min(100, Math.max(0, n));
              setCommissionPct(v);
              saveCommissionPct(v);
            }}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100"
          />
        </label>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="text-xs text-emerald-300/80">Szacunek ten miesiąc</p>
          <p className="text-2xl font-semibold tabular-nums text-emerald-200">
            {formatPricePln(stats.commissionPln)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Marża ≈ {formatPricePln(stats.marginPln)} · {commissionPct}% udziału
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 pb-10">
      {/* Profil / żywy panel */}
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
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:max-w-3xl lg:grid-cols-3 xl:grid-cols-6">
            <Stat
              label="Klienci"
              value={String(stats.clients)}
              hint="Twoja baza"
            />
            <Stat
              label="W koszyku"
              value={String(stats.orderDraft)}
              hint="pozycje draft"
              accent={stats.orderDraft > 0}
            />
            <Stat
              label="Ten miesiąc"
              value={String(stats.monthOrders)}
              hint="zapisy CRM"
            />
            <Stat
              label="Obrót (mies.)"
              value={formatPricePln(stats.turnover)}
              hint="netto z pozycji"
            />
            <Stat
              label="Marża obr."
              value={
                stats.marginPct != null
                  ? `${stats.marginPct.toFixed(1)}%`
                  : '—'
              }
              hint={formatPricePln(stats.marginPln)}
              accent
            />
            <Stat
              label="Twoja prowizja"
              value={formatPricePln(stats.commissionPln)}
              hint={`${commissionPct}% od marży`}
              accent
              onClick={() => setTool('commission')}
            />
          </div>
        </div>
      </section>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-200">
          Narzędzia handlowe
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            icon={<ShoppingCart className="h-5 w-5" />}
            title="Zamówienia i oferty"
            subtitle="Koszyk, Discord, prośba o ofertę — bieżąca praca"
            status="ready"
            badge={orderCount > 0 ? String(orderCount) : undefined}
            onClick={() => openWorkspace('current')}
          />
          <ModuleCard
            icon={<Users className="h-5 w-5" />}
            title="Klienci"
            subtitle="Kartoteka, NIP/GUS, notatki — Twoi kontrahenci"
            status="ready"
            onClick={() => openWorkspace('clients')}
          />
          <ModuleCard
            icon={<History className="h-5 w-5" />}
            title="Historia"
            subtitle="Wysłane i zapisane zamówienia / oferty"
            status="ready"
            onClick={() => openWorkspace('history')}
          />
          <ModuleCard
            icon={<Route className="h-5 w-5" />}
            title="Trasy"
            subtitle="Kolejność wizyt, czas jazdy i dystans na mapie"
            status="ready"
            onClick={() => setTool('routes')}
          />
          <ModuleCard
            icon={<Bell className="h-5 w-5" />}
            title="Przypomnienia"
            subtitle="Follow-upy, ważność ofert, ważne daty"
            status="soon"
            onClick={() => setTool('reminders')}
          />
          <ModuleCard
            icon={<Percent className="h-5 w-5" />}
            title="Prowizja / marża"
            subtitle="Udział w marży obrotu — żywy szacunek z historii"
            status="ready"
            onClick={() => setTool('commission')}
          />
          <ModuleCard
            icon={<Briefcase className="h-5 w-5" />}
            title="Lejek sprzedaży"
            subtitle="Lead → oferta → zamówienie (jak w CRM-Base)"
            status="soon"
            onClick={() =>
              showToast('Lejek — w kolejce po statusach ofert', 'info', 3500)
            }
          />
          <ModuleCard
            icon={<CalendarDays className="h-5 w-5" />}
            title="Aktywności"
            subtitle="Telefony, maile, wizyty przy kliencie"
            status="soon"
            onClick={() =>
              showToast('Aktywności — następny etap CRM', 'info', 3500)
            }
          />
          <ModuleCard
            icon={<MapPin className="h-5 w-5" />}
            title="Mapa klientów"
            subtitle="Pinezki na mapie Polski + budowa tras"
            status="ready"
            onClick={() => setTool('routes')}
          />
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
        CRM to osobny tryb od katalogu — tu budujemy pełny warsztat handlowca.
        Kierunek modelu: docs/crm-from-crm-base.md
      </p>
    </div>
  );
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

function ModuleCard({
  icon,
  title,
  subtitle,
  status,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  status: 'ready' | 'soon';
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left transition hover:border-slate-600 hover:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-xl bg-slate-800 p-2 text-brand-400">{icon}</span>
        <span className="flex items-center gap-1.5">
          {badge && (
            <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
              {badge}
            </span>
          )}
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              status === 'ready'
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-slate-700/80 text-slate-400'
            }`}
          >
            {status === 'ready' ? 'Dostępne' : 'Wkrótce'}
          </span>
        </span>
      </div>
      <div>
        <p className="font-semibold text-slate-100">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p>
      </div>
      <span className="mt-auto flex items-center gap-1 text-xs text-slate-500 group-hover:text-slate-300">
        Wejdź
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function SoonCrm({
  title,
  blurb,
  onBack,
}: {
  title: string;
  blurb: string;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-4 pb-8">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-slate-400 hover:text-slate-200"
      >
        ← Panel CRM
      </button>
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-4 py-6 text-sm leading-relaxed text-slate-400">
        {blurb}
        <span className="mt-3 block text-xs text-slate-500">
          Moduł w siatce CRM — doprecyzujemy po ustaleniu tras i źródeł danych.
        </span>
      </p>
    </div>
  );
}
