import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CATEGORIES } from "@/utils/categoryDefinitions";
import { getCategoryCounts } from "@/utils/categoryStorage";
import type { CategoryAssignments } from "@/utils/categoryStorage";
import type { Mod } from "./ModList";

interface CategorySidebarProps {
  categories: CategoryAssignments;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  mods: Mod[];
}

export const CategorySidebar = ({
  categories,
  selectedCategory,
  onSelectCategory,
  mods
}: CategorySidebarProps) => {
  const allModIds = mods.map(m => m.id);
  let counts: Record<string, number> = {};
  try {
    counts = getCategoryCounts(categories, allModIds);
  } catch (error) {
    console.error('[CategorySidebar] Error getting category counts:', error);
    counts = {};
  }

  // Sort categories by count (descending)
  const sortedCategories = [...CATEGORIES].sort((a, b) => {
    const countA = counts[a.name] || 0;
    const countB = counts[b.name] || 0;
    return countB - countA;
  });

  return (
    <div className="border-b border-border bg-muted/30">
      <div className="p-3">
        <h3 className="text-sm font-semibold mb-3">📂 Categories</h3>
        
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-2 pr-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectCategory(null)}
              className="w-full justify-between h-9"
            >
              <span>All Mods</span>
              <Badge variant="secondary" className="ml-2">
                {mods.length}
              </Badge>
            </Button>
            
            {sortedCategories.map(cat => {
              const count = counts[cat.name] || 0;
              if (count === 0) return null;
              
              const isSelected = selectedCategory === cat.name;
              return (
                <Button
                  key={cat.name}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => onSelectCategory(cat.name)}
                  className={`w-full justify-between h-9 ${
                    isSelected ? `${cat.color} ${cat.textColor}` : ""
                  }`}
                >
                  <span className="text-left truncate">{cat.name}</span>
                  <Badge 
                    variant="secondary" 
                    className={`ml-2 ${isSelected ? "bg-white/20 text-white" : ""}`}
                  >
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
