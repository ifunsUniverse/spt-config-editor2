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
import { ModMetadataViewer, ModMetadata } from "@/components/ModMetadataViewer";
import { getCategoryBgColor } from "@/utils/categoryDefinitions";

// ✅ CONTEXT MENU (the NEW import)
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

export interface Mod {
  id: string;
  name: string;
  version: string;
  configCount: number;
  category?: string;
  categories?: string[];
  author?: string;
  description?: string;
  metadata?: ModMetadata;
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
  modCategories?: Record<string, string>;

  // ✅ NEW PROP
  onCategoryAssign?: (modId: string) => void;
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
  searchInputRef,
  modCategories = {},
  onCategoryAssign,  // ✅ NEW
}: ModListProps) => {
  const [expandedMods, setExpandedMods] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const toggleMod = (modId: string) => {
    setExpandedMods((prev) => ({
      ...prev,
      [modId]: !prev[modId],
    }));
  };

  const filteredMods = mods.filter((mod) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      mod.name.toLowerCase().includes(query) ||
      mod.id.toLowerCase().includes(query) ||
      mod.category?.toLowerCase().includes(query) ||
      mod.description?.toLowerCase().includes(query)
    );
  });

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

      <ScrollArea className="flex-1 pr-2">
        <div className="px-2 py-2 space-y-1.5">
          {filteredMods.map((mod) => {
            const modConfigs = configFiles[mod.id] || [];
            const lastEditTime = getModEditTime(mod.id);
            const hasBeenEdited = lastEditTime !== null;
            const lastEditDate = lastEditTime ? new Date(lastEditTime) : null;

            return (
              <ContextMenu key={mod.id}>
                <ContextMenuTrigger className="w-full">

                  <Card className="overflow-hidden border-border bg-card/50">
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
                            <div className="flex items-start gap-1.5 mb-1 flex-wrap">
                              <h3 className="font-semibold text-sm break-words leading-tight">
                                {splitCamelCase(mod.name)}
                              </h3>

                              {/* CATEGORY BADGE */}
                              {modCategories[mod.id] && (
                                <Badge
                                  className={`${getCategoryBgColor(
                                    modCategories[mod.id]
                                  )} text-white border-0 text-[10px] px-1.5 py-0 h-4 shrink-0`}
                                >
                                  {modCategories[mod.id]}
                                </Badge>
                              )}

                              {/* EDITED BADGE */}
                              {hasBeenEdited && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 h-4 bg-success/20 text-success border-success/30 shrink-0"
                                >
                                  Edited
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                              <span>v{mod.version}</span>
                              <span>•</span>
                              <span>{mod.configCount} config{mod.configCount !== 1 ? "s" : ""}</span>

                              {hasBeenEdited && (
                                <>
                                  <span>•</span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Clock className="h-3 w-3" />
                                    <span className="whitespace-nowrap">
                                      {formatDistanceToNow(lastEditDate!, { addSuffix: true })}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {mod.metadata && (
                            <ModMetadataViewer metadata={mod.metadata} modName={mod.name} />
                          )}
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
                </ContextMenuTrigger>

                {/* ✅ CONTEXT MENU */}
                <ContextMenuContent className="w-48">
                  <ContextMenuItem onClick={() => onSelectMod(mod.id, 0)}>
                    📄 Open Config
                  </ContextMenuItem>

                  <ContextMenuItem onClick={() => onCategoryAssign?.(mod.id)}>
                    ➕ Add to Category
                  </ContextMenuItem>

                  <ContextMenuSeparator />

                  <ContextMenuItem onClick={() => onToggleFavorite(mod.id)}>
                    ⭐ {favoritedModIds.has(mod.id) ? "Unfavorite" : "Favorite"}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
