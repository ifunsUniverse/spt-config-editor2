export interface CategoryDefinition {
  name: string;
  keywords: string[];
  color: string;
}

export const CATEGORIES: CategoryDefinition[] = [
  { 
    name: "AI & Bots", 
    keywords: ["ai", "sain", "bot", "pmc", "scav", "questing", "behavior", "intelligence", "donuts", "waypoints", "spawn"],
    color: "text-purple-500"
  },
  { 
    name: "Loot & Economy", 
    keywords: ["loot", "economy", "price", "trader", "fleamarket", "flea", "money", "value", "market", "finance", "progression"],
    color: "text-green-500"
  },
  { 
    name: "Quests & Progression", 
    keywords: ["quest", "progression", "task", "mission", "objective", "storyline", "level", "experience"],
    color: "text-blue-500"
  },
  { 
    name: "Weapons & Ballistics", 
    keywords: ["weapon", "ballistic", "recoil", "gun", "firearm", "ammo", "ammunition", "reload", "malfunction", "durability"],
    color: "text-red-500"
  },
  { 
    name: "Medical & Health", 
    keywords: ["health", "medical", "healing", "surgery", "damage", "injury", "pain", "bleed", "fracture"],
    color: "text-pink-500"
  },
  { 
    name: "Realism & Hardcore", 
    keywords: ["realism", "hardcore", "difficulty", "simulation", "realistic", "immersive"],
    color: "text-orange-500"
  },
  { 
    name: "UI & Interface", 
    keywords: ["ui", "hud", "interface", "menu", "display", "overlay", "minimap", "notification", "screen"],
    color: "text-cyan-500"
  },
  { 
    name: "Audio & Sound", 
    keywords: ["audio", "sound", "music", "volume", "voice", "hearing", "binaural"],
    color: "text-indigo-500"
  },
  { 
    name: "Performance & Graphics", 
    keywords: ["performance", "graphics", "fps", "optimization", "visual", "render", "quality"],
    color: "text-yellow-500"
  },
  { 
    name: "Utilities & Tools", 
    keywords: ["utility", "tool", "helper", "debug", "config", "manager", "editor", "inspector"],
    color: "text-gray-500"
  },
  { 
    name: "Gameplay Tweaks", 
    keywords: ["tweak", "balance", "adjust", "modifier", "custom", "enhanced", "improved", "fix"],
    color: "text-teal-500"
  },
  { 
    name: "Content Addition", 
    keywords: ["new", "expanded", "additional", "extra", "more", "custom", "items", "gear"],
    color: "text-emerald-500"
  },
];

/**
 * Categorizes a mod based on its name, description, and author
 * Returns a primary category and up to 2 secondary categories
 */
export function categorizeMod(
  modName: string, 
  description?: string, 
  author?: string
): {
  primary: string;
  secondary: string[];
} {
  const text = `${modName} ${description || ""} ${author || ""}`.toLowerCase();
  const matches: { category: string; score: number }[] = [];

  for (const category of CATEGORIES) {
    let score = 0;
    for (const keyword of category.keywords) {
      // Weight matches in mod name higher (3 points)
      if (modName.toLowerCase().includes(keyword)) {
        score += 3;
      }
      // Description matches worth 2 points
      if (description?.toLowerCase().includes(keyword)) {
        score += 2;
      }
      // Author matches worth 1 point
      if (author?.toLowerCase().includes(keyword)) {
        score += 1;
      }
    }
    if (score > 0) {
      matches.push({ category: category.name, score });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return {
    primary: matches[0]?.category || "Uncategorized",
    secondary: matches.slice(1, 3).map(m => m.category), // Top 2-3 additional matches
  };
}

/**
 * Gets the color for a category
 */
export function getCategoryColor(categoryName: string): string {
  const category = CATEGORIES.find(c => c.name === categoryName);
  return category?.color || "text-muted-foreground";
}
