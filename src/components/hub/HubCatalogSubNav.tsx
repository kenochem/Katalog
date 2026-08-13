import { BarChart3, Home, ImageOff, Layers, Printer, Search, Star } from 'lucide-react';
import type { View } from '../../types';

export function HubCatalogSubNav({
  view,
  onView,
  counts,
  role,
}: {
  view: View;
  onView: (v: View) => void;
  counts: {
    products: number;
    favorites: number;
    kits: number;
    missing: number;
    labels: number;
  };
  role: {
    favorites: boolean;
    kits: boolean;
    progress: boolean;
    labels: boolean;
  };
}) {
  const tabs: { id: View; label: string; icon: typeof Search; count?: number }[] = [
    { id: 'home', label: 'Start', icon: Home },
    { id: 'catalog', label: 'Lista', icon: Search, count: counts.products },
  ];
  if (role.favorites) {
    tabs.push({ id: 'favorites', label: 'Ulubione', icon: Star, count: counts.favorites });
  }
  if (role.kits) {
    tabs.push({ id: 'kits', label: 'Zestawy', icon: Layers, count: counts.kits });
  }
  if (role.progress) {
    tabs.push({ id: 'progress', label: 'Postęp', icon: BarChart3 });
    tabs.push({ id: 'missing-images', label: 'Bez zdjęć', icon: ImageOff, count: counts.missing });
  }
  if (role.labels) {
    tabs.push({ id: 'labels', label: 'Etykiety', icon: Printer, count: counts.labels });
  }

  return (
    <nav className="mb-3 flex gap-1 overflow-x-auto rounded-xl bg-slate-900/80 p-1 ring-1 ring-slate-800 scrollbar-none">
      {tabs.map((tab) => {
        const active = view === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onView(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium sm:text-sm ${
              active ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="rounded-md bg-slate-950/60 px-1.5 text-[10px] tabular-nums">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
