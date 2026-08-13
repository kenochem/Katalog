import { lazy, type LazyExoticComponent, type ComponentType } from 'react';
import { BUILD_HAS_CRM } from '../../app/moduleRegistry';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComp = ComponentType<any>;

function crmLazy(
  loader: () => Promise<{ default: AnyComp }>,
): LazyExoticComponent<AnyComp> | null {
  return BUILD_HAS_CRM ? lazy(loader) : null;
}

export const CrmHubView = crmLazy(() =>
  import('../../components/CrmHubView').then((m) => ({
    default: m.CrmHubView as AnyComp,
  })),
);

export const CrmOrderSidePanel = crmLazy(() =>
  import('../../components/CrmOrderSidePanel').then((m) => ({
    default: m.CrmOrderSidePanel as AnyComp,
  })),
);
