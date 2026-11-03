import { Brain, Loader2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../../types';
import { runBulkEdit } from '../../lib/bulkEdit';
import { getProductDisplayCategory } from '../../lib/catalogCategory';
import type { MaterialFact } from '../../lib/categoryEngine';
import { confirmDialog } from '../../lib/dialog';
import { plainText } from '../../lib/engineDescriptions';
import { buildIndustryModel, INDUSTRY_KEY } from '../../lib/industryModel';
import { hasProductDocs } from '../../lib/productDocsIndex';
import { buildProfile, knowledgeCoverage, type Known, type ProductProfile } from '../../lib/productProfile';
import { fold } from '../../lib/partsText';
import { showToast } from '../../lib/toast';
import { AttributesFill } from './AttributesFill';
import { btn, btnPrimary, card, SubTabs } from './ui';

type Section = 'atrybuty' | 'pokrycie' | 'branza' | 'produkt';


const SOURCE_BADGE: Record<Known['source'], string> = {
  nazwa: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  opis: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  karta: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  kategoria: 'bg-black/[0.07] text-slate-700 dark:text-slate-300',
};

const departmentOf = (p: Product) => (p.meta?.shopCategoryPath ?? '').split(' › ')[0] ?? '';

function Row({ label, items }: { label: string; items: Known[] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5">
      <span className="w-44 shrink-0 text-xs font-semibold text-slate-500">{label}</span>
      {items.length === 0 ? (
        <span className="text-sm text-slate-400">— nie wiem</span>
      ) : (
        items.map((i) => (
          <span key={i.value} className="inline-flex items-center gap-1.5 text-sm text-slate-900 dark:text-slate-100">
            {i.value}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE[i.source]}`}>{i.source}</span>
          </span>
        ))
      )}
    </div>
  );
}

/** „Wiedza”: co silnik rozumie o produktach — profil pojedynczego produktu, pokrycie wiedzy w katalogu i podpowiedzi atrybutu Branża. */
export function KnowledgeTab({
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
  const [section, setSection] = useState<Section>('atrybuty');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [industryOn, setIndustryOn] = useState(false);
  const [skip, setSkip] = useState<Set<string>>(new Set());

  const singles = useMemo(() => products.filter((p) => !p.isGroup && (p.sku ?? '').trim()), [products]);
  const matches = useMemo(() => {
    const q = fold(query).trim();
    if (q.length < 2) return [];
    return singles.filter((p) => fold(`${p.sku} ${p.displayName || p.name}`).includes(q)).slice(0, 8);
  }, [query, singles]);
  const selected = useMemo(() => singles.find((p) => p.id === selectedId) ?? null, [singles, selectedId]);

  const profileOf = (p: Product): ProductProfile =>
    buildProfile(p, {
      description: descriptions?.get(p.id) ?? p.description ?? '',
      category: getProductDisplayCategory(p),
      department: departmentOf(p),
      fact: facts[(p.sku ?? '').toUpperCase()],
      siblings: singles,
      hasMaterials: hasProductDocs(p.id),
    });

  const profile = useMemo(() => (selected ? profileOf(selected) : null), [selected, descriptions, facts, singles]); // eslint-disable-line react-hooks/exhaustive-deps
  const coverage = useMemo(() => {
    if (!descriptions) return null;
    // rodziny liczymy raz, a nie dla każdego produktu osobno
    const cheap = singles.map((p) => buildProfile(p, { description: descriptions.get(p.id) ?? '', category: getProductDisplayCategory(p), department: departmentOf(p), fact: facts[(p.sku ?? '').toUpperCase()], siblings: [], hasMaterials: hasProductDocs(p.id) }));
    return knowledgeCoverage(cheap);
  }, [descriptions, singles, facts]);

  const model = useMemo(() => buildIndustryModel(singles, getProductDisplayCategory), [singles]);
  const suggestions = useMemo(() => {
    if (!industryOn) return [];
    return singles
      .map((p) => model.suggest(p, `${p.displayName || p.name} ${plainText(descriptions?.get(p.id) ?? p.description ?? '')}`, departmentOf(p)))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .sort((a, b) => b.options[0].confidence - a.options[0].confidence);
  }, [industryOn, singles, model, descriptions]);
  const chosen = suggestions.filter((s) => !skip.has(s.product.id));

  async function loadAll() {
    setLoading(true);
    try {
      await loadDescriptions();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się pobrać opisów', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function applyIndustries() {
    if (!chosen.length) return;
    const ok = await confirmDialog({
      title: 'Ustaw atrybut Branża',
      message: `Ustawię branżę w ${chosen.length} produktach według podpowiedzi silnika. Zmianę da się cofnąć w Logi → Operacje masowe.`,
      confirmLabel: 'Ustaw',
      tone: 'warn',
    });
    if (!ok) return;
    setApplying(true);
    try {
      const byId = new Map(chosen.map((s) => [s.product.id, s.value]));
      const res = await runBulkEdit([...byId.keys()], (id) => ({ attr: { key: INDUSTRY_KEY, value: byId.get(id)! } }), 'Silnik: atrybut Branża');
      onPatched(res.patches);
      showToast(`Ustawiono branżę w ${res.updated} produktach${res.failed.length ? `, błędy: ${res.failed.length}` : ''}`, res.failed.length ? 'warn' : 'ok');
      setIndustryOn(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać atrybutu', 'error', 8000);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      <SubTabs
        value={section}
        onChange={setSection}
        items={[
          { id: 'atrybuty', label: 'Uzupełnianie atrybutów' },
          { id: 'pokrycie', label: 'Pokrycie wiedzy' },
          { id: 'branza', label: 'Branża' },
          { id: 'produkt', label: 'Sprawdź produkt' },
        ]}
      />
      {section === 'produkt' && <section className={card}>
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-950 dark:text-slate-50">
          <Brain className="h-4 w-4" /> Co silnik wie o produkcie
        </h3>
        <p className="mt-1 max-w-3xl text-[13px] text-slate-500">
          Wpisz SKU lub nazwę. Silnik pokaże, co rozumie o produkcie (pojemność, forma, dozowanie, pH, odbiorca, certyfikaty, przeznaczenie), skąd to wie, czego mu brakuje i gdzie źródła się ze sobą nie zgadzają.
          {!descriptions && ' Dla pełnego obrazu wczytaj opisy produktów.'}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SKU lub nazwa produktu…"
              className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <button type="button" className={btn} disabled={loading} onClick={() => void loadAll()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} {descriptions ? 'Opisy wczytane' : 'Wczytaj opisy'}
          </button>
        </div>
        {matches.length > 0 && (
          <ul className="mt-2 max-w-xl divide-y divide-black/10 rounded-2xl bg-white/70 dark:divide-white/10 dark:bg-white/5">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-black/[0.05] dark:hover:bg-white/10"
                  onClick={() => {
                    setSelectedId(p.id);
                    setQuery('');
                  }}
                >
                  <span className="font-semibold">{p.sku}</span> · {p.displayName || p.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && profile && (
          <div className="mt-4 rounded-2xl bg-white/70 p-4 dark:bg-white/5">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {selected.sku} · {selected.displayName || selected.name}
            </p>
            <p className="text-xs text-slate-500">
              {selected.manufacturer} · {getProductDisplayCategory(selected)}
            </p>
            <div className="mt-2 divide-y divide-black/10 dark:divide-white/10">
              <Row label="Pojemność" items={profile.volume ? [profile.volume] : []} />
              <Row label="Forma" items={profile.forms} />
              <Row label="Koncentracja" items={profile.concentration ? [profile.concentration] : []} />
              <Row label="Dozowanie" items={profile.dilution ? [profile.dilution] : []} />
              <Row label="pH" items={profile.ph ? [profile.ph] : []} />
              <Row label="Odbiorca" items={profile.audience ? [profile.audience] : []} />
              <Row label="Certyfikaty" items={profile.certificates} />
              <Row label="Deklaracje" items={profile.claims} />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5">
                <span className="w-44 shrink-0 text-xs font-semibold text-slate-500">Do czego służy</span>
                {profile.uses.length ? (
                  profile.uses.map((u) => (
                    <span key={u.leaf} className="text-sm text-slate-900 dark:text-slate-100">
                      {u.leaf} <span className="text-xs text-slate-500">({u.score})</span>
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">— nie wiem</span>
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3 py-1.5">
                <span className="w-44 shrink-0 text-xs font-semibold text-slate-500">Rodzina</span>
                <span className="text-sm text-slate-900 dark:text-slate-100">
                  {profile.family.size} opakowań{profile.family.volumes.length ? `: ${profile.family.volumes.join(', ')}` : ''}
                </span>
              </div>
            </div>
            {profile.conflicts.length > 0 && (
              <div className="mt-3 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                <p className="font-semibold">Sprzeczności</p>
                <ul className="mt-1 list-disc pl-4">
                  {profile.conflicts.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {profile.gaps.length > 0 && (
              <div className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <p className="font-semibold">Czego silnikowi brakuje</p>
                <ul className="mt-1 list-disc pl-4">
                  {profile.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>}

      {section === 'pokrycie' && <section className={card}>
        <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">Pokrycie wiedzy w katalogu</h3>
        {!coverage ? (
          <p className="mt-1 text-[13px] text-slate-500">Wczytaj opisy, aby policzyć, ile produktów ma poszczególne informacje.</p>
        ) : (
          <ul className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {coverage.map((c) => (
              <li key={c.label}>
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-700 dark:text-slate-200">{c.label}</span>
                  <span className="tabular-nums text-slate-500">
                    {c.count.toLocaleString('pl-PL')} / {c.total.toLocaleString('pl-PL')} · {Math.round((100 * c.count) / Math.max(1, c.total))}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round((100 * c.count) / Math.max(1, c.total))}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>}

      {section === 'atrybuty' && <AttributesFill products={products} descriptions={descriptions} loadDescriptions={loadDescriptions} facts={facts} canEdit={canEdit} onPatched={onPatched} />}

      {section === 'branza' && <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">Atrybut „Branża”</h3>
            <p className="mt-1 text-[13px] text-slate-500">
              Silnik uczy się z {model.labelled.toLocaleString('pl-PL')} produktów, które mają już ustawioną branżę: gdy większość oznaczonych produktów danej kategorii ma jakąś branżę, proponuje ją pozostałym. Jednoznaczne słowa
              w tekście (szpital, hotel, przedszkole) są osobnym dowodem. Każdą podpowiedź możesz wykluczyć przed zapisem.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className={btn} onClick={() => setIndustryOn((v) => !v)}>
              {industryOn ? 'Ukryj podpowiedzi' : 'Pokaż podpowiedzi'}
            </button>
            {canEdit && industryOn && (
              <button type="button" className={btnPrimary} disabled={!chosen.length || applying} onClick={() => void applyIndustries()}>
                {applying && <Loader2 className="h-4 w-4 animate-spin" />} Ustaw ({chosen.length})
              </button>
            )}
          </div>
        </div>
        {industryOn && (
          <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10">
            {suggestions.slice(0, 60).map((s) => (
              <li key={s.product.id} className="flex flex-wrap items-center gap-3 py-2">
                <input
                  type="checkbox"
                  checked={!skip.has(s.product.id)}
                  onChange={(e) =>
                    setSkip((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.delete(s.product.id);
                      else next.add(s.product.id);
                      return next;
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {s.product.sku} · {s.product.displayName || s.product.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">{s.options.map((o) => `${o.option} (${Math.round(o.confidence * 100)}%) — ${o.why}`).join(' · ')}</p>
                </div>
              </li>
            ))}
            {suggestions.length === 0 && <li className="py-6 text-center text-sm text-slate-500">Brak podpowiedzi — nie ma kategorii z wystarczającą liczbą oznaczonych produktów.</li>}
            {suggestions.length > 60 && <li className="py-2 text-xs text-slate-500">Pokazano pierwsze 60 z {suggestions.length}. „Ustaw” obejmuje wszystkie niewykluczone.</li>}
          </ul>
        )}
      </section>}
    </div>
  );
}
