import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { HubView } from '../../app/hubNavigation';
import type { HubNavItem } from './HubPrimaryNav';
import {
  isNavSectionVisible,
  loadHubPreferences,
  saveHubPreferences,
  sortByNavSectionOrder,
  type HubPreferences,
} from '../../lib/hubPreferences';

interface HubSidebarProps {
  view: HubView;
  onViewChange: (v: HubView) => void;
  items: HubNavItem[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  userId: string;
  prefs: HubPreferences;
  onPrefsChange: (prefs: HubPreferences) => void;
}

const APP_LAUNCHER_IDS = new Set<HubView>([
  'workspace',
  'catalog',
  'crm',
  'ops',
  'comms',
  'warehouse',
  'calendar',
]);

const APP_ICONS: Partial<Record<HubView, string>> = {
  workspace: '/icons/suite-icon-192.png',
  catalog: '/icons/icon-192.png',
  crm: '/icons/sell-icon-192.png',
  ops: '/icons/ops-icon-192.png',
  comms: '/icons/talk-icon-192.png',
  warehouse: '/icons/stock-icon-192.png',
  calendar: '/icons/calendar-icon-192.png',
};

const APP_HINTS: Partial<Record<HubView, string>> = {
  workspace: 'Start',
  catalog: 'Produkty',
  crm: 'Handel',
  ops: 'Finanse',
  comms: 'Czat',
  warehouse: 'Stany i trasy',
  calendar: 'Plan',
};

export function HubSidebar({
  view,
  onViewChange,
  items,
  collapsed,
  onToggleCollapsed,
  userId: _userId,
  prefs,
  onPrefsChange: _onPrefsChange,
}: HubSidebarProps) {
  const visible = sortByNavSectionOrder(
    items.filter((i) => isNavSectionVisible(prefs, i.navSection)),
    prefs.navSectionOrder,
  );
  const apps = visible.filter((item) => APP_LAUNCHER_IDS.has(item.id));
  const tools = visible.filter((item) => !APP_LAUNCHER_IDS.has(item.id));

  if (visible.length === 0) return null;

  return (
    <aside
      className={`hub-sidebar hidden shrink-0 flex-col border-r border-slate-800/80 bg-slate-950 lg:flex ${
        collapsed ? 'w-[4.25rem]' : 'w-56 xl:w-60'
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 px-2 py-3">
        {!collapsed && (
          <span className="truncate px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Menu
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hub-header-btn hub-header-btn--icon ml-auto inline-flex"
          title={collapsed ? 'Rozwiń menu' : 'Zwiń menu'}
          aria-label={collapsed ? 'Rozwiń menu' : 'Zwiń menu'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="Sidebar">
        {!collapsed && apps.length > 0 && (
          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Aplikacje
          </p>
        )}
        {apps.map((item) => {
          const active = item.match.includes(view);
          const iconSrc = APP_ICONS[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              title={item.label}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium transition ${
                active
                  ? 'bg-brand-600/90 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              }`}
            >
              {iconSrc ? (
                <img
                  src={iconSrc}
                  alt=""
                  className={`h-7 w-7 shrink-0 rounded-lg shadow-sm ${active ? 'ring-1 ring-white/40' : ''}`}
                  width={28}
                  height={28}
                />
              ) : (
                item.icon
              )}
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  <span className={`block truncate text-[10px] ${active ? 'text-white/70' : 'text-slate-600'}`}>
                    {APP_HINTS[item.id] ?? 'Aplikacja'}
                  </span>
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          title="Kolejne narzedzie"
          className="mt-1 flex items-center gap-2.5 rounded-xl border border-dashed border-slate-800 px-2.5 py-2.5 text-left text-sm font-medium text-slate-500 transition hover:border-slate-700 hover:bg-slate-900 hover:text-slate-300"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 ring-1 ring-slate-800">
            <Plus className="h-4 w-4" />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate">Kolejne narzedzie</span>
              <span className="block truncate text-[10px] text-slate-600">Miejsce na rozbudowe</span>
            </span>
          )}
        </button>

        {tools.length > 0 && !collapsed && (
          <p className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Narzedzia
          </p>
        )}
        {tools.map((item) => {
          const active = item.match.includes(view);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              title={item.label}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium transition ${
                active
                  ? 'bg-brand-600/90 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              }`}
            >
              {item.icon}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function useHubSidebarPrefs(userId: string) {
  const [prefs, setPrefsState] = useState(() => loadHubPreferences(userId));
  useEffect(() => {
    setPrefsState(loadHubPreferences(userId));
  }, [userId]);
  useEffect(() => {
    const onChange = () => setPrefsState(loadHubPreferences(userId));
    window.addEventListener('katalog-hub-preferences-changed', onChange);
    return () => window.removeEventListener('katalog-hub-preferences-changed', onChange);
  }, [userId]);
  const setPrefs = (next: HubPreferences) => {
    setPrefsState(next);
    saveHubPreferences(userId, next);
  };
  return { prefs, setPrefs };
}
