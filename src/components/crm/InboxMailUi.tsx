import { CornerUpRight } from 'lucide-react';
import {
  inboxCategoryClass,
  inboxCategoryLabel,
  type InboxCategoryId,
} from '../../lib/crmInbox';

export function InboxRepliedIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <span className="inline-flex shrink-0 text-slate-500" title="Odpowiedziano">
      <CornerUpRight className={className} aria-hidden />
    </span>
  );
}

export function InboxCategoryBadge({ category }: { category: InboxCategoryId }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${inboxCategoryClass(category)}`}
    >
      {inboxCategoryLabel(category)}
    </span>
  );
}

export function formatInboxDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Wczoraj';
  }
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}
