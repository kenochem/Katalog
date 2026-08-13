import { lazy, type LazyExoticComponent, type ComponentType } from 'react';
import { BUILD_HAS_OPS } from '../../app/moduleRegistry';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComp = ComponentType<any>;

function opsLazy(
  loader: () => Promise<{ default: AnyComp }>,
): LazyExoticComponent<AnyComp> | null {
  return BUILD_HAS_OPS ? lazy(loader) : null;
}

export const OpsHubView = opsLazy(() =>
  import('../../components/OpsHubView').then((m) => ({
    default: m.OpsHubView as AnyComp,
  })),
);
