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

const tree = treeJson as ShopCategoryTreeFile;

export function getShopCategoryTree(): ShopCategoryTreeFile {
  return tree;
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
