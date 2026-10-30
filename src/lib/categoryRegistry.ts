import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { logAudit } from './auditLog';
import { invalidateProductsCache } from './products';
import { rebuildCategoryIndex } from './catalogCategory';
import {
  getBaseShopCategoryTree,
  getCategoryTreeVersion,
  getShopCategoryTree,
  setCategoryOverrides,
  subscribeCategoryTree,
  walkShopLeaves,
  type CategoryOverride,
  type ShopCategoryNode,
} from './shopCategoryTree';

/**
 * Zarządzanie drzewem kategorii: kategorie własne, przeniesienia i usunięcia zapisane w bazie
 * (tabela catalog_categories) i nakładane na drzewo bazowe ze sklepu — wspólne dla wszystkich.
 */
export interface CategoryRow extends CategoryOverride {
  updatedAt: string;
}

let rows: CategoryRow[] = [];
let loaded = false;
let inflight: Promise<void> | null = null;

export const categoryKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');
export const cleanCategoryName = (raw: string) => raw.trim().replace(/\s+/g, ' ');

function apply() {
  setCategoryOverrides(rows.map(({ name, parent, source, removed }) => ({ name, parent, source, removed })));
  rebuildCategoryIndex();
}

/** Hook odświeżający komponent po zmianie drzewa kategorii (zwraca numer wersji). */
export function useCategoryRegistry(): number {
  return useSyncExternalStore(subscribeCategoryTree, getCategoryTreeVersion, () => 0);
}

function missingTable(message: string): Error {
  return new Error(
    /does not exist|catalog_categories|schema cache/i.test(message)
      ? 'Brak tabeli kategorii w bazie — uruchom migrację migration-catalog-categories.sql'
      : message,
  );
}

export function loadCategoryRegistry(force = false): Promise<void> {
  const client = supabase;
  if (!client) return Promise.resolve();
  if (loaded && !force) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await client.from('catalog_categories').select('*').order('created_at');
      if (error) throw error;
      rows = (data ?? []).map((r) => ({
        name: String(r.name),
        parent: r.parent ? String(r.parent) : null,
        source: r.source === 'shop' ? 'shop' : 'custom',
        removed: r.removed === true,
        updatedAt: String(r.updated_at ?? ''),
      }));
      loaded = true;
      apply();
    } catch (err) {
      console.warn('catalog_categories', err);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// ---------------------------------------------------------------------------------------------
// Zapytania o drzewo
// ---------------------------------------------------------------------------------------------

export interface CategoryNodeInfo {
  name: string;
  parent: string | null;
  isLeaf: boolean;
  /** true = kategoria ze sklepu (drzewo bazowe); false = dodana ręcznie. */
  fromShop: boolean;
  /** Ścieżka od korzenia, np. „Samochód › Mycie”. */
  path: string;
  depth: number;
}

function baseNames(): Set<string> {
  const set = new Set<string>();
  const walk = (nodes: ShopCategoryNode[]) => {
    for (const n of nodes) {
      set.add(categoryKey(n.name));
      walk(n.children);
    }
  };
  walk(getBaseShopCategoryTree().roots);
  return set;
}

export function flattenCategories(): CategoryNodeInfo[] {
  const base = baseNames();
  const out: CategoryNodeInfo[] = [];
  const walk = (nodes: ShopCategoryNode[], parent: string | null, prefix: string, depth: number) => {
    for (const n of nodes) {
      const path = prefix ? `${prefix} › ${n.name}` : n.name;
      out.push({ name: n.name, parent, isLeaf: n.children.length === 0, fromShop: base.has(categoryKey(n.name)), path, depth });
      walk(n.children, n.name, path, depth + 1);
    }
  };
  walk(getShopCategoryTree().roots, null, '', 0);
  return out;
}

export function getCategoryInfo(name: string): CategoryNodeInfo | undefined {
  const k = categoryKey(name);
  return flattenCategories().find((c) => categoryKey(c.name) === k);
}

/** Wszystkie kategorie, do których można przypisać produkt (liście drzewa). */
export function getAssignableCategories(): string[] {
  return walkShopLeaves(getShopCategoryTree().roots).map((l) => l.label);
}

/** Struktura katalogu: 7 stałych działów (poziom 1), podkategoria (2) i kategoria najniższego poziomu (3). */
export const MAX_CATEGORY_DEPTH = 2;

/** Nazwy stałych działów głównych — z drzewa bazowego (sklepu). */
export function mainCategoryRoots(): string[] {
  return getBaseShopCategoryTree().roots.map((r) => r.name);
}

/** Kategorie niezgodne ze strukturą: dodatkowe działy główne i wszystko głębsze niż 3 poziomy (wraz z potomkami). */
export function findLooseCategories(): CategoryNodeInfo[] {
  const main = new Set(mainCategoryRoots().map(categoryKey));
  const flat = flattenCategories();
  const loose = new Set<string>();
  for (const c of flat) {
    if ((c.depth === 0 && !main.has(categoryKey(c.name))) || c.depth > MAX_CATEGORY_DEPTH) loose.add(categoryKey(c.name));
  }
  // potomkowie luźnej kategorii też są luźni
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of flat) {
      if (c.parent && loose.has(categoryKey(c.parent)) && !loose.has(categoryKey(c.name))) {
        loose.add(categoryKey(c.name));
        grew = true;
      }
    }
  }
  return flat.filter((c) => loose.has(categoryKey(c.name)));
}

function subtreeHeight(name: string): number {
  const flat = flattenCategories();
  const k = categoryKey(name);
  const walk = (parentKey: string): number => {
    const kids = flat.filter((c) => c.parent && categoryKey(c.parent) === parentKey);
    return kids.length ? 1 + Math.max(...kids.map((c) => walk(categoryKey(c.name)))) : 0;
  };
  return walk(k);
}

/** Kategorie, pod którymi można umieścić nową (korzenie i kategorie grupujące; liście z produktami odpadają). */
export function getParentCandidates(): CategoryNodeInfo[] {
  return flattenCategories().filter((c) => !c.isLeaf || c.depth === 0);
}

// ---------------------------------------------------------------------------------------------
// Zapisy
// ---------------------------------------------------------------------------------------------

function findRow(name: string): CategoryRow | undefined {
  const k = categoryKey(name);
  return rows.find((r) => categoryKey(r.name) === k);
}

async function upsertRow(r: { name: string; parent: string | null; source: 'custom' | 'shop'; removed: boolean }): Promise<void> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const { error } = await client.from('catalog_categories').upsert(
    {
      name_key: categoryKey(r.name),
      name: r.name,
      parent: r.parent,
      source: r.source,
      removed: r.removed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'name_key' },
  );
  if (error) throw missingTable(error.message);
}

async function deleteRow(name: string): Promise<void> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const { error } = await client.from('catalog_categories').delete().eq('name_key', categoryKey(name));
  if (error) throw missingTable(error.message);
}

function exists(name: string): boolean {
  return Boolean(getCategoryInfo(name));
}

/** Dodaje własną kategorię (pod wskazanym rodzicem albo jako główną). Zwraca zapisaną nazwę. */
export async function addCategory(rawName: string, parent: string | null = null): Promise<string> {
  const name = cleanCategoryName(rawName);
  if (!name) throw new Error('Podaj nazwę kategorii');
  const info = getCategoryInfo(name);
  if (info) return info.name; // już istnieje — po prostu ją wybieramy
  if (!parent) throw new Error('Działów głównych jest 7 i są stałe — wybierz dział, pod którym ma powstać kategoria');
  {
    const p = getCategoryInfo(parent);
    if (!p) throw new Error(`Nie ma kategorii nadrzędnej „${parent}”`);
    if (p.depth + 1 > MAX_CATEGORY_DEPTH) throw new Error('Struktura ma 3 poziomy (dział › podkategoria › kategoria) — nie można zagnieżdżać głębiej');
    if (p.isLeaf && p.depth > 0) throw new Error(`„${parent}” zawiera produkty — wybierz kategorię grupującą lub główną`);
  }
  await upsertRow({ name, parent, source: 'custom', removed: false });
  await loadCategoryRegistry(true);
  logAudit({ action: 'category.add', entityType: 'category', entityId: name, summary: `Kategoria „${name}” dodana${parent ? ` w „${parent}”` : ''}` });
  return name;
}

async function moveProducts(oldName: string, newName: string): Promise<number> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from('products')
      .select('id')
      .ilike('category', oldName.replace(/[\\%_]/g, (c) => `\\${c}`))
      .range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) ids.push(String(r.id));
    if (!data || data.length < 1000) break;
  }
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await client.from('products').update({ category: newName }).in('id', ids.slice(i, i + 200));
    if (error) throw error;
  }
  return ids.length;
}

/** Zmienia nazwę kategorii z produktami (liść). Produkty dostają nową nazwę. */
export async function renameCategory(oldName: string, newRaw: string): Promise<{ updated: number }> {
  const info = getCategoryInfo(oldName);
  if (!info) throw new Error('Nie znaleziono kategorii');
  const newName = cleanCategoryName(newRaw);
  if (!newName) throw new Error('Podaj nową nazwę');
  if (newName === info.name) return { updated: 0 };
  if (categoryKey(newName) !== categoryKey(info.name) && exists(newName)) {
    throw new Error(`Kategoria „${newName}” już istnieje — wybierz inną nazwę`);
  }
  if (info.fromShop && !info.isLeaf) throw new Error('Nazwy kategorii grupującej ze sklepu nie można zmienić');

  let updated = 0;
  if (info.isLeaf) updated = await moveProducts(info.name, newName);

  if (info.fromShop) {
    // kategoria ze sklepu: stara znika, nowa własna zajmuje jej miejsce
    await upsertRow({ name: info.name, parent: info.parent, source: 'shop', removed: true });
    await upsertRow({ name: newName, parent: info.parent, source: 'custom', removed: false });
  } else {
    const row = findRow(info.name);
    await upsertRow({ name: newName, parent: info.parent, source: 'custom', removed: false });
    if (row && categoryKey(row.name) !== categoryKey(newName)) await deleteRow(info.name);
    // dzieci przechodzą pod nową nazwę
    const client = supabase;
    if (client) {
      await client.from('catalog_categories').update({ parent: newName }).eq('parent', info.name);
    }
  }
  invalidateProductsCache();
  await loadCategoryRegistry(true);
  logAudit({ action: 'category.rename', entityType: 'category', entityId: newName, summary: `Kategoria „${info.name}” → „${newName}” (${updated} produktów)` });
  return { updated };
}

/** Przenosi kategorię pod innego rodzica (null = kategoria główna). */
export async function moveCategory(name: string, newParent: string | null): Promise<void> {
  const info = getCategoryInfo(name);
  if (!info) throw new Error('Nie znaleziono kategorii');
  if (!newParent) throw new Error('Działów głównych jest 7 i są stałe — przenieś kategorię pod jeden z nich');
  {
    const p = getCategoryInfo(newParent);
    if (!p) throw new Error('Nie znaleziono kategorii nadrzędnej');
    if (p.depth + 1 + subtreeHeight(info.name) > MAX_CATEGORY_DEPTH) throw new Error('Struktura ma 3 poziomy (dział › podkategoria › kategoria) — ta gałąź nie zmieści się tutaj');
    if (categoryKey(p.name) === categoryKey(info.name)) throw new Error('Kategoria nie może być własnym rodzicem');
    if (p.path.split(' › ').some((seg) => categoryKey(seg) === categoryKey(info.name))) throw new Error('Nie można przenieść kategorii pod jej własną podkategorię');
    if (p.isLeaf && p.depth > 0) throw new Error(`„${newParent}” zawiera produkty — wybierz kategorię grupującą lub główną`);
  }
  await upsertRow({ name: info.name, parent: newParent, source: info.fromShop ? 'shop' : 'custom', removed: false });
  await loadCategoryRegistry(true);
  logAudit({ action: 'category.move', entityType: 'category', entityId: info.name, summary: `Kategoria „${info.name}” przeniesiona do „${newParent ?? 'głównych'}”` });
}

/** Usuwa kategorię; jej produkty przechodzą do wskazanej kategorii (pusta = „Do decyzji”). */
export async function removeCategory(name: string, moveTo: string): Promise<{ moved: number }> {
  const info = getCategoryInfo(name);
  if (!info) throw new Error('Nie znaleziono kategorii');
  if (!info.isLeaf) throw new Error('Najpierw usuń lub przenieś podkategorie');
  const target = cleanCategoryName(moveTo);
  if (target && categoryKey(target) === categoryKey(info.name)) throw new Error('Wybierz inną kategorię docelową');
  const moved = await moveProducts(info.name, target);
  if (info.fromShop) await upsertRow({ name: info.name, parent: info.parent, source: 'shop', removed: true });
  else await deleteRow(info.name);
  invalidateProductsCache();
  await loadCategoryRegistry(true);
  logAudit({ action: 'category.remove', entityType: 'category', entityId: info.name, summary: `Kategoria „${info.name}” usunięta, ${moved} produktów → ${target || 'Do decyzji'}` });
  return { moved };
}

/** Przywraca kategorię ze sklepu (cofa usunięcie lub przeniesienie). */
export async function restoreShopCategory(name: string): Promise<void> {
  const row = findRow(name);
  if (!row) return;
  await deleteRow(name);
  await loadCategoryRegistry(true);
}

export function removedShopCategories(): string[] {
  return rows.filter((r) => r.source === 'shop' && r.removed).map((r) => r.name);
}

/** Zmiany drzewa zapisane w bazie względem drzewa ze sklepu (własne kategorie, przeniesienia, usunięcia). */
export function getCategoryOverrides(): CategoryRow[] {
  return rows;
}

/** Kasuje wszystkie zmiany drzewa — zostaje drzewo ze sklepu 1:1. Zwraca liczbę usuniętych zmian. */
export async function resetCategoryOverrides(): Promise<number> {
  const client = supabase;
  if (!client) throw new Error('Brak połączenia z bazą');
  const count = rows.length;
  if (!count) return 0;
  const { error } = await client.from('catalog_categories').delete().neq('name_key', '');
  if (error) throw missingTable(error.message);
  await loadCategoryRegistry(true);
  logAudit({ action: 'category.reset', entityType: 'category', entityId: 'drzewo', summary: `Przywrócono drzewo kategorii ze sklepu (usunięto ${count} zmian)` });
  return count;
}
