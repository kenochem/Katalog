import { Construction } from 'lucide-react';
import type { HubView } from '../../app/hubNavigation';
import { hubViewSectionLabel } from './HubShell';

export function HubSegmentPlaceholder({ view }: { view: HubView }) {
  const title = hubViewSectionLabel(view);
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-slate-400">
        <Construction className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Ten segment jest w trakcie przenoszenia z hub-platform. Tymczasowo użyj powiązanych
        modułów z menu (CRM, Operacje, Katalog).
      </p>
    </div>
  );
}
