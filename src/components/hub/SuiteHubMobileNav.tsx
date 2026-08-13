import type { HubView } from '../../app/hubNavigation';
import {
  Boxes,
  Calculator,
  LayoutDashboard,
  Package,
  ShoppingCart,
} from 'lucide-react';

const MOBILE_TABS: { id: HubView; label: string; icon: typeof Package }[] = [
  { id: 'workspace', label: 'Pulpit', icon: LayoutDashboard },
  { id: 'catalog', label: 'Katalog', icon: Package },
  { id: 'warehouse', label: 'Magazyn', icon: Boxes },
  { id: 'crm', label: 'CRM', icon: ShoppingCart },
  { id: 'ops', label: 'Ops', icon: Calculator },
];

export function SuiteHubMobileNav({
  view,
  onViewChange,
  showCrm,
  showOps,
}: {
  view: HubView;
  onViewChange: (v: HubView) => void;
  showCrm: boolean;
  showOps: boolean;
}) {
  const tabs = MOBILE_TABS.filter((t) => {
    if (t.id === 'crm') return showCrm;
    if (t.id === 'ops') return showOps;
    return true;
  });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] lg:hidden supports-[backdrop-filter]:backdrop-blur-md"
      aria-label="Nawigacja mobilna"
    >
      {tabs.map((tab) => {
        const active =
          tab.id === view ||
          (tab.id === 'catalog' && ['catalog', 'favorites', 'kits'].includes(view));
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onViewChange(tab.id)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
              active ? 'text-brand-400' : 'text-slate-500'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate px-0.5">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
