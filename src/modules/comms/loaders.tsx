import { lazy, type LazyExoticComponent, type ComponentType } from 'react';
import { BUILD_HAS_COMMS } from '../../app/moduleRegistry';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComp = ComponentType<any>;

function commsLazy(
  loader: () => Promise<{ default: AnyComp }>,
): LazyExoticComponent<AnyComp> | null {
  return BUILD_HAS_COMMS ? lazy(loader) : null;
}

export const ChatDrawer = commsLazy(() =>
  import('../../components/ChatDrawer').then((m) => ({
    default: m.ChatDrawer as AnyComp,
  })),
);
