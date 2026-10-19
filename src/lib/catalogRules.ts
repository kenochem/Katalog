import type { Product } from '../types';
import { supabase } from './supabase';
import { logAudit, withAuditBatch } from './auditLog';
import { getProductDisplayCategory } from './catalogCategory';
import { effectiveManufacturer } from './waproManufacturers';
import { computeChanges, runBulkEdit, sourceFromProduct, type BulkEditSpec, type BulkRunResult } from './bulkEdit';
import { setProductsHidden } from './products';
import { setDataExceptions, type ExceptionKind } from './dataExceptions';
import { normalizeName } from './validations';

/**
 * Reguły jakości: „jeśli produkt spełnia WSZYSTKIE warunki, wykonaj akcję”. Uruchamiane ręcznie z podglądem;
 * zmiany zapisują się jako jedna partia do cofnięcia (Logi → Operacje masowe).
 */
export type RuleField = 'name' | 'sku' | 'manufacturer' | 'category' | 'ean' | 'stock' | 'priceSaleGross' | 'catalog' | 'tag' | 'image';
export type RuleOp = 'contains' | 'notContains' | 'startsWith' | 'equals' | 'empty' | 'notEmpty' | 'gt' | 'lt';

export interface RuleCondition {
  field: RuleField;
  op: RuleOp;
  value: string;
}

export type RuleAction =
  | { type: 'setCategory'; value: string }
  | { type: 'setManufacturer'; value: string }
  | { type: 'addTag'; value: string }
  | { type: 'hide'; reason: string }
  | { type: 'exception'; kinds: (ExceptionKind | 'all')[]; note: string };

export interface CatalogRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleCondition[];
  action: RuleAction;
  lastRunAt?: string | null;
  lastRunCount?: number | null;
}

export const FIELD_LABEL: Record<RuleField, string> = {
  name: 'Nazwa',
  sku: 'SKU',
  manufacturer: 'Producent',
  category: 'Kategoria',
  ean: 'EAN',
  stock: 'Stan magazynowy',
  priceSaleGross: 'Cena sprzedaży brutto',
  catalog: 'Katalog',
  tag: 'Tag',
  image: 'Zdjęcie',
};

export const OP_LABEL: Record<RuleOp, string> = {
  contains: 'zawiera',
  notContains: 'nie zawiera',
  startsWith: 'zaczyna się od',
  equals: 'jest równe',
  empty: 'jest puste / brak',
  notEmpty: 'jest uzupełnione',
  gt: 'większe niż',
  lt: 'mniejsze niż',
};

export const FIELD_OPS: Record<RuleField, RuleOp[]> = {
  name: ['contains', 'notContains', 'startsWith', 'equals'],
  sku: ['startsWith', 'contains', 'equals'],
  manufacturer: ['equals', 'empty', 'notEmpty', 'contains'],
  category: ['equals', 'empty', 'notEmpty', 'contains'],
  ean: ['empty', 'notEmpty'],
  stock: ['equals', 'gt', 'lt'],
  priceSaleGross: ['empty', 'notEmpty', 'gt', 'lt'],
  catalog: ['equals'],
  tag: ['contains', 'notContains'],
  image: ['empty', 'notEmpty'],
};

export const NO_VALUE_OPS: RuleOp[] = ['empty', 'notEmpty'];

const norm = (s: string) => normalizeName(s);

function textOf(p: Product, field: RuleField): string {
  switch (field) {
    case 'name':
      return `${p.displayName ?? ''} ${p.name ?? ''}`;
    case 'sku':
      return p.sku ?? '';
    case 'manufacturer':
      return effectiveManufacturer(p) || '';
    case 'category':
      return getProductDisplayCategory(p) || '';
    case 'ean':
      return p.ean ?? '';
    case 'catalog':
      return p.catalog === 'shop' ? 'sklep' : 'akcesoria';
    case 'tag':
      return (p.tags ?? []).join(' ');
    case 'image':
      return p.hasImage || p.imageUrl || p.customImageUrl ? 'tak' : '';
    default:
      return '';
  }
}

export function matchesCondition(p: Product, c: RuleCondition): boolean {
  if (c.field === 'stock' || c.field === 'priceSaleGross') {
    const v = c.field === 'stock' ? (p.stock ?? 0) : p.priceSaleGross;
    if (c.op === 'empty') return v == null || v === 0;
    if (c.op === 'notEmpty') return v != null && v !== 0;
    if (v == null) return false;
    const n = Number(c.value.replace(',', '.'));
    if (!Number.isFinite(n)) return false;
    if (c.op === 'gt') return v > n;
    if (c.op === 'lt') return v < n;
    return v === n;
  }
  const raw = textOf(p, c.field);
  if (c.op === 'empty') return raw.trim() === '';
  if (c.op === 'notEmpty') return raw.trim() !== '';
  const hay = norm(raw);
  const needle = norm(c.value);
  if (!needle) return false;
  if (c.op === 'contains') return hay.includes(needle);
  if (c.op === 'notContains') return !hay.includes(needle);
  if (c.op === 'startsWith') return hay.startsWith(needle) || norm(raw.replace(/^\W+/, '')).startsWith(needle);
  return hay === needle;
}

/** Produkt spełnia wszystkie warunki (reguła bez warunków nie pasuje do niczego). */
export function matchesRule(p: Product, conditions: RuleCondition[]): boolean {
  if (!conditions.length) return false;
  return conditions.every((c) => matchesCondition(p, c));
}

export function describeCondition(c: RuleCondition): string {
  return `${FIELD_LABEL[c.field]} ${OP_LABEL[c.op]}${NO_VALUE_OPS.includes(c.op) ? '' : ` „${c.value}”`}`;
}

export function describeAction(a: RuleAction): string {
  switch (a.type) {
    case 'setCategory':
      return `ustaw kategorię „${a.value}”`;
    case 'setManufacturer':
      return `ustaw producenta „${a.value}”`;
    case 'addTag':
      return `dodaj tag „${a.value}”`;
    case 'hide':
      return `ukryj (${a.reason})`;
    case 'exception':
      return `ustaw wyjątek (${a.kinds.join(', ')})`;
  }
}

/** Czy akcja cokolwiek zmieni w produkcie (pomijamy te, które już są w docelowym stanie). */
export function actionWouldChange(p: Product, a: RuleAction): boolean {
  switch (a.type) {
    case 'setCategory':
    case 'setManufacturer':
    case 'addTag':
      return computeChanges(sourceFromProduct(p), actionToSpec(a)).length > 0;
    case 'hide':
      return p.meta?.catalogHidden !== true;
    case 'exception': {
      const have = new Set(p.meta?.dataExceptions ?? []);
      return !a.kinds.every((k) => have.has(k));
    }
  }
}

function actionToSpec(a: RuleAction): BulkEditSpec {
  if (a.type === 'setCategory') return { category: a.value };
  if (a.type === 'setManufacturer') return { manufacturer: a.value };
  if (a.type === 'addTag') return { tagsAdd: [a.value] };
  return {};
}

export function ruleIsValid(r: Pick<CatalogRule, 'name' | 'conditions' | 'action'>): string | null {
  if (!r.name.trim()) return 'Podaj nazwę reguły';
  if (!r.conditions.length) return 'Dodaj co najmniej jeden warunek';
  for (const c of r.conditions) {
    if (!NO_VALUE_OPS.includes(c.op) && !c.value.trim()) return `Uzupełnij wartość warunku: ${FIELD_LABEL[c.field]}`;
  }
  const a = r.action;
  if ((a.type === 'setCategory' || a.type === 'setManufacturer' || a.type === 'addTag') && !a.value.trim()) return 'Uzupełnij wartość akcji';
  if (a.type === 'hide' && !a.reason.trim()) return 'Podaj powód ukrycia';
  if (a.type === 'exception' && !a.kinds.length) return 'Wybierz rodzaje wyjątku';
  return null;
}

/** Gotowe szablony reguł (punkt wyjścia do edycji). */
export const RULE_TEMPLATES: Omit<CatalogRule, 'id' | 'enabled'>[] = [
  {
    name: 'Części myjek bez zdjęcia i stanu → ukryj',
    conditions: [
      { field: 'image', op: 'empty', value: '' },
      { field: 'stock', op: 'equals', value: '0' },
      { field: 'name', op: 'contains', value: 'obudowa' },
    ],
    action: { type: 'hide', reason: 'Część myjki' },
  },
  {
    name: 'Bez zdjęcia, stanu i ceny → Śmietnik Piotra',
    conditions: [
      { field: 'image', op: 'empty', value: '' },
      { field: 'stock', op: 'equals', value: '0' },
      { field: 'priceSaleGross', op: 'empty', value: '' },
    ],
    action: { type: 'hide', reason: 'Śmietnik Piotra' },
  },
  {
    name: 'SKU z prefiksem KARC → producent KARCHER',
    conditions: [
      { field: 'sku', op: 'startsWith', value: 'KARC' },
      { field: 'manufacturer', op: 'empty', value: '' },
    ],
    action: { type: 'setManufacturer', value: 'KARCHER' },
  },
  {
    name: 'Nazwa zawiera „szampon” → kategoria Szampony',
    conditions: [{ field: 'name', op: 'contains', value: 'szampon' }],
    action: { type: 'setCategory', value: 'Szampony' },
  },
];

// ---------------------------------------------------------------------------------------------
// Zapis w bazie
// ---------------------------------------------------------------------------------------------

function missingTable(message: string): Error {
  return new Error(
    /does not exist|catalog_rules|schema cache/i.test(message)
      ? 'Brak tabeli reguł w bazie — uruchom migrację migration-catalog-rules.sql'
      : message,
  );
}

function fromRow(r: Record<string, unknown>): CatalogRule {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    enabled: r.enabled !== false,
    conditions: Array.isArray(r.conditions) ? (r.conditions as RuleCondition[]) : [],
    action: (r.action && typeof r.action === 'object' ? r.action : { type: 'addTag', value: '' }) as RuleAction,
    lastRunAt: r.last_run_at ? String(r.last_run_at) : null,
    lastRunCount: r.last_run_count != null ? Number(r.last_run_count) : null,
  };
}

export async function fetchRules(): Promise<CatalogRule[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('catalog_rules').select('*').order('created_at');
  if (error) throw missingTable(error.message);
  return (data ?? []).map((r) => fromRow(r as Record<string, unknown>));
}

export async function saveRule(rule: Omit<CatalogRule, 'id'> & { id?: string }): Promise<void> {
  if (!supabase) throw new Error('Brak połączenia z bazą');
  const payload = {
    name: rule.name.trim(),
    enabled: rule.enabled,
    conditions: rule.conditions,
    action: rule.action,
    updated_at: new Date().toISOString(),
  };
  const { error } = rule.id
    ? await supabase.from('catalog_rules').update(payload).eq('id', rule.id)
    : await supabase.from('catalog_rules').insert(payload);
  if (error) throw missingTable(error.message);
  logAudit({ action: 'rule.save', entityType: 'rule', entityId: payload.name, summary: `Reguła „${payload.name}” zapisana` });
}

export async function deleteRule(rule: CatalogRule): Promise<void> {
  if (!supabase) throw new Error('Brak połączenia z bazą');
  const { error } = await supabase.from('catalog_rules').delete().eq('id', rule.id);
  if (error) throw missingTable(error.message);
  logAudit({ action: 'rule.delete', entityType: 'rule', entityId: rule.name, summary: `Reguła „${rule.name}” usunięta` });
}

async function markRun(rule: CatalogRule, count: number): Promise<void> {
  if (!supabase) return;
  await supabase.from('catalog_rules').update({ last_run_at: new Date().toISOString(), last_run_count: count }).eq('id', rule.id);
}

export interface RuleRunResult {
  affected: number;
  failed: number;
  patches: BulkRunResult['patches'];
  hiddenIds: string[];
  exceptionIds: string[];
}

/** Wykonuje regułę na wskazanych produktach (jedna partia do cofnięcia). */
export async function runRule(
  rule: CatalogRule,
  products: Product[],
  onProgress?: (done: number, total: number) => void,
): Promise<RuleRunResult> {
  const ids = products.map((p) => p.id);
  const label = `Reguła „${rule.name}”: ${describeAction(rule.action)}`;
  const result: RuleRunResult = { affected: 0, failed: 0, patches: [], hiddenIds: [], exceptionIds: [] };
  const a = rule.action;
  if (a.type === 'setCategory' || a.type === 'setManufacturer' || a.type === 'addTag') {
    const res = await runBulkEdit(ids, actionToSpec(a), label, onProgress);
    result.affected = res.updated;
    result.failed = res.failed.length;
    result.patches = res.patches;
  } else if (a.type === 'hide') {
    const res = await withAuditBatch(label, () => setProductsHidden(ids, true, a.reason));
    result.failed = res.failed.length;
    result.affected = ids.length - res.failed.length;
    result.hiddenIds = ids.filter((id) => !res.failed.includes(id));
  } else {
    const res = await withAuditBatch(label, () => setDataExceptions(ids, a.kinds, a.note));
    result.failed = res.failed.length;
    result.affected = ids.length - res.failed.length;
    result.exceptionIds = ids.filter((id) => !res.failed.includes(id));
  }
  await markRun(rule, result.affected);
  return result;
}
