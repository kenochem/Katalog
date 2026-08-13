/** Typy skrzynki CRM — wiadomości z IMAP (Supabase), bez lokalnych demo. */

export type InboxCategoryId =
  | 'important'
  | 'offer'
  | 'resolved'
  | 'waiting'
  | 'complaint';

export const INBOX_CATEGORIES: {
  id: InboxCategoryId;
  label: string;
  className: string;
}[] = [
  { id: 'important', label: 'Ważne', className: 'hub-badge-rose' },
  { id: 'offer', label: 'Oferta', className: 'hub-badge-sky' },
  { id: 'resolved', label: 'Załatwione', className: 'hub-badge-emerald' },
  { id: 'waiting', label: 'Oczekuje', className: 'hub-badge-amber' },
  { id: 'complaint', label: 'Reklamacja', className: 'hub-badge-violet' },
];

export function inboxCategoryLabel(id: InboxCategoryId): string {
  return INBOX_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function inboxCategoryClass(id: InboxCategoryId): string {
  return INBOX_CATEGORIES.find((c) => c.id === id)?.className ?? 'hub-badge-neutral';
}

export type InboxChannel = 'allegro' | 'email' | 'crm' | 'baselinker';

export interface CrmInboxThread {
  id: string;
  channel: InboxChannel;
  channelLabel: string;
  from: string;
  subject: string;
  preview: string;
  body: string;
  bodyHtml?: string;
  sku?: string;
  clientId?: string;
  clientName?: string;
  unread: boolean;
  createdAt: string;
  replied?: boolean;
  category?: InboxCategoryId;
  meta?: {
    imapUid?: number;
    bodyFetched?: boolean;
    messageId?: string;
    replyTo?: string;
    to?: string;
  };
}

export const CRM_INBOX_CHANGED = 'katalog-crm-inbox-changed';
