import type { Product } from '../types';
import { runBulkEdit } from './bulkEdit';
import { addCategory, categoryKey, cleanCategoryName, getCategoryInfo, moveCategory, removeCategory, renameCategory } from './categoryRegistry';
import type { TreeAction } from './treeAdvisor';

type Patch = { id: string; patch: Partial<Product> };

export interface TreeApplyResult {
  patches: Patch[];
  message: string;
}

/** Wybór użytkownika, który może zmienić propozycję przed zastosowaniem. */
export interface TreeApplyChoice {
  /** merge: kategoria docelowa; rename: nowa nazwa; regroup: nazwa grupy. */
  text?: string;
  /** split: nazwy i zaznaczenie części (indeksy zgodne z action.parts). */
  parts?: { name: string; on: boolean }[];
}

/** Produkty przenosimy przez zbiorczą edycję (zapis w Logi → Operacje masowe, da się cofnąć); kategorię usuwamy dopiero po pełnym sukcesie. */
async function moveProducts(ids: string[], leaf: string, label: string): Promise<Patch[]> {
  if (!ids.length) return [];
  const path = getCategoryInfo(leaf)?.path ?? '';
  const res = await runBulkEdit(ids, { category: leaf, shopPath: path }, label);
  if (res.failed.length) throw new Error(`Nie udało się przenieść ${res.failed.length} produktów do „${leaf}” (${res.failed[0].error}) — kategoria nie została zmieniona`);
  return res.patches;
}

export async function applyTreeAction(action: TreeAction, currentIds: Map<string, string[]>, choice: TreeApplyChoice = {}): Promise<TreeApplyResult> {
  const idsOf = (name: string) => currentIds.get(categoryKey(name)) ?? [];
  switch (action.kind) {
    case 'remove': {
      const { moved } = await removeCategory(action.name, '');
      return { patches: [], message: `Usunięto pustą kategorię „${action.name}”${moved ? ` (${moved} produktów trafiło do „Do decyzji”)` : ''}` };
    }
    case 'merge': {
      const into = choice.text || action.into;
      const target = getCategoryInfo(into);
      if (!target || !target.isLeaf) throw new Error(`„${into}” nie jest kategorią z produktami`);
      if (categoryKey(into) === categoryKey(action.name)) throw new Error('Wybierz inną kategorię docelową');
      const patches = await moveProducts(idsOf(action.name), target.name, `Drzewo: scalenie „${action.name}” → „${target.name}”`);
      await removeCategory(action.name, target.name);
      return { patches, message: `Scalono „${action.name}” z „${target.name}” (${patches.length} produktów)` };
    }
    case 'rename': {
      const to = cleanCategoryName(choice.text ?? action.to);
      if (!to || to === action.name) throw new Error('Wpisz nową nazwę');
      const { updated } = await renameCategory(action.name, to);
      const path = getCategoryInfo(to)?.path ?? '';
      const patches = idsOf(action.name).map((id) => ({ id, patch: { category: to, ...(path ? { shopPath: path } : {}) } as Partial<Product> }));
      return { patches, message: `Zmieniono nazwę na „${to}” (${updated} produktów)` };
    }
    case 'split': {
      const chosen = action.parts.map((p, i) => ({ ...p, name: cleanCategoryName(choice.parts?.[i]?.name ?? p.name), on: choice.parts?.[i]?.on ?? true })).filter((p) => p.on);
      if (!chosen.length) throw new Error('Zaznacz przynajmniej jedną część');
      const seen = new Set<string>();
      for (const p of chosen) {
        if (!p.name) throw new Error('Każda część potrzebuje nazwy');
        if (seen.has(categoryKey(p.name))) throw new Error(`Nazwa „${p.name}” powtarza się`);
        seen.add(categoryKey(p.name));
        if (getCategoryInfo(p.name)) throw new Error(`Kategoria „${p.name}” już istnieje — wpisz inną nazwę`);
      }
      const patches: Patch[] = [];
      for (const p of chosen) {
        await addCategory(p.name, action.parent);
        patches.push(...(await moveProducts(p.ids, p.name, `Drzewo: podział „${action.name}” → „${p.name}”`)));
      }
      return { patches, message: `Podzielono „${action.name}”: ${chosen.length} nowych podkategorii, ${patches.length} produktów` };
    }
    case 'flatten': {
      await moveCategory(action.child, action.dept);
      await removeCategory(action.group, '');
      return { patches: [], message: `„${action.child}” przeniesiono do „${action.dept}”, grupę „${action.group}” usunięto` };
    }
    case 'regroup': {
      const group = cleanCategoryName(choice.text ?? action.group);
      if (!group) throw new Error('Wpisz nazwę grupy');
      if (getCategoryInfo(group)) throw new Error(`Kategoria „${group}” już istnieje — wpisz inną nazwę`);
      await addCategory(group, action.dept);
      for (const leaf of action.leaves) await moveCategory(leaf, group, { emptyTarget: true });
      return { patches: [], message: `Utworzono grupę „${group}” i przeniesiono do niej ${action.leaves.length} kategorii` };
    }
    case 'note':
      return { patches: [], message: '' };
  }
}
