import { useState } from 'react';
import { PackagePlus, History } from 'lucide-react';
import type { Product } from '../types';
import { CatalogNewProductsView } from './CatalogNewProductsView';
import { CatalogChangelogView } from './CatalogChangelogView';

type GridDensity = 'sm' | 'md' | 'lg';
type NewsTab = 'products' | 'changelog';

const TABS: { id: NewsTab; label: string; icon: typeof PackagePlus }[] = [
  { id: 'products', label: 'Nowe produkty', icon: PackagePlus },
  { id: 'changelog', label: 'Aktualizacje', icon: History },
];

interface CatalogNewsHubViewProps {
  gridDensity?: GridDensity;
  hideImages?: boolean;
  showPrices?: boolean;
  onProductClick: (p: Product) => void;
  collectionUserKey?: string;
  onCollectionsChange?: () => void;
}

export function CatalogNewsHubView(props: CatalogNewsHubViewProps) {
  const [tab, setTab] = useState<NewsTab>('products');

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition sm:flex-none sm:px-5 ${
                active
                  ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                  : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'products' ? <CatalogNewProductsView {...props} /> : <CatalogChangelogView />}
    </div>
  );
}
