import type { ReactNode } from 'react';
import { CrmSubNav, type CrmTab } from './CrmSubNav';

interface CrmShellLayoutProps {
  tab: CrmTab;
  onTabChange: (tab: CrmTab) => void;
  orderQty: number;
  inboxUnread?: number;
  pipelineOpen?: number;
  displayLabel?: string;
  hubHero?: ReactNode;
  children: ReactNode;
}

/** CRM: boczny panel zakładek (desktop) + poziomy pasek (mobile). */
export function CrmShellLayout({
  tab,
  onTabChange,
  orderQty,
  inboxUnread = 0,
  pipelineOpen = 0,
  displayLabel,
  hubHero,
  children,
}: CrmShellLayoutProps) {
  return (
    <div className="crm-shell w-full pb-24">
      {tab === 'hub' && hubHero}

      <div className="mt-4 flex flex-col gap-4 lg:mt-5 lg:flex-row lg:items-start lg:gap-5">
        <aside className="crm-shell-sidebar hidden shrink-0 lg:block lg:w-56 xl:w-60">
          <div className="sticky top-3 space-y-3">
            {displayLabel && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-400">
                  Panel handlowca
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-100">{displayLabel}</p>
              </div>
            )}
            <CrmSubNav
              active={tab}
              onChange={onTabChange}
              orderQty={orderQty}
              inboxUnread={inboxUnread}
              pipelineOpen={pipelineOpen}
              variant="sidebar"
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="lg:hidden">
            <CrmSubNav
              active={tab}
              onChange={onTabChange}
              orderQty={orderQty}
              inboxUnread={inboxUnread}
              pipelineOpen={pipelineOpen}
              variant="bar"
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
