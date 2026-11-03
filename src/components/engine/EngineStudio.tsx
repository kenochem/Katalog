import { Brain, Building2, FileText, LayoutDashboard, Loader2, Network, Play, RefreshCw, ShieldCheck, Type, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '../../types';
import { buildManufacturerFinder } from '../../lib/assortmentAnalysis';
import { attributeCoverage } from '../../lib/attributes';
import { getProductDisplayCategory } from '../../lib/catalogCategory';
import type { MaterialFact } from '../../lib/categoryEngine';
import { fetchDescriptions, runCategoryEngine, summarizeEngine, type EngineRow, type EngineScope } from '../../lib/categoryEngineReport';
import { categoryKey, flattenCategories, useCategoryRegistry } from '../../lib/categoryRegistry';
import { checkAllDescriptions } from '../../lib/descriptionChecks';
import { ENGINE_BACKRONYM, ENGINE_NAME, ENGINE_TAGLINE } from '../../lib/engineBrand';
import { findMissingDescriptions } from '../../lib/engineDescriptions';
import { buildNameRows, loadBrandRules, nameStats } from '../../lib/engineNames';
import { appendMemory, deriveMemory, loadMemory, type MemoryEntry } from '../../lib/engineMemory';
import { buildOverview, type EngineTab } from '../../lib/engineOverview';
import { loadMaterialFacts } from '../../lib/materialFacts';
import { loadShopSkuMap, type ShopSkuFile } from '../../lib/shopMirror';
import { showToast } from '../../lib/toast';
import { adviseTree } from '../../lib/treeAdvisor';
import { supplierOverview } from '../../lib/suppliers';
import { effectiveManufacturer } from '../../lib/waproManufacturers';
import { AssignmentsTab, type Queue } from './AssignmentsTab';
import { DescriptionsTab } from './DescriptionsTab';
import { EngineAnimation, type EngineState } from './EngineAnimation';
import { KnowledgeTab } from './KnowledgeTab';
import { ManufacturersTab } from './ManufacturersTab';
import { NamesTab } from './NamesTab';
import { OverviewTab } from './OverviewTab';
import { TreeTab } from './TreeTab';
import { SuppliersTab } from './SuppliersTab';
import { btn, btnPrimary, ScoreRing, SubTabs } from './ui';

const UNDECIDED = 'Do decyzji';
const LAST_KEY = 'katalog.engine.last.v1';
const TAB_KEY = 'katalog.engine.tab.v1';

const TABS: { id: EngineTab; label: string; icon: LucideIcon }[] = [
  { id: 'przeglad', label: 'Przegląd', icon: LayoutDashboard },
  { id: 'przypisania', label: 'Przypisania', icon: ShieldCheck },
  { id: 'drzewo', label: 'Drzewo', icon: Network },
  { id: 'nazwy', label: 'Nazwy', icon: Type },
  { id: 'wiedza', label: 'Wiedza', icon: Brain },
  { id: 'opisy', label: 'Opisy', icon: FileText },
  { id: 'producenci', label: 'Producenci i dostawcy', icon: Building2 },
];

/** Skąd zadanie z Przeglądu otwiera Przypisania. */
const TASK_FOCUS: Record<string, { scope: EngineScope; queue: Queue }> = {
  wrong: { scope: 'audyt', queue: 'changes' },
  sure: { scope: 'uzupelnij', queue: 'changes' },
  review: { scope: 'audyt', queue: 'review' },
  research: { scope: 'audyt', queue: 'research' },
  hide: { scope: 'audyt', queue: 'hide' },
};

function readTab(): EngineTab {
  try {
    const t = localStorage.getItem(TAB_KEY) as EngineTab | null;
    return t && TABS.some((x) => x.id === t) ? t : 'przeglad';
  } catch {
    return 'przeglad';
  }
}

/**
 * Silnik produktowy (nazwa w interfejsie: patrz engineBrand): jedno miejsce do układania i porządkowania katalogu.
 * Powłoka trzyma wspólny stan i jedno uruchomienie analizy; każda zakładka to osobne narzędzie nad tymi samymi danymi.
 */
export function EngineStudio({
  products,
  canEdit,
  canEditManufacturers,
  onPatched,
}: {
  products: Product[];
  canEdit: boolean;
  canEditManufacturers: boolean;
  onPatched: (patches: { id: string; patch: Partial<Product> }[]) => void;
}) {
  const version = useCategoryRegistry();
  const [tab, setTabState] = useState<EngineTab>(readTab);
  const [partner, setPartner] = useState<'producenci' | 'dostawcy'>('producenci');
  const [scope, setScope] = useState<EngineScope>('audyt');
  const [queue, setQueue] = useState<Queue>('changes');
  const [shop, setShop] = useState<ShopSkuFile | null>(null);
  const [descriptions, setDescriptions] = useState<Map<string, string> | null>(null);
  const [rows, setRows] = useState<EngineRow[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [last, setLast] = useState<{ at: string; changes: number; review: number; research: number } | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null');
    } catch {
      return null;
    }
  });
  const [memory, setMemory] = useState<MemoryEntry[]>([]);
  const [facts, setFacts] = useState<Record<string, MaterialFact>>({});
  const derived = useMemo(() => deriveMemory(memory), [memory]);
  const runRef = useRef<(force?: boolean) => Promise<void>>(async () => undefined);

  useEffect(() => {
    let alive = true;
    loadShopSkuMap().then((f) => alive && setShop(f)).catch(() => undefined);
    loadMemory().then((m) => alive && setMemory(m)).catch(() => undefined);
    loadMaterialFacts().then((f) => alive && setFacts(f)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const setTab = (t: EngineTab) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* pamięć przeglądarki niedostępna */
    }
  };

  // ---- dane pochodne -----------------------------------------------------------------------
  const leaves = useMemo(() => flattenCategories().filter((c) => c.isLeaf), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const singles = useMemo(() => products.filter((p) => !p.isGroup && (p.sku ?? '').trim()), [products]);
  /** Id wszystkich produktów (także grup wariantów) w każdej kategorii — do zmian w drzewie. */
  const currentIds = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of products) {
      const c = getProductDisplayCategory(p);
      if (!c) continue;
      const k = categoryKey(c);
      const list = m.get(k);
      if (list) list.push(p.id);
      else m.set(k, [p.id]);
    }
    return m;
  }, [products]);
  const treeReport = useMemo(
    () =>
      rows
        ? adviseTree({
            nodes: flattenCategories(),
            rows: rows.map((r) => ({ id: r.id, name: r.name, maker: r.maker, from: r.decision.from, to: r.decision.to, status: r.decision.status, alternatives: r.decision.alternatives })),
            currentIds,
          })
        : null,
    [rows, currentIds, version], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const nameRows = useMemo(() => buildNameRows(products, loadBrandRules()), [products]);
  const names = useMemo(() => nameStats(nameRows), [nameRows]);
  const descInfo = useMemo(() => {
    if (!descriptions) return null;
    return { missing: findMissingDescriptions(products, descriptions).length, issues: checkAllDescriptions(products, descriptions, facts, getProductDisplayCategory).length };
  }, [products, descriptions, facts]);
  const attributesPct = useMemo(() => {
    const cov = attributeCoverage(products).filter((c) => c.inScope > 0);
    return cov.length ? Math.round(cov.reduce((s, c) => s + c.pct, 0) / cov.length) : null;
  }, [products]);
  const mf = useMemo(() => {
    const find = buildManufacturerFinder(products);
    const byName = new Map<string, string[]>();
    let missing = 0;
    for (const p of singles) {
      if (effectiveManufacturer(p)) continue;
      missing++;
      const s = find(p);
      if (s) byName.set(s.manufacturer, [...(byName.get(s.manufacturer) ?? []), p.id]);
    }
    const groups = [...byName.entries()].map(([name, ids]) => ({ name, ids })).sort((a, b) => b.ids.length - a.ids.length);
    return { missing, groups, suggested: groups.reduce((s, g) => s + g.ids.length, 0) };
  }, [products, singles]);

  const sup = useMemo(() => supplierOverview(products, effectiveManufacturer), [products]);

  const overview = useMemo(() => {
    const audit = rows ? summarizeEngine(rows, 'audyt') : null;
    const fill = rows ? summarizeEngine(rows, 'uzupelnij') : null;
    return buildOverview({
      products: singles.length,
      categorized: singles.filter((p) => p.category && p.category !== UNDECIDED).length,
      assign: audit && fill ? { wrong: audit.changes.length, review: audit.review.length + fill.review.length, research: audit.research.length + fill.research.length, hide: audit.hide.length + fill.hide.length, unassignedSure: fill.changes.length } : null,
      tree: treeReport ? { stats: treeReport.stats, actionable: treeReport.proposals.filter((p) => p.tone !== 'info').length } : null,
      names,
      descriptions: descInfo,
      attributesPct,
      manufacturers: { missing: mf.missing, suggested: mf.suggested },
      suppliers: { without: sup.withoutSupplier },
    });
  }, [rows, singles, treeReport, names, descInfo, attributesPct, mf, sup]);

  // ---- uruchomienie ------------------------------------------------------------------------
  async function loadDescriptions(): Promise<Map<string, string>> {
    if (descriptions) return descriptions;
    const map = await fetchDescriptions(
      products.filter((p) => !p.isGroup).map((p) => p.id),
      (done, total) => setProgress(`Pobieram opisy produktów ${done}/${total}…`),
    );
    setDescriptions(map);
    return map;
  }

  async function run(force = false) {
    if (progress !== null) return;
    setProgress('Pobieram opisy produktów…');
    try {
      const map = force && descriptions ? descriptions : await loadDescriptions();
      setProgress(`${ENGINE_NAME} analizuje produkty…`);
      // oddajemy sterowanie przeglądarce, żeby animacja i pasek postępu zdążyły się odświeżyć
      await new Promise((r) => setTimeout(r, 60));
      const result = runCategoryEngine(products, map, shop, { learned: derived.learned, rejected: derived.rejected, facts });
      setRows(result);
      const s = summarizeEngine(result, 'audyt');
      const entry = { at: new Date().toISOString(), changes: s.changes.length, review: s.review.length, research: s.research.length };
      setLast(entry);
      try {
        localStorage.setItem(LAST_KEY, JSON.stringify(entry));
      } catch {
        /* pomijamy */
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się uruchomić silnika', 'error', 8000);
    } finally {
      setProgress(null);
    }
  }
  runRef.current = run;

  /** Dopisuje decyzje do wspólnego dziennika silnika; błąd zapisu nie blokuje pracy. */
  async function remember(entries: Omit<MemoryEntry, 'at'>[]) {
    if (!entries.length) return;
    const at = new Date().toISOString();
    try {
      setMemory(await appendMemory(entries.map((e) => ({ ...e, at }))));
    } catch {
      setMemory((m) => [...m, ...entries.map((e) => ({ ...e, at }))]);
    }
  }

  function open(next: EngineTab, taskId?: string) {
    const focus = taskId ? TASK_FOCUS[taskId] : undefined;
    if (focus) {
      setScope(focus.scope);
      setQueue(focus.queue);
    }
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const running = progress !== null;
  const engineState: EngineState = running ? 'running' : rows ? 'idle' : 'off';
  const badge = (id: EngineTab): number | undefined => {
    const n =
      id === 'przypisania' ? overview.tasks.filter((t) => t.tab === id && t.tone !== 'info').reduce((s, t) => s + t.count, 0) :
      id === 'drzewo' ? treeReport?.proposals.filter((p) => p.tone !== 'info').length :
      id === 'nazwy' ? names.sure + names.dups :
      id === 'opisy' && descInfo ? descInfo.missing + descInfo.issues :
      id === 'producenci' ? mf.suggested + sup.withoutSupplier : 0;
    return n && n > 0 ? n : undefined;
  };

  return (
    <div className="space-y-4">
      {tab !== 'przeglad' && (
        <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-black/10 bg-white/80 px-4 py-2.5 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
          <button type="button" className="text-lg font-bold tracking-tight text-slate-950 hover:text-brand-700 dark:text-slate-50" onClick={() => setTab('przeglad')} title="Wróć do przeglądu">
            {ENGINE_NAME}
          </button>
          <span className="text-xs text-slate-500">{progress ?? (rows ? `Analiza z ${last ? new Date(last.at).toLocaleString('pl-PL') : 'tej sesji'}` : 'Analiza nie była uruchomiona')}</span>
          <span className="ml-auto flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">
              Gotowość <span className="text-base font-bold tabular-nums text-slate-950 dark:text-slate-50">{overview.score ?? '—'}</span>
            </span>
            <button type="button" className={rows ? btn : btnPrimary} disabled={running} onClick={() => void run(!!rows)}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : rows ? <RefreshCw className="h-4 w-4" /> : <Play className="h-4 w-4" />} {rows ? 'Przelicz' : 'Uruchom analizę'}
            </button>
          </span>
        </section>
      )}
      {tab === 'przeglad' && <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-gradient-to-br from-white via-white to-brand-50/60 p-5 shadow-sm dark:border-white/10 dark:from-white/[0.05] dark:via-white/[0.03] dark:to-brand-500/10">
        <div className="grid items-center gap-5 md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]">
          <EngineAnimation state={engineState} className="mx-auto w-full max-w-[10rem]" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">{ENGINE_TAGLINE}</p>
            <h2 className="mt-1 flex flex-wrap items-baseline gap-3 text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
              {ENGINE_NAME}
              <span className="flex flex-wrap gap-1.5 text-sm font-semibold">
                {ENGINE_BACKRONYM.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => open(b.tab as EngineTab)}
                    className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-slate-700 transition hover:bg-brand-600 hover:text-white dark:bg-white/10 dark:text-slate-300"
                    title={`Otwórz: ${b.word}`}
                  >
                    <span className="font-bold text-brand-700 dark:text-brand-300">{b.letter}</span>
                    {b.word.slice(1)}
                  </button>
                ))}
              </span>
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] text-slate-600 dark:text-slate-400">
              Układa asortyment: przypisuje produkty do kategorii, pilnuje sensu drzewa, ujednolica nazwy rodzin, uczy się z kart i opisów oraz Twoich decyzji. Niczego nie zmienia bez potwierdzenia, a zmiany da się cofnąć w Logi → Operacje masowe.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className={rows ? btn : btnPrimary} disabled={running} onClick={() => void run(!!rows)}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : rows ? <RefreshCw className="h-4 w-4" /> : <Play className="h-4 w-4" />} {rows ? 'Przelicz' : 'Uruchom analizę'}
              </button>
              <span className="text-xs text-slate-500">
                {progress ?? (rows ? `Gotowe${last ? ` · ${new Date(last.at).toLocaleString('pl-PL')}` : ''}` : `${ENGINE_NAME} stoi — uruchom analizę.`)}
                {derived.stats.total > 0 && !progress && <span> · pamięć: {derived.stats.total} decyzji{derived.stats.acceptRate != null ? `, trafność ${derived.stats.acceptRate}%` : ''}</span>}
                {Object.keys(facts).length > 0 && !progress && <span> · karty: {Object.keys(facts).length} produktów</span>}
              </span>
            </div>
          </div>
          <div className="mx-auto md:mx-0">
            <ScoreRing value={overview.score} />
          </div>
        </div>
      </section>}

      <nav className="sticky top-0 z-10 -mx-1 overflow-x-auto px-1 py-1">
        <div className="flex w-max gap-1 rounded-full border border-black/10 bg-white/90 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/80">
          {TABS.map(({ id, label, icon: Icon }) => {
            const n = badge(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-black/[0.06] dark:text-slate-300 dark:hover:bg-white/10'}`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {n ? <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] leading-none text-white">{n > 999 ? '999+' : n}</span> : null}
              </button>
            );
          })}
        </div>
      </nav>

      {tab === 'przeglad' && <OverviewTab overview={overview} hasRun={!!rows} running={running} products={products} onRun={() => void run()} onOpen={open} />}

      {tab === 'przypisania' && (
        <AssignmentsTab
          rows={rows}
          setRows={setRows}
          scope={scope}
          setScope={setScope}
          queue={queue}
          setQueue={setQueue}
          products={products}
          leaves={leaves}
          canEdit={canEdit}
          running={running}
          onRun={() => void run()}
          onPatched={onPatched}
          remember={remember}
        />
      )}

      {tab === 'drzewo' && (
        <TreeTab
          report={treeReport}
          currentIds={currentIds}
          leafNames={leaves.map((l) => l.name)}
          canEdit={canEdit}
          busy={running}
          onRun={() => void run(!!rows)}
          onPatched={onPatched}
          // zmiana drzewa unieważnia wynik silnika — liczymy od nowa, gdy rodzic zdąży odświeżyć produkty
          onChanged={() => setTimeout(() => void runRef.current(true), 400)}
        />
      )}

      {tab === 'nazwy' && <NamesTab rows={nameRows} stats={names} canEdit={canEdit} onPatched={onPatched} />}

      {tab === 'wiedza' && <KnowledgeTab products={products} descriptions={descriptions} loadDescriptions={loadDescriptions} facts={facts} canEdit={canEdit} onPatched={onPatched} />}

      {tab === 'opisy' && <DescriptionsTab products={products} descriptions={descriptions} loadDescriptions={loadDescriptions} canEdit={canEdit} onPatched={onPatched} facts={facts} />}

      {tab === 'producenci' && (
        <div className="space-y-4">
          <SubTabs
            value={partner}
            onChange={setPartner}
            items={[
              { id: 'producenci', label: 'Producenci (marki)', count: mf.suggested },
              { id: 'dostawcy', label: 'Dostawcy', count: sup.withoutSupplier },
            ]}
          />
          {partner === 'producenci' ? (
            <ManufacturersTab products={products} groups={mf.groups} canEdit={canEditManufacturers} onPatched={onPatched} />
          ) : (
            <SuppliersTab products={products} canEdit={canEditManufacturers} onPatched={onPatched} />
          )}
        </div>
      )}
    </div>
  );
}
