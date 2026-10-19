import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../types';
import { computeCatalogStats } from '../lib/catalogExport';
import { showToast } from '../lib/toast';
import { CsvExportDialog } from './CsvExportDialog';

interface CatalogStatsBarProps {
  /** Produkty po filtrach (to, co widać na liście). */
  filtered: Product[];
  /** Wszystkie w aktywnym katalogu (KPI całości). */
  catalogProducts: Product[];
  catalogLabel: string;
  exportLabel?: string;
  /** Uprawnienie „Eksport danych” — bez niego przycisk jest ukryty. */
  canExport?: boolean;
}

export function CatalogStatsBar({
  filtered,
  catalogProducts,
  catalogLabel,
  exportLabel = 'Eksportuj widok (CSV)',
  canExport = true,
}: CatalogStatsBarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const stats = useMemo(() => computeCatalogStats(catalogProducts), [catalogProducts]);

  function handleExport() {
    if (filtered.length === 0) {
      showToast('Brak produktów do eksportu', 'warn', 2500);
      return;
    }
    setExportOpen(true);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800/80 bg-slate-900/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span>
          <strong className="font-semibold text-slate-200">{stats.total}</strong>{' '}
          SKU
        </span>
        <span>
          na stanie{' '}
          <strong className="text-emerald-400/90">{stats.inStock}</strong>
        </span>
        <span>
          brak{' '}
          <strong className="text-rose-400/90">{stats.outOfStock}</strong>
        </span>
        <span>
          niski ≤5{' '}
          <strong className="text-amber-400/90">{stats.lowStock}</strong>
        </span>
        <span>
          bez zdj.{' '}
          <strong className="text-slate-300">{stats.withoutImage}</strong>
        </span>
        {stats.weakKnowledge > 0 && (
          <span>
            słaby opis{' '}
            <strong className="text-violet-300/90">{stats.weakKnowledge}</strong>
          </span>
        )}
        <span title="Średnia kompletności opisu / parametrów">
          wiedza ~{' '}
          <strong className="text-slate-300">{stats.avgKnowledgeScore}%</strong>
        </span>
        {filtered.length !== catalogProducts.length && (
          <span className="text-brand-300/90">
            w filtrze: {filtered.length}
          </span>
        )}
      </div>
      {canExport && (
      <button
        type="button"
        onClick={handleExport}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-brand-500/40 hover:text-brand-200"
      >
        <Download className="h-3.5 w-3.5" />
        {exportLabel}
      </button>
      )}
      {exportOpen && (
        <CsvExportDialog
          products={filtered}
          title={`Eksport CSV — ${catalogLabel}`}
          filePrefix="katalog"
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
