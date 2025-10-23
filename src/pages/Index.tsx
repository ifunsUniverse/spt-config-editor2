import { useState, useEffect, useRef, useMemo } from "react";
import { PathSelector } from "@/components/PathSelector";
import { ModList, Mod, ConfigFile } from "@/components/ModList";
import { ConfigEditor, ConfigValue } from "@/components/ConfigEditor";
import { CategoryBrowser } from "@/components/CategoryBrowser";
import { ConfigValidationSummary } from "@/components/ConfigValidationSummary";
import { ThemeToggle } from "@/components/ThemeToggle";
import { scanSPTFolder, ScannedMod, saveConfigToFile } from "@/utils/folderScanner";
import { scanSPTFolderElectron, ElectronScannedMod, saveConfigToFileElectron } from "@/utils/electronFolderScanner";
import { exportModsAsZip, downloadZipFromUrl } from "@/utils/exportMods";
import { saveEditHistory, getEditHistory, getModEditTime } from "@/utils/editTracking";
import { 
  loadCategories, 
  assignModToCategory, 
  removeModFromCategory,
  getModCategory
} from "@/utils/categoryStorage";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { toast } from "sonner";
import { Loader2, Package, Download, Upload, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isElectron } from "@/utils/electronBridge";
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

const Index = () => {
  const [sptPath, setSptPath] = useState<string | null>(null);
  const [selectedModId, setSelectedModId] = useState<string | null>(null);
  const [scannedMods, setScannedMods] = useState<ScannedMod[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedConfigIndex, setSelectedConfigIndex] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingModSwitch, setPendingModSwitch] = useState<{ modId: string; configIndex: number } | null>(null);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [zipBlobUrl, setZipBlobUrl] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipCurrentFile, setZipCurrentFile] = useState<string | undefined>(undefined);
  const [zipStartTime, setZipStartTime] = useState<number | null>(null);
  const [showZipProgress, setShowZipProgress] = useState(false);
  const [editedModIds, setEditedModIds] = useState<Set<string>>(new Set());
  const [favoritedModIds, setFavoritedModIds] = useState<Set<string>>(() => {
    // Load favorites from localStorage on mount (safe parse)
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
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const saveConfigRef = useRef<(() => void) | null>(null);

  // Load categories on mount
  useEffect(() => {
    loadCategories().then(categories => {
      setModCategories(categories);
    });
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("spt-favorites", JSON.stringify(Array.from(favoritedModIds)));
  }, [favoritedModIds]);

  // Keyboard shortcuts
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

  // CRITICAL: All hooks must be called before any early returns!
  // Derive mods from scanned data only
  const mods = scannedMods.map(sm => sm.mod);

  // Get recently edited mods
  const editHistory = getEditHistory();
  const recentlyEditedModIds = [...new Set(editHistory.map(h => h.modId))];

  // Filter mods based on active tab and category
  const filteredModsByCategory = useMemo(() => {
    let result = mods;
    
    // Apply category filter if one is selected
    if (selectedCategory) {
      result = result.filter(m => getModCategory(m.id, modCategories) === selectedCategory);
    }
    
    return result;
  }, [mods, selectedCategory, modCategories]);

  // Get recently edited mods with filter applied
  const recentlyEditedMods = mods
    .filter(m => recentlyEditedModIds.includes(m.id))
    .filter(m => !selectedCategory || getModCategory(m.id, modCategories) === selectedCategory)
    .sort((a, b) => {
      const aTime = getModEditTime(a.id) || 0;
      const bTime = getModEditTime(b.id) || 0;
      return bTime - aTime;
    });

  const handleFolderSelected = async (handle: FileSystemDirectoryHandle | string) => {
    setIsScanning(true);
    
    try {
      let mods: ScannedMod[] | ElectronScannedMod[];
      let pathName: string;

      if (isElectron() && typeof handle === 'string') {
        // Electron path - Save to localStorage FIRST before any async operations
        localStorage.setItem('lastSPTFolder', handle);
        console.log('✅ Saved Electron folder path to localStorage:', handle);
        
        mods = await scanSPTFolderElectron(handle);
        pathName = handle.split(/[/\\]/).pop() || handle;
        console.log('[Scan] Electron mods:', mods.length, mods[0]?.mod?.name, 'configs:', mods[0]?.configs?.length);
      } else {
        // Browser FileSystemDirectoryHandle
        // For browser, we can't persist the handle directly, save marker first
        localStorage.setItem('lastSPTFolder', 'browser-handle');
        console.log('✅ Saved browser handle marker to localStorage');
        
        mods = await scanSPTFolder(handle as FileSystemDirectoryHandle);
        pathName = (handle as FileSystemDirectoryHandle).name;
        console.log('[Scan] Browser mods:', mods.length, mods[0]?.mod?.name, 'configs:', mods[0]?.configs?.length);
      }
      
      if (mods.length === 0) {
        toast.warning("No mods found", {
          description: "No compatible mod configs were found in the user/mods directory"
        });
        return;
      }

      setScannedMods(mods as ScannedMod[]);
      setSptPath(pathName);
      
      // Auto-select first mod
      if (mods.length > 0) {
        setSelectedModId(mods[0].mod.id);
        setSelectedConfigIndex(0);
      }

      toast.success(`Found ${mods.length} mod(s)`, {
        description: `${mods.reduce((sum, m) => sum + m.configs.length, 0)} config files detected`
      });
      
    } catch (error: any) {
      console.error('[Scan] Error scanning folder:', error);
      toast.error("Scan failed", {
        description: error.message || "Could not scan the folder structure"
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectMod = (modId: string, configIndex: number) => {
    if (hasUnsavedChanges) {
      setPendingModSwitch({ modId, configIndex });
    } else {
      setSelectedModId(modId);
      setSelectedConfigIndex(configIndex);
      setHasUnsavedChanges(false);
    }
  };

  const handleSaveAndSwitch = async () => {
    if (pendingModSwitch) {
      // Save current changes
      const selectedMod = scannedMods.find(m => m.mod.id === selectedModId);
      if (selectedMod) {
        const config = selectedMod.configs[selectedConfigIndex];
        // Note: This would need the current values from ConfigEditor
        // For now, we'll just switch
      }
      
      setSelectedModId(pendingModSwitch.modId);
      setSelectedConfigIndex(pendingModSwitch.configIndex);
      setHasUnsavedChanges(false);
      setPendingModSwitch(null);
    }
  };

  const handleDiscardAndSwitch = () => {
    if (pendingModSwitch) {
      setSelectedModId(pendingModSwitch.modId);
      setSelectedConfigIndex(pendingModSwitch.configIndex);
      setHasUnsavedChanges(false);
      setPendingModSwitch(null);
    }
  };

  const handleSaveConfig = async (values: ConfigValue[]) => {
    if (scannedMods.length === 0) {
      // Demo mode - just log
      console.log("Saving config:", values);
      setHasUnsavedChanges(false);
      return;
    }

    const selectedMod = scannedMods.find(m => m.mod.id === selectedModId);
    if (!selectedMod) return;

    const config = selectedMod.configs[selectedConfigIndex];
    if (!config) return;

    try {
      if (isElectron() && 'filePath' in config) {
        // Electron save
        await saveConfigToFileElectron(
          (config as any).filePath,
          values,
          config.rawJson
        );
      } else {
        // Browser save
        await saveConfigToFile(
          (selectedMod as any).folderHandle,
          config.fileName,
          values,
          config.rawJson
        );
      }

      setHasUnsavedChanges(false);
      if (selectedModId) {
        setEditedModIds((prev) => {
          const next = new Set(prev);
          next.add(selectedModId);
          return next;
        });
        
        // Track edit history
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
  };

const handleExportMods = async () => {
  if (scannedMods.length === 0) {
    toast.error("No mods to export");
    return;
  }

  const modsToExport = scannedMods.filter((m) => editedModIds.has(m.mod.id));
  if (modsToExport.length === 0) {
    toast.info("No edited mods to export", {
      description: "Make some changes and save before exporting.",
    });
    return;
  }

  try {
    setZipProgress(0);
    setZipCurrentFile(undefined);
    setZipStartTime(Date.now());
    setShowZipProgress(true);

    const blobUrl = await exportModsAsZip(modsToExport, (percent, currentFile) => {
      setZipProgress(percent);
      setZipCurrentFile(currentFile);
    });

    setShowZipProgress(false);
    setZipBlobUrl(blobUrl);
    toast.success("Export successful – ZIP is ready to download.");
  } catch (error: any) {
    setShowZipProgress(false);
    toast.error("Export failed", {
      description: error.message || "Could not create ZIP file",
    });
  }
};

  const handleDownloadZip = () => {
    if (zipBlobUrl) {
      downloadZipFromUrl(zipBlobUrl);
      setZipBlobUrl(null);
    }
  };

  const handleCancelDownload = () => {
    if (zipBlobUrl) {
      URL.revokeObjectURL(zipBlobUrl);
      setZipBlobUrl(null);
    }
  };

  const handleToggleFavorite = (modId: string) => {
    setFavoritedModIds(prev => {
      const newSet = new Set(prev);
      const modName = scannedMods.find(m => m.mod.id === modId)?.mod.name || modId;
      
      if (newSet.has(modId)) {
        newSet.delete(modId);
        toast.info("Removed from Favorites", {
          description: `${modName} removed from favorites`
        });
      } else {
        newSet.add(modId);
        toast.success("Added to Favorites", {
          description: `${modName} added to favorites`
        });
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
    setScannedMods([]);
    setSelectedModId(null);
    setSelectedConfigIndex(0);
    setHasUnsavedChanges(false);
    setShowHomeConfirm(false);
    setEditedModIds(new Set());
    toast.info("Returned to home", {
      description: "Returning to folder selection"
    });
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
    
    toast.success("Favorites exported", {
      description: "Favorites list downloaded as JSON"
    });
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
          toast.success("Favorites imported", {
            description: `${data.favorites.length} favorites loaded`
          });
        } else {
          throw new Error("Invalid favorites file format");
        }
      } catch (error: any) {
        toast.error("Import failed", {
          description: error.message || "Could not read favorites file"
        });
      }
    };
    input.click();
  };

  const handleLoadLastFolder = async () => {
    const lastFolder = localStorage.getItem('lastSPTFolder');
    console.log('🔍 Loading last folder from localStorage:', lastFolder);
    
    if (!lastFolder) {
      console.log('❌ No last folder found in localStorage');
      toast.error("No previous folder found");
      return;
    }

    if (isElectron()) {
      // For Electron, we saved the full path
      if (lastFolder !== 'browser-handle') {
        console.log('📂 Loading Electron folder:', lastFolder);
        await handleFolderSelected(lastFolder);
      } else {
        console.log('⚠️ Last folder was from browser mode');
        toast.error("Previous folder was selected in browser mode");
      }
    } else {
      console.log('🌐 Browser mode - cannot auto-load folders');
      toast.info("Browser mode", {
        description: "Please select your folder again. Browser security prevents automatic folder access."
      });
    }
  };

  if (!sptPath) {
    return (
      <PathSelector 
        onFolderSelected={handleFolderSelected}
        onLoadLastFolder={handleLoadLastFolder}
      />
    );
  }

  if (isScanning) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-foreground font-medium">Scanning mods...</p>
          <p className="text-sm text-muted-foreground">Reading config files</p>
        </div>
      </div>
    );
  }

  // Build config files map
  const configFilesMap: Record<string, ConfigFile[]> = {};
  try {
    scannedMods.forEach(sm => {
      configFilesMap[sm.mod.id] = sm.configs.map((cfg, idx) => ({
        fileName: cfg.fileName,
        index: idx
      }));
    });
  } catch (error) {
    console.error('[ConfigMap] Error building config map:', error);
  }

  const selectedScannedMod = scannedMods.find(m => m.mod.id === selectedModId);
  const selectedMod = selectedScannedMod?.mod;

  // Get config data with guards
  let configFile = "config.json";
  let configValues: ConfigValue[] = [];
  let rawJson = {};

  if (selectedScannedMod) {
    // Guard: ensure selectedConfigIndex is within bounds
    const maxConfigIndex = (selectedScannedMod.configs?.length || 1) - 1;
    const safeConfigIndex = Math.max(0, Math.min(selectedConfigIndex, maxConfigIndex));
    
    const config = selectedScannedMod.configs?.[safeConfigIndex];
    if (config) {
      configFile = config.fileName;
      configValues = config.values || [];
      rawJson = config.rawJson || {};
    }
    console.log('[Editor] selectedModId:', selectedModId, 'configIndex:', safeConfigIndex, 'configFile:', configFile, 'values:', configValues.length);
  }

  // Handler for category changes
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

  return (
    <>
      <div className="flex w-full h-screen overflow-hidden relative">
        <div className="w-72 border-r border-border bg-card flex flex-col h-full">
          <div className="border-b border-border px-3 pt-3 pb-2 shrink-0">
            <div className="flex gap-1 mb-1.5">
              <Button
                variant={activeTab === "mods" ? "default" : "ghost"}
                onClick={() => setActiveTab("mods")}
                className="flex-1 h-8 text-xs"
              >
                Mods ({mods.filter(m => !favoritedModIds.has(m.id)).length})
              </Button>
              <Button
                variant={activeTab === "favorites" ? "default" : "ghost"}
                onClick={() => setActiveTab("favorites")}
                className="flex-1 h-8 text-xs"
              >
                Favorites ({favoritedModIds.size})
              </Button>
              <Button
                variant={activeTab === "recent" ? "default" : "ghost"}
                onClick={() => setActiveTab("recent")}
                className="flex-1 h-8 text-xs"
                title="Recently Edited"
              >
                Recent
              </Button>
            </div>
            
            {/* Category Browser Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCategoryBrowser(true)}
              className="w-full h-8 text-xs flex items-center gap-2 justify-start"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Categories</span>
              {selectedCategory && (
                <span className="ml-auto text-xs text-muted-foreground">
                  ({selectedCategory})
                </span>
              )}
            </Button>
            {activeTab === "favorites" && favoritedModIds.size > 0 && (
              <div className="flex gap-1 mb-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportFavorites}
                  className="flex-1 h-7 text-xs px-2"
                  title="Export favorites list"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleImportFavorites}
                  className="flex-1 h-7 text-xs px-2"
                  title="Import favorites list"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Import
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFavorites}
                  className="flex-1 h-7 text-xs px-2"
                  title="Clear all favorites"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              </div>
            )}
           </div>
           
           <div className="flex-1 overflow-hidden">
             <ModList
             mods={
               activeTab === "mods" 
                 ? filteredModsByCategory.filter(m => !favoritedModIds.has(m.id))
                 : activeTab === "favorites"
                 ? filteredModsByCategory.filter(m => favoritedModIds.has(m.id))
                 : recentlyEditedMods
             }
             configFiles={configFilesMap}
             selectedModId={selectedModId}
             selectedConfigIndex={selectedConfigIndex}
             onSelectMod={handleSelectMod}
              favoritedModIds={favoritedModIds}
              onToggleFavorite={handleToggleFavorite}
              editHistory={editHistory}
              searchInputRef={searchInputRef}
              modCategories={modCategories}
              />
           </div>
        </div>
        {selectedMod && selectedModId && configValues.length > 0 ? (
          <ConfigEditor
            modName={selectedMod.name}
            configFile={configFile}
            values={configValues}
            rawJson={rawJson}
            modId={selectedModId}
            onSave={handleSaveConfig}
            hasUnsavedChanges={hasUnsavedChanges}
            onChangesDetected={(has) => {
              setHasUnsavedChanges(has);
              if (has && selectedModId) {
                setEditedModIds((prev) => {
                  const next = new Set(prev);
                  next.add(selectedModId);
                  return next;
                });
              }
            }}
             onExportMods={scannedMods.length > 0 ? handleExportMods : undefined}
             onHome={handleHome}
             saveConfigRef={saveConfigRef}
             currentCategory={getModCategory(selectedModId, modCategories)}
             onCategoryChange={handleCategoryChange}
           />
        ) : selectedMod && selectedModId ? (
          <div className="flex-1 flex items-center justify-center bg-background">
            <div className="text-center text-muted-foreground space-y-2">
              <Package className="w-12 h-12 mx-auto opacity-50" />
              <p className="font-medium">No configuration files found</p>
              <p className="text-sm">This mod doesn't have any editable config files</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-background">
            <p className="text-muted-foreground">Select a config file to edit</p>
          </div>
        )}
      </div>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={pendingModSwitch !== null} onOpenChange={(open) => !open && setPendingModSwitch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Do you want to save them before switching to another config?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingModSwitch(null)}>
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

      {/* Home Confirmation Dialog */}
      <AlertDialog open={showHomeConfirm} onOpenChange={setShowHomeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Config Editor?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to return to the home screen? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleGoHome} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard & Go Home
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ZIP Progress Dialog */}
      <AlertDialog open={showZipProgress} onOpenChange={(open) => !open && setShowZipProgress(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Creating ZIP...</AlertDialogTitle>
            <AlertDialogDescription>
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

      {/* Download Confirmation Dialog */}
      <AlertDialog open={zipBlobUrl !== null} onOpenChange={(open) => !open && handleCancelDownload()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zip Created. Would you like to download it?</AlertDialogTitle>
            <AlertDialogDescription>
              Your mods have been packaged and are ready to download as SPT Mods.zip
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={handleCancelDownload}
              className="bg-secondary text-secondary-foreground hover:bg-destructive hover:text-destructive-foreground"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDownloadZip}
              autoFocus
              className="bg-success text-success-foreground hover:bg-success/90 focus-visible:ring-success"
            >
              Download
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Browser Dialog */}
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
