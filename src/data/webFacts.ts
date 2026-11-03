/**
 * Fakty o produktach znalezione w internecie (strona producenta, karta charakterystyki, sklepy konkurencji).
 * Klucz to SKU. Każdy wpis musi mieć co najmniej jedno źródło — bez źródła silnik go ignoruje.
 * Warstwa „sieć” głosuje z dużą wagą jako dowód, a z `use` i `facts` powstają szkice opisów produktów.
 */
export interface WebFact {
  /** Kategoria (liść drzewa), do której produkt należy według źródeł; pomijamy, gdy źródła tego nie rozstrzygają. */
  leaf?: string;
  /** Do czego służy produkt — jedno zdanie, własnymi słowami (nie kopiujemy cudzych opisów). */
  use: string;
  /** Konkretne fakty: skład, pH, stężenie, sposób użycia, certyfikaty — każdy jako osobne zdanie. */
  facts?: string[];
  /** Adresy stron, z których pochodzą informacje. */
  sources: string[];
  /** Data sprawdzenia (YYYY-MM-DD). */
  checked: string;
}

export const WEB_FACTS: Record<string, WebFact> = {};
