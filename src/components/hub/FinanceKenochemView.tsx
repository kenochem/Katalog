import {
  Calculator,
  ChevronRight,
  LineChart,
  Percent,
  Wallet,
} from 'lucide-react';
import { dispatchHubNavigate } from '../../app/hubNavigation';
import { dispatchOpsTool } from '../../lib/hubSegmentNav';

function Row({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-left hover:border-slate-700"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-100">{title}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-600" />
    </button>
  );
}

export function FinanceKenochemView() {
  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-5 sm:px-5 sm:py-8">
      <div className="mb-6 flex items-center gap-2">
        <Wallet className="h-6 w-6 text-violet-400" />
        <div>
          <h1 className="text-xl font-bold text-slate-50">Finanse</h1>
          <p className="text-sm text-slate-500">Skróty do modułu Operacje i marż katalogu.</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Row
          icon={<LineChart className="h-5 w-5" />}
          title="Dashboard finansowy"
          desc="Koszty, marże i raporty — FinanceDashboard w Operacjach."
          onClick={() => dispatchOpsTool('finance')}
        />
        <Row
          icon={<Percent className="h-5 w-5" />}
          title="Ranking marży SKU"
          desc="Produkty posortowane według marży."
          onClick={() => dispatchOpsTool('margin-rank')}
        />
        <Row
          icon={<Calculator className="h-5 w-5" />}
          title="Cały moduł Operacje"
          desc="ABC, marketplace, alerty — hub operacji Kenochem."
          onClick={() => dispatchHubNavigate('ops')}
        />
      </div>
    </div>
  );
}
