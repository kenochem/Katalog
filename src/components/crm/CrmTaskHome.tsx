import {
  ArrowRight,
  GitBranch,
  History,
  MapPin,
  Percent,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { formatPricePln } from '../../lib/format';
import { CRM_INBOX_ENABLED } from '../../lib/crmInboxFeature';
import { ContextHelp } from '../ContextHelp';

interface CrmTaskHomeProps {
  draftQty: number;
  draftTotal: number;
  inboxUnread: number;
  pipelineOpen: number;
  clientCount: number;
  onOrder: () => void;
  onPipeline: () => void;
  onInbox: () => void;
  onRoutes: () => void;
  onClients: () => void;
  onHistory: () => void;
  onCommission: () => void;
}

export function CrmTaskHome({
  draftQty,
  draftTotal,
  inboxUnread,
  pipelineOpen,
  clientCount,
  onOrder,
  onPipeline,
  onInbox,
  onRoutes,
  onClients,
  onHistory,
  onCommission,
}: CrmTaskHomeProps) {
  const alerts: { label: string; onClick: () => void }[] = [];
  if (draftQty > 0) {
    alerts.push({
      label: `${draftQty} poz. w koszyku · ${formatPricePln(draftTotal)}`,
      onClick: onOrder,
    });
  }
  if (pipelineOpen > 0) {
    alerts.push({
      label: `${pipelineOpen} otwartych szans w lejku`,
      onClick: onPipeline,
    });
  }
  if (CRM_INBOX_ENABLED && inboxUnread > 0) {
    alerts.push({
      label: `${inboxUnread} wiadomości do obsługi`,
      onClick: onInbox,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-50">
          Centrum CRM
          <ContextHelp id="crm" />
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Szybki start pracy handlowca: zamowienie, lejek, trasy, klienci i historia.
        </p>
      </div>
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onOrder}
        className="group flex w-full items-center gap-4 rounded-2xl border border-brand-500/40 bg-brand-500/10 p-5 text-left transition hover:border-brand-400/60 hover:bg-brand-500/15 active:scale-[0.99]"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-950/30">
          <ShoppingCart className="h-7 w-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-slate-50">Składam zamówienie</span>
            {draftQty > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-slate-950">
                {draftQty} w koszyku
              </span>
            )}
          </span>
          <span className="mt-1 block text-sm text-slate-400">
            Dodaj produkty, wybierz klienta i wyślij ofertę
            {draftQty > 0 ? ` · ${formatPricePln(draftTotal)}` : ''}
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-brand-400 opacity-60 transition group-hover:opacity-100" />
      </button>

      <button
        type="button"
        onClick={onPipeline}
        className="group flex w-full items-center gap-4 rounded-2xl border border-violet-500/35 bg-violet-500/10 p-4 text-left transition hover:border-violet-400/50 hover:bg-violet-500/15"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600/30 text-violet-200">
          <GitBranch className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-base font-semibold text-slate-50">
            Lejek sprzedaży
            {pipelineOpen > 0 && (
              <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {pipelineOpen}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-sm text-slate-400">
            Leady, rozmowy, oferty — dopnij wygraną lub porażkę
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-violet-400 opacity-60 group-hover:opacity-100" />
      </button>

      <div className="grid gap-3 sm:grid-cols-2">
        <TaskCard
          icon={<MapPin className="h-6 w-6" />}
          title="Planuję trasę wizyt"
          desc="Mapa klientów — ułóż wizyty na dziś"
          onClick={onRoutes}
          accent="emerald"
        />
        <TaskCard
          icon={<Users className="h-6 w-6" />}
          title="Szukam klienta"
          desc={`Kartoteka, NIP, notatki · ${clientCount} w bazie`}
          onClick={onClients}
          accent="sky"
        />
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Inne
        </p>
        <div className="flex flex-wrap gap-2">
          <SecondaryTaskButton
            icon={<History className="h-4 w-4" />}
            label="Historia zamówień"
            onClick={onHistory}
          />
          <SecondaryTaskButton
            icon={<Percent className="h-4 w-4" />}
            label="Moja prowizja"
            onClick={onCommission}
          />
        </div>
      </section>
    </div>
  );
}

function TaskCard({
  icon,
  title,
  desc,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  accent: 'emerald' | 'sky';
}) {
  const accentCls =
    accent === 'emerald'
      ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25 hover:border-emerald-500/40'
      : 'text-sky-400 bg-sky-500/15 border-sky-500/25 hover:border-sky-500/40';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[120px] flex-col items-start gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${accentCls}`}
    >
      <span className="rounded-xl bg-slate-950/40 p-2.5">{icon}</span>
      <span>
        <span className="block font-semibold text-slate-100">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-slate-500">{desc}</span>
      </span>
    </button>
  );
}

function SecondaryTaskButton({
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
      className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
    >
      {icon}
      {label}
    </button>
  );
}
