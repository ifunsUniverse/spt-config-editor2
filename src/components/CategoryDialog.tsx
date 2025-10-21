import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/utils/categoryDefinitions";
import { toast } from "sonner";

interface CategoryDialogProps {
  modId: string;
  modName: string;
  currentCategory: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoryAssigned: (category: string | null) => void;
}

export const CategoryDialog = ({
  modId,
  modName,
  currentCategory,
  open,
  onOpenChange,
  onCategoryAssigned
}: CategoryDialogProps) => {
  const handleAssign = (categoryName: string) => {
    onCategoryAssigned(categoryName);
    toast.success("Category assigned", {
      description: `${modName} assigned to ${categoryName}`
    });
    onOpenChange(false);
  };

  const handleRemove = () => {
    onCategoryAssigned(null);
    toast.success("Category removed", {
      description: `Removed category from ${modName}`
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Category</DialogTitle>
          <DialogDescription>
            Choose a category for <span className="font-medium">{modName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-4">
          {CATEGORIES.map((cat) => {
            const isSelected = currentCategory === cat.name;
            return (
              <Button
                key={cat.name}
                variant={isSelected ? "default" : "outline"}
                className={`h-20 flex flex-col items-center justify-center gap-2 relative ${
                  isSelected ? `${cat.color} ${cat.textColor}` : ""
                }`}
                onClick={() => handleAssign(cat.name)}
              >
                {isSelected && (
                  <Check className="w-4 h-4 absolute top-2 right-2" />
                )}
                <span className="font-semibold text-center text-sm leading-tight">
                  {cat.name}
                </span>
              </Button>
            );
          })}
        </div>

        {currentCategory && (
          <Button
            variant="destructive"
            onClick={handleRemove}
            className="w-full"
          >
            Remove Category
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};
