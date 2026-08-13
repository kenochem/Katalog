import {
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  ClipboardList,
  MessageSquare,
  PackageSearch,
  ShoppingCart,
  Star,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { HubView } from '../../app/hubNavigation';

type PreviewKind = 'catalog' | 'crm' | 'ops' | 'talk';

interface HubAppPreviewViewProps {
  kind: PreviewKind;
  productCount: number;
  favoriteCount: number;
  orderCount: number;
  lowStockCount: number;
  missingImagesCount: number;
  onNavigate: (view: HubView) => void;
}

const APP_COPY: Record<
  PreviewKind,
  {
    title: string;
    eyebrow: string;
    desc: string;
    icon: string;
    href: string;
    cta: string;
  }
> = {
  catalog: {
    title: 'Katalog produktow',
    eyebrow: 'Podglad aplikacji',
    desc: 'Szybki obraz bazy produktowej. Pelna praca nad produktami, zdjeciami i wiedza produktowa jest w aplikacji Katalog.',
    icon: '/icons/icon-192.png',
    href: 'https://kenochem-katalog.web.app/',
    cta: 'Otworz pelny Katalog',
  },
  crm: {
    title: 'CRM / Handel',
    eyebrow: 'Podglad aplikacji',
    desc: 'Najwazniejsze skroty handlowe bez ladowania calego CRM w Suite. Pelne zamowienia, klienci i trasy sa w aplikacji Handel.',
    icon: '/icons/sell-icon-192.png',
    href: 'https://kenochem-sell.web.app/',
    cta: 'Otworz pelny CRM',
  },
  ops: {
    title: 'Operacje finansowe',
    eyebrow: 'Podglad aplikacji',
    desc: 'Krotki widok kontroli firmy. Szczegolowe raporty, importy danych i analityka sa w aplikacji Operacje.',
    icon: '/icons/ops-icon-192.png',
    href: 'https://kenochem-ops.web.app/',
    cta: 'Otworz pelne Operacje',
  },
  talk: {
    title: 'Talk / Czat zespolu',
    eyebrow: 'Podglad aplikacji',
    desc: 'Suite pokazuje tylko bramke do komunikatora. Szybki dymek czatu zostaje na dole, a pelne rozmowy, watki i ustawienia sa w aplikacji Talk.',
    icon: '/icons/talk-icon-192.png',
    href: 'https://kenochem-talk.web.app/',
    cta: 'Przejdz do czatu',
  },
};

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className="text-brand-400">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-50">{value}</p>
    </div>
  );
}

function Shortcut({
  title,
  desc,
  icon,
  onClick,
}: {
  title: string;
  desc: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-32 flex-col rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-left transition hover:border-brand-500/40 hover:bg-slate-900"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
        {icon}
      </span>
      <h3 className="mt-3 text-sm font-bold text-slate-100">{title}</h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{desc}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-400 opacity-0 transition group-hover:opacity-100">
        Przejdz
        <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

export function HubAppPreviewView({
  kind,
  productCount,
  favoriteCount,
  orderCount,
  lowStockCount,
  missingImagesCount,
  onNavigate,
}: HubAppPreviewViewProps) {
  const app = APP_COPY[kind];
  const metrics =
    kind === 'catalog'
      ? [
          ['Produkty', productCount, <PackageSearch className="h-4 w-4" />],
          ['Ulubione', favoriteCount, <Star className="h-4 w-4" />],
          ['Niski stan', lowStockCount, <Boxes className="h-4 w-4" />],
        ]
      : kind === 'crm'
        ? [
            ['Koszyk CRM', orderCount, <ShoppingCart className="h-4 w-4" />],
            ['Baza klientow', 'B2B', <Users className="h-4 w-4" />],
            ['Trasy', 'Plan', <CalendarDays className="h-4 w-4" />],
          ]
        : kind === 'ops'
          ? [
            ['Raporty', 'Finanse', <BarChart3 className="h-4 w-4" />],
            ['Importy', 'Dane', <ClipboardList className="h-4 w-4" />],
            ['Kontrola', 'Marze', <BarChart3 className="h-4 w-4" />],
          ]
          : [
            ['Rozmowy', 'Talk', <MessageSquare className="h-4 w-4" />],
            ['Powiadomienia', 'Push', <MessageSquare className="h-4 w-4" />],
            ['Zespol', 'Online', <Users className="h-4 w-4" />],
          ];

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-5 sm:py-8">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <img src={app.icon} alt="" className="h-14 w-14 shrink-0 rounded-2xl shadow-lg shadow-black/25" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-400">{app.eyebrow}</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-50">{app.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">{app.desc}</p>
            </div>
          </div>
          <a
            href={app.href}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-brand-950/30 transition hover:bg-brand-500"
          >
            {app.cta}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        {metrics.map(([label, value, icon]) => (
          <Metric key={String(label)} label={String(label)} value={value as string | number} icon={icon as ReactNode} />
        ))}
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        {kind === 'catalog' ? (
          <>
            <Shortcut
              title="Ulubione"
              desc="Szybki dostep do przypietych produktow."
              icon={<Star className="h-5 w-5" />}
              onClick={() => onNavigate('favorites')}
            />
            <Shortcut
              title="Magazyn"
              desc="Stany, lokalizacje SKU i etykiety."
              icon={<Boxes className="h-5 w-5" />}
              onClick={() => onNavigate('warehouse')}
            />
            <Shortcut
              title="Pelna baza produktow"
              desc={`${missingImagesCount} pozycji bez zdjec. Szczegoly sa w Katalogu.`}
              icon={<PackageSearch className="h-5 w-5" />}
              onClick={() => window.location.assign(APP_COPY.catalog.href)}
            />
          </>
        ) : kind === 'crm' ? (
          <>
            <Shortcut
              title="Zamowienia"
              desc="Podglad zamowien i akceptacji."
              icon={<ShoppingCart className="h-5 w-5" />}
              onClick={() => onNavigate('orders')}
            />
            <Shortcut
              title="Kalendarz wizyt"
              desc="Plan pracy handlowcow i spotkan."
              icon={<CalendarDays className="h-5 w-5" />}
              onClick={() => onNavigate('calendar')}
            />
            <Shortcut
              title="Czat z zespolem"
              desc="Szybkie przejscie do komunikacji."
              icon={<Users className="h-5 w-5" />}
              onClick={() => onNavigate('comms')}
            />
          </>
        ) : kind === 'ops' ? (
          <>
            <Shortcut
              title="Finanse"
              desc="Skroty do raportow i danych finansowych."
              icon={<BarChart3 className="h-5 w-5" />}
              onClick={() => onNavigate('finance')}
            />
            <Shortcut
              title="Integracje danych"
              desc="Zrodla importow i automatyzacje."
              icon={<ClipboardList className="h-5 w-5" />}
              onClick={() => onNavigate('integrations')}
            />
            <Shortcut
              title="Baza wiedzy"
              desc="Opis procesow i zasad pracy."
              icon={<PackageSearch className="h-5 w-5" />}
              onClick={() => onNavigate('guide')}
            />
          </>
        ) : (
          <>
            <Shortcut
              title="Pelny Talk"
              desc="Otworz aplikacje czatu w osobnym widoku PWA."
              icon={<MessageSquare className="h-5 w-5" />}
              onClick={() => window.location.assign(APP_COPY.talk.href)}
            />
            <Shortcut
              title="Kalendarz zespolu"
              desc="Przejdz do planu spotkan i odpraw."
              icon={<CalendarDays className="h-5 w-5" />}
              onClick={() => onNavigate('calendar')}
            />
            <Shortcut
              title="Baza wiedzy"
              desc="Zasady pracy, procesy i ustalenia dla zespolu."
              icon={<PackageSearch className="h-5 w-5" />}
              onClick={() => onNavigate('guide')}
            />
          </>
        )}
      </section>
    </div>
  );
}
