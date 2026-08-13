import type { HubView } from '../app/hubNavigation';
import type { View } from '../types';

/** Widoki renderowane wewnątrz `App` (katalog + moduły). */
export function hubViewToAppView(h: HubView): View | null {
  switch (h) {
    case 'favorites':
      return 'favorites';
    case 'kits':
      return 'kits';
    case 'admin':
      return 'admin';
    default:
      return null;
  }
}

export function appViewToHubView(v: View): HubView {
  switch (v) {
    case 'crm':
      return 'crm';
    case 'ops':
      return 'ops';
    case 'admin':
      return 'admin';
    case 'favorites':
      return 'favorites';
    case 'kits':
      return 'kits';
    default:
      return 'catalog';
  }
}

export function isAppHostedHubView(h: HubView): boolean {
  return (
    hubViewToAppView(h) !== null ||
    h === 'catalog' ||
    h === 'favorites' ||
    h === 'kits'
  );
}

export function dispatchAppView(view: View) {
  window.dispatchEvent(new CustomEvent('katalog-app-view', { detail: { view } }));
}
