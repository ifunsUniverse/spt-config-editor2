import { CATEGORIES } from "@/utils/categoryDefinitions";
import { getCategoryCounts } from "@/utils/categoryStorage";
import { Mod } from "./ModList";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface CategoryBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Record<string, string>;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  mods: Mod[];
}

export function CategoryBrowser({
  open,
  onOpenChange,
  categories,
  selectedCategory,
  onSelectCategory,
  mods,
}: CategoryBrowserProps) {
  const allModIds = mods.map(m => m.id);
  const categoryCounts = getCategoryCounts(categories, allModIds);
  
  const sortedCategories = [...CATEGORIES].sort((a, b) => {
    const countA = categoryCounts[a.name] || 0;
    const countB = categoryCounts[b.name] || 0;
    return countB - countA;
  });

  const handleCategoryClick = (categoryName: string) => {
    if (selectedCategory === categoryName) {
      onSelectCategory(null);
    } else {
      onSelectCategory(categoryName);
    }
    onOpenChange(false);
  };

  const handleAllModsClick = () => {
    onSelectCategory(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Browse by Category</DialogTitle>
          <DialogDescription>
            Filter mods by selecting a category
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              className="w-full justify-between"
              onClick={handleAllModsClick}
            >
              <span>All Mods</span>
              <Badge variant="secondary">{mods.length}</Badge>
            </Button>
            
            {sortedCategories.map((category) => {
              const count = categoryCounts[category.name] || 0;
              const isSelected = selectedCategory === category.name;
              
              if (count === 0) return null;
              
              return (
                <Button
                  key={category.name}
                  variant={isSelected ? "default" : "outline"}
                  className="w-full justify-between"
                  onClick={() => handleCategoryClick(category.name)}
                >
                  <span className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${category.bgColor}`} />
                    {category.name}
                  </span>
                  <Badge variant="secondary">{count}</Badge>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
