import { MapPin, PackageCheck, ShoppingCart, Truck, Warehouse } from 'lucide-react';
import { dispatchHubNavigate } from '../../app/hubNavigation';
import { dispatchCrmTab } from '../../lib/hubSegmentNav';

function Tile({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left transition hover:border-amber-500/30 hover:bg-slate-900"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </button>
  );
}

export function LogisticsKenochemView() {
  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-5 sm:px-5 sm:py-8">
      <header className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-amber-400">
          <Truck className="h-5 w-5" />
          <h1 className="text-lg font-semibold text-slate-50 sm:text-xl">Logistyka</h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Trasy wizyt, magazyn i zaopatrzenie — moduły Kenochem (bez demo PO z huba).
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          icon={<MapPin className="h-5 w-5" />}
          title="Trasy i mapa CRM"
          subtitle="Planowanie wizyt u klientów, czasy dojazdu."
          onClick={() => dispatchCrmTab('routes')}
        />
        <Tile
          icon={<ShoppingCart className="h-5 w-5" />}
          title="Aktywne koszyki"
          subtitle="Oferty i zamówienia w CRM."
          onClick={() => dispatchCrmTab('order')}
        />
        <Tile
          icon={<Warehouse className="h-5 w-5" />}
          title="Magazyn"
          subtitle="Stany, etykiety, zdjęcia."
          onClick={() => dispatchHubNavigate('warehouse')}
        />
        <Tile
          icon={<PackageCheck className="h-5 w-5" />}
          title="Przyjęcia / dostawy"
          subtitle="Pełny WMS jak w hub-platform — w planie; tymczasem stany w katalogu + WAPRO."
          onClick={() => dispatchHubNavigate('catalog')}
        />
      </div>
    </div>
  );
}
