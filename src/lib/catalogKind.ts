import type { CatalogType, Product } from '../types';
import { ACCESSORY_CATEGORIES } from '../types';

const WAPRO_ACCESSORY_CATEGORIES = new Set<string>(
  ACCESSORY_CATEGORIES.filter((c) => c !== 'Wszystkie'),
);

/** Kategorie Baselinker / sklep = osprzęt myjni, nie chemia. */
const SHOP_EQUIPMENT_CATEGORIES = new Set([
  'Akcesoria sklepowe',
  'Opryskiwacze',
]);

const WASH_EQUIPMENT_NAME =
  /pianownic|pistolet\s+(do\s+)?(myj|pian|piank)|\blanc[aęy]\b|lanca\b|lancy\b|foam\s*gun|tornador|dysz[aąeęy]|w[eę]ż\b|waz\b|szybkozł|ko[nń]c[oó]wk[aąey].*lanc|inżektor|pianuj|spieniaj|manometr|mosi[aą]dz|gwint\s|m22\b|m18\b|benbow|kwazar|interpump|kewazar|myjni\b|hydro\s*0|szczotk[aąey].*myjn|piaskow/i;

/** Chemia / kosmetyka w BL „Akcesoria sklepowe” — zostaje w Produktach. */
const CHEMISTRY_NAME =
  /szampon|shampoo|\bwosk\b|odświeżacz|preparat do|op\s*akryl|polerow|felg|nano\s|wax\b|detailer|quick\s*detailer|\d+\s*(ml|l)\b|aktywna\s+piana|piana\s+aktywna|środek\s+myj|nabłyszcz|odtłuszcz|deiron|clay|glinka/i;

export function resolveProductCatalogKind(product: Product): CatalogType {
  const stored = product.catalog || 'accessories';
  if (stored === 'accessories') return 'accessories';

  const category = (product.category || '').trim();
  if (WAPRO_ACCESSORY_CATEGORIES.has(category)) return 'accessories';
  if (category === 'Opryskiwacze') return 'accessories';

  if (!SHOP_EQUIPMENT_CATEGORIES.has(category)) return 'shop';

  const text = `${product.displayName || ''} ${product.name || ''} ${product.description || ''}`;
  if (CHEMISTRY_NAME.test(text) && !WASH_EQUIPMENT_NAME.test(text)) return 'shop';
  if (WASH_EQUIPMENT_NAME.test(text)) return 'accessories';

  return 'shop';
}

export function inferProductTypeLabel(product: Product): string {
  const category = (product.category || '').trim();
  const categoryLower = category.toLowerCase();
  const text = `${category} ${product.displayName || ''} ${product.name || ''}`.toLowerCase();

  if (CHEMISTRY_NAME.test(text)) return 'Chemia';
  if (/szczotk/.test(text)) return 'Szczotka';
  if (/opryskiwacz|spryskiwacz|atomizer/.test(text)) return 'Opryskiwacz';
  if (/pianownic|pianownica|foam/.test(text)) return 'Pianownica';
  if (/pistolet/.test(text)) return 'Pistolet';
  if (/\blanc|lanca|lancy|lance/.test(text)) return 'Lanca';
  if (/dysz/.test(text)) return 'Dysza';
  if (/wąż|waz|węże|weze|przew[oó]d/.test(text)) return 'Wąż';
  if (/szybkozł|szybkozl|z[łl][aą]cz|adapter|redukcj|ko[nń]c[oó]wk|gwint/.test(text)) {
    return 'Złącze / adapter';
  }
  if (/filtr/.test(text)) return 'Filtr';
  if (/manometr/.test(text)) return 'Manometr';
  if (/zaw[oó]r/.test(text)) return 'Zawór';
  if (/rur/.test(text)) return 'Rurka';
  if (/zbiornik/.test(text)) return 'Zbiornik';

  if (category && categoryLower !== 'produkty' && categoryLower !== 'akcesoria sklepowe') {
    return category;
  }

  return resolveProductCatalogKind(product) === 'shop' ? 'Produkt sklepowy' : 'Akcesoria';
}
