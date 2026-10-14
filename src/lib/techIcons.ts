import type { TechType } from './techParser';

/**
 * Ikony typów elementów technicznych (siatka 24×24, kontur `currentColor`).
 * Statyczne fragmenty SVG — rysowane ręcznie, bo biblioteka ikon nie ma nypli, trójników itp.
 */
export const TECH_ICON_SVG: Record<TechType, string> = {
  // nypel: sześciokątny korpus z gwintowanymi końcami
  nypel:
    '<path d="M9 7h6l1.5 5L15 17H9l-1.5-5z"/><path d="M2 9.5h5.5M2 14.5h5.5M16.5 9.5H22M16.5 14.5H22"/><path d="M3.5 9.5v5M5.5 9.5v5M18.5 9.5v5M20.5 9.5v5"/>',
  // trójnik: litera T z rur
  trojnik: '<path d="M2 5h20v6h-6.5v9h-7v-9H2z"/><path d="M8.5 11h7"/>',
  // kolanko: rura z zagięciem 90°
  kolanko: '<path d="M3 4h11a6 6 0 0 1 6 6v11h-6V11a1 1 0 0 0-1-1H3z"/><path d="M14 17h6"/>',
  // redukcja: rura zwężająca się
  redukcja: '<path d="M2 5h9l4 4h7v6h-7l-4 4H2z"/><path d="M11 5v14M15 9v6"/>',
  // dysza: korpus + strumienie
  dysza: '<path d="M3 9h8l4-3v12l-4-3H3z"/><path d="M17.5 8l4-2M18 12h4.5M17.5 16l4 2"/>',
  // szybkozłącze: wtyk i gniazdo
  szybkozlacze: '<path d="M2 9h8v6H2z"/><path d="M14 6.5h8v11h-8z"/><path d="M10 12h4"/><path d="M17 10v4"/>',
  // adapter: dwa różne końce z przejściem
  adapter: '<path d="M2 8h5v8H2z"/><path d="M17 5.5h5v13h-5z"/><path d="M7 9.5l10-4M7 14.5l10 4"/>',
  // zawór: dwa trójkąty + wrzeciono i pokrętło
  zawor: '<path d="M3 8v9l9-4.5zM21 8v9l-9-4.5z"/><path d="M12 12.5V5.5M8 5.5h8"/>',
  // o-ring / uszczelka
  oring: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/>',
  // zaślepka / korek
  zaslepka: '<path d="M6 20.5V11a6 6 0 0 1 12 0v9.5z"/><path d="M6 16.5h12"/>',
  // manometr: tarcza z wskazówką
  manometr:
    '<circle cx="12" cy="12" r="9"/><path d="M12 12l4-4.5"/><path d="M12 4.5V6M4.5 12H6M19.5 12H18M7 7l1 1M17 7l-1 1"/><path d="M9 21h6"/>',
  // gniazdo
  gniazdo: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2"/>',
  // lanca: długa rura z uchwytem i dyszą
  lanca: '<path d="M3 21l13-13"/><path d="M5.5 21.5l-2-2"/><path d="M14 6l4 4"/><path d="M18.5 4.5l2-2M20 8.5h2.5M15.5 2.5v2.5"/>',
  // pistolet: korpus z kolbą i spustem
  pistolet: '<path d="M2 7h14.5l3 2.5V13H13l-1 8H8l1-8H2z"/><path d="M13 13l-1.5-3"/>',
  // wąż: skręcona rura
  waz: '<path d="M20 4H8a4 4 0 0 0 0 8h8a4 4 0 0 1 0 8H4"/><path d="M20 2v4M4 18v4"/>',
  // filtr: lejek z kratką
  filtr: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/><path d="M6.5 8h11"/>',
  // sitko: sitko z siatką
  sitko: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12M18 6L6 18M3 12h18M12 3v18"/>',
  // pianownica: butelka z pianą
  pianownica:
    '<path d="M6 9h7v12H6z"/><path d="M7 9V5.5h5L15 7.5"/><circle cx="17.5" cy="11" r="1.6"/><circle cx="20" cy="15" r="1.1"/><circle cx="16.5" cy="17" r="1.3"/>',
  // zbiornik: walec
  zbiornik:
    '<path d="M5 6c0-1.7 3-3 7-3s7 1.3 7 3v12c0 1.7-3 3-7 3s-7-1.3-7-3z"/><path d="M5 6c0 1.7 3 3 7 3s7-1.3 7-3"/><path d="M5 12c0 1.7 3 3 7 3s7-1.3 7-3"/>',
  // zestaw naprawczy: klucz
  naprawczy:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>',
};
