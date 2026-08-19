import { Inbox, MailX } from 'lucide-react';

/** Moduł poczty w CRM — wyłączony; sync IMAP wyłączony (uninstall-crm-mail-sync.ps1). */
export function CrmInboxPausedView() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-slate-500">
        <MailX className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-200">Obsługa klienta (poczta)</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Moduł jest <span className="text-amber-400/90">wyłączony</span> — brak sync IMAP do Supabase.
        Skupiamy się na lejku sprzedaży i koszyku zamówienia.
      </p>
      <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1 text-xs text-slate-500">
        <Inbox className="h-3.5 w-3.5" />
        Nieaktywne · harmonogram poczty usunięty na serwerze
      </p>
    </div>
  );
}
