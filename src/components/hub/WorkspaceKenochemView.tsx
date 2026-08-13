import {
  ArrowRight,
  Boxes,
  Calculator,
  CalendarDays,
  MessageSquare,
  Package,
  ShoppingCart,
  Sparkles,
  Star,
} from 'lucide-react';
import type { HubView } from '../../app/hubNavigation';
import { ContextHelp } from '../ContextHelp';

interface WorkspaceKenochemViewProps {
  favoriteCount: number;
  orderCount: number;
  productCount: number;
  onNavigate: (view: HubView) => void;
  canCrm: boolean;
  canOps: boolean;
  canComms: boolean;
}

function Tile({
  title,
  desc,
  icon,
  iconSrc,
  accent,
  meta,
  onClick,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  iconSrc?: string;
  accent: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-44 flex-col rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 text-left transition hover:border-brand-500/40 hover:bg-slate-900"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        {iconSrc ? (
          <img
            src={iconSrc}
            alt=""
            className="h-12 w-12 shrink-0 rounded-2xl shadow-lg shadow-black/25"
            width={48}
            height={48}
          />
        ) : (
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${accent}`}>
            {icon}
          </div>
        )}
        {meta && (
          <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {meta}
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{desc}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-400 opacity-0 transition group-hover:opacity-100">
        Otwórz
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

export function WorkspaceKenochemView({
  favoriteCount,
  orderCount,
  productCount,
  onNavigate,
  canCrm,
  canOps,
  canComms,
}: WorkspaceKenochemViewProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-5 sm:py-8">
      <div className="mb-6 overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-brand-950/30 p-4 shadow-xl shadow-slate-950/20 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">
              Kenochem Suite
            </p>
            <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              Jeden pulpit do aplikacji Kenochem
              <ContextHelp id="suite" side="left" />
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Katalog, CRM, Operacje, Talk, Magazyn i Kalendarz dzialaja jako widoki jednego huba.
              Przechodzisz miedzy nimi z bocznego panelu bez ponownego logowania.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:min-w-[24rem]">
            {[
              ['/icons/icon-192.png', 'Katalog'],
              ['/icons/sell-icon-192.png', 'CRM'],
              ['/icons/ops-icon-192.png', 'Operacje'],
              ['/icons/talk-icon-192.png', 'Talk'],
              ['/icons/stock-icon-192.png', 'Magazyn'],
              ['/icons/calendar-icon-192.png', 'Kalendarz'],
            ].map(([src, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (label === 'CRM') onNavigate('crm');
                  else if (label === 'Operacje') onNavigate('ops');
                  else if (label === 'Talk') onNavigate('comms');
                  else if (label === 'Kalendarz') onNavigate('calendar');
                  else if (label === 'Magazyn') onNavigate('warehouse');
                  else if (label === 'Katalog') onNavigate('catalog');
                  else onNavigate('workspace');
                }}
                className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/50 p-2 text-left transition hover:border-brand-500/50 hover:bg-slate-900"
              >
                <img src={src} alt="" className="h-9 w-9 rounded-xl" width={36} height={36} />
                <span className="min-w-0 truncate text-xs font-semibold text-slate-200">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mb-6">
        <h2 className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-slate-50 sm:text-xl">
          Podsumowanie
          <ContextHelp id="suite" />
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Kenochem Suite — katalog WAPRO, CRM, magazyn i operacje w jednym miejscu.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
          <p className="text-xs text-slate-500">Produkty</p>
          <p className="text-2xl font-bold text-slate-100">{productCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
          <p className="text-xs text-slate-500">Ulubione</p>
          <p className="text-2xl font-bold text-slate-100">{favoriteCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
          <p className="text-xs text-slate-500">Pozycje w koszyku CRM</p>
          <p className="text-2xl font-bold text-slate-100">{orderCount}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          title="Katalog"
          desc={`Przeglądaj ${productCount} pozycji — Akcesoria i Produkty sklepu.`}
          icon={<Package className="h-5 w-5 text-brand-300" />}
          iconSrc="/icons/icon-192.png"
          accent="bg-brand-500/15"
          meta="PWA"
          onClick={() => onNavigate('catalog')}
        />
        <Tile
          title="Ulubione"
          desc="Szybki dostęp do zapisanych pozycji."
          icon={<Star className="h-5 w-5 text-amber-300" />}
          accent="bg-amber-500/15"
          meta={String(favoriteCount)}
          onClick={() => onNavigate('favorites')}
        />
        <Tile
          title="Magazyn"
          desc="Stany, etykiety, lokalizacje, kompletacja, dostawy i operacje magazynowe."
          icon={<Boxes className="h-5 w-5 text-sky-300" />}
          iconSrc="/icons/stock-icon-192.png"
          accent="bg-sky-500/15"
          meta="PWA"
          onClick={() => onNavigate('warehouse')}
        />
        {canCrm && (
          <Tile
            title="CRM"
            desc="Klienci, lejek, koszyk, mapa tras."
            icon={<ShoppingCart className="h-5 w-5 text-emerald-300" />}
            iconSrc="/icons/sell-icon-192.png"
            accent="bg-emerald-500/15"
            meta="Handel"
            onClick={() => onNavigate('crm')}
          />
        )}
        {canOps && (
          <Tile
            title="Operacje"
            desc="Marże, koszty i analityka firmy."
            icon={<Calculator className="h-5 w-5 text-violet-300" />}
            iconSrc="/icons/ops-icon-192.png"
            accent="bg-violet-500/15"
            meta="Finanse"
            onClick={() => onNavigate('ops')}
          />
        )}
        {canComms && (
          <Tile
            title="Talk"
            desc="Czat zespołu Kenochem."
            icon={<MessageSquare className="h-5 w-5 text-rose-300" />}
            iconSrc="/icons/talk-icon-192.png"
            accent="bg-rose-500/15"
            meta="Czat"
            onClick={() => onNavigate('comms')}
          />
        )}
        <Tile
          title="Kalendarz"
          desc="Plan wizyt, dostaw, spotkan, raportow i synchronizacji firmowych."
          icon={<CalendarDays className="h-5 w-5 text-emerald-300" />}
          iconSrc="/icons/calendar-icon-192.png"
          accent="bg-emerald-500/15"
          meta="Plan"
          onClick={() => onNavigate('calendar')}
        />
        <Tile
          title="Lens / skaner"
          desc="Otwórz katalog sklepu — skan EAN i wyszukiwanie wizualne."
          icon={<Sparkles className="h-5 w-5 text-brand-200" />}
          accent="bg-brand-500/10"
          meta="AI"
          onClick={() => onNavigate('catalog')}
        />
        <Tile
          title="Kolejne narzedzia"
          desc="Miejsce na nowe moduly: kalendarz, dzialy, automatyzacje, integracje i raporty."
          icon={<ArrowRight className="h-5 w-5 text-slate-300" />}
          accent="bg-slate-800"
          meta="Soon"
          onClick={() => onNavigate('integrations')}
        />
      </div>
    </div>
  );
}
