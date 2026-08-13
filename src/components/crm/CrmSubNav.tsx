import {
  GitBranch,
  History,
  LayoutDashboard,
  MapPin,
  Percent,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { CRM_INBOX_ENABLED } from '../../lib/crmInboxFeature';

export type CrmTab =
  | 'hub'
  | 'order'
  | 'pipeline'
  | 'inbox'
  | 'clients'
  | 'routes'
  | 'history'
  | 'commission';

interface CrmSubNavProps {
  active: CrmTab;
  onChange: (tab: CrmTab) => void;
  orderQty: number;
  inboxUnread?: number;
  pipelineOpen?: number;
}

const TABS: {
  id: CrmTab;
  label: string;
  short: string;
  icon: React.ReactNode;
}[] = [
  { id: 'hub', label: 'Pulpit', short: 'Pulpit', icon: <LayoutDashboard className="h-4 w-4" /> },
  {
    id: 'order',
    label: 'Koszyk / oferta',
    short: 'Koszyk',
    icon: <ShoppingCart className="h-4 w-4" />,
  },
  {
    id: 'pipeline',
    label: 'Lejek sprzedaży',
    short: 'Lejek',
    icon: <GitBranch className="h-4 w-4" />,
  },
  ...(CRM_INBOX_ENABLED
    ? [
        {
          id: 'inbox' as const,
          label: 'Obsługa klienta',
          short: 'Inbox',
          icon: <LayoutDashboard className="h-4 w-4 hidden" />,
        },
      ]
    : []),
  { id: 'clients', label: 'Klienci', short: 'Klienci', icon: <Users className="h-4 w-4" /> },
  {
    id: 'routes',
    label: 'Mapa wizyt',
    short: 'Mapa',
    icon: <MapPin className="h-4 w-4" />,
  },
  {
    id: 'history',
    label: 'Historia',
    short: 'Historia',
    icon: <History className="h-4 w-4" />,
  },
  {
    id: 'commission',
    label: 'Prowizja',
    short: 'Prowizja',
    icon: <Percent className="h-4 w-4" />,
  },
];

export function CrmSubNav({
  active,
  onChange,
  orderQty,
  inboxUnread = 0,
  pipelineOpen = 0,
}: CrmSubNavProps) {
  return (
    <nav
      className="sticky top-0 z-20 -mx-1 border-b border-slate-800 bg-slate-950/95 px-1 backdrop-blur-md sm:rounded-2xl sm:border sm:px-2"
      aria-label="Sekcje CRM"
    >
      <div className="flex gap-1 overflow-x-auto py-2 scrollbar-none">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          const badge =
            tab.id === 'order' && orderQty > 0
              ? orderQty
              : tab.id === 'pipeline' && pipelineOpen > 0
                ? pipelineOpen
                : tab.id === 'inbox' && inboxUnread > 0
                  ? inboxUnread
                  : null;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition min-h-[44px] ${
                isActive
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-900/40'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.short}</span>
              {badge != null && (
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    isActive ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
