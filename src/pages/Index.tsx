import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { PathSelector } from "@/components/PathSelector";
import { ModList, Mod, ConfigFile } from "@/components/ModList";
import { ConfigEditor } from "@/components/ConfigEditor";
import { SPTControlPanel } from "@/components/SPTControlPanel";
import { ConfigValue } from "@/utils/configHelpers";
import { CategoryBrowser } from "@/components/CategoryBrowser";
import { ConfigValidationSummary } from "@/components/ConfigValidationSummary";
import { CategoryDialog } from "@/components/CategoryDialog";
import { scanSPTFolderElectron, ElectronScannedMod, saveConfigToFileElectron } from "@/utils/electronFolderScanner";
import { exportModsAsZip } from "@/utils/exportMods";
import { saveEditHistory, getEditHistory, getModEditTime } from "@/utils/editTracking";
import { 
  loadCategories, 
  assignModToCategory, 
  removeModFromCategory,
  getModCategory
} from "@/utils/categoryStorage";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Package, Download, Upload, Trash2, FolderOpen, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const Index = () => {
  const [sptPath, setSptPath] = useState<string | null>(null);
  const [rawSptPath, setRawSptPath] = useState<string | null>(null);
  const [selectedModId, setSelectedModId] = useState<string | null>(null);
  const [scannedMods, setScannedMods] = useState<ElectronScannedMod[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [openConfigIndices, setOpenConfigIndices] = useState<number[]>([0]);
  const [activeConfigIndex, setActiveConfigIndex] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingModSwitch, setPendingModSwitch] = useState<{ modId: string; configIndex: number } | null>(null);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipCurrentFile, setZipCurrentFile] = useState<string | undefined>(undefined);
  const [zipStartTime, setZipStartTime] = useState<number | null>(null);
  const [showZipProgress, setShowZipProgress] = useState(false);
  const [editedModIds, setEditedModIds] = useState<Set<string>>(new Set());
  const [showZipDialog, setShowZipDialog] = useState(false);
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [favoritedModIds, setFavoritedModIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("spt-favorites");
      const arr = saved ? JSON.parse(saved) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.warn("Invalid favorites data in localStorage; resetting.", e);
      localStorage.removeItem("spt-favorites");
      return new Set();
    }
  });
  const [activeTab, setActiveTab] = useState<"mods" | "favorites" | "recent">("mods");
  const [modCategories, setModCategories] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryBrowser, setShowCategoryBrowser] = useState(false);
  const [showValidationSummary, setShowValidationSummary] = useState(false);
  const [categoryTargetModId, setCategoryTargetModId] = useState<string | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const saveConfigRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const remember = JSON.parse(localStorage.getItem("rememberLastSession") || "false");
    const lastSession = localStorage.getItem("lastSession");

    if (remember && lastSession && sptPath) {
      try {
        const { modId, configFile } = JSON.parse(lastSession);
        const mod = scannedMods.find(m => m.mod.id === modId);
        if (mod) {
          const configIndex = mod.configs.findIndex(c => c.fileName === configFile);
          if (configIndex >= 0) {
            setSelectedModId(modId);
            setOpenConfigIndices([configIndex]);
            setActiveConfigIndex(configIndex);
          }
        }
      } catch (e) {
        console.error("Failed to restore last session:", e);
      }
    }
  }, [sptPath, scannedMods]);

  useEffect(() => {
    loadCategories().then(categories => {
      setModCategories(categories);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem("spt-favorites", JSON.stringify(Array.from(favoritedModIds)));
  }, [favoritedModIds]);

  useKeyboardShortcuts({
    onSave: () => {
      if (hasUnsavedChanges && saveConfigRef.current) {
        saveConfigRef.current();
        toast.success("Saved via keyboard shortcut");
      }
    },
    onSearch: () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    }
  });

  const mods = useMemo(() => {
    return scannedMods.map(sm => sm.mod);
  }, [scannedMods]);

  const editHistory = getEditHistory();
  const recentlyEditedModIds = [...new Set(editHistory.map(h => h.modId))];

  const filteredModsByCategory = useMemo(() => {
    let result = mods;
    if (selectedCategory) {
      result = result.filter(m => getModCategory(m.id, modCategories) === selectedCategory);
    }
    return result;
  }, [mods, selectedCategory, modCategories]);

  const recentlyEditedMods = mods
    .filter(m => recentlyEditedModIds.includes(m.id))
    .filter(m => !selectedCategory || getModCategory(m.id, modCategories) === selectedCategory)
    .sort((a, b) => {
      const aTime = getModEditTime(a.id) || 0;
      const bTime = getModEditTime(b.id) || 0;
      return bTime - aTime;
    });

  const handleFolderSelected = async (folderPath: string) => {
    setIsScanning(true);
    try {
      localStorage.setItem('lastSPTFolder', folderPath);
      const mods = await scanSPTFolderElectron(folderPath);
      const pathName = folderPath.split(/[/\\]/).pop() || folderPath;
      
      if (mods.length === 0) {
        toast.warning("No mods found", {
          description: "No compatible mod configs were found in the user/mods directory"
        });
        return;
      }

      setScannedMods(mods);
      setSptPath(pathName);
      setRawSptPath(folderPath);
      
      if (mods.length > 0) {
        setSelectedModId(mods[0].mod.id);
        setOpenConfigIndices([0]);
        setActiveConfigIndex(0);
      }

      toast.success(`Found ${mods.length} mod(s)`, {
        description: `${mods.reduce((sum, m) => sum + m.configs.length, 0)} config files detected`
      });
    } catch (error: any) {
      toast.error("Scan failed", {
        description: error.message || "Could not scan the folder structure"
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectMod = (modId: string, configIndex: number) => {
    const targetMod = scannedMods.find(m => m.mod.id === modId);
    if (!targetMod) return;
    if (!targetMod.configs || targetMod.configs.length === 0) return;
    
    const safeConfigIndex = Math.max(0, Math.min(configIndex, targetMod.configs.length - 1));
    
    if (hasUnsavedChanges && selectedModId !== modId) {
      setPendingModSwitch({ modId, configIndex: safeConfigIndex });
    } else {
      setSelectedModId(modId);
      if (selectedModId !== modId) {
        // Switching mod: reset tabs to the selected file
        setOpenConfigIndices([safeConfigIndex]);
        setActiveConfigIndex(safeConfigIndex);
      } else {
        // Same mod: add to tabs if not present
        setOpenConfigIndices(prev => 
          prev.includes(safeConfigIndex) ? prev : [...prev, safeConfigIndex]
        );
        setActiveConfigIndex(safeConfigIndex);
      }
      setHasUnsavedChanges(false);
      if (isMobile) setIsSidebarOpen(false);
    }
  };

  const handleCloseTab = (index: number) => {
    if (openConfigIndices.length <= 1) return;
    
    const newIndices = openConfigIndices.filter(i => i !== index);
    setOpenConfigIndices(newIndices);
    
    if (activeConfigIndex === index) {
      setActiveConfigIndex(newIndices[0]);
    }
  };

  const handleDiscardAndSwitch = () => {
    if (pendingModSwitch) {
      setSelectedModId(pendingModSwitch.modId);
      setOpenConfigIndices([pendingModSwitch.configIndex]);
      setActiveConfigIndex(pendingModSwitch.configIndex);
      setHasUnsavedChanges(false);
      setPendingModSwitch(null);
      if (isMobile) setIsSidebarOpen(false);
    }
  };

  const handleSaveAndSwitch = async () => {
    if (pendingModSwitch && saveConfigRef.current) {
      await saveConfigRef.current();
      setSelectedModId(pendingModSwitch.modId);
      setOpenConfigIndices([pendingModSwitch.configIndex]);
      setActiveConfigIndex(pendingModSwitch.configIndex);
      setHasUnsavedChanges(false);
      setPendingModSwitch(null);
      if (isMobile) setIsSidebarOpen(false);
    }
  };

  const handleSaveConfig = useCallback(async (values: ConfigValue[]) => {
    if (scannedMods.length === 0) {
      setHasUnsavedChanges(false);
      return;
    }

    const selectedMod = scannedMods.find(m => m.mod.id === selectedModId);
    if (!selectedMod) return;

    const config = selectedMod.configs[activeConfigIndex];
    if (!config) return;

    try {
      await saveConfigToFileElectron(
        (config as any).filePath,
        values,
        config.rawJson
      );

      setHasUnsavedChanges(false);
      if (selectedModId) {
        setEditedModIds((prev) => {
          const next = new Set(prev);
          next.add(selectedModId);
          return next;
        });
        saveEditHistory(selectedModId, config.fileName);
      }

      toast.success("Config saved", {
        description: "Changes have been saved successfully"
      });
    } catch (error: any) {
      toast.error("Save failed", {
        description: error.message || "Could not save the config file"
      });
      throw error;
    }
  }, [scannedMods, selectedModId, activeConfigIndex]);

  const configFilesMap = useMemo(() => {
    const map: Record<string, ConfigFile[]> = {};
    for (const mod of scannedMods) {
      map[mod.mod.id] = mod.configs;
    }
    return map;
  }, [scannedMods]);

  const handleExportMods = () => {
    const modsToExport = scannedMods.filter((m) => editedModIds.has(m.mod.id));
    if (modsToExport.length === 0) {
      toast.info("No edited mods to export", {
        description: "Make some changes and save before exporting.",
      });
      return;
    }
    setShowZipDialog(true);
  };

  const handleExportVersion = async (isFourOhStyle: boolean) => {
    setShowZipProgress(true);
    setZipStartTime(Date.now());
    try {
      const modsToExport = scannedMods.filter((m) => editedModIds.has(m.mod.id));
      await exportModsAsZip(
        modsToExport,
        isFourOhStyle,
        (percent, currentFile) => {
          setZipProgress(percent);
          setZipCurrentFile(currentFile);
        }
      );
      toast.success("Export complete");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export ZIP");
    } finally {
      setShowZipProgress(false);
      setZipProgress(0);
      setZipCurrentFile(undefined);
    }
    setShowZipDialog(false);
  };

  const handleToggleFavorite = (modId: string) => {
    setFavoritedModIds(prev => {
      const newSet = new Set(prev);
      const modName = scannedMods.find(m => m.mod.id === modId)?.mod.name || modId;
      if (newSet.has(modId)) {
        newSet.delete(modId);
        toast.info("Removed from Favorites", { description: `${modName} removed from favorites` });
      } else {
        newSet.add(modId);
        toast.success("Added to Favorites", { description: `${modName} added to favorites` });
      }
      return newSet;
    });
  };

  const handleClearFavorites = () => {
    setFavoritedModIds(new Set());
    toast.success("All favorites cleared");
  };

  const handleHome = () => {
    if (hasUnsavedChanges) {
      setShowHomeConfirm(true);
    } else {
      handleGoHome();
    }
  };

  const handleGoHome = () => {
    setSptPath(null);
    setRawSptPath(null);
    setScannedMods([]);
    setSelectedModId(null);
    setOpenConfigIndices([0]);
    setActiveConfigIndex(0);
    setHasUnsavedChanges(false);
    setShowHomeConfirm(false);
    setEditedModIds(new Set());
    toast.info("Returned to home", { description: "Returning to folder selection" });
  };

  const handleExportFavorites = () => {
    const favoritesData = {
      version: "1.0",
      favorites: Array.from(favoritedModIds),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(favoritesData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `spt-favorites-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Favorites exported", { description: "Favorites list downloaded as JSON" });
  };

  const handleImportFavorites = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: any) => {
      try {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.favorites && Array.isArray(data.favorites)) {
          setFavoritedModIds(new Set(data.favorites));
          toast.success("Favorites imported", { description: `${data.favorites.length} favorites loaded` });
        } else {
          throw new Error("Invalid favorites file format");
        }
      } catch (error: any) {
        toast.error("Import failed", { description: error.message || "Could not read favorites file" });
      }
    };
    input.click();
  };

  const handleLoadLastFolder = async () => {
    const lastFolder = localStorage.getItem("lastSPTFolder");
    if (!lastFolder) {
      toast.error("No previous folder found");
      return;
    }
    await handleFolderSelected(lastFolder);
  };

  const handleCategoryChange = async (category: string | null) => {
    if (!selectedModId) return;
    if (category) {
      const updated = await assignModToCategory(selectedModId, category, modCategories);
      setModCategories(updated);
    } else {
      const updated = await removeModFromCategory(selectedModId, modCategories);
      setModCategories(updated);
    }
  };

  const handleChangesDetected = useCallback((has: boolean) => {
    setHasUnsavedChanges(has);
    if (has && selectedModId) {
      setEditedModIds((prev) => {
        const next = new Set(prev);
        next.add(selectedModId);
        return next;
      });
    }
  }, [selectedModId]);

  if (!sptPath) {
    return (
      <PathSelector 
        onFolderSelected={handleFolderSelected}
        onLoadLastFolder={handleLoadLastFolder}
      />
    );
  }

  const selectedScannedMod = scannedMods.find(m => m.mod.id === selectedModId);
  const selectedMod = selectedScannedMod ? selectedScannedMod.mod : null;

  let selectedConfig = null;
  const openConfigs = selectedScannedMod 
    ? openConfigIndices.map(idx => selectedScannedMod.configs[idx]).filter(Boolean)
    : [];

  if (selectedScannedMod && selectedScannedMod.configs && selectedScannedMod.configs.length > 0) {
    const safeIndex = Math.max(0, Math.min(activeConfigIndex, selectedScannedMod.configs.length - 1));
    selectedConfig = selectedScannedMod.configs[safeIndex];
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {rawSptPath && (
        <SPTControlPanel 
          sptPath={rawSptPath} 
        />
      )}

      <div className="border-b border-border px-3 pt-3 pb-2 shrink-0">
        <div className="flex gap-1 mb-1.5">
          <Button
            variant={activeTab === "mods" ? "default" : "ghost"}
            onClick={() => setActiveTab("mods")}
            className="flex-1 h-8 text-[10px] sm:text-xs px-1"
          >
            Mods ({mods.filter(m => !favoritedModIds.has(m.id)).length})
          </Button>
          <Button
            variant={activeTab === "favorites" ? "default" : "ghost"}
            onClick={() => setActiveTab("favorites")}
            className="flex-1 h-8 text-[10px] sm:text-xs px-1"
          >
            Favs ({favoritedModIds.size})
          </Button>
          <Button
            variant={activeTab === "recent" ? "default" : "ghost"}
            onClick={() => setActiveTab("recent")}
            className="flex-1 h-8 text-[10px] sm:text-xs px-1"
            title="Recently Edited"
          >
            Recent
          </Button>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCategoryBrowser(true)}
          className="w-full h-8 text-xs flex items-center gap-2 justify-start"
        >
          <FolderOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Categories</span>
          <span className="sm:hidden">Cats</span>
          {selectedCategory && (
            <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[60px]">
              ({selectedCategory})
            </span>
          )}
        </Button>
        {activeTab === "favorites" && favoritedModIds.size > 0 && (
          <div className="flex gap-1 mt-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportFavorites}
              className="flex-1 h-7 text-[10px] px-1"
              title="Export favorites list"
            >
              <Download className="w-3 h-3 mr-1" />
              Exp
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleImportFavorites}
              className="flex-1 h-7 text-[10px] px-1"
              title="Import favorites list"
            >
              <Upload className="w-3 h-3 mr-1" />
              Imp
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFavorites}
              className="flex-1 h-7 text-[10px] px-1"
              title="Clear all favorites"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clr
            </Button>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-hidden">
        <ModList
          mods={
            activeTab === "favorites"
              ? filteredModsByCategory.filter(m => favoritedModIds.has(m.id))
              : activeTab === "recent"
              ? recentlyEditedMods
              : selectedCategory
              ? filteredModsByCategory
              : filteredModsByCategory.filter(m => !favoritedModIds.has(m.id))
          }
          configFiles={configFilesMap}
          selectedModId={selectedModId}
          selectedConfigIndex={activeConfigIndex}
          onSelectMod={handleSelectMod}
          favoritedModIds={favoritedModIds}
          onToggleFavorite={handleToggleFavorite}
          editHistory={editHistory}
          searchInputRef={searchInputRef}
          modCategories={modCategories}
          onCategoryAssign={(modId) => setCategoryTargetModId(modId)} 
        /> 
      </div>
    </div>
  );

  return (
    <>
      <div className="flex w-full h-screen overflow-hidden relative bg-background">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="w-64 lg:w-72 border-r border-border bg-card flex flex-col h-full shrink-0">
            {sidebarContent}
          </div>
        )}

        {/* Mobile Sidebar Trigger (Floating) */}
        {isMobile && (
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="fixed bottom-4 right-4 z-50 rounded-full h-12 w-12 shadow-lg bg-primary text-primary-foreground border-none"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px] border-r border-border">
              {sidebarContent}
            </SheetContent>
          </Sheet>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          {selectedMod && selectedModId && selectedConfig ? (
            <ConfigEditor
              modName={selectedMod.name}
              configFile={selectedConfig?.filePath || ""}
              activeConfigIndex={activeConfigIndex}
              openConfigIndices={openConfigIndices}
              allConfigs={selectedScannedMod.configs}
              onSelectTab={(idx) => { setActiveConfigIndex(idx); }}
              onCloseTab={handleCloseTab}
              rawJson={selectedConfig?.rawJson}
              modId={selectedModId}
              onSave={handleSaveConfig}
              sptPath={sptPath}
              onChangesDetected={handleChangesDetected}
              onExportMods={scannedMods.length > 0 ? handleExportMods : undefined}
              onHome={handleHome}
              saveConfigRef={saveConfigRef}
              currentCategory={getModCategory(selectedModId, modCategories)}
              onCategoryChange={handleCategoryChange}
            />
          ) : selectedMod && selectedModId ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center text-muted-foreground space-y-4 max-w-sm">
                <Package className="w-16 h-16 mx-auto opacity-20" />
                <h3 className="text-lg font-semibold">No configuration files found</h3>
                <p className="text-sm">This mod doesn't have any editable config files detected by the scanner.</p>
                {isMobile && (
                  <Button onClick={() => setIsSidebarOpen(true)} variant="outline" className="w-full">
                    Open Mod List
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">Select a mod from the list to begin editing</p>
                {isMobile && (
                  <Button onClick={() => setIsSidebarOpen(true)} className="w-full">
                    Browse Mods
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs and Overlays */}
      {categoryTargetModId && (
        <CategoryDialog
          modId={categoryTargetModId}
          modName={mods.find((m) => m.id === categoryTargetModId)?.name || ""}
          currentCategory={modCategories[categoryTargetModId] ?? null}
          open={true}
          onOpenChange={() => setCategoryTargetModId(null)}
          onCategoryAssigned={async (category) => {
            if (!categoryTargetModId) return;
            let updatedMap;
            if (category) {
              updatedMap = await assignModToCategory(categoryTargetModId, category, modCategories);
            } else {
              updatedMap = await removeModFromCategory(categoryTargetModId, modCategories);
            }
            setModCategories(updatedMap);
            setCategoryTargetModId(null);
          }}
        />
      )}

      <ConfigValidationSummary
        open={showValidationSummary}
        onOpenChange={setShowValidationSummary}
        scannedMods={scannedMods.map(sm => ({
          mod: sm.mod,
          configs: sm.configs.map(c => ({
            fileName: c.fileName,
            content: c.rawJson
          }))
        }))}
        onNavigateToConfig={(modId, configIndex) => {
          setSelectedModId(modId);
          setOpenConfigIndices([configIndex]);
          setActiveConfigIndex(configIndex);
          setShowValidationSummary(false);
        }}
      />

      <AlertDialog open={pendingModSwitch !== null} onOpenChange={(open) => !open && setPendingModSwitch(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to save them before switching to another mod?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setPendingModSwitch(null)} className="mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardAndSwitch} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard Changes
            </AlertDialogAction>
            <AlertDialogAction onClick={handleSaveAndSwitch}>
              Save and Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showHomeConfirm} onOpenChange={setShowHomeConfirm}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Config Editor?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to return to the home screen? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleGoHome} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard & Go Home
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showZipProgress} onOpenChange={(open) => !open && setShowZipProgress(false)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Creating ZIP...</AlertDialogTitle>
            <AlertDialogDescription className="truncate">
              {zipCurrentFile ? `Compressing: ${zipCurrentFile}` : "Preparing files..."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Progress value={zipProgress} />
            <p className="text-xs text-muted-foreground">
              {`${zipProgress.toFixed(0)}%`}
              {zipStartTime && zipProgress > 0
                ? ` • ~${Math.max(
                    1,
                    Math.round(((Date.now() - zipStartTime) / 1000) * (100 - zipProgress) / zipProgress),
                  )}s remaining`
                : ""}
            </p>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showZipDialog} onOpenChange={setShowZipDialog}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Package Edited Mods</AlertDialogTitle>
            <AlertDialogDescription>
              Choose the directory layout to use when packaging your mods:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Button
              onClick={() => handleExportVersion(false)}
              className="w-full h-14 text-base sm:text-lg bg-blue-600 hover:bg-blue-700 text-white flex flex-col h-auto py-2"
            >
              <span>Export for SPT 3.11.X</span>
              <span className="text-[10px] opacity-80">(user/mods)</span>
            </Button>
            <Button
              onClick={() => handleExportVersion(true)}
              className="w-full h-14 text-base sm:text-lg bg-purple-600 hover:bg-purple-700 text-white flex flex-col h-auto py-2"
            >
              <span>Export for SPT 4.0.X</span>
              <span className="text-[10px] opacity-80">(SPT/user/mods)</span>
            </Button>
            <AlertDialogCancel className="mt-2">Cancel</AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <CategoryBrowser
        open={showCategoryBrowser}
        onOpenChange={setShowCategoryBrowser}
        categories={modCategories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        mods={mods}
      />
    </>
  );
};

export default Index;