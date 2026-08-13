const KEY = 'katalog-hub-preferences';

export type NavSectionId =
  | 'home'
  | 'catalog'
  | 'warehouse'
  | 'logistics'
  | 'finance'
  | 'crm'
  | 'orders'
  | 'ops'
  | 'social'
  | 'calendar'
  | 'assist'
  | 'inbox'
  | 'integrations'
  | 'departments'
  | 'downloads'
  | 'guide';

export interface HubPreferences {
  hiddenNavSections: NavSectionId[];
  navSectionOrder: NavSectionId[];
  sidebarCollapsed: boolean;
}

const DEFAULT: HubPreferences = {
  hiddenNavSections: [],
  navSectionOrder: [
    'home',
    'catalog',
    'warehouse',
    'logistics',
    'crm',
    'orders',
    'inbox',
    'finance',
    'ops',
    'social',
    'calendar',
    'assist',
    'departments',
    'integrations',
    'downloads',
    'guide',
  ],
  sidebarCollapsed: false,
};

export function loadHubPreferences(_userId: string): HubPreferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...(JSON.parse(raw) as HubPreferences) };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveHubPreferences(_userId: string, prefs: HubPreferences) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent('katalog-hub-preferences-changed'));
}

export function isNavSectionVisible(prefs: HubPreferences, section: NavSectionId): boolean {
  return !prefs.hiddenNavSections.includes(section);
}

export function sortByNavSectionOrder<T extends { navSection: NavSectionId }>(
  items: T[],
  order: NavSectionId[],
): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...items].sort(
    (a, b) => (rank.get(a.navSection) ?? 999) - (rank.get(b.navSection) ?? 999),
  );
}
