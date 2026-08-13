import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { APP_PRODUCT } from '../app/moduleRegistry';

/** Suite / Sell osadzają katalog w HubShell — sam produkt „catalog” tego nie bundluje. */
export const EMBEDDED_HUB_ENABLED =
  APP_PRODUCT === 'suite' || APP_PRODUCT === 'sell';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComp = ComponentType<any>;

function hubLazy(
  loader: () => Promise<{ default: AnyComp }>,
): LazyExoticComponent<AnyComp> | null {
  return EMBEDDED_HUB_ENABLED ? lazy(loader) : null;
}

export const HubShell = hubLazy(() =>
  import('../components/hub/HubShell').then((m) => ({ default: m.HubShell })),
);

export const HubSegmentOverlay = hubLazy(() =>
  import('./HubSegmentOverlay').then((m) => ({
    default: m.HubSegmentOverlay as AnyComp,
  })),
);
