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
  | 'admin'
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
    'admin',
    'downloads',
    'guide',
  ],
  sidebarCollapsed: false,
};

export function loadHubPreferences(_userId: string): HubPreferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<HubPreferences>;
    const navSectionOrder = [
      ...new Set([
        ...(Array.isArray(parsed.navSectionOrder) ? parsed.navSectionOrder : DEFAULT.navSectionOrder),
        ...DEFAULT.navSectionOrder,
      ]),
    ] as NavSectionId[];
    return { ...DEFAULT, ...parsed, navSectionOrder };
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
