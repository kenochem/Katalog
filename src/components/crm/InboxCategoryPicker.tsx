import {
  INBOX_CATEGORIES,
  type InboxCategoryId,
} from '../../lib/crmInbox';

interface InboxCategoryPickerProps {
  value?: InboxCategoryId;
  onChange: (category: InboxCategoryId | null) => void;
}

export function InboxCategoryPicker({ value, onChange }: InboxCategoryPickerProps) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Kategoria
      </p>
      <div className="flex flex-wrap gap-1.5">
        {INBOX_CATEGORIES.map((cat) => {
          const active = value === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onChange(active ? null : cat.id)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                active ? cat.className : 'hub-badge-neutral hover:opacity-90'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type InboxFilterId = 'all' | 'unreplied' | InboxCategoryId;

export function InboxFilterBar({
  active,
  onChange,
  counts,
}: {
  active: InboxFilterId;
  onChange: (id: InboxFilterId) => void;
  counts: {
    all: number;
    unreplied: number;
    byCategory: Partial<Record<InboxCategoryId, number>>;
  };
}) {
  const items: { id: InboxFilterId; label: string; count?: number }[] = [
    { id: 'all', label: 'Wszystkie', count: counts.all },
    { id: 'unreplied', label: 'Bez odpowiedzi', count: counts.unreplied },
    ...INBOX_CATEGORIES.map((c) => ({
      id: c.id as InboxFilterId,
      label: c.label,
      count: counts.byCategory[c.id],
    })),
  ];

  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-1 scrollbar-none">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
            active === item.id
              ? 'bg-brand-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          {item.label}
          {item.count != null && item.count > 0 && (
            <span
              className={`rounded-full px-1.5 py-px text-[10px] ${
                active === item.id ? 'bg-white/20' : 'bg-slate-800 text-slate-500'
              }`}
            >
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
