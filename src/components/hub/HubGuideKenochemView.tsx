import { useMemo, useState } from 'react';
import { BookOpen, ChevronRight, Search } from 'lucide-react';
import { KENOCHEM_GUIDE_SECTIONS, findKenochemGuideArticle } from '../../lib/kenochemGuide';
import { ContextHelp } from '../ContextHelp';

export function HubGuideKenochemView() {
  const [sectionId, setSectionId] = useState(KENOCHEM_GUIDE_SECTIONS[0].id);
  const [articleId, setArticleId] = useState<string | null>(
    KENOCHEM_GUIDE_SECTIONS[0].articles[0]?.id ?? null,
  );
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const hits: { sectionTitle: string; id: string; title: string }[] = [];
    for (const s of KENOCHEM_GUIDE_SECTIONS) {
      for (const a of s.articles) {
        if (a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)) {
          hits.push({ sectionTitle: s.title, id: a.id, title: a.title });
        }
      }
    }
    return hits;
  }, [query]);

  const active = articleId ? findKenochemGuideArticle(articleId)?.article : null;
  const articleCount = KENOCHEM_GUIDE_SECTIONS.reduce(
    (sum, section) => sum + section.articles.length,
    0,
  );

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 px-3 py-5 sm:flex-row sm:px-5">
      <aside className="w-full shrink-0 sm:w-72">
        <div className="mb-3 flex items-center gap-2 text-brand-300">
          <BookOpen className="h-5 w-5" />
          <div>
            <h1 className="inline-flex items-center gap-2 text-lg font-bold text-slate-50">
              Baza wiedzy
              <ContextHelp id="guide" />
            </h1>
            <p className="text-[11px] text-slate-500">
              {KENOCHEM_GUIDE_SECTIONS.length} sekcji / {articleCount} artykulow
            </p>
          </div>
        </div>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj…"
            className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-brand-500/50"
          />
        </div>
        {searchResults ? (
          <ul className="space-y-1">
            {searchResults.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className="w-full rounded-lg px-2 py-2 text-left text-sm text-[#475569] hover:bg-[#f1f5f9] dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => {
                    const found = findKenochemGuideArticle(hit.id);
                    if (found) {
                      setSectionId(found.section.id);
                      setArticleId(hit.id);
                      setQuery('');
                    }
                  }}
                >
                  <span className="block font-medium text-[#0f172a] dark:text-slate-100">{hit.title}</span>
                  <span className="text-xs text-[#64748b] dark:text-slate-500">{hit.sectionTitle}</span>
                </button>
              </li>
            ))}
            {searchResults.length === 0 && (
              <p className="px-2 text-sm text-slate-500">Brak wyników</p>
            )}
          </ul>
        ) : (
          <nav className="space-y-3">
            {KENOCHEM_GUIDE_SECTIONS.map((s) => (
              <div key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSectionId(s.id);
                    setArticleId(s.articles[0]?.id ?? null);
                  }}
                  className={`mb-1 text-xs font-semibold uppercase tracking-wide ${
                    s.id === sectionId ? 'text-brand-400' : 'text-[#64748b] dark:text-slate-500'
                  }`}
                >
                  {s.title}
                </button>
                <ul className="space-y-0.5">
                  {s.articles.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSectionId(s.id);
                          setArticleId(a.id);
                        }}
                        className={`flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm ${
                          a.id === articleId
                            ? 'bg-[#e8eef6] text-[#0f172a] dark:bg-slate-800 dark:text-white'
                            : 'text-[#475569] hover:bg-[#f1f5f9] dark:text-slate-400 dark:hover:bg-slate-900'
                        }`}
                      >
                        {a.title}
                        {a.id === articleId && (
                          <ChevronRight className="ml-auto h-3.5 w-3.5" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        )}
      </aside>
      <article className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-7">
        {active ? (
          <>
            <h2 className="flex items-center gap-2 text-xl font-bold text-slate-50">
              {active.title}
              <ContextHelp id="guide" side="left" />
            </h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">
              {active.body}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Wybierz artykuł z listy.</p>
        )}
      </article>
    </div>
  );
}
