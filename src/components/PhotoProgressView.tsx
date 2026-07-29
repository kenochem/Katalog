import { ImageOff, Camera, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import type { Product } from '../types';
import { getProductImage } from '../lib/products';

interface CategoryPhotoStats {
  category: string;
  total: number;
  withImage: number;
  missing: number;
  percent: number;
}

function computePhotoStats(products: Product[]): CategoryPhotoStats[] {
  const map = new Map<string, { total: number; withImage: number }>();

  for (const p of products) {
    const cat = p.category;
    const entry = map.get(cat) || { total: 0, withImage: 0 };
    entry.total += 1;
    if (getProductImage(p)) entry.withImage += 1;
    map.set(cat, entry);
  }

  return [...map.entries()]
    .map(([category, data]) => {
      const missing = data.total - data.withImage;
      const percent = data.total ? Math.round((data.withImage / data.total) * 100) : 0;
      return { category, total: data.total, withImage: data.withImage, missing, percent };
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => a.percent - b.percent || a.category.localeCompare(b.category, 'pl'));
}

function formatStock(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export { formatStock };

interface PhotoProgressViewProps {
  products: Product[];
  onOpenMissing: (category?: string) => void;
}

export function PhotoProgressView({ products, onOpenMissing }: PhotoProgressViewProps) {
  const stats = useMemo(() => computePhotoStats(products), [products]);

  const total = products.length;
  const withImage = products.filter((p) => getProductImage(p)).length;
  const missing = total - withImage;
  const overallPercent = total ? Math.round((withImage / total) * 100) : 0;

  const lowStock = useMemo(
    () => products.filter((p) => p.stock <= 0).length,
    [products],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Postęp i stany</h2>
        <p className="text-sm text-slate-400">
          Podsumowanie zdjęć oraz orientacyjne stany z ostatniego eksportu Wapro
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<Camera className="h-5 w-5 text-brand-400" />}
          label="Ze zdjęciem"
          value={`${withImage} / ${total}`}
          sub={`${overallPercent}% ukończone`}
        />
        <SummaryCard
          icon={<ImageOff className="h-5 w-5 text-amber-400" />}
          label="Bez zdjęcia"
          value={String(missing)}
          sub="do uzupełnienia"
          onClick={() => onOpenMissing()}
          clickable
        />
        <SummaryCard
          icon={<span className="text-sm font-bold text-slate-300">0</span>}
          label="Brak na stanie"
          value={String(lowStock)}
          sub="stan ≤ 0 (orientacyjnie)"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="font-medium text-slate-100">Zdjęcia per kategoria</h3>
          <p className="text-xs text-slate-500">Kliknij kategorię, aby przejść do brakujących zdjęć</p>
        </div>

        <ul className="divide-y divide-slate-800">
          {stats.map((row) => (
            <li key={row.category}>
              <button
                type="button"
                onClick={() => row.missing > 0 && onOpenMissing(row.category)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-slate-800/50 disabled:cursor-default"
                disabled={row.missing === 0}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-200">{row.category}</span>
                    <span className="text-sm text-slate-400">
                      {row.withImage}/{row.total} ({row.percent}%)
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        row.percent >= 80
                          ? 'bg-emerald-500'
                          : row.percent >= 40
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                  {row.missing > 0 && (
                    <p className="mt-1 text-xs text-amber-300/80">
                      Brakuje {row.missing} zdjęć
                    </p>
                  )}
                </div>
                {row.missing > 0 && (
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-slate-500">
        Stany magazynowe są orientacyjne (z Wapro). Po ręcznej edycji w produkcie nie są
        nadpisywane przy kolejnym imporcie.
      </p>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  onClick,
  clickable,
}: {
  icon: React.ReactNode;
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
      className={`rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-left ${
        clickable ? 'transition hover:border-brand-500/40 hover:bg-slate-800/80' : ''
      }`}
    >
      <div className="mb-2">{icon}</div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </Tag>
  );
}
