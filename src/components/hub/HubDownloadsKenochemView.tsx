import { Download, ExternalLink, FileText } from 'lucide-react';

const LINKS = [
  {
    title: 'Kenochem.com',
    href: 'https://kenochem.com',
    desc: 'Sklep i strona firmowa',
  },
  {
    title: 'Instrukcje migracji Supabase',
    href: 'https://github.com',
    desc: 'Pliki migration-*.sql w repozytorium katalog',
    internal: true,
  },
];

export function HubDownloadsKenochemView() {
  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-5 sm:px-5 sm:py-8">
      <div className="mb-6 flex items-center gap-2">
        <Download className="h-6 w-6 text-sky-400" />
        <h1 className="text-xl font-bold text-slate-50">Do pobrania</h1>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        Materiały i linki zespołu. Pełny hub-platform ma pliki demo — u nas lista startowa.
      </p>
      <ul className="space-y-2">
        {LINKS.map((item) => (
          <li key={item.title}>
            <a
              href={item.internal ? undefined : item.href}
              target={item.internal ? undefined : '_blank'}
              rel="noreferrer"
              className={`flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 ${
                item.internal ? 'cursor-default opacity-80' : 'hover:border-slate-700'
              }`}
            >
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-100">{item.title}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
              {!item.internal && <ExternalLink className="h-4 w-4 shrink-0 text-slate-600" />}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
