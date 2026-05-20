import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronRight, Star, Clock, FileJson, Folder, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { splitCamelCase, cn } from "@/lib/utils";
import { ModEditHistory, getModEditTime } from "@/utils/editTracking";
import { ModMetadataViewer, ModMetadata } from "@/components/ModMetadataViewer";
import { getCategoryBgColor } from "@/utils/categoryDefinitions";
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
  filePath?: string;
}

interface ModListProps {
  mods: Mod[];
  configFiles: Record<string, ConfigFile[]>;
  configErrorIndicesByMod?: Record<string, number[]>;
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
  configErrorIndicesByMod = {},
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
        // Handle both / and \ separators
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

  const filteredFavoriteCount = filteredMods.filter((mod) => favoritedModIds.has(mod.id)).length;
  const totalConfigCount = filteredMods.reduce((sum, mod) => sum + (configFiles[mod.id]?.length ?? 0), 0);

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 min-w-0 overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border/70 bg-[linear-gradient(180deg,rgba(59,130,246,0.08)_0%,rgba(59,130,246,0)_100%)] px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search mods, IDs, or author (Ctrl+F)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 border-border/80 bg-background/85 pl-9 pr-9 text-sm shadow-sm focus-visible:ring-primary/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          <Badge variant="secondary" className="h-5 rounded-md px-2 text-[10px] font-semibold">
            {filteredMods.length} mod{filteredMods.length === 1 ? "" : "s"}
          </Badge>
          <Badge variant="secondary" className="h-5 rounded-md px-2 text-[10px] font-semibold">
            {totalConfigCount} config{totalConfigCount === 1 ? "" : "s"}
          </Badge>
          <Badge variant="secondary" className="h-5 rounded-md px-2 text-[10px] font-semibold">
            {filteredFavoriteCount} favorite{filteredFavoriteCount === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden no-scrollbar">
        <div className="flex w-full flex-col gap-2 px-2 py-2">
          {filteredMods.length === 0 && (
            <Card className="border-dashed border-border/70 bg-muted/30 p-4 text-center">
              <p className="text-sm font-semibold text-foreground">No mods match this search</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a different name, ID, or author.</p>
            </Card>
          )}

          {filteredMods.map((mod) => {
            const lastEditTime = getModEditTime(mod.id);
            const isSelectedMod = selectedModId === mod.id;
            const isExpanded = !!expandedMods[mod.id];
            const isFavorited = favoritedModIds.has(mod.id);
            const errorIndices = new Set(configErrorIndicesByMod[mod.id] || []);
            const hasErrorInMod = errorIndices.size > 0;
            const modGroup = groupedFiles[mod.id] || { root: [], folders: {} };

            return (
              <ContextMenu key={mod.id}>
                <div className="relative group w-full max-w-full">
                  <ContextMenuTrigger>
                    <Card 
                      className={cn(
                        "relative h-auto w-full max-w-full overflow-hidden border transition-all duration-200",
                        hasErrorInMod
                          ? "border-red-500/60 bg-red-500/15 shadow-[0_0_0_1px_rgba(239,68,68,0.45)]"
                          : isSelectedMod 
                          ? "border-blue-400/65 bg-blue-500/15 shadow-[0_0_0_1px_rgba(96,165,250,0.55)]" 
                          : "border-border/70 bg-card/50 hover:border-primary/35 hover:bg-card/85",
                        isExpanded && "pb-1"
                      )}
                    >
                      {/* Mod Header Row */}
                      <div 
                        className="flex min-w-0 cursor-pointer select-none items-center gap-2 p-2"
                        onClick={() => toggleMod(mod.id)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(mod.id);
                          }}
                          className="mt-1 shrink-0 rounded-sm p-0.5 transition-transform active:scale-125 focus:outline-none"
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
                          <div className="mb-0.5 flex items-start gap-1.5">
                            <span className="whitespace-normal break-words text-sm font-semibold leading-tight text-foreground">
                              {splitCamelCase(mod.name)}
                            </span>
                            {modCategories[mod.id] && (
                              <Badge
                                className={cn(
                                  getCategoryBgColor(modCategories[mod.id]),
                                  "mt-0.5 h-3.5 shrink-0 border-0 px-1 py-0 text-[9px] font-black uppercase tracking-wider text-white"
                                )}
                              >
                                {modCategories[mod.id]}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="font-mono opacity-80 shrink-0">v{mod.version}</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/30 shrink-0" />
                            <span className="block truncate">by {mod.author || "Unknown"}</span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-0.5 self-center">
                          {lastEditTime && (
                            <Clock className="h-3 w-3 text-primary/60" />
                          )}
                          {mod.metadata && (
                            <ModMetadataViewer metadata={mod.metadata} modName={mod.name} />
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
                        <div className="animate-in slide-in-from-top-1 fade-in space-y-0.5 px-1 duration-200">
                          <div className="mx-2 mb-1 h-px bg-border/60" />
                          
                          {/* Files in the mod root */}
                          {modGroup.root.map((cfg) => (
                            <ConfigButton 
                              key={cfg.index}
                              cfg={cfg} 
                              hasError={errorIndices.has(cfg.index)}
                              isSelected={isSelectedMod && selectedConfigIndex === cfg.index} 
                              onClick={() => onSelectMod(mod.id, cfg.index)} 
                            />
                          ))}

                          {/* Subfolders */}
                          {Object.entries(modGroup.folders).map(([folderName, files]) => {
                            const folderKey = `${mod.id}:${folderName}`;
                            const isFolderExpanded = !!expandedFolders[folderKey];
                            
                            return (
                              <div key={folderName} className="space-y-0.5">
                                <button
                                  onClick={() => toggleFolder(mod.id, folderName)}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-0.5 text-left text-[11px] text-foreground/80 transition-colors hover:bg-blue-500/10 hover:text-foreground"
                                >
                                  <ChevronRight className={cn(
                                    "h-3 w-3 transition-transform",
                                    isFolderExpanded && "rotate-90"
                                  )} />
                                  <Folder className="h-3 w-3 text-primary/40" />
                                  <span className="font-medium truncate">{folderName}</span>
                                  <Badge variant="outline" className="ml-auto h-4 px-1 text-[9px] opacity-50">{files.length}</Badge>
                                </button>
                                
                                {isFolderExpanded && (
                                  <div className="space-y-0.5 pl-3">
                                    {files.map((cfg) => (
                                      <ConfigButton 
                                        key={cfg.index}
                                        cfg={cfg} 
                                        hasError={errorIndices.has(cfg.index)}
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
      </div>
    </div>
  );
};

/**
 * Sub-component for individual config file buttons to maintain styling
 */
const ConfigButton = ({ cfg, isSelected, hasError, onClick }: { cfg: ConfigFile; isSelected: boolean; hasError?: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-md text-[11px] transition-colors border",
      hasError
        ? isSelected
          ? "bg-red-600 text-white font-semibold shadow-sm border-red-500"
          : "bg-red-500/10 text-red-200 border-red-500/40 hover:bg-red-500/20"
        : isSelected
          ? "bg-blue-500/90 text-white font-semibold shadow-sm border-blue-500/70"
          : "border-transparent hover:bg-blue-500/10 text-foreground/85 hover:text-foreground"
    )}
  >
    <FileJson className={cn(
      "h-3 w-3 shrink-0",
      hasError ? "text-red-300" : isSelected ? "text-white" : "text-foreground/55"
    )} />
    <span className="block truncate">{cfg.fileName.split(/[\\/]/).pop()}</span>
  </button>
);