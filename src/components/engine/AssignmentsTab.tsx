import { ChevronDown, ChevronRight, Download, EyeOff, Loader2, Play, Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { Product } from '../../types';
import { downloadText } from '../../lib/assortmentAudit';
import { runBulkEdit } from '../../lib/bulkEdit';
import { hideCsv, proposalsCsv, researchCsv, summarizeEngine, type EngineRow, type EngineScope } from '../../lib/categoryEngineReport';
import { confirmDialog } from '../../lib/dialog';
import { buildInsights, type Insight } from '../../lib/engineInsights';
import type { MemoryEntry } from '../../lib/engineMemory';
import { hasProductDocs, useDocsIndexVersion } from '../../lib/productDocsIndex';
import { showToast } from '../../lib/toast';
import { btn, btnPrimary, card, chip, SectionHead, toneBox } from './ui';

const UNDECIDED = 'Do decyzji';

export type Queue = 'changes' | 'review' | 'research' | 'hide';

const QUEUES: { id: Queue; label: string; hint: string }[] = [
  { id: 'changes', label: 'Pewne', hint: 'Silnik jest pewny — można zastosować hurtem.' },
  { id: 'review', label: 'Do sprawdzenia', hint: 'Sygnały są słabe lub sprzeczne — zdecyduj dla każdej pozycji.' },
  { id: 'research', label: 'Bez sygnału', hint: 'Nazwa i opis nic nie mówią. Dostarcz kartę charakterystyki lub opis.' },
  { id: 'hide', label: 'Do ukrycia', hint: 'Pozycje niesprzedażowe: usługi, wysyłka, sprzęt biurowy.' },
];

const DISMISS_KEY = 'katalog.engine.dismissed.v1';

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function saveDismissed(s: Set<string>) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...s].slice(-5000)));
  } catch {
    /* brak dostępu do pamięci przeglądarki — pomijamy zapamiętywanie */
  }
}
const dismissKey = (r: EngineRow) => `${r.sku}>${r.decision.to ?? ''}`;

const LAYER_LABEL: Record<string, string> = {
  ręczne: 'ręcznie zatwierdzone',
  rodzaj: 'rodzaj produktu',
  funkcja: 'funkcja z nazwy',
  opis: 'opis i skład',
  rodzina: 'ten sam produkt, inne opakowanie',
  sklep: 'kategoria w sklepie',
  linia: 'linia produktowa',
  producent: 'producent (podpowiedź)',
  podobne: 'podobne nazwy',
  model: 'model statystyczny',
  sieć: 'fakty z internetu',
  karta: 'karta produktu / karta charakterystyki',
  obecna: 'obecna kategoria',
};

/** Przypisania: audyt już przypisanych produktów i uzupełnianie tych bez kategorii — jedna lista decyzji. */
export function AssignmentsTab({
  rows,
  setRows,
  scope,
  setScope,
  queue,
  setQueue,
  products,
  leaves,
  canEdit,
  running,
  onRun,
  onPatched,
  remember,
}: {
  rows: EngineRow[] | null;
  setRows: React.Dispatch<React.SetStateAction<EngineRow[] | null>>;
  scope: EngineScope;
  setScope: (s: EngineScope) => void;
  queue: Queue;
  setQueue: (q: Queue) => void;
  products: Product[];
  leaves: { name: string; path: string }[];
  canEdit: boolean;
  running: boolean;
  onRun: () => void;
  onPatched: (patches: { id: string; patch: Partial<Product> }[]) => void;
  remember: (entries: Omit<MemoryEntry, 'at'>[]) => Promise<void>;
}) {
  const docsVersion = useDocsIndexVersion();
  const [applying, setApplying] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const queueRef = useRef<HTMLDivElement>(null);
  const pathOf = useMemo(() => new Map(leaves.map((c) => [c.name, c.path])), [leaves]);
  const summary = useMemo(() => (rows ? summarizeEngine(rows, scope) : null), [rows, scope]);
  const singles = useMemo(() => products.filter((p) => !p.isGroup && (p.sku ?? '').trim()), [products]);
  const stamp = new Date().toISOString().slice(0, 10);

  const insights = useMemo(
    () =>
      summary
        ? buildInsights({
            scope,
            summary,
            health: null,
            totals: { products: singles.length, categorized: singles.filter((p) => p.category && p.category !== UNDECIDED).length },
            descriptions: null,
            researchWithDocs: summary.research.filter((r) => hasProductDocs(r.id)).length,
          }).filter((i) => i.id !== 'coverage')
        : [],
    [summary, scope, singles, docsVersion], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Po zapisaniu kategorii aktualizujemy wynik lokalnie — bez ponownego liczenia całego katalogu. */
  function markAssigned(ids: Map<string, string>) {
    setRows((prev) => prev && prev.map((r) => (ids.has(r.id) ? { ...r, decision: { ...r.decision, from: ids.get(r.id)!, to: ids.get(r.id)!, status: 'pewne' as const } } : r)));
  }

  async function assign(items: { row: EngineRow; leaf: string }[], label: string) {
    if (!canEdit || !items.length) return;
    setApplying(true);
    try {
      const target = new Map(items.map((i) => [i.row.id, i.leaf]));
      const res = await runBulkEdit(
        items.map((i) => i.row.id),
        (id) => {
          const leaf = target.get(id)!;
          return { category: leaf, shopPath: pathOf.get(leaf) ?? '' };
        },
        label,
      );
      onPatched(res.patches);
      const okItems = items.filter((i) => !res.failed.some((f) => f.sku === i.row.sku));
      markAssigned(new Map(okItems.map((i) => [i.row.id, i.leaf])));
      void remember(okItems.map((i) => ({ sku: i.row.sku, action: i.leaf === i.row.decision.to ? ('accept' as const) : ('change' as const), proposed: i.row.decision.to ?? '', chosen: i.leaf, from: i.row.decision.from })));
      showToast(`Zapisano ${res.updated} przypisań (cofniesz w Logi → Operacje masowe)${res.failed.length ? `, błędy: ${res.failed.length}` : ''}`, res.failed.length ? 'warn' : 'ok', 6000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać kategorii', 'error', 8000);
    } finally {
      setApplying(false);
    }
  }

  async function applyConfident() {
    if (!summary?.changes.length) return;
    const ok = await confirmDialog({
      title: scope === 'audyt' ? 'Popraw błędne przypisania' : 'Zastosuj pewne decyzje silnika',
      message: `Zmienię kategorię w ${summary.changes.length} produktach na wskazaną przez silnik z pewnością (nazwa, opis, linia produktowa zgodne). Pozycje „do sprawdzenia” i „bez sygnału” nie są ruszane. Całość da się cofnąć w Logi → Operacje masowe.`,
      confirmLabel: 'Zastosuj',
      tone: 'warn',
    });
    if (!ok) return;
    await assign(
      summary.changes.map((row) => ({ row, leaf: row.decision.to! })),
      'Silnik kategorii: pewne decyzje',
    );
  }

  function dismiss(r: EngineRow) {
    const next = new Set(dismissed).add(dismissKey(r));
    setDismissed(next);
    saveDismissed(next);
    void remember([{ sku: r.sku, action: 'dismiss', proposed: r.decision.to ?? '', chosen: '', from: r.decision.from }]);
  }
  function undismissAll() {
    setDismissed(new Set());
    saveDismissed(new Set());
  }

  function onInsight(i: Insight) {
    const a = i.action;
    if (!a) return;
    if (a.kind === 'apply') void applyConfident();
    else if (a.kind === 'queue') {
      setQueue(a.target as Queue);
      queueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (!rows || !summary) {
    return (
      <section className={`${card} text-center`}>
        <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Przypisania do kategorii</h3>
        <p className="mx-auto mt-1 max-w-xl text-[13px] text-slate-500">
          Na każdym produkcie silnik sprawdza kilkanaście warstw: rodzaj i funkcję z nazwy, opis, skład, linię produktową, opakowanie, kategorię w sklepie, model statystyczny i fakty z materiałów. Wskaże błędnie przypisane produkty z propozycją poprawki i przypisze te bez kategorii.
        </p>
        <button type="button" className={`${btnPrimary} mt-3`} disabled={running} onClick={onRun}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Uruchom analizę
        </button>
      </section>
    );
  }

  const list = summary[queue];
  const visible = list.filter((r) => !(queue === 'review' || queue === 'changes' ? dismissed.has(dismissKey(r)) : false));
  const hiddenCount = list.length - visible.length;
  const assigned = rows.filter((r) => r.decision.from !== UNDECIDED).length;
  const unassigned = rows.length - assigned;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip(scope === 'audyt')} onClick={() => { setScope('audyt'); setQueue('changes'); }}>
          Przypisane · {assigned.toLocaleString('pl-PL')}
        </button>
        <button type="button" className={chip(scope === 'uzupelnij')} onClick={() => { setScope('uzupelnij'); setQueue('changes'); }}>
          Bez kategorii · {unassigned.toLocaleString('pl-PL')}
        </button>
        <span className="text-xs text-slate-500">{scope === 'audyt' ? 'Sprawdzam, czy produkty z kategorią leżą we właściwej.' : 'Proponuję kategorię dla produktów w „Do decyzji”.'}</span>
      </div>

      {insights.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {insights.map((i) => (
            <div key={i.id} className={`flex flex-col justify-between gap-2 rounded-2xl border p-4 ${toneBox[i.tone]}`}>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{i.title}</p>
                <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-300">{i.text}</p>
              </div>
              {i.action && (i.action.kind !== 'apply' || canEdit) && i.action.kind !== 'tab' && (
                <div>
                  <button type="button" className={btn} disabled={applying} onClick={() => onInsight(i)}>
                    {i.action.label}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <section className={card} ref={queueRef}>
        <SectionHead
          title="Kolejka decyzji"
          hint={QUEUES.find((q) => q.id === queue)!.hint}
          actions={
            <>
              {canEdit && queue === 'changes' && (
                <button type="button" className={btnPrimary} disabled={!summary.changes.length || applying} onClick={() => void applyConfident()}>
                  {applying && <Loader2 className="h-4 w-4 animate-spin" />} {scope === 'audyt' ? 'Popraw błędne' : 'Zastosuj pewne'} ({summary.changes.length})
                </button>
              )}
              <button type="button" className={btn} onClick={() => downloadText(`kategorie-propozycje-${stamp}.csv`, proposalsCsv(rows), 'text/csv')}>
                <Download className="h-4 w-4" /> Propozycje (CSV)
              </button>
              {queue === 'research' && (
                <button type="button" className={btn} disabled={!summary.research.length} onClick={() => downloadText(`do-wyszukania-${stamp}.csv`, researchCsv(summary.research), 'text/csv')}>
                  <Download className="h-4 w-4" /> Do wyszukania (CSV)
                </button>
              )}
              {queue === 'hide' && (
                <button type="button" className={btn} disabled={!summary.hide.length} onClick={() => downloadText(`do-ukrycia-${stamp}.csv`, hideCsv(summary.hide), 'text/csv')}>
                  <Download className="h-4 w-4" /> Do ukrycia (CSV)
                </button>
              )}
            </>
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          {QUEUES.map((q) => (
            <button key={q.id} type="button" onClick={() => setQueue(q.id)} className={chip(queue === q.id)}>
              {q.label} · {summary[q.id].length.toLocaleString('pl-PL')}
            </button>
          ))}
        </div>
        {hiddenCount > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            Pominięte przez Ciebie: {hiddenCount}.{' '}
            <button type="button" className="font-semibold underline" onClick={undismissAll}>
              Przywróć wszystkie
            </button>
          </p>
        )}
        <DecisionList rows={visible} queue={queue} canEdit={canEdit} busy={applying} leaves={leaves} onAssign={(row, leaf) => void assign([{ row, leaf }], 'Silnik kategorii: decyzja ręczna')} onDismiss={dismiss} />
      </section>
    </div>
  );
}

function DecisionList({
  rows,
  queue,
  canEdit,
  busy,
  leaves,
  onAssign,
  onDismiss,
}: {
  rows: EngineRow[];
  queue: Queue;
  canEdit: boolean;
  busy: boolean;
  leaves: { name: string; path: string }[];
  onAssign: (row: EngineRow, leaf: string) => void;
  onDismiss: (row: EngineRow) => void;
}) {
  const [filter, setFilter] = useState('');
  const [limit, setLimit] = useState(30);
  const [open, setOpen] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const q = filter.trim().toLowerCase();
  const shown = q ? rows.filter((r) => `${r.sku} ${r.name} ${r.maker} ${r.decision.to ?? ''} ${r.decision.from}`.toLowerCase().includes(q)) : rows;

  return (
    <div className="mt-3">
      <div className="relative mb-2 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setLimit(30);
          }}
          placeholder="Szukaj w tej liście…"
          className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-9 pr-8 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        {filter && (
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" onClick={() => setFilter('')}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <ul className="divide-y divide-black/10 dark:divide-white/10">
        {shown.slice(0, limit).map((r) => {
          const d = r.decision;
          const isOpen = open === r.id;
          const target = pick[r.id] ?? d.to ?? '';
          const canApply = canEdit && (queue === 'changes' || queue === 'review') && !!target && target !== d.from;
          return (
            <li key={r.id} className="py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => setOpen(isOpen ? null : r.id)} title="Dlaczego?">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {r.sku} · {r.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {queue === 'research' || queue === 'hide' ? (
                      <>
                        {r.maker || 'brak producenta'} · obecnie: {d.from}
                        {hasProductDocs(r.id) && <span className="ml-2 text-emerald-600 dark:text-emerald-400">ma materiały</span>}
                      </>
                    ) : (
                      <>
                        {d.from} → <span className="font-medium text-slate-700 dark:text-slate-200">{d.to ?? '?'}</span> · wynik {d.score}
                        {d.flags.length > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400">{d.flags.join(', ')}</span>}
                      </>
                    )}
                  </p>
                </div>
                {(queue === 'review' || queue === 'changes') && (
                  <select
                    value={target}
                    onChange={(e) => setPick((p) => ({ ...p, [r.id]: e.target.value }))}
                    className="max-w-[16rem] rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    title="Kategoria docelowa"
                  >
                    <optgroup label="Propozycje silnika">
                      {d.alternatives.map((a) => (
                        <option key={a.leaf} value={a.leaf}>
                          {a.leaf} ({a.score})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Wszystkie kategorie">
                      {leaves.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.path.split(' › ').slice(-2).join(' › ')}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                )}
                {canApply && (
                  <button type="button" className={btnPrimary} disabled={busy} onClick={() => onAssign(r, target)}>
                    Zatwierdź
                  </button>
                )}
                {(queue === 'review' || queue === 'changes') && (
                  <button type="button" className={btn} onClick={() => onDismiss(r)} title="Nie pokazuj tej propozycji więcej">
                    <EyeOff className="h-4 w-4" />
                  </button>
                )}
                {queue === 'research' && (
                  <a
                    className={btn}
                    target="_blank"
                    rel="noreferrer"
                    href={`https://www.google.com/search?q=${encodeURIComponent(`${r.maker && !/^(inni producenci|ogólna|marka niezdefiniowana)$/i.test(r.maker) ? r.maker + ' ' : ''}${r.name} do czego służy`)}`}
                  >
                    Szukaj w sieci
                  </a>
                )}
              </div>
              {isOpen && (
                <div className="ml-7 mt-2 rounded-2xl bg-black/[0.04] p-3 text-[13px] dark:bg-white/5">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dlaczego</p>
                  <p className="text-slate-700 dark:text-slate-300">{d.reason}</p>
                  {d.votes.length > 0 && (
                    <ul className="mt-2 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
                      {d.votes
                        .slice()
                        .sort((a, b) => b.weight - a.weight)
                        .map((v, i) => (
                          <li key={i} className="flex justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
                            <span className="truncate">
                              <span className="font-semibold">{LAYER_LABEL[v.layer] ?? v.layer}</span> → {v.leaf}
                            </span>
                            <span className="tabular-nums">{v.weight.toFixed(2)}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {shown.length === 0 && <li className="py-8 text-center text-sm text-slate-500">Brak pozycji w tej kolejce.</li>}
      </ul>
      {shown.length > limit && (
        <button type="button" className={`${btn} mt-3`} onClick={() => setLimit((l) => l + 50)}>
          Pokaż więcej ({shown.length - limit})
        </button>
      )}
    </div>
  );
}
