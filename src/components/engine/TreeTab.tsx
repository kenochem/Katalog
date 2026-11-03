import { Loader2, Play, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../../types';
import { categoryKey } from '../../lib/categoryRegistry';
import { confirmDialog } from '../../lib/dialog';
import { showToast } from '../../lib/toast';
import { applyTreeAction, type TreeApplyChoice } from '../../lib/treeApply';
import type { TreeAction, TreeProposal, TreeReport } from '../../lib/treeAdvisor';
import { btn, btnPrimary, card, field as input } from './ui';

const DISMISS_KEY = 'katalog.tree.dismissed.v1';

type Filter = 'all' | 'merge' | 'split' | 'rename' | 'structure' | 'note';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Wszystko' },
  { id: 'merge', label: 'Scalenia i usunięcia' },
  { id: 'split', label: 'Podziały' },
  { id: 'rename', label: 'Nazwy' },
  { id: 'structure', label: 'Poziomy' },
  { id: 'note', label: 'Uwagi' },
];
const groupOf = (a: TreeAction): Filter => (a.kind === 'merge' || a.kind === 'remove' ? 'merge' : a.kind === 'flatten' || a.kind === 'regroup' ? 'structure' : a.kind);

const toneClass: Record<TreeProposal['tone'], string> = {
  bad: 'border-rose-500/30 bg-rose-500/10',
  warn: 'border-amber-500/30 bg-amber-500/10',
  info: 'border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/5',
};

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

const CONFIRM: Record<string, (p: TreeProposal, c: TreeApplyChoice) => string> = {
  remove: (p) => `Usunę pustą kategorię. ${p.title}.`,
  merge: (p, c) => `Przeniosę ${p.products} produktów do „${c.text || (p.action as { into: string }).into}” (przypisania da się cofnąć w Logi → Operacje masowe) i usunę kategorię „${(p.action as { name: string }).name}”. Samej kategorii po usunięciu nie przywróci przycisk cofnięcia — trzeba ją dodać ponownie w Kategoriach.`,
  rename: (_p, c) => `Zmienię nazwę kategorii na „${c.text}”. Produkty dostaną nową nazwę.`,
  split: (p, c) => `Utworzę ${(c.parts ?? []).filter((x) => x.on).length} podkategorii obok „${(p.action as { name: string }).name}” i przeniosę do nich produkty (przypisania da się cofnąć w Logi → Operacje masowe, same kategorie usuniesz w Kategoriach).`,
  flatten: (p) => `${p.reason} Przeniosę podkategorię o poziom wyżej i usunę pustą grupę.`,
  regroup: (_p, c) => `Utworzę grupę „${c.text}” i przeniosę do niej wskazane kategorie (produkty zostają w swoich kategoriach).`,
};

export function TreeTab({
  report,
  currentIds,
  leafNames,
  canEdit,
  busy,
  onRun,
  onPatched,
  onChanged,
}: {
  report: TreeReport | null;
  currentIds: Map<string, string[]>;
  leafNames: string[];
  canEdit: boolean;
  busy: boolean;
  onRun: () => void;
  onPatched: (patches: { id: string; patch: Partial<Product> }[]) => void;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const [choices, setChoices] = useState<Record<string, TreeApplyChoice>>({});
  const [working, setWorking] = useState<string | null>(null);
  const [limit, setLimit] = useState(25);

  const visible = useMemo(() => (report?.proposals ?? []).filter((p) => !dismissed.has(p.id) && (filter === 'all' || groupOf(p.action) === filter)), [report, dismissed, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const p of report?.proposals ?? []) {
      if (dismissed.has(p.id)) continue;
      c.all++;
      c[groupOf(p.action)] = (c[groupOf(p.action)] ?? 0) + 1;
    }
    return c;
  }, [report, dismissed]);

  function dismiss(id: string) {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...next].slice(-2000)));
    } catch {
      /* pamięć przeglądarki niedostępna — pomijamy zapamiętywanie */
    }
  }

  function choiceOf(p: TreeProposal): TreeApplyChoice {
    const a = p.action;
    const own = choices[p.id];
    if (a.kind === 'merge') return { text: own?.text ?? a.into };
    if (a.kind === 'rename') return { text: own?.text ?? a.to };
    if (a.kind === 'regroup') return { text: own?.text ?? a.group };
    if (a.kind === 'split') return { parts: a.parts.map((x, i) => ({ name: own?.parts?.[i]?.name ?? x.name, on: own?.parts?.[i]?.on ?? true })) };
    return {};
  }
  const setChoice = (id: string, c: TreeApplyChoice) => setChoices((s) => ({ ...s, [id]: c }));

  async function apply(p: TreeProposal) {
    if (!canEdit || working) return;
    const choice = choiceOf(p);
    const ok = await confirmDialog({ title: 'Zmiana w drzewie kategorii', message: CONFIRM[p.action.kind]?.(p, choice) ?? p.title, confirmLabel: 'Zastosuj', tone: 'warn' });
    if (!ok) return;
    setWorking(p.id);
    try {
      const res = await applyTreeAction(p.action, currentIds, choice);
      if (res.patches.length) onPatched(res.patches);
      showToast(res.message, 'ok', 7000);
      dismiss(p.id);
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zmienić drzewa', 'error', 9000);
    } finally {
      setWorking(null);
    }
  }

  if (!report) {
    return (
      <section className={`${card} text-center`}>
        <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Ocena drzewa kategorii</h3>
        <p className="mx-auto mt-1 max-w-xl text-[13px] text-slate-500">
          Silnik patrzy na samo drzewo: dubel w nazwach, drobnicę, puste gałęzie, kategorie zbyt długie do przeglądania, szuflady typu „Inne” i nazwy, które nie mówią, co jest w środku. Najpierw musi policzyć produkty.
        </p>
        <button type="button" className={`${btnPrimary} mt-3`} disabled={busy} onClick={onRun}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Oceń drzewo
        </button>
      </section>
    );
  }

  const s = report.stats;
  const tile = (label: string, value: string, hint?: string) => (
    <div className="rounded-2xl bg-white/70 p-3 dark:bg-white/5" title={hint}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className={card}>
        <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">Kondycja układu</h3>
        <p className="mt-1 text-[13px] text-slate-500">
          Dobre drzewo dla sklepu ma kategorie, w których da się coś znaleźć: ani puste, ani przepełnione, bez dubli i szuflad. Propozycje poniżej wynikają z nazw i liczebności; nic nie zmienia się bez Twojego potwierdzenia.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {tile('Kategorii', s.leaves.toLocaleString('pl-PL'))}
          {tile('W sam raz (3–60)', `${s.leaves ? Math.round((100 * s.healthy) / s.leaves) : 0}%`, 'Udział kategorii, które da się wygodnie przejrzeć')}
          {tile('Przeładowane (45+)', String(s.overloaded))}
          {tile('Drobnica (1–2)', String(s.tiny))}
          {tile('Puste', String(s.empty))}
          {tile('W szufladach', `${Math.round(s.dumpShare * 100)}%`, 'Produkty w kategoriach „Inne”, „Pozostałe”…')}
        </div>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setLimit(25);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${filter === f.id ? 'bg-brand-600 text-white' : 'bg-black/[0.06] text-slate-700 dark:bg-white/10 dark:text-slate-300'}`}
            >
              {f.label} · {counts[f.id] ?? 0}
            </button>
          ))}
          <button type="button" className={`${btn} ml-auto`} disabled={busy} onClick={onRun} title="Policz od nowa na aktualnych danych">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Oceń ponownie
          </button>
        </div>

        <ul className="mt-3 space-y-2.5">
          {visible.slice(0, limit).map((p) => {
            const a = p.action;
            const c = choiceOf(p);
            const isBusy = working === p.id;
            return (
              <li key={p.id} className={`rounded-2xl border p-3.5 ${toneClass[p.tone]}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{p.title}</p>
                    <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-300">{p.reason}</p>
                  </div>
                  <button type="button" className="text-slate-400 hover:text-slate-700" onClick={() => dismiss(p.id)} title="Nie pokazuj tej uwagi więcej">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {a.kind === 'merge' && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">Przenieś „{a.name}” do:</span>
                    <select className={`${input} max-w-[18rem]`} value={c.text} onChange={(e) => setChoice(p.id, { text: e.target.value })}>
                      {leafNames
                        .filter((n) => categoryKey(n) !== categoryKey(a.name))
                        .map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                    </select>
                    {canEdit && (
                      <button type="button" className={btnPrimary} disabled={!!working} onClick={() => void apply(p)}>
                        {isBusy && <Loader2 className="h-4 w-4 animate-spin" />} Scal ({p.products})
                      </button>
                    )}
                  </div>
                )}

                {a.kind === 'remove' && canEdit && (
                  <div className="mt-2.5">
                    <button type="button" className={btnPrimary} disabled={!!working} onClick={() => void apply(p)}>
                      {isBusy && <Loader2 className="h-4 w-4 animate-spin" />} Usuń pustą kategorię
                    </button>
                  </div>
                )}

                {a.kind === 'rename' && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <input className={`${input} w-72`} value={c.text} onChange={(e) => setChoice(p.id, { text: e.target.value })} />
                    {canEdit && (
                      <button type="button" className={btnPrimary} disabled={!!working || !c.text?.trim() || c.text.trim() === a.name} onClick={() => void apply(p)}>
                        {isBusy && <Loader2 className="h-4 w-4 animate-spin" />} Zmień nazwę
                      </button>
                    )}
                  </div>
                )}

                {a.kind === 'split' && (
                  <div className="mt-2.5 space-y-1.5">
                    {a.parts.map((part, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/60 px-2.5 py-1.5 dark:bg-white/5">
                        <input
                          type="checkbox"
                          checked={c.parts?.[i]?.on ?? true}
                          onChange={(e) => setChoice(p.id, { parts: (c.parts ?? []).map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)) })}
                        />
                        <input className={`${input} w-72`} value={c.parts?.[i]?.name ?? part.name} onChange={(e) => setChoice(p.id, { parts: (c.parts ?? []).map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                        <span className="text-xs tabular-nums text-slate-500">{part.ids.length} szt.</span>
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-500">np. {part.samples.join(' · ')}</span>
                      </div>
                    ))}
                    {canEdit && (
                      <button type="button" className={btnPrimary} disabled={!!working} onClick={() => void apply(p)}>
                        {isBusy && <Loader2 className="h-4 w-4 animate-spin" />} Utwórz podkategorie
                      </button>
                    )}
                  </div>
                )}

                {a.kind === 'flatten' && canEdit && (
                  <div className="mt-2.5">
                    <button type="button" className={btnPrimary} disabled={!!working} onClick={() => void apply(p)}>
                      {isBusy && <Loader2 className="h-4 w-4 animate-spin" />} Przenieś wyżej i usuń grupę
                    </button>
                  </div>
                )}

                {a.kind === 'regroup' && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">Nazwa grupy:</span>
                    <input className={`${input} w-64`} value={c.text} onChange={(e) => setChoice(p.id, { text: e.target.value })} />
                    {canEdit && (
                      <button type="button" className={btnPrimary} disabled={!!working || !c.text?.trim()} onClick={() => void apply(p)}>
                        {isBusy && <Loader2 className="h-4 w-4 animate-spin" />} Utwórz grupę
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {visible.length === 0 && <li className="py-8 text-center text-sm text-slate-500">Brak uwag w tej grupie — układ wygląda dobrze.</li>}
        </ul>
        {visible.length > limit && (
          <button type="button" className={`${btn} mt-3`} onClick={() => setLimit((l) => l + 25)}>
            Pokaż więcej ({visible.length - limit})
          </button>
        )}
      </section>
    </div>
  );
}
