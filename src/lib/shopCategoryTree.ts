import treeJson from '../../public/data/shop-category-tree.json';

export type ShopCategoryNode = {
  id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
  children: ShopCategoryNode[];
};

export type ShopCategoryTreeFile = {
  fetchedAt: string;
  roots: ShopCategoryNode[];
};

const baseTree = treeJson as ShopCategoryTreeFile;

/** Zmiany drzewa kategorii zapisane w bazie (catalog_categories): własne kategorie, przeniesienia i usunięcia. */
export interface CategoryOverride {
  name: string;
  /** Nazwa kategorii nadrzędnej; null = główna (korzeń). */
  parent: string | null;
  /** custom = dodana ręcznie; shop = kategoria ze sklepu zmodyfikowana (przeniesiona / usunięta). */
  source: 'custom' | 'shop';
  removed: boolean;
}

let tree: ShopCategoryTreeFile = baseTree;
let overridesVersion = 0;
const treeListeners = new Set<() => void>();

const nkey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function cloneNode(n: ShopCategoryNode): ShopCategoryNode {
  return { ...n, children: n.children.map(cloneNode) };
}

function findNode(roots: ShopCategoryNode[], name: string): { node: ShopCategoryNode; list: ShopCategoryNode[] } | null {
  for (const n of roots) {
    if (nkey(n.name) === nkey(name)) return { node: n, list: roots };
    const inner = findNode(n.children, name);
    if (inner) return inner;
  }
  return null;
}

/** Drzewo bazowe (ze sklepu) z naniesionymi zmianami. */
export function buildEffectiveTree(base: ShopCategoryTreeFile, overrides: CategoryOverride[]): ShopCategoryTreeFile {
  const roots = base.roots.map(cloneNode);
  let nextId = -1;
  // 1) usunięcia i przeniesienia kategorii ze sklepu
  for (const o of overrides.filter((r) => r.source === 'shop')) {
    const hit = findNode(roots, o.name);
    if (!hit) continue;
    if (o.removed) {
      hit.list.splice(hit.list.indexOf(hit.node), 1);
      continue;
    }
    const parent = o.parent ? findNode(roots, o.parent) : null;
    if (o.parent && !parent) continue;
    if (parent && parent.node === hit.node) continue;
    hit.list.splice(hit.list.indexOf(hit.node), 1);
    (parent ? parent.node.children : roots).push(hit.node);
  }
  // 2) kategorie własne (rodzice przed dziećmi — kilka przebiegów)
  const pending = overrides.filter((r) => r.source === 'custom' && !r.removed);
  for (let pass = 0; pass < 5 && pending.length; pass++) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const o = pending[i];
      const parent = o.parent ? findNode(roots, o.parent) : null;
      if (o.parent && !parent && pass < 4) continue;
      const node: ShopCategoryNode = { id: nextId--, name: o.name, slug: nkey(o.name).replace(/\s+/g, '-'), parent: parent?.node.id ?? 0, count: 0, children: [] };
      (parent ? parent.node.children : roots).push(node);
      pending.splice(i, 1);
    }
  }
  return { fetchedAt: base.fetchedAt, roots };
}

export function setCategoryOverrides(rows: CategoryOverride[]): void {
  tree = rows.length ? buildEffectiveTree(baseTree, rows) : baseTree;
  overridesVersion++;
  treeListeners.forEach((fn) => fn());
}

export function getCategoryTreeVersion(): number {
  return overridesVersion;
}

export function subscribeCategoryTree(fn: () => void): () => void {
  treeListeners.add(fn);
  return () => treeListeners.delete(fn);
}

/** Drzewo kategorii: bazowe ze sklepu + zmiany z bazy. */
export function getShopCategoryTree(): ShopCategoryTreeFile {
  return tree;
}

/** Drzewo bazowe (bez zmian z bazy) — do wykrywania, czy kategoria pochodzi ze sklepu. */
export function getBaseShopCategoryTree(): ShopCategoryTreeFile {
  return baseTree;
}


export function walkShopLeaves(
  nodes: ShopCategoryNode[],
  prefix = '',
): { path: string; label: string; wpId: number }[] {
  const out: { path: string; label: string; wpId: number }[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix} › ${node.name}` : node.name;
    if (node.children?.length) {
      out.push(...walkShopLeaves(node.children, path));
    } else {
      out.push({ path, label: node.name, wpId: node.id });
    }
  }
  return out;
}

export function deriveShopCategoryOptions(products: { category: string }[]): string[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    const c = p.category?.trim();
    if (c) counts.set(c, (counts.get(c) || 0) + 1);
  }

  const leaves = walkShopLeaves(tree.roots);
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const leaf of leaves) {
    if (counts.has(leaf.label) && !seen.has(leaf.label)) {
      ordered.push(leaf.label);
      seen.add(leaf.label);
    }
  }

  const rest = [...counts.keys()]
    .filter((c) => !seen.has(c))
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b, 'pl'));

  return ['Wszystkie', ...ordered, ...rest];
}

export function getShopCategoryGroups(): { root: string; leaves: string[] }[] {
  return tree.roots.map((root) => ({
    root: root.name,
    leaves: walkShopLeaves(root.children.length ? root.children : [root]).map((l) => l.label),
  }));
}
