import { BarChart3, BookOpen, Camera } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Product } from '../../types';
import { PhotoProgressView } from '../PhotoProgressView';
import { KnowledgeProgressPanel } from './KnowledgeProgressPanel';

export type ProgressTab = 'photos' | 'knowledge';

interface CatalogProgressViewProps {
  products: Product[];
  onOpenMissing: (category?: string) => void;
  onOpenKnowledgeWeak: (category?: string) => void;
}

export function CatalogProgressView({
  products,
  onOpenMissing,
  onOpenKnowledgeWeak,
}: CatalogProgressViewProps) {
  const [tab, setTab] = useState<ProgressTab>('photos');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Postępy katalogu</h2>
        <p className="text-sm text-slate-400">Zdjęcia, stany oraz kompletność opisów pod handlowców i boty AI</p>
      </div>

      <div
        className="flex gap-1 rounded-xl border border-slate-700/70 bg-slate-900/40 p-1 dark:border-slate-800 dark:bg-slate-900/60"
        role="tablist"
      >
        <ProgressTabButton
          active={tab === 'photos'}
          onClick={() => setTab('photos')}
          icon={<Camera className="h-4 w-4" />}
          label="Zdjęcia i stany"
        />
        <ProgressTabButton
          active={tab === 'knowledge'}
          onClick={() => setTab('knowledge')}
          icon={<BookOpen className="h-4 w-4" />}
          label="Wiedza o produktach"
        />
      </div>

      {tab === 'photos' ? (
        <PhotoProgressView products={products} onOpenMissing={onOpenMissing} embedded />
      ) : (
        <KnowledgeProgressPanel products={products} onOpenWeak={onOpenKnowledgeWeak} />
      )}
    </div>
  );
}

function ProgressTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition sm:flex-initial sm:px-4 ${
        active
          ? 'bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/35 dark:text-brand-200'
          : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Ikona do nawigacji (paleta / hub). */
export const progressNavIcon = BarChart3;
