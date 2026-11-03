import type { EngineSummary, TreeHealth } from './categoryEngineReport';
import type { EngineScope } from './categoryEngineReport';

/** Komunikaty silnika dla użytkownika: co znalazł i co proponuje zrobić. Każdy może mieć przycisk, który wykonuje albo pokazuje decyzję. */
export interface Insight {
  id: string;
  tone: 'ok' | 'info' | 'warn' | 'bad';
  title: string;
  text: string;
  action?: { label: string; kind: 'apply' | 'queue' | 'tab'; target: string };
}

export interface InsightInput {
  scope: EngineScope;
  summary: EngineSummary;
  health: TreeHealth | null;
  /** Wszystkie produkty (bez grup) i ile z nich ma kategorię. */
  totals: { products: number; categorized: number };
  /** Produkty z brakującym opisem i opisy z uwagami kontroli spójności. */
  descriptions: { missing: number; issues: number } | null;
  /** Produkty „do wyszukania”, które mają już wgrane materiały (karty) — da się je rozpoznać z dokumentów. */
  researchWithDocs: number;
}

const pl = (n: number) => n.toLocaleString('pl-PL');

export function buildInsights(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  const { summary: s } = i;
  const pct = i.totals.products ? Math.round((100 * i.totals.categorized) / i.totals.products) : 0;

  if (i.scope === 'audyt') {
    if (s.changes.length)
      out.push({
        id: 'audit-wrong',
        tone: 'bad',
        title: `${pl(s.changes.length)} produktów jest przypisanych źle`,
        text: 'Nazwa, opis albo identyczny produkt w innym opakowaniu jednoznacznie wskazują inną kategorię. Poprawki są pewne i da się je cofnąć.',
        action: { label: 'Popraw pewne', kind: 'apply', target: 'changes' },
      });
    else
      out.push({ id: 'audit-ok', tone: 'ok', title: 'Nie znaleziono pewnych błędów', text: `Silnik sprawdził ${pl(s.total)} przypisanych produktów i nie ma do nich zastrzeżeń, które mógłby uzasadnić.` });
    if (s.review.length)
      out.push({
        id: 'audit-review',
        tone: 'warn',
        title: `${pl(s.review.length)} przypisań budzi wątpliwość`,
        text: 'Sygnały są sprzeczne albo słabe (np. opis wskazuje inną kategorię niż nazwa). Wymagają Twojej decyzji.',
        action: { label: 'Przejrzyj', kind: 'queue', target: 'review' },
      });
    if (s.flagged.length)
      out.push({
        id: 'audit-flags',
        tone: 'warn',
        title: `${pl(s.flagged.length)} produktów z flagą niespójności`,
        text: 'Nazwa i opis się nie zgadzają albo ten sam produkt w różnych opakowaniach leży w różnych kategoriach.',
        action: { label: 'Pokaż', kind: 'queue', target: 'review' },
      });
  } else {
    if (s.changes.length)
      out.push({
        id: 'assign-sure',
        tone: 'ok',
        title: `${pl(s.changes.length)} produktów można przypisać od ręki`,
        text: 'Silnik ma dla nich dowód w nazwie lub opisie i potwierdzenie z drugiej strony (linia, opakowanie, sklep).',
        action: { label: 'Przypisz pewne', kind: 'apply', target: 'changes' },
      });
    if (s.review.length)
      out.push({
        id: 'assign-review',
        tone: 'warn',
        title: `${pl(s.review.length)} produktów wymaga Twojej decyzji`,
        text: 'Silnik proponuje kategorię, ale sygnały nie są jednoznaczne. Każdą propozycję możesz zatwierdzić, zmienić albo pominąć.',
        action: { label: 'Przejrzyj', kind: 'queue', target: 'review' },
      });
  }

  if (s.research.length) {
    const withDocs = i.researchWithDocs;
    out.push({
      id: 'research',
      tone: 'info',
      title: `${pl(s.research.length)} produktów bez żadnego sygnału`,
      text: `Nazwa i opis nic nie mówią o przeznaczeniu.${withDocs ? ` ${pl(withDocs)} z nich ma już wgrane materiały — karty charakterystyki wystarczą do rozpoznania.` : ''} Dostarcz karty charakterystyki lub opisy (zakładka produktu „Materiały”), a silnik użyje ich przy następnym uruchomieniu.`,
      action: { label: 'Pokaż listę', kind: 'queue', target: 'research' },
    });
  }
  if (s.hide.length)
    out.push({
      id: 'hide',
      tone: 'info',
      title: `${pl(s.hide.length)} pozycji wygląda na niesprzedażowe`,
      text: 'Usługi, wysyłka, sprzęt biurowy i opakowania nie powinny być widoczne w katalogu.',
      action: { label: 'Pokaż', kind: 'queue', target: 'hide' },
    });

  if (i.health) {
    if (i.health.empty.length)
      out.push({ id: 'tree-empty', tone: 'warn', title: `${pl(i.health.empty.length)} pustych kategorii po poprawkach`, text: `Kandydaci do usunięcia: ${i.health.empty.slice(0, 4).map((p) => p.split(' › ').pop()).join(', ')}${i.health.empty.length > 4 ? '…' : ''}.` });
    if (i.health.confusable.length)
      out.push({
        id: 'tree-confusable',
        tone: 'info',
        title: 'Kategorie, między którymi silnik się waha',
        text: i.health.confusable.slice(0, 3).map((c) => `${c.a} ⇄ ${c.b} (${c.count})`).join(' · ') + '. To możliwy dubel albo zbyt płynna granica w drzewie.',
      });
  }

  if (i.descriptions && (i.descriptions.missing || i.descriptions.issues))
    out.push({
      id: 'descriptions',
      tone: i.descriptions.issues ? 'warn' : 'info',
      title: `${pl(i.descriptions.missing)} produktów bez pełnego opisu, ${pl(i.descriptions.issues)} opisów z uwagami`,
      text: 'Opisy powstają poza katalogiem. Pobierz teczkę dla autora opisów albo wczytaj gotowe opisy — silnik sprawdzi je przed zapisem i wskaże niespójności w istniejących.',
      action: { label: 'Opisy', kind: 'tab', target: 'opisy' },
    });

  out.push({ id: 'coverage', tone: pct >= 98 ? 'ok' : 'info', title: `Pokrycie kategoriami: ${pct}%`, text: `${pl(i.totals.categorized)} z ${pl(i.totals.products)} produktów ma kategorię w drzewie.` });
  return out;
}
