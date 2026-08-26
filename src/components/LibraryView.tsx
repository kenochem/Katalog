import { BookOpen, CarFront, Droplet, ExternalLink, SprayCan, Wind, Wrench } from 'lucide-react';

type LibraryEntry = {
  id: string;
  number: string;
  title: string;
  description: string;
  file: string;
  icon: typeof BookOpen;
  accent: string;
};

const LIBRARY_ENTRIES: LibraryEntry[] = [
  {
    id: 'dysze-zlaczki',
    number: '01',
    title: 'Atlas Dysz i Złączek',
    description:
      'Słowniczek gwintów (GZ/GW), dobór dysz wysokociśnieniowych, budowa lancy krok po kroku, osłony dysz, iniektory chemii (efekt Venturiego) i szybka diagnostyka usterek.',
    file: '/biblioteka/zeszyt-01-dysze-i-zlaczki.html',
    icon: Wrench,
    accent: 'text-sky-600 bg-sky-100 dark:text-sky-300 dark:bg-sky-500/15',
  },
  {
    id: 'chemia-obiektowa',
    number: '02',
    title: 'Atlas Chemii Obiektowej',
    description:
      'Słowniczek (pH, koncentrat, RTU), mapa zastosowań, skala pH na realnych produktach, porównanie linii (Eco Shine, Cid Lines, Clinex, Eilfix, Draco), dawkowanie i bezpieczeństwo.',
    file: '/biblioteka/zeszyt-02-chemia-obiektowa.html',
    icon: Droplet,
    accent: 'text-emerald-600 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15',
  },
  {
    id: 'aromamarketing',
    number: '03',
    title: 'Atlas Aromamarketingu',
    description:
      'Jak działa zimna dyfuzja, dobór mocy dyfuzora do powierzchni (linia KALA), mapa produktów, dobór zapachu do branży oraz bezpieczeństwo i etyka (REACH, alergie).',
    file: '/biblioteka/zeszyt-03-aromamarketing.html',
    icon: Wind,
    accent: 'text-violet-600 bg-violet-100 dark:text-violet-300 dark:bg-violet-500/15',
  },
  {
    id: 'aplikacja-chemii',
    number: '04',
    title: 'Atlas Sprzętu do Aplikacji Chemii',
    description:
      'Opryskiwacze ciśnieniowe i pianownice ręczne (Kwazar Orion/Venus), kolory linii wg odporności chemicznej, pistolety pneumatyczne Tornador/Benbow, zbiorniki natrysku, BHP i dobór zestawu do zastosowania.',
    file: '/biblioteka/zeszyt-04-aplikacja-chemii.html',
    icon: SprayCan,
    accent: 'text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15',
  },
  {
    id: 'myjnie-samochodowe',
    number: '05',
    title: 'Atlas Myjni Samochodowych',
    description:
      'Rodzaje myjni (portalowe, tunelowe, bezdotykowe, self-service), jak działa stanowisko samoobsługowe krok po kroku, dobór chemii Orion na każdy etap programu i szczotki myjniowe.',
    file: '/biblioteka/zeszyt-05-myjnie-samochodowe.html',
    icon: CarFront,
    accent: 'text-teal-600 bg-teal-100 dark:text-teal-300 dark:bg-teal-500/15',
  },
];

export function LibraryView() {
  return (
    <div className="catalog-home-view mx-auto max-w-5xl space-y-8 pb-12 pt-2">
      <section className="text-center sm:text-left">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-400/90">
          Kenochem Katalog
        </p>
        <h1 className="mt-1 inline-flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:justify-start sm:text-3xl">
          <BookOpen className="h-6 w-6 text-brand-500" />
          Biblioteka Techniczna
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400 sm:mx-0">
          Praktyczne poradniki dla magazynu, sprzedaży i obsługi klienta — oparte na
          realnych produktach z naszego katalogu. Otwierają się w nowej karcie.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {LIBRARY_ENTRIES.map((entry) => {
          const Icon = entry.icon;
          return (
            <a
              key={entry.id}
              href={entry.file}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-brand-400 dark:border-slate-700/80 dark:bg-slate-900/60 dark:hover:border-brand-500/40"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`rounded-xl p-3 ${entry.accent}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-brand-500 dark:text-slate-500">
                  Otwórz <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Zeszyt {entry.number}
                </p>
                <h2 className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {entry.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {entry.description}
                </p>
              </div>
            </a>
          );
        })}

        <div className="flex flex-col justify-center gap-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-500">
          <p className="font-medium text-slate-600 dark:text-slate-400">Kolejne zeszyty w przygotowaniu</p>
          <p>Zeszyt 06: chemia profesjonalna do detailingu — pasty polerskie, powłoki, technika nakładania.</p>
        </div>
      </section>
    </div>
  );
}
