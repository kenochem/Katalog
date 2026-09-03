import type { ReactNode } from 'react';
import type { HubView } from '../../app/hubNavigation';
import type { NavSectionId } from '../../lib/hubPreferences';
import {
  BookOpen,
  Briefcase,
  Calculator,
  Calendar,
  CreditCard,
  Download,
  Inbox,
  LayoutDashboard,
  Package,
  Plug,
  Settings2,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Boxes,
} from 'lucide-react';

export interface HubNavItem {
  id: HubView;
  navSection: NavSectionId;
  label: string;
  icon: ReactNode;
  match: HubView[];
  visible: boolean;
}

export function buildKenochemHubNavItems(opts: {
  showCatalog: boolean;
  showWarehouse: boolean;
  showLogistics: boolean;
  showCrm: boolean;
  showOrders: boolean;
  showFinance: boolean;
  showOps: boolean;
  showComms: boolean;
  showInbox: boolean;
  showIntegrations: boolean;
  showAdmin: boolean;
  showDepartments: boolean;
  showDownloads: boolean;
  showGuide: boolean;
  showCalendar: boolean;
  showAssist: boolean;
}): HubNavItem[] {
  const items: HubNavItem[] = [
    {
      id: 'workspace',
      navSection: 'home',
      label: 'Pulpit',
      icon: <LayoutDashboard className="h-4 w-4 shrink-0" />,
      match: ['workspace', 'home'],
      visible: true,
    },
    {
      id: 'catalog',
      navSection: 'catalog',
      label: 'Produkty',
      icon: <Package className="h-4 w-4 shrink-0" />,
      match: ['catalog', 'favorites', 'kits'],
      visible: opts.showCatalog,
    },
    {
      id: 'logistics',
      navSection: 'logistics',
      label: 'Logistyka',
      icon: <Truck className="h-4 w-4 shrink-0" />,
      match: ['logistics'],
      visible: opts.showLogistics,
    },
    {
      id: 'warehouse',
      navSection: 'warehouse',
      label: 'Magazyn',
      icon: <Boxes className="h-4 w-4 shrink-0" />,
      match: ['warehouse'],
      visible: opts.showWarehouse,
    },
    {
      id: 'crm',
      navSection: 'crm',
      label: 'CRM',
      icon: <ShoppingCart className="h-4 w-4 shrink-0" />,
      match: ['crm'],
      visible: opts.showCrm,
    },
    {
      id: 'orders',
      navSection: 'orders',
      label: 'Zamówienia',
      icon: <ShoppingBag className="h-4 w-4 shrink-0" />,
      match: ['orders'],
      visible: opts.showOrders,
    },
    {
      id: 'inbox',
      navSection: 'inbox',
      label: 'Obsługa klienta',
      icon: <Inbox className="h-4 w-4 shrink-0" />,
      match: ['inbox'],
      visible: opts.showInbox,
    },
    {
      id: 'assist',
      navSection: 'assist',
      label: 'Assist',
      icon: <Sparkles className="h-4 w-4 shrink-0" />,
      match: ['assist'],
      visible: opts.showAssist,
    },
    {
      id: 'calendar',
      navSection: 'calendar',
      label: 'Kalendarz',
      icon: <Calendar className="h-4 w-4 shrink-0" />,
      match: ['calendar'],
      visible: opts.showCalendar,
    },
    {
      id: 'finance',
      navSection: 'finance',
      label: 'Finanse',
      icon: <CreditCard className="h-4 w-4 shrink-0" />,
      match: ['finance'],
      visible: opts.showFinance,
    },
    {
      id: 'ops',
      navSection: 'ops',
      label: 'Operacje',
      icon: <Calculator className="h-4 w-4 shrink-0" />,
      match: ['ops'],
      visible: opts.showOps,
    },
    {
      id: 'comms',
      navSection: 'social',
      label: 'Czat',
      icon: <Users className="h-4 w-4 shrink-0" />,
      match: ['comms', 'team', 'social'],
      visible: opts.showComms,
    },
    {
      id: 'departments',
      navSection: 'departments',
      label: 'Działy',
      icon: <Briefcase className="h-4 w-4 shrink-0" />,
      match: ['departments'],
      visible: opts.showDepartments,
    },
    {
      id: 'integrations',
      navSection: 'integrations',
      label: 'Integracje',
      icon: <Plug className="h-4 w-4 shrink-0" />,
      match: ['integrations'],
      visible: opts.showIntegrations,
    },
    {
      id: 'admin',
      navSection: 'admin',
      label: 'Administracja',
      icon: <Settings2 className="h-4 w-4 shrink-0" />,
      match: ['admin'],
      visible: opts.showAdmin,
    },
    {
      id: 'downloads',
      navSection: 'downloads',
      label: 'Do pobrania',
      icon: <Download className="h-4 w-4 shrink-0" />,
      match: ['downloads'],
      visible: opts.showDownloads,
    },
    {
      id: 'guide',
      navSection: 'guide',
      label: 'Baza wiedzy',
      icon: <BookOpen className="h-4 w-4 shrink-0" />,
      match: ['guide'],
      visible: opts.showGuide,
    },
  ];
  const seen = new Set<string>();
  return items.filter((i) => {
    if (!i.visible) return false;
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}

export function HubPrimaryNav({
  view,
  onViewChange,
  items,
}: {
  view: HubView;
  onViewChange: (v: HubView) => void;
  items: HubNavItem[];
}) {
  if (items.length === 0) return null;
  return (
    <nav
      className="hub-primary-nav flex gap-1 overflow-x-auto rounded-xl bg-slate-900 p-1 ring-1 ring-slate-800 scrollbar-none"
      aria-label="Główne sekcje"
    >
      {items.map((item) => {
        const active = item.match.includes(view);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onViewChange(item.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium sm:text-sm ${
              active
                ? 'bg-brand-600 text-white shadow'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-50'
            }`}
          >
            {item.icon}
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
