import { BookOpen, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import type { Product } from '../../types';
import {
  averageKnowledgeScore,
  computeKnowledgeStatsByCategory,
  countByKnowledgeLevel,
  isWeakProductKnowledge,
} from '../../lib/productKnowledge';

interface KnowledgeProgressPanelProps {
  products: Product[];
  onOpenWeak: (category?: string) => void;
}

export function KnowledgeProgressPanel({ products, onOpenWeak }: KnowledgeProgressPanelProps) {
  const byLevel = useMemo(() => countByKnowledgeLevel(products), [products]);
  const byCategory = useMemo(() => computeKnowledgeStatsByCategory(products), [products]);
  const weakTotal = useMemo(() => products.filter(isWeakProductKnowledge).length, [products]);
  const avg = useMemo(() => averageKnowledgeScore(products), [products]);

  const apiUrlHint =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
      ? `${String(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, '')}/functions/v1/product-knowledge`
      : 'https://[projekt].supabase.co/functions/v1/product-knowledge';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-100">Wiedza o produktach (katalog / boty)</h3>
        <p className="text-sm text-slate-400">
          Ocena na żywo z opisów, parametrów, EAN, zdjęć i logistyki. Uzupełniaj słabe pozycje lub
          korzystaj z API dla zewnętrznych botów.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Średnia kompletności" value={`${avg}%`} sub="cały widoczny katalog" />
        <StatCard
          label="Słaba baza"
          value={String(weakTotal)}
          sub="poniżej 55%"
          onClick={() => onOpenWeak()}
          clickable
        />
        <StatCard label="Dobra / bogata" value={String(byLevel.good + byLevel.rich)} sub="≥65%" />
        <StatCard label="W trakcie" value={String(byLevel.fair)} sub="40–64%" />
      </div>

      <div className="surface-panel overflow-hidden">
        <div className="border-b border-slate-700/70 px-4 py-3 dark:border-slate-800">
          <h4 className="font-medium text-slate-100">Kompletność per kategoria</h4>
          <p className="text-xs text-slate-400">Niższa średnia = więcej pracy; kliknij, aby filtrować słabe opisy</p>
        </div>
        <ul className="divide-y divide-slate-700/60 dark:divide-slate-800">
          {byCategory.map((row) => (
            <li key={row.category}>
              <button
                type="button"
                onClick={() => row.weak > 0 && onOpenWeak(row.category)}
                disabled={row.weak === 0}
                className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-slate-800/30 disabled:cursor-default dark:hover:bg-slate-800/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-200">{row.category}</span>
                    <span className="text-sm text-slate-400">
                      śr. {row.avgScore}% · {row.percentGood}% dobrych
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        row.avgScore >= 65
                          ? 'bg-emerald-500'
                          : row.avgScore >= 40
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                      }`}
                      style={{ width: `${row.avgScore}%` }}
                    />
                  </div>
                  {row.weak > 0 && (
                    <p className="mt-1 text-xs text-amber-900 dark:text-amber-200/90">
                      {row.weak} poz. ze słabą wiedzą
                    </p>
                  )}
                </div>
                {row.weak > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="surface-panel p-4">
        <div className="flex gap-2">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-100">API uzupełniania wiedzy (boty)</p>
            <p className="mt-1 text-xs text-slate-400">
              Zewnętrzny bot może dopisywać krótki opis, parametry i opis — domyślnie tylko puste pola
              (chyba że wyślesz <code className="text-slate-300">overwrite: true</code>). Klucz w nagłówku{' '}
              <code className="text-slate-300">X-Knowledge-Bot-Key</code>.
            </p>
            <p className="mt-2 break-all font-mono text-[11px] text-slate-500">{apiUrlHint}</p>
            <p className="mt-2 text-xs text-slate-500">
              Szczegóły: <span className="text-slate-400">docs/products/KNOWLEDGE-BOT-API.md</span> · export
              read-only: <span className="text-slate-400">/data/knowledge/manifest.json</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  onClick,
  clickable,
}: {
  label: string;
  value: string;
  sub: string;
  onClick?: () => void;
  clickable?: boolean;
}) {
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`surface-panel p-4 text-left ${
        clickable ? 'transition hover:border-brand-500/40 hover:bg-slate-800/20' : ''
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </Tag>
  );
}
