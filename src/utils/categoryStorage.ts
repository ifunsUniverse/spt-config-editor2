import { isElectron, readCategoryFile, writeCategoryFile } from "./electronBridge";

const STORAGE_KEY = "spt-mod-categories";

export interface CategoryAssignments {
  [modId: string]: string;
}

export async function loadCategories(): Promise<CategoryAssignments> {
  if (isElectron()) {
    try {
      const content = await readCategoryFile();
      return content ? JSON.parse(content) : {};
    } catch (error) {
      console.log("No categories file found in Electron, returning empty");
      return {};
    }
  } else {
    // Browser localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  }
}

export async function saveCategories(assignments: CategoryAssignments): Promise<void> {
  if (isElectron()) {
    try {
      await writeCategoryFile(JSON.stringify(assignments, null, 2));
    } catch (error) {
      console.error("Failed to save categories in Electron:", error);
    }
  } else {
    // Browser localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  }
}

export async function assignModToCategory(
  modId: string,
  category: string,
  currentAssignments: CategoryAssignments
): Promise<CategoryAssignments> {
  const updated = { ...currentAssignments, [modId]: category };
  await saveCategories(updated);
  return updated;
}

export async function removeModFromCategory(
  modId: string,
  currentAssignments: CategoryAssignments
): Promise<CategoryAssignments> {
  const updated = { ...currentAssignments };
  delete updated[modId];
  await saveCategories(updated);
  return updated;
}

export function getModCategory(modId: string, assignments: CategoryAssignments): string | null {
  return assignments[modId] || null;
}

export function getModsByCategory(category: string, assignments: CategoryAssignments): string[] {
  return Object.entries(assignments)
    .filter(([_, cat]) => cat === category)
    .map(([modId]) => modId);
}

export function getCategoryCounts(
  assignments: CategoryAssignments,
  allModIds: string[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  
  for (const modId of allModIds) {
    const category = assignments[modId];
    if (category) {
      counts[category] = (counts[category] || 0) + 1;
    }
  }
  
  return counts;
}
