import type { View } from '../types';
import { getMergedFinanceData } from './financeStore';

export type AppNotificationKind = 'low_stock' | 'sync' | 'system' | 'finance';
export type AppNotificationScope =
  | 'all'
  | 'catalog'
  | 'ops'
  | 'crm'
  | 'talk'
  | 'calendar'
  | 'system';

export interface AppNotification {
  id: string;
  kind: AppNotificationKind;
  scope?: AppNotificationScope;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  userId?: string;
  /** np. view name */
  actionView?: View;
}

const KEY = 'katalog-notifications';

function loadAll(): AppNotification[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AppNotification[]) : [];
  } catch {
    return [];
  }
}

function saveAll(list: AppNotification[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
  window.dispatchEvent(new CustomEvent('katalog-notifications-changed'));
}

function notificationScope(n: AppNotification): AppNotificationScope {
  if (n.scope) return n.scope;
  if (n.actionView === 'ops') return 'ops';
  if (n.actionView === 'crm') return 'crm';
  return 'catalog';
}

export function listAppNotifications(
  userId: string,
  scope: AppNotificationScope = 'catalog',
): AppNotification[] {
  return loadAll()
    .filter((n) => !n.userId || n.userId === userId)
    .filter((n) => scope === 'all' || notificationScope(n) === scope)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function unreadAppNotificationCount(
  userId: string,
  scope: AppNotificationScope = 'catalog',
): number {
  return listAppNotifications(userId, scope).filter((n) => !n.read).length;
}

export function markAppNotificationRead(id: string) {
  const list = loadAll().map((n) => (n.id === id ? { ...n, read: true } : n));
  saveAll(list);
}

export function markAllAppNotificationsRead(
  userId: string,
  scope: AppNotificationScope = 'catalog',
) {
  const list = loadAll().map((n) =>
    (!n.userId || n.userId === userId) &&
    (scope === 'all' || notificationScope(n) === scope)
      ? { ...n, read: true }
      : n,
  );
  saveAll(list);
}

export function pushAppNotification(
  n: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string },
) {
  const list = loadAll();
  const item: AppNotification = {
    id: n.id ?? `n-${Date.now()}`,
    kind: n.kind,
    scope: n.scope,
    title: n.title,
    body: n.body,
    createdAt: new Date().toISOString(),
    read: false,
    userId: n.userId,
    actionView: n.actionView,
  };
  if (list.some((x) => x.id === item.id)) return;
  saveAll([item, ...list]);
}

/** Demo / operacyjne alerty po zalogowaniu: niski stan, braki zdjec. */
export function seedCatalogAlerts(
  userId: string,
  stats: { lowStock: number; outOfStock: number; withoutImage: number },
) {
  if (stats.outOfStock > 0) {
    pushAppNotification({
      id: `seed-out-${userId}`,
      userId,
      kind: 'low_stock',
      scope: 'catalog',
      title: 'Brak na stanie',
      body: `${stats.outOfStock} SKU bez stanu magazynowego.`,
      actionView: 'catalog',
    });
  }
  if (stats.lowStock > 0) {
    pushAppNotification({
      id: `seed-low-${userId}`,
      userId,
      kind: 'low_stock',
      scope: 'catalog',
      title: 'Niski stan',
      body: `${stats.lowStock} pozycji ze stanem <= 5.`,
      actionView: 'catalog',
    });
  }
  if (stats.withoutImage > 0) {
    pushAppNotification({
      id: `seed-img-${userId}`,
      userId,
      kind: 'system',
      scope: 'catalog',
      title: 'Brak zdjec',
      body: `${stats.withoutImage} produktow bez zdjecia w katalogu.`,
      actionView: 'missing-images',
    });
  }
}

export function seedOpsAlerts(userId: string) {
  const finance = getMergedFinanceData();
  const current =
    finance.months.find((m) => m.month === finance.meta.defaultMonth) ??
    finance.months[finance.months.length - 1] ??
    null;

  if (!current) {
    pushAppNotification({
      id: `seed-ops-empty-${userId}`,
      userId,
      kind: 'finance',
      scope: 'ops',
      title: 'Brak danych finansowych',
      body: 'Operacje nie maja jeszcze miesiaca bazowego do analizy.',
      actionView: 'ops',
    });
    return;
  }

  if (current.wynikNetto < 0) {
    pushAppNotification({
      id: `seed-ops-loss-${userId}-${current.month}`,
      userId,
      kind: 'finance',
      scope: 'ops',
      title: 'Ujemny wynik miesiaca',
      body: `${current.month}: wynik netto jest ponizej zera.`,
      actionView: 'ops',
    });
  }

  if (current.kosztDoSprzedazy >= 0.75) {
    pushAppNotification({
      id: `seed-ops-cost-ratio-${userId}-${current.month}`,
      userId,
      kind: 'finance',
      scope: 'ops',
      title: 'Wysoki udzial kosztow',
      body: `${Math.round(current.kosztDoSprzedazy * 100)}% sprzedazy pochlaniaja koszty.`,
      actionView: 'ops',
    });
  }

  const channels = finance.channelsByMonth[current.month] ?? [];
  if (channels.length === 0) {
    pushAppNotification({
      id: `seed-ops-channels-${userId}-${current.month}`,
      userId,
      kind: 'finance',
      scope: 'ops',
      title: 'Brak rozbicia kanalow',
      body: 'Dodaj dane e-commerce i handlowe, zeby uzgadniac sprzedaz.',
      actionView: 'ops',
    });
  }

  pushAppNotification({
    id: `seed-ops-ready-${userId}`,
    userId,
    kind: 'system',
    scope: 'ops',
    title: 'Operacje gotowe do pracy',
    body: 'Pulpit finansowy ma osobne alerty i wlasne narzedzia analizy.',
    actionView: 'ops',
  });
}
