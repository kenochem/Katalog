import { ListChecks, Loader2, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../../types';
import { attributeCoverage, formatAttrValue, getAttributes, loadAttributes, saveAttribute, useAttributesVersion, type AttributeDef } from '../../lib/attributes';
import { extractorFor, knowledgeOf, missingAttributes, proposeAttributes, type AttrProposal } from '../../lib/attributeFill';
import { runBulkEdit } from '../../lib/bulkEdit';
import { getProductDisplayCategory } from '../../lib/catalogCategory';
import type { MaterialFact } from '../../lib/categoryEngine';
import { confirmDialog } from '../../lib/dialog';
import { hasProductDocs } from '../../lib/productDocsIndex';
import { buildProfile } from '../../lib/productProfile';
import { showToast } from '../../lib/toast';
import { btn, btnPrimary, card } from './ui';


const departmentOf = (p: Product) => (p.meta?.shopCategoryPath ?? '').split(' › ')[0] ?? '';

/** Uzupełnianie atrybutów z panelu atrybutów wiedzą silnika (karty produktów, opisy, nazwy) z kontrolą spójności z już wpisanymi wartościami. */
export function AttributesFill({
  products,
  descriptions,
  loadDescriptions,
  facts,
  canEdit,
  onPatched,
}: {
  products: Product[];
  descriptions: Map<string, string> | null;
  loadDescriptions: () => Promise<Map<string, string>>;
  facts: Record<string, MaterialFact>;
  canEdit: boolean;
  onPatched: (patches: { id: string; patch: Partial<Product> }[]) => void;
}) {
  const attrVersion = useAttributesVersion();
  const [proposals, setProposals] = useState<AttrProposal[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(40);

  useEffect(() => {
    void loadAttributes();
  }, []);

  const defs = useMemo(() => getAttributes(), [attrVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const singles = useMemo(() => products.filter((p) => !p.isGroup && (p.sku ?? '').trim()), [products]);
  const coverage = useMemo(() => new Map(attributeCoverage(singles, defs).map((c) => [c.def.key, c])), [singles, defs]);
  const missing = useMemo(() => missingAttributes(defs), [defs]);

  async function analyze() {
    setBusy('analyze');
    try {
      const map = descriptions ?? (await loadDescriptions());
      // czekamy na oddech przeglądarki, żeby przycisk pokazał stan pracy
      await new Promise((r) => setTimeout(r, 30));
      setProposals(
        proposeAttributes(singles, defs, (p) =>
          knowledgeOf(
            p,
            buildProfile(p, { description: map.get(p.id) ?? p.description ?? '', category: getProductDisplayCategory(p), department: departmentOf(p), fact: facts[(p.sku ?? '').toUpperCase()], siblings: [], hasMaterials: hasProductDocs(p.id) }),
            facts[(p.sku ?? '').toUpperCase()],
          ),
        ),
      );
      setSkip(new Set());
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się przeanalizować produktów', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function create(m: ReturnType<typeof missingAttributes>[number]) {
    const ok = await confirmDialog({
      title: `Utworzyć atrybut „${m.create.label}”?`,
      message: `Dodam do panelu atrybutów nowy atrybut „${m.create.label}” (${m.create.type === 'number' ? 'liczba' : m.create.type === 'select' ? 'lista wartości' : m.create.type === 'bool' ? 'tak/nie' : 'tekst'}${m.create.unit ? `, jednostka ${m.create.unit}` : ''}) obowiązujący we wszystkich kategoriach. Później możesz go edytować lub usunąć w panelu atrybutów.`,
      confirmLabel: 'Utwórz',
      tone: 'warn',
    });
    if (!ok) return;
    setBusy(`create-${m.id}`);
    try {
      await saveAttribute({ key: '', label: m.create.label, type: m.create.type, unit: m.create.unit, options: m.create.options ?? [], categories: [], required: false, sort: 900, showWhen: null });
      showToast(`Utworzono atrybut „${m.create.label}”. Uruchom analizę ponownie, aby zobaczyć propozycje.`, 'ok');
      setProposals(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się utworzyć atrybutu', 'error', 8000);
    } finally {
      setBusy(null);
    }
  }

  const byKey = useMemo(() => {
    const m = new Map<string, { fill: AttrProposal[]; diff: AttrProposal[] }>();
    for (const p of proposals ?? []) {
      const e = m.get(p.def.key) ?? { fill: [], diff: [] };
      (p.existing === undefined ? e.fill : e.diff).push(p);
      m.set(p.def.key, e);
    }
    return m;
  }, [proposals]);
  const active = activeKey ? byKey.get(activeKey) : undefined;
  const activeDef = defs.find((d) => d.key === activeKey);
  const chosen = (active?.fill ?? []).filter((p) => !skip.has(p.product.id));

  async function apply() {
    if (!activeDef || !chosen.length) return;
    const ok = await confirmDialog({
      title: `Uzupełnij atrybut „${activeDef.label}”`,
      message: `Wpiszę wartości w ${chosen.length} produktach (tylko tam, gdzie atrybut jest pusty). Zmianę da się cofnąć w Logi → Operacje masowe.`,
      confirmLabel: 'Uzupełnij',
      tone: 'warn',
    });
    if (!ok) return;
    setBusy('apply');
    try {
      const byId = new Map(chosen.map((c) => [c.product.id, c.value]));
      const res = await runBulkEdit([...byId.keys()], (id) => ({ attr: { key: activeDef.key, value: byId.get(id)! } }), `Silnik: atrybut ${activeDef.label}`);
      onPatched(res.patches);
      const done = new Set(chosen.map((c) => c.product.id));
      setProposals((prev) => prev && prev.filter((p) => !(p.def.key === activeDef.key && p.existing === undefined && done.has(p.product.id))));
      showToast(`Uzupełniono „${activeDef.label}” w ${res.updated} produktach${res.failed.length ? `, błędy: ${res.failed.length}` : ''}`, res.failed.length ? 'warn' : 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać atrybutów', 'error', 8000);
    } finally {
      setBusy(null);
    }
  }

  const show = (def: AttributeDef, v: string | number | boolean) => formatAttrValue(def, v);

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-950 dark:text-slate-50">
            <ListChecks className="h-4 w-4" /> Uzupełnianie atrybutów
          </h3>
          <p className="mt-1 text-[13px] text-slate-500">
            Silnik rozumie atrybuty z panelu po nazwie (np. pH, gęstość, termin trwałości, forma, dozowanie) i wpisuje je z kart produktów, opisów i nazw. Uzupełnia tylko puste pola, a wartości już wpisane porównuje z tym, co
            wie, i pokazuje niespójności. Przykład: dla Eco Shine Smart Foam z karty produktu odczyta pH ok. 10.
          </p>
        </div>
        <button type="button" className={btnPrimary} disabled={busy !== null || !defs.length} onClick={() => void analyze()}>
          {busy === 'analyze' && <Loader2 className="h-4 w-4 animate-spin" />} {proposals ? 'Analizuj ponownie' : 'Analizuj produkty'}
        </button>
      </div>

      {!defs.length ? (
        <p className="mt-3 text-[13px] text-slate-500">Panel atrybutów jest pusty albo jeszcze się ładuje. Utwórz atrybuty poniżej.</p>
      ) : (
        <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10">
          {defs.map((d) => {
            const ex = extractorFor(d);
            const cov = coverage.get(d.key);
            const e = byKey.get(d.key);
            return (
              <li key={d.key} className={`flex flex-wrap items-center gap-3 py-2 ${activeKey === d.key ? 'rounded-xl bg-white/60 px-2 dark:bg-white/5' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {d.label}
                    {d.unit ? <span className="font-normal text-slate-500"> ({d.unit})</span> : null}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {ex ? `silnik rozumie: ${ex.title}` : 'silnik nie wie, skąd brać ten atrybut'}
                    {cov ? ` · wypełnione ${cov.filled}/${cov.inScope}` : ''}
                  </p>
                </div>
                {proposals && ex && (
                  <>
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">do uzupełnienia: {e?.fill.length ?? 0}</span>
                    {(e?.diff.length ?? 0) > 0 && <span className="text-xs text-amber-700 dark:text-amber-300">niespójne: {e!.diff.length}</span>}
                    {((e?.fill.length ?? 0) > 0 || (e?.diff.length ?? 0) > 0) && (
                      <button
                        type="button"
                        className={btn}
                        onClick={() => {
                          setActiveKey(activeKey === d.key ? null : d.key);
                          setLimit(40);
                        }}
                      >
                        {activeKey === d.key ? 'Zwiń' : 'Pokaż'}
                      </button>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {missing.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white/60 p-3 dark:bg-white/5">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Atrybuty, które silnik potrafi uzupełniać, a których nie ma w panelu</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map((m) => (
              <button key={m.id} type="button" className={btn} disabled={busy !== null || !canEdit} onClick={() => void create(m)}>
                {busy === `create-${m.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {m.create.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {active && activeDef && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {activeDef.label}: {active.fill.length} do uzupełnienia, {active.diff.length} niespójnych
            </p>
            {canEdit && active.fill.length > 0 && (
              <button type="button" className={`${btnPrimary} ml-auto`} disabled={busy !== null || !chosen.length} onClick={() => void apply()}>
                {busy === 'apply' && <Loader2 className="h-4 w-4 animate-spin" />} Uzupełnij ({chosen.length})
              </button>
            )}
          </div>
          {active.fill.length > 0 && (
            <ul className="mt-2 divide-y divide-black/10 dark:divide-white/10">
              {active.fill.slice(0, limit).map((p) => (
                <li key={p.product.id} className="flex items-center gap-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={!skip.has(p.product.id)}
                    onChange={(e) =>
                      setSkip((prev) => {
                        const n = new Set(prev);
                        if (e.target.checked) n.delete(p.product.id);
                        else n.add(p.product.id);
                        return n;
                      })
                    }
                  />
                  <p className="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-slate-100">
                    {p.product.sku} · {p.product.displayName || p.product.name}
                  </p>
                  <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-slate-100">{show(activeDef, p.value)}</span>
                  <span className="hidden max-w-[16rem] shrink-0 truncate text-xs text-slate-500 sm:block" title={p.source}>
                    {p.source}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {active.fill.length > limit && (
            <button type="button" className={`${btn} mt-2`} onClick={() => setLimit((l) => l + 60)}>
              Pokaż więcej ({active.fill.length - limit})
            </button>
          )}
          {active.diff.length > 0 && (
            <div className="mt-3 rounded-2xl bg-amber-500/10 p-3">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Niespójne z wartością w katalogu (nie zapisuję bez Twojej decyzji)</p>
              <ul className="mt-1 space-y-0.5">
                {active.diff.slice(0, 20).map((p) => (
                  <li key={p.product.id} className="truncate text-xs text-slate-700 dark:text-slate-300">
                    {p.product.sku} · {p.product.displayName || p.product.name}: w katalogu {show(activeDef, p.existing!)}, {p.source} mówi {show(activeDef, p.value)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
