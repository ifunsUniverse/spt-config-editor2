import { writeCategoryFile, readCategoryFile } from "@/utils/electronBridge";

export type CategoryAssignments = Record<string, string>;

export async function saveCategories(categories: CategoryAssignments) {
  try {
    const json = JSON.stringify(categories, null, 2);
    await writeCategoryFile(json);
  } catch (error) {
    console.error("❌ Failed to save categories:", error);
  }
}

export async function loadCategories(): Promise<CategoryAssignments> {
  try {
    const data = await readCategoryFile();
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export async function assignModToCategory(
  modId: string,
  category: string,
  existingMap: CategoryAssignments
) {
  const updated = { ...existingMap, [modId]: category };
  await saveCategories(updated);
  return updated;
}

export async function removeModFromCategory(
  modId: string,
  existingMap: CategoryAssignments
) {
  const updated = { ...existingMap };
  delete updated[modId];
  await saveCategories(updated);
  return updated;
}

export function getModCategory(
  modId: string,
  map: CategoryAssignments
): string | null {
  return map[modId] ?? null;
}

export function getCategoryCounts(
  categoryMap: CategoryAssignments,
  allModIds: string[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  allModIds.forEach((modId) => {
    const category = categoryMap[modId];
    if (!category) return;
    counts[category] = (counts[category] || 0) + 1;
  });
  return counts;
}
