import { Package, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface Mod {
  id: string;
  name: string;
  version: string;
  configCount: number;
}

interface ModListProps {
  mods: Mod[];
  selectedModId: string | null;
  onSelectMod: (modId: string) => void;
}

export const ModList = ({ mods, selectedModId, onSelectMod }: ModListProps) => {
  return (
    <div className="w-80 border-r border-border bg-sidebar flex flex-col h-screen">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-sidebar-foreground">Discovered Mods</h2>
        <p className="text-sm text-muted-foreground">{mods.length} mods found</p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {mods.map((mod) => (
            <button
              key={mod.id}
              onClick={() => onSelectMod(mod.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                "hover:bg-sidebar-accent",
                selectedModId === mod.id && "bg-sidebar-accent"
              )}
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sidebar-foreground truncate">
                  {mod.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  v{mod.version} • {mod.configCount} configs
                </div>
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                selectedModId === mod.id && "text-primary"
              )} />
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
