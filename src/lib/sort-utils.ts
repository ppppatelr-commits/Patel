import type { MenuCategory, MenuItem } from '@/types';

/**
 * Normalizes category sort orders to be contiguous 1, 2, 3, ... N with no duplicates.
 */
export function normalizeCategories(categories: MenuCategory[]): MenuCategory[] {
  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  return sorted.map((cat, index) => ({
    ...cat,
    sort_order: index + 1,
  }));
}

/**
 * Inserts a new category at the given sort_order (1-based).
 * All categories at targetSortOrder and below shift down by 1.
 */
export function insertCategory(
  categories: MenuCategory[],
  newCategory: MenuCategory,
  targetSortOrder?: number
): MenuCategory[] {
  const normalized = normalizeCategories(categories);
  const total = normalized.length;

  let insertIndex: number;
  if (!targetSortOrder || targetSortOrder > total + 1) {
    insertIndex = total;
  } else if (targetSortOrder < 1) {
    insertIndex = 0;
  } else {
    insertIndex = targetSortOrder - 1;
  }

  normalized.splice(insertIndex, 0, newCategory);
  return normalized.map((cat, index) => ({
    ...cat,
    sort_order: index + 1,
  }));
}

/**
 * Moves an existing category to a new sort_order (1-based).
 * Automatically shifts other categories to keep continuous 1..N ordering.
 */
export function moveCategory(
  categories: MenuCategory[],
  id: string,
  newSortOrder: number
): MenuCategory[] {
  const normalized = normalizeCategories(categories);
  const currentIndex = normalized.findIndex((c) => c.id === id);
  if (currentIndex === -1) return normalized;

  const [targetCategory] = normalized.splice(currentIndex, 1);
  const totalAfterRemoval = normalized.length;

  let targetIndex: number;
  if (newSortOrder < 1) {
    targetIndex = 0;
  } else if (newSortOrder > totalAfterRemoval + 1) {
    targetIndex = totalAfterRemoval;
  } else {
    targetIndex = newSortOrder - 1;
  }

  normalized.splice(targetIndex, 0, targetCategory);
  return normalized.map((cat, index) => ({
    ...cat,
    sort_order: index + 1,
  }));
}

/**
 * Removes a category and renumbers remaining categories sequentially 1..N.
 */
export function removeCategory(categories: MenuCategory[], id: string): MenuCategory[] {
  const filtered = categories.filter((c) => c.id !== id);
  return normalizeCategories(filtered);
}

/**
 * Reorders categories based on an array of category IDs in the new order.
 */
export function reorderCategories(
  categories: MenuCategory[],
  orderedIds: string[]
): MenuCategory[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const result: MenuCategory[] = [];

  for (const id of orderedIds) {
    const cat = catMap.get(id);
    if (cat) {
      result.push(cat);
      catMap.delete(id);
    }
  }

  for (const remaining of catMap.values()) {
    result.push(remaining);
  }

  return result.map((cat, index) => ({
    ...cat,
    sort_order: index + 1,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// MENU ITEMS (Category-wise independent sorting: 1, 2, 3... within each category)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes all items so each category has independent contiguous 1..M sort orders.
 */
export function normalizeItems(items: MenuItem[]): MenuItem[] {
  const byCategory = new Map<string, MenuItem[]>();

  for (const item of items) {
    if (!byCategory.has(item.category_id)) {
      byCategory.set(item.category_id, []);
    }
    byCategory.get(item.category_id)!.push({ ...item });
  }

  const result: MenuItem[] = [];
  for (const catItems of byCategory.values()) {
    catItems.sort((a, b) => a.sort_order - b.sort_order);
    catItems.forEach((it, idx) => {
      it.sort_order = idx + 1;
      result.push(it);
    });
  }

  return result;
}

/**
 * Inserts a new item into its category at the target sort_order (1-based).
 * Shifts other items in that category down.
 */
export function insertItem(
  items: MenuItem[],
  newItem: MenuItem,
  targetSortOrder?: number
): MenuItem[] {
  const allNormalized = normalizeItems(items);

  const catId = newItem.category_id;
  const catItems = allNormalized.filter((i) => i.category_id === catId).sort((a, b) => a.sort_order - b.sort_order);
  const otherItems = allNormalized.filter((i) => i.category_id !== catId);

  let insertIndex: number;
  if (!targetSortOrder || targetSortOrder > catItems.length + 1) {
    insertIndex = catItems.length;
  } else if (targetSortOrder < 1) {
    insertIndex = 0;
  } else {
    insertIndex = targetSortOrder - 1;
  }

  catItems.splice(insertIndex, 0, { ...newItem });
  catItems.forEach((it, idx) => {
    it.sort_order = idx + 1;
  });

  return [...otherItems, ...catItems];
}

/**
 * Moves an item within its category or to a new category, maintaining
 * independent sequential 1..M ordering in all affected categories.
 */
export function moveItem(
  items: MenuItem[],
  id: string,
  newSortOrder?: number,
  newCategoryId?: string
): MenuItem[] {
  const allNormalized = normalizeItems(items);

  const itemIndex = allNormalized.findIndex((i) => i.id === id);
  if (itemIndex === -1) return allNormalized;

  const item = { ...allNormalized[itemIndex] };
  const oldCatId = item.category_id;
  const targetCatId = newCategoryId && newCategoryId !== oldCatId ? newCategoryId : oldCatId;

  if (targetCatId === oldCatId) {
    if (newSortOrder === undefined) return allNormalized;

    const catItems = allNormalized
      .filter((i) => i.category_id === oldCatId)
      .sort((a, b) => a.sort_order - b.sort_order);
    const otherItems = allNormalized.filter((i) => i.category_id !== oldCatId);

    const currentCatIdx = catItems.findIndex((i) => i.id === id);
    if (currentCatIdx === -1) return allNormalized;

    const [moved] = catItems.splice(currentCatIdx, 1);
    const targetIdx = Math.max(0, Math.min(newSortOrder - 1, catItems.length));
    catItems.splice(targetIdx, 0, moved);

    catItems.forEach((it, idx) => {
      it.sort_order = idx + 1;
    });

    return [...otherItems, ...catItems];
  }

  // Moved to a different category
  allNormalized.splice(itemIndex, 1);

  // Renumber old category
  const oldCatItems = allNormalized
    .filter((i) => i.category_id === oldCatId)
    .sort((a, b) => a.sort_order - b.sort_order);
  oldCatItems.forEach((it, idx) => {
    it.sort_order = idx + 1;
  });

  // Insert into new category
  item.category_id = targetCatId;
  const newCatItems = allNormalized
    .filter((i) => i.category_id === targetCatId)
    .sort((a, b) => a.sort_order - b.sort_order);
  const otherItems = allNormalized.filter((i) => i.category_id !== oldCatId && i.category_id !== targetCatId);

  const targetIdx =
    newSortOrder !== undefined
      ? Math.max(0, Math.min(newSortOrder - 1, newCatItems.length))
      : newCatItems.length;

  newCatItems.splice(targetIdx, 0, item);
  newCatItems.forEach((it, idx) => {
    it.sort_order = idx + 1;
  });

  return [...otherItems, ...oldCatItems, ...newCatItems];
}

/**
 * Removes an item and renumbers remaining items in its category 1..M.
 */
export function removeItem(items: MenuItem[], id: string): MenuItem[] {
  const allNormalized = normalizeItems(items);
  const itemIndex = allNormalized.findIndex((i) => i.id === id);
  if (itemIndex === -1) return allNormalized;

  const [removed] = allNormalized.splice(itemIndex, 1);
  const catItems = allNormalized
    .filter((i) => i.category_id === removed.category_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  catItems.forEach((it, idx) => {
    it.sort_order = idx + 1;
  });

  return allNormalized;
}

/**
 * Reorders items within a specific category according to orderedIds.
 * Renumbers them 1..M.
 */
export function reorderCategoryItems(
  items: MenuItem[],
  categoryId: string,
  orderedIds: string[]
): MenuItem[] {
  const allNormalized = normalizeItems(items);
  const catItems = allNormalized.filter((i) => i.category_id === categoryId);
  const otherItems = allNormalized.filter((i) => i.category_id !== categoryId);

  const itemMap = new Map(catItems.map((i) => [i.id, i]));
  const newOrder: MenuItem[] = [];

  for (const id of orderedIds) {
    const item = itemMap.get(id);
    if (item) {
      newOrder.push(item);
      itemMap.delete(id);
    }
  }

  for (const remaining of itemMap.values()) {
    newOrder.push(remaining);
  }

  newOrder.forEach((item, index) => {
    item.sort_order = index + 1;
  });

  return [...otherItems, ...newOrder];
}
