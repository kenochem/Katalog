import { ArrowRight, ClipboardCheck, Download, Loader2, Play } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '../../types';
import { buildCategoryModel } from '../../lib/assortmentAnalysis';
import { AUDIT_CODE_LABEL, auditToCsv, downloadText, runAudit, type AuditResult } from '../../lib/assortmentAudit';
import type { EngineTab, Overview } from '../../lib/engineOverview';
import { showToast } from '../../lib/toast';
import { Bar, btn, btnPrimary, card, SectionHead, toneBox } from './ui';

/** Przegląd: co jest w porządku, co wymaga pracy i od czego zacząć — jedno miejsce zamiast osobnych analiz w każdej zakładce. */
export function OverviewTab({
  overview,
  hasRun,
  running,
  products,
  onRun,
  onOpen,
}: {
  overview: Overview;
  hasRun: boolean;
  running: boolean;
  products: Product[];
  onRun: () => void;
  onOpen: (tab: EngineTab, taskId?: string) => void;
}) {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);

  /** Audyt liczy się ok. sekundy — najpierw pokazujemy stan „liczenie”, potem blokujemy wątek. */
  function startAudit() {
    setAuditing(true);
    window.setTimeout(() => {
      try {
        setAudit(runAudit(products, buildCategoryModel(products)));
      } finally {
        setAuditing(false);
      }
    }, 40);
  }
  function exportAudit(kind: 'csv' | 'json') {
    const r = audit ?? runAudit(products, buildCategoryModel(products));
    setAudit(r);
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'csv') downloadText(`audyt-asortymentu-${stamp}.csv`, auditToCsv(r), 'text/csv');
    else downloadText(`audyt-asortymentu-${stamp}.json`, JSON.stringify(r), 'application/json');
    showToast(`Pobrano audyt: ${r.summary.withIssues.toLocaleString('pl-PL')} produktów z uwagami`, 'info');
  }

  return (
    <div className="space-y-4">
      {!hasRun && (
        <section className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <div className="max-w-2xl">
            <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">Zacznij od analizy</h3>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Jedno uruchomienie liczy przypisania do kategorii, kondycję drzewa i spójność opisów. Nazwy, atrybuty i producenci są policzone od razu.
            </p>
          </div>
          <button type="button" className={btnPrimary} disabled={running} onClick={onRun}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Uruchom analizę
          </button>
        </section>
      )}

      <section className={card}>
        <SectionHead title="Stan katalogu" hint="Sześć obszarów, które silnik pielęgnuje. Wynik gotowości to ich średnia ważona." />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {overview.meters.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpen(m.id)}
              className="group rounded-2xl bg-black/[0.04] p-4 text-left transition hover:bg-black/[0.07] dark:bg-white/[0.06] dark:hover:bg-white/10"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{m.label}</span>
                <span className="text-lg font-bold tabular-nums text-slate-950 dark:text-slate-50">{m.value == null ? '—' : `${m.value}%`}</span>
              </div>
              <Bar value={m.value} className="mt-2" />
              <p className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span className="truncate">{m.detail}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className={card}>
        <SectionHead title="Do zrobienia" hint="Posortowane od najpoważniejszych. Kliknij, żeby przejść do narzędzia, które to załatwia." />
        {overview.tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{hasRun ? 'Nic pilnego — katalog jest w dobrym stanie.' : 'Uruchom analizę, żeby zobaczyć listę.'}</p>
        ) : (
          <ul className="grid gap-2.5 md:grid-cols-2">
            {overview.tasks.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onOpen(t.tab, t.id)} className={`group flex h-full w-full items-start justify-between gap-3 rounded-2xl border p-4 text-left transition hover:brightness-[0.98] ${toneBox[t.tone]}`}>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">{t.title}</span>
                    <span className="mt-1 block text-[13px] text-slate-600 dark:text-slate-300">{t.text}</span>
                  </span>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <SectionHead
          title="Pełny audyt jakości danych"
          hint="Sprawdza każdy produkt pod kątem producenta, kategorii, nazwy i gotowości do sklepu. Raport można pobrać i przeanalizować w całości."
          actions={
            <>
              <button type="button" disabled={auditing} onClick={startAudit} className={btnPrimary}>
                {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} {auditing ? 'Liczenie…' : 'Uruchom audyt'}
              </button>
              <button type="button" onClick={() => exportAudit('csv')} className={btn}>
                <Download className="h-4 w-4" /> CSV
              </button>
              <button type="button" onClick={() => exportAudit('json')} className={btn}>
                <Download className="h-4 w-4" /> JSON
              </button>
            </>
          }
        />
        {audit && (
          <div className="space-y-3">
            <p className="text-[13px] text-slate-600 dark:text-slate-300">
              {audit.summary.withIssues.toLocaleString('pl-PL')} z {audit.summary.total.toLocaleString('pl-PL')} produktów ma uwagi; bez uwag: {audit.summary.clean.toLocaleString('pl-PL')}.
            </p>
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {audit.summary.byCode.map((c) => (
                <li key={c.code} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-slate-700 dark:text-slate-200">{AUDIT_CODE_LABEL[c.code] ?? c.code}</span>
                  <span className="font-semibold tabular-nums text-slate-950 dark:text-slate-50">{c.count.toLocaleString('pl-PL')}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
