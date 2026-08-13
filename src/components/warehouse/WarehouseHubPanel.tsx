import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  ChevronRight,
  LayoutGrid,
  Map,
  MapPin,
  Printer,
} from 'lucide-react';
import type { Product } from '../../types';
import { formatLocationCode } from '../../lib/warehouseLocation';
import { mergeLocationIntoProducts } from '../../lib/locationStore';
import { seedKenochemWarehouseLayout } from '../../lib/warehouseLayoutStore';
import { WarehouseLayoutEditor } from './WarehouseLayoutEditor';
import { WarehouseLocationsPanel } from './WarehouseLocationsPanel';
import { WarehouseIsometricView } from './WarehouseIsometricView';
import { ContextHelp } from '../ContextHelp';

type WhTool = 'hub' | 'layout' | 'locations' | 'isometric';

interface WarehouseHubPanelProps {
  products: Product[];
  labelQueueCount: number;
  onOpenLabels: () => void;
  onLocationSaved?: (productId: string, location: Product['warehouseLocation']) => void;
}

function ToolRow({
  title,
  desc,
  count,
  icon,
  onClick,
}: {
  title: string;
  desc: string;
  count?: number;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800/80 dark:bg-slate-900/50 dark:shadow-none dark:hover:border-slate-700 dark:hover:bg-slate-900"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
        <p className="text-xs text-slate-600 dark:text-slate-500">{desc}</p>
      </div>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">
          {count}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-600" />
    </button>
  );
}

export function WarehouseHubPanel({
  products,
  labelQueueCount,
  onOpenLabels,
  onLocationSaved,
}: WarehouseHubPanelProps) {
  const [tool, setTool] = useState<WhTool>('hub');

  useEffect(() => {
    seedKenochemWarehouseLayout();
  }, []);

  const withLocations = useMemo(() => mergeLocationIntoProducts(products), [products]);
  const assignedCount = useMemo(
    () => withLocations.filter((p) => formatLocationCode(p.warehouseLocation)).length,
    [withLocations],
  );
  const unassignedCount = withLocations.length - assignedCount;

  if (tool === 'layout') {
    return (
      <WarehouseLayoutEditor
        onBack={() => setTool('hub')}
        onOpenLocations={() => setTool('locations')}
      />
    );
  }

  if (tool === 'locations') {
    return (
      <WarehouseLocationsPanel
        products={withLocations}
        onBack={() => setTool('hub')}
        onOpenLayout={() => setTool('layout')}
        onLocationSaved={onLocationSaved}
      />
    );
  }

  if (tool === 'isometric') {
    return (
      <div className="stock-app mx-auto w-full max-w-7xl space-y-3 pb-10">
        <button
          type="button"
          onClick={() => setTool('hub')}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Magazyn
        </button>
        <WarehouseIsometricView
          products={withLocations}
          onOpenLocations={() => setTool('locations')}
          onOpenLayout={() => setTool('layout')}
        />
      </div>
    );
  }

  return (
    <div className="stock-app mx-auto w-full max-w-3xl space-y-5 px-1 pb-10 sm:px-0">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-none sm:p-5">
        <div className="flex items-center gap-2 text-emerald-400">
          <Boxes className="h-5 w-5" />
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
            Magazyn — układ i adresy
            <ContextHelp id="warehouseMap" />
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Zaprojektuj halę (regały, pakowanie, strefy), przypisz SKU — lokalizacja pojawi się na etykietach.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-800 dark:bg-slate-950/50">
            <p className="text-lg font-bold tabular-nums text-slate-950 dark:text-slate-50">{withLocations.length}</p>
            <p className="text-[10px] uppercase text-slate-600 dark:text-slate-500">SKU</p>
          </div>
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-50 px-2 py-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <p className="text-lg font-bold tabular-nums text-emerald-900 dark:text-emerald-200">{assignedCount}</p>
            <p className="text-[10px] uppercase text-emerald-800/80 dark:text-slate-500">Z adresem</p>
          </div>
          <div className="rounded-xl border border-amber-500/45 bg-amber-50 px-2 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-lg font-bold tabular-nums text-amber-950 dark:text-amber-200">{unassignedCount}</p>
            <p className="text-[10px] uppercase text-amber-900/75 dark:text-slate-500">Bez adresu</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <ToolRow
          title="Plan magazynu"
          desc="Układ hali — regały, alejki, pakowanie, wysyłka (Baselinker-style)"
          icon={<LayoutGrid className="h-5 w-5" />}
          onClick={() => setTool('layout')}
        />
        <ToolRow
          title="Mapa 2.5D"
          desc="Izometryczny podglad regalow i stref, docelowo jak wskazanie produktu na sali"
          icon={<Map className="h-5 w-5" />}
          onClick={() => setTool('isometric')}
        />
        <ToolRow
          title="Regały i lokalizacje SKU"
          desc="Przypisz strefę, półkę i pojemnik do produktów"
          count={unassignedCount > 0 ? unassignedCount : undefined}
          icon={<MapPin className="h-5 w-5" />}
          onClick={() => setTool('locations')}
        />
        <ToolRow
          title="Etykiety półkowe"
          desc="Kolejka druku z kodem kreskowym i adresem magazynowym"
          count={labelQueueCount}
          icon={<Printer className="h-5 w-5" />}
          onClick={onOpenLabels}
        />
      </div>
    </div>
  );
}

export { useWarehouseLayoutRevision } from './useWarehouseLayoutRevision';
