import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Star, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { splitCamelCase } from "@/lib/utils";
import { ModEditHistory, getModEditTime } from "@/utils/editTracking";
import { formatDistanceToNow } from "date-fns";

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
  editHistory: ModEditHistory[];
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

export const ModList = ({ 
  mods, 
  configFiles, 
  selectedModId, 
  selectedConfigIndex, 
  onSelectMod,
  favoritedModIds,
  onToggleFavorite,
  editHistory,
  searchInputRef
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
          ref={searchInputRef}
          placeholder="Search mods... (Ctrl+F)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-input border-border h-8"
        />
      </div>
      <ScrollArea className="flex-1">
        <div className="pl-2 pr-1 py-2 space-y-1.5 mr-1">
          {filteredMods.map((mod) => {
            const modConfigs = configFiles[mod.id] || [];
            const lastEditTime = getModEditTime(mod.id);
            const hasBeenEdited = lastEditTime !== null;
            
            return (
              <Card key={mod.id} className="overflow-hidden border-border bg-card/50">
                <Collapsible
                  open={expandedMods[mod.id]}
                  onOpenChange={() => toggleMod(mod.id)}
                >
                  <div className="flex items-center w-full p-2.5 gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(mod.id);
                      }}
                      className="h-7 w-7 shrink-0"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          favoritedModIds.has(mod.id) 
                            ? "fill-yellow-400 text-yellow-400" 
                            : "text-muted-foreground"
                        }`}
                      />
                    </Button>
                    <CollapsibleTrigger className="flex items-center flex-1 min-w-0 gap-2 hover:opacity-80 transition-opacity">
                      <ChevronRight 
                        className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                          expandedMods[mod.id] ? "rotate-90" : ""
                        }`}
                      />
                      <div className="text-left flex-1 min-w-0">
                        {/* Row 1: Name + Badge */}
                        <div className="flex items-start gap-2 mb-1">
                          <h3 className="font-semibold text-sm break-words hyphens-auto flex-1 leading-tight">
                            {splitCamelCase(mod.name)}
                          </h3>
                          {hasBeenEdited && (
                            <Badge 
                              variant="secondary" 
                              className="text-[10px] px-1.5 py-0 h-4 bg-success/20 text-success border-success/30 shrink-0"
                            >
                              Edited
                            </Badge>
                          )}
                        </div>
                        
                        {/* Row 2: Version + Edit Time */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="shrink-0">
                            v{mod.version}
                          </span>
                          <span className="shrink-0">•</span>
                          <span className="shrink-0">
                            {mod.configCount} config{mod.configCount !== 1 ? 's' : ''}
                          </span>
                          {hasBeenEdited && lastEditTime && (
                            <>
                              <span className="shrink-0">•</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <Clock className="h-3 w-3" />
                                <span className="whitespace-nowrap">
                                  {formatDistanceToNow(lastEditTime, { addSuffix: true })}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent>
                    <div className="px-2 pb-2 pt-0 space-y-0.5">
                      {modConfigs.map((cfg) => (
                        <button
                          key={cfg.index}
                          onClick={() => onSelectMod(mod.id, cfg.index)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors truncate ${
                            selectedModId === mod.id && selectedConfigIndex === cfg.index
                              ? "bg-primary/20 text-primary font-medium"
                              : "hover:bg-accent/50 text-muted-foreground"
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
