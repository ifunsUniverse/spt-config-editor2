import { useState } from "react";
import { Package, ChevronDown, ChevronRight, FileJson } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface Mod {
  id: string;
  name: string;
  version: string;
  configCount: number;
}

export interface ConfigFile {
  fileName: string;
  index: number;
}

interface ModListProps {
  mods: Mod[];
  configFiles: Record<string, ConfigFile[]>;
  selectedModId: string | null;
  selectedConfigIndex: number;
  onSelectMod: (modId: string, configIndex: number) => void;
}

export const ModList = ({ 
  mods, 
  configFiles,
  selectedModId, 
  selectedConfigIndex,
  onSelectMod 
}: ModListProps) => {
  const [expandedMods, setExpandedMods] = useState<Set<string>>(
    new Set(selectedModId ? [selectedModId] : [])
  );

  const toggleMod = (modId: string) => {
    setExpandedMods(prev => {
      const next = new Set(prev);
      if (next.has(modId)) {
        next.delete(modId);
      } else {
        next.add(modId);
      }
      return next;
    });
  };

  return (
    <div className="w-80 border-r border-border bg-sidebar flex flex-col h-screen">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-sidebar-foreground">MODS</h2>
        <p className="text-sm text-muted-foreground">{mods.length} mods found</p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {mods.map((mod) => {
            const isExpanded = expandedMods.has(mod.id);
            const modConfigs = configFiles[mod.id] || [];
            
            return (
              <Collapsible
                key={mod.id}
                open={isExpanded}
                onOpenChange={() => toggleMod(mod.id)}
              >
                <CollapsibleTrigger
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left hover:bg-sidebar-accent",
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
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-1">
                  <div className="ml-4 pl-4 border-l-2 border-border space-y-1">
                    {modConfigs.map((config) => (
                      <button
                        key={config.index}
                        onClick={() => onSelectMod(mod.id, config.index)}
                        className={cn(
                          "w-full flex items-center gap-2 p-2 rounded-md transition-colors text-left text-sm",
                          "hover:bg-sidebar-accent/50",
                          selectedModId === mod.id && selectedConfigIndex === config.index
                            ? "bg-primary/20 text-primary font-medium"
                            : "text-sidebar-foreground"
                        )}
                      >
                        <FileJson className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{config.fileName}</span>
                      </button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
