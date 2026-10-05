import type { AppRole } from '../lib/roles';
import { roleCan } from '../lib/roles';

/** Narzędzia widoczne w launcherze Suite — każde to osobna aplikacja (osobny adres). */
export interface SuiteTool {
  id: 'catalog' | 'sell' | 'stock' | 'ops' | 'calendar' | 'logistics';
  name: string;
  tagline: string;
  description: string;
  url: string;
  icon: string;
  /** Przy `soon` kafelek jest nieaktywny. */
  soon?: boolean;
  /** Kto widzi kafelek jako aktywny; reszta go nie widzi wcale. */
  canSee: (role: AppRole) => boolean;
}

const signedIn = (role: AppRole) => role !== 'guest';

export const SUITE_TOOLS: SuiteTool[] = [
  {
    id: 'catalog',
    name: 'Katalog',
    tagline: 'Produkty, zdjęcia, stany',
    description:
      'Wyszukiwanie produktów, ceny, zdjęcia, etykiety, foldery robocze, Nowości i log zmian z WAPRO.',
    url: 'https://kenochem-katalog.web.app',
    icon: '/icons/icon-192.png',
    canSee: () => true,
  },
  {
    id: 'sell',
    name: 'Handel',
    tagline: 'CRM, oferty, klienci',
    description:
      'Koszyk i oferty PDF z historią, lejek sprzedaży, klienci, mapa wizyt, kalendarz i skrzynka e-mail.',
    url: 'https://kenochem-sell.web.app',
    icon: '/icons/sell-icon-192.png',
    canSee: (role) => roleCan(role, 'useCrm'),
  },
  {
    id: 'ops',
    name: 'Operacje',
    tagline: 'Sprzedaż, martwy stock, finanse',
    description:
      'Analiza sprzedaży, martwy stock z syncem z Mag, koszty, marże i prognozy.',
    url: 'https://kenochem-ops.web.app',
    icon: '/icons/ops-icon-192.png',
    canSee: (role) => roleCan(role, 'viewOps'),
  },
  {
    id: 'stock',
    name: 'Magazyn',
    tagline: 'Stany ±, lokalizacje',
    description:
      'Szybka korekta stanów, lokalizacje towaru, etykiety i układ magazynu z widokiem 3D.',
    url: 'https://kenochem-stock.web.app',
    icon: '/icons/stock-icon-192.png',
    canSee: signedIn,
  },
  {
    id: 'calendar',
    name: 'Kalendarz',
    tagline: 'Plan firmy i wizyty',
    description: 'Wspólny plan: wizyty, dostawy, zadania i wydarzenia zespołu.',
    url: 'https://kenochem-calendar.web.app',
    icon: '/icons/calendar-icon-192.png',
    canSee: signedIn,
  },
  {
    id: 'logistics',
    name: 'Logistyka',
    tagline: 'Trasy i dostawy',
    description: 'Planowanie tras i dostaw — w przygotowaniu.',
    url: 'https://kenochem-logistics.web.app',
    icon: '/icons/suite-icon-192.png',
    soon: true,
    canSee: signedIn,
  },
];

export function toolsForRole(role: AppRole): SuiteTool[] {
  return SUITE_TOOLS.filter((t) => t.canSee(role));
}

export function toolUrl(id: SuiteTool['id']): string {
  return SUITE_TOOLS.find((t) => t.id === id)?.url ?? '/';
}
