import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Star } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

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
  selectedConfigIndex: number | null;
  onSelectMod: (modId: string, configIndex?: number) => void;
  favoritedModIds: Set<string>;
  onToggleFavorite: (modId: string) => void;
}

export const ModList = ({ 
  mods, 
  configFiles, 
  selectedModId, 
  selectedConfigIndex, 
  onSelectMod,
  favoritedModIds,
  onToggleFavorite
}: ModListProps) => {
  const [expandedMods, setExpandedMods] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const toggleMod = (modId: string) => {
    setExpandedMods(prev => ({
      ...prev,
      [modId]: !prev[modId]
    }));
  };

  const filteredMods = mods.filter(mod =>
    mod.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-border shrink-0">
        <Input
          placeholder="Search mods..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-input border-border h-8"
        />
      </div>
      <ScrollArea className="flex-1 overflow-auto">
        <div className="p-2 space-y-1.5">
          {filteredMods.map((mod) => {
            const modConfigs = configFiles[mod.id] || [];
            return (
              <Card key={mod.id} className="overflow-hidden border-border">
                <Collapsible
                  open={expandedMods[mod.id]}
                  onOpenChange={() => toggleMod(mod.id)}
                >
                  <CollapsibleTrigger
                    className="flex items-center w-full p-2 hover:bg-accent rounded-lg transition-colors gap-2"
                  >
                    <ChevronRight 
                      className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                        expandedMods[mod.id] ? "rotate-90" : ""
                      }`}
                    />
                    <div className="text-left flex-1 min-w-0 overflow-hidden pr-2">
                      <h3 className="font-semibold text-sm truncate">{mod.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        v{mod.version} • {mod.configCount} config{mod.configCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(mod.id);
                      }}
                      className="h-6 w-6 shrink-0"
                    >
                      <Star
                        className={`h-3.5 w-3.5 ${
                          favoritedModIds.has(mod.id) 
                            ? "fill-yellow-400 text-yellow-400" 
                            : "text-muted-foreground"
                        }`}
                      />
                    </Button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-2 pb-1 space-y-0.5">
                      {modConfigs.map((cfg) => (
                        <button
                          key={cfg.index}
                          onClick={() => onSelectMod(mod.id, cfg.index)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors truncate ${
                            selectedModId === mod.id && selectedConfigIndex === cfg.index
                              ? "bg-primary/20 text-primary font-medium"
                              : "hover:bg-accent text-muted-foreground"
                          }`}
                        >
                          {cfg.fileName}
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
