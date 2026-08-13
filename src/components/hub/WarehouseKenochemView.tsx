import { useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Map,
  MapPin,
  PackageCheck,
  Printer,
} from 'lucide-react';
import { WarehouseIsometricView } from '../warehouse/WarehouseIsometricView';

interface WarehouseKenochemViewProps {
  productCount: number;
  missingImagesCount: number;
  lowStockCount: number;
  labelQueueCount: number;
}

type WarehouseSuitePanel = 'hub' | 'isometric';

function Row({
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
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand-500/40 hover:bg-slate-50 dark:border-slate-800/80 dark:bg-slate-900/50 dark:shadow-none dark:hover:bg-slate-900"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-500">{desc}</p>
      </div>
      {count !== undefined && count > 0 && (
        <span className="hub-badge-amber rounded-full px-2 py-0.5 text-xs font-semibold">{count}</span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-600" />
    </button>
  );
}

export function WarehouseKenochemView({
  productCount,
  missingImagesCount,
  lowStockCount,
  labelQueueCount,
}: WarehouseKenochemViewProps) {
  const [panel, setPanel] = useState<WarehouseSuitePanel>('hub');

  if (panel === 'isometric') {
    return (
      <div className="stock-app mx-auto w-full max-w-7xl px-3 py-5 sm:px-5 sm:py-8">
        <button
          type="button"
          onClick={() => setPanel('hub')}
          className="mb-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
          Magazyn
        </button>
        <WarehouseIsometricView />
      </div>
    );
  }

  return (
    <div className="stock-app mx-auto w-full max-w-4xl px-3 py-5 sm:px-5 sm:py-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
              Kenochem Magazyn
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-950 dark:text-slate-50">Stany, lokalizacje i kompletacja</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              To jest osobna przestrzen magazynu. Katalog zostaje baza wiedzy produktowej, a tutaj budujemy
              lokalizacje, regaly, stany krytyczne, etykiety i docelowo prowadzenie pracownika do towaru.
            </p>
          </div>
          <a
            href="https://kenochem-stock.web.app/"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-500"
          >
            Otworz pelny Magazyn
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Metric label="SKU" value={productCount} />
          <Metric label="Niski stan" value={lowStockCount} />
          <Metric label="Etykiety" value={labelQueueCount} />
          <Metric label="Brak zdjec" value={missingImagesCount} />
        </div>
      </section>

      <div className="mt-5 flex flex-col gap-2">
        <Row
          title="Mapa magazynu 2.5D"
          desc="Izometryczny rzut regalow i stref. Docelowo podswietli miejsce produktu jak w aplikacji sklepowej."
          icon={<Map className="h-5 w-5" />}
          onClick={() => setPanel('isometric')}
        />
        <Row
          title="Lokalizacje SKU"
          desc="Przypisywanie stref, alejek, regalow, polek i pojemnikow do produktow."
          icon={<MapPin className="h-5 w-5" />}
          onClick={() => window.location.assign('https://kenochem-stock.web.app/')}
        />
        <Row
          title="Stany krytyczne"
          desc="Towary wymagajace decyzji zakupowej albo kontroli fizycznego stanu."
          count={lowStockCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          onClick={() => window.location.assign('https://kenochem-stock.web.app/')}
        />
        <Row
          title="Kompletacja i wydania"
          desc="Miejsce na przyszly proces: lista zbiorcza, sciezka po regalach i potwierdzanie pobrania."
          icon={<PackageCheck className="h-5 w-5" />}
          onClick={() => window.location.assign('https://kenochem-stock.web.app/')}
        />
        <Row
          title="Etykiety polkowe"
          desc="Druk etykiet z kodem kreskowym i adresem magazynowym."
          count={labelQueueCount}
          icon={<Printer className="h-5 w-5" />}
          onClick={() => window.location.assign('https://kenochem-stock.web.app/')}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-950 dark:text-slate-100">{value}</p>
    </div>
  );
}
