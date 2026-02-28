import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronRight, Star, Clock, FileJson, Folder } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { splitCamelCase, cn } from "@/lib/utils";
import { ModEditHistory, getModEditTime } from "@/utils/editTracking";
import { getCategoryBgColor } from "@/utils/categoryDefinitions";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface Mod {
  id: string;
  name: string;
  version: string;
  configCount: number;
  category?: string;
  categories?: string[];
  author?: string;
  description?: string;
}

export interface ConfigFile {
  fileName: string;
  index: number;
  filePath?: string;
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
  searchInputRef,
  modCategories = {},
  onCategoryAssign,
}: ModListProps) => {
  const [expandedMods, setExpandedMods] = useState<Record<string, boolean>>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const toggleMod = (modId: string) => {
    setExpandedMods((prev) => ({
      ...prev,
      [modId]: !prev[modId],
    }));
  };

  const toggleFolder = (modId: string, folderName: string) => {
    const key = `${modId}:${folderName}`;
    setExpandedFolders((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const filteredMods = mods.filter((mod) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      mod.name.toLowerCase().includes(query) ||
      mod.id.toLowerCase().includes(query) ||
      mod.author?.toLowerCase().includes(query)
    );
  });

  // Group files by folder for a nested view
  const groupedFiles = useMemo(() => {
    const groups: Record<string, { root: ConfigFile[]; folders: Record<string, ConfigFile[]> }> = {};
    
    Object.entries(configFiles).forEach(([modId, files]) => {
      const modGroup: { root: ConfigFile[]; folders: Record<string, ConfigFile[]> } = {
        root: [],
        folders: {}
      };

      files.forEach(file => {
        const parts = file.fileName.split(/[\\/]/);
        if (parts.length === 1) {
          modGroup.root.push(file);
        } else {
          const folderName = parts[0];
          if (!modGroup.folders[folderName]) {
            modGroup.folders[folderName] = [];
          }
          modGroup.folders[folderName].push(file);
        }
      });
      
      groups[modId] = modGroup;
    });
    
    return groups;
  }, [configFiles]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="p-4 border-b border-border shrink-0">
        <Input
          ref={searchInputRef}
          placeholder="Search mods... (Ctrl+F)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-muted/50 border-border h-10 text-sm focus-visible:ring-primary/30"
        />
      </div>

      <ScrollArea className="flex-1 no-scrollbar">
        <div className="flex flex-col gap-2.5 py-4 px-4">
          {filteredMods.map((mod) => {
            const lastEditTime = getModEditTime(mod.id);
            const isSelectedMod = selectedModId === mod.id;
            const isExpanded = !!expandedMods[mod.id];
            const isFavorited = favoritedModIds.has(mod.id);
            const modGroup = groupedFiles[mod.id] || { root: [], folders: {} };

            return (
              <ContextMenu key={mod.id}>
                <div className="relative group w-full max-w-full">
                  <ContextMenuTrigger>
                    <Card 
                      className={cn(
                        "relative transition-all duration-200 border-border overflow-hidden w-full max-w-full",
                        "mx-0",
                        isSelectedMod 
                          ? "ring-2 ring-primary bg-accent/30 shadow-md" 
                          : "bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-sm",
                        isExpanded && "pb-2"
                      )}
                    >
                      {/* Mod Header Row */}
                      <div 
                        className="flex items-center gap-2 p-2 cursor-pointer select-none min-w-0"
                        onClick={() => toggleMod(mod.id)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(mod.id);
                          }}
                          className="shrink-0 transition-transform active:scale-125 focus:outline-none self-start mt-1"
                        >
                          <Star
                            className={cn(
                              "h-4 w-4 transition-colors",
                              isFavorited
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/30 group-hover:text-muted-foreground/60"
                            )}
                          />
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-1.5 mb-0.5">
                            <span className="font-bold text-sm text-foreground whitespace-normal break-all leading-tight">
                              {splitCamelCase(mod.name)}
                            </span>
                            {modCategories[mod.id] && (
                              <Badge
                                className={cn(
                                  getCategoryBgColor(modCategories[mod.id]),
                                  "text-white border-0 text-[9px] px-1 py-0 h-3.5 uppercase tracking-wider font-black shrink-0 mt-0.5"
                                )}
                              >
                                {modCategories[mod.id]}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0 self-center">
                          {lastEditTime && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Clock className="h-3 w-3 text-primary/60 cursor-default" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Recently edited</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <ChevronRight 
                            className={cn(
                              "h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-300",
                              isExpanded && "rotate-90 text-primary"
                            )} 
                          />
                        </div>
                      </div>

                      {/* Nested Content */}
                      {isExpanded && (
                        <div className="px-1.5 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="mx-2 h-px bg-border/50 mb-1.5" />
                          
                          {modGroup.root.map((cfg) => (
                            <ConfigButton 
                              key={cfg.index}
                              cfg={cfg} 
                              isSelected={isSelectedMod && selectedConfigIndex === cfg.index} 
                              onClick={() => onSelectMod(mod.id, cfg.index)} 
                            />
                          ))}

                          {Object.entries(modGroup.folders).map(([folderName, files]) => {
                            const folderKey = `${mod.id}:${folderName}`;
                            const isFolderExpanded = !!expandedFolders[folderKey];
                            
                            return (
                              <div key={folderName} className="space-y-0.5">
                                <button
                                  onClick={() => toggleFolder(mod.id, folderName)}
                                  className="flex items-center gap-2 w-full text-left px-2 py-1 rounded-md text-[11px] hover:bg-accent/30 text-muted-foreground/80 transition-colors"
                                >
                                  <ChevronRight className={cn(
                                    "h-3 w-3 transition-transform",
                                    isFolderExpanded && "rotate-90"
                                  )} />
                                  <Folder className="h-3 w-3 text-primary/40" />
                                  <span className="font-medium truncate">{folderName}</span>
                                  <Badge variant="outline" className="ml-auto text-[9px] h-3.5 px-1 opacity-50">{files.length}</Badge>
                                </button>
                                
                                {isFolderExpanded && (
                                  <div className="pl-4 space-y-0.5">
                                    {files.map((cfg) => (
                                      <ConfigButton 
                                        key={cfg.index}
                                        cfg={cfg} 
                                        isSelected={isSelectedMod && selectedConfigIndex === cfg.index} 
                                        onClick={() => onSelectMod(mod.id, cfg.index)} 
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  </ContextMenuTrigger>

                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => onSelectMod(mod.id, 0)} className="gap-2">
                      <FileJson className="w-4 h-4" /> Open Primary Config
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => onCategoryAssign?.(mod.id)} className="gap-2">
                      <Badge className="w-4 h-4 p-0 rounded-full bg-primary" /> Assign Category
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => onToggleFavorite(mod.id)} className="gap-2">
                      <Star className={cn("w-4 h-4", isFavorited && "fill-yellow-400 text-yellow-400")} />
                      {isFavorited ? "Remove from Favorites" : "Add to Favorites"}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </div>
              </ContextMenu>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

const ConfigButton = ({ cfg, isSelected, onClick }: { cfg: ConfigFile; isSelected: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-md text-[11px] transition-colors",
      isSelected
        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
        : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
    )}
  >
    <FileJson className={cn(
      "h-3 w-3 shrink-0",
      isSelected ? "text-primary-foreground" : "text-muted-foreground/50"
    )} />
    <span className="block truncate">{cfg.fileName.split(/[\\/]/).pop()}</span>
  </button>
);