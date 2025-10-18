import { useState, useEffect } from "react";
import { PathSelector } from "@/components/PathSelector";
import { ModList, Mod, ConfigFile } from "@/components/ModList";
import { ConfigEditor, ConfigValue } from "@/components/ConfigEditor";
import { scanSPTFolder, ScannedMod, saveConfigToFile } from "@/utils/folderScanner";
import { scanSPTFolderElectron, ElectronScannedMod, saveConfigToFileElectron } from "@/utils/electronFolderScanner";
import { exportModsAsZip, downloadZipFromUrl } from "@/utils/exportMods";
import { toast } from "sonner";
import { Loader2, Package, Download, Upload, Trash2 } from "lucide-react";
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

// Mock data for demonstration
const MOCK_MODS: Mod[] = [
  { id: "1", name: "Ammo Stats Tweaker", version: "1.2.0", configCount: 3 },
  { id: "2", name: "Realism Mod", version: "2.5.1", configCount: 8 },
  { id: "3", name: "Trader Plus", version: "1.0.5", configCount: 2 },
  { id: "4", name: "Quest Editor", version: "3.1.0", configCount: 5 },
  { id: "5", name: "Loot Enhancer", version: "1.8.2", configCount: 4 },
];

const MOCK_CONFIGS: Record<string, ConfigValue[]> = {
  "1": [
    { key: "enableDamageModifier", value: true, type: "boolean", description: "Enable custom damage modifications" },
    { key: "damageMultiplier", value: 1.5, type: "number", description: "Global damage multiplier" },
    { key: "penetrationMode", value: "realistic", type: "select", options: ["arcade", "realistic", "hardcore"], description: "Armor penetration calculation mode" },
    { key: "enableTracer", value: false, type: "boolean", description: "Show tracer rounds" },
  ],
  "2": [
    { key: "realismLevel", value: 75, type: "number", description: "Overall realism intensity (0-100)" },
    { key: "enableStamina", value: true, type: "boolean", description: "Enable realistic stamina system" },
    { key: "weatherEffects", value: true, type: "boolean", description: "Weather affects gameplay" },
    { key: "difficultyMode", value: "hard", type: "select", options: ["easy", "normal", "hard", "extreme"], description: "AI difficulty preset" },
    { key: "gunJamming", value: true, type: "boolean", description: "Weapons can jam when dirty" },
    { key: "jamFrequency", value: 15, type: "number", description: "Jam chance percentage" },
    { key: "enableHunger", value: true, type: "boolean", description: "Hunger system active" },
    { key: "quickHealKey", value: "H", type: "keybind", description: "Keybind for quick heal" },
  ],
  "3": [
    { key: "unlockAllTraders", value: false, type: "boolean", description: "Unlock all traders at level 1" },
    { key: "traderStockMultiplier", value: 1.0, type: "number", description: "Trader inventory size multiplier" },
  ],
  "4": [
    { key: "skipIntroQuests", value: false, type: "boolean", description: "Automatically complete intro quests" },
    { key: "questRewardMultiplier", value: 1.0, type: "number", description: "Multiply quest rewards" },
    { key: "enableCustomQuests", value: true, type: "boolean", description: "Load custom quest files" },
    { key: "questDifficulty", value: "normal", type: "select", options: ["easy", "normal", "hard"], description: "Quest objective difficulty" },
    { key: "showQuestMarkers", value: true, type: "boolean", description: "Show quest objectives on map" },
  ],
  "5": [
    { key: "lootMultiplier", value: 1.2, type: "number", description: "Loot spawn rate multiplier" },
    { key: "rareItemChance", value: 25, type: "number", description: "Rare item spawn chance %" },
    { key: "enableKeySpawns", value: true, type: "boolean", description: "Allow keys to spawn in world" },
    { key: "lootQuality", value: "high", type: "select", options: ["low", "normal", "high", "extreme"], description: "Overall loot quality" },
  ],
};

const Index = () => {
  const [sptPath, setSptPath] = useState<string | null>(null);
  const [selectedModId, setSelectedModId] = useState<string | null>(null);
  const [scannedMods, setScannedMods] = useState<ScannedMod[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedConfigIndex, setSelectedConfigIndex] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingModSwitch, setPendingModSwitch] = useState<{ modId: string; configIndex: number } | null>(null);
  const [zipBlobUrl, setZipBlobUrl] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipCurrentFile, setZipCurrentFile] = useState<string | undefined>(undefined);
  const [zipStartTime, setZipStartTime] = useState<number | null>(null);
  const [showZipProgress, setShowZipProgress] = useState(false);
  const [editedModIds, setEditedModIds] = useState<Set<string>>(new Set());
  const [favoritedModIds, setFavoritedModIds] = useState<Set<string>>(() => {
    // Load favorites from localStorage on mount
    const saved = localStorage.getItem("spt-favorites");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [activeTab, setActiveTab] = useState<"mods" | "favorites">("mods");

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("spt-favorites", JSON.stringify(Array.from(favoritedModIds)));
  }, [favoritedModIds]);

  const handlePathSelected = (path: string) => {
    setSptPath(path);
    // Use mock data for demo
    setScannedMods([]);
    if (MOCK_MODS.length > 0) {
      setSelectedModId(MOCK_MODS[0].id);
    }
  };

  const handleFolderSelected = async (handle: FileSystemDirectoryHandle | string) => {
    setIsScanning(true);
    
    try {
      let mods: ScannedMod[] | ElectronScannedMod[];
      let pathName: string;

      if (typeof handle === 'string') {
        // Electron path
        mods = await scanSPTFolderElectron(handle);
        pathName = handle.split(/[/\\]/).pop() || handle;
      } else {
        // Browser FileSystemDirectoryHandle
        mods = await scanSPTFolder(handle);
        pathName = handle.name;
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

  if (!sptPath) {
    return (
      <PathSelector 
        onPathSelected={handlePathSelected}
        onFolderSelected={handleFolderSelected}
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

  // Use scanned data if available, otherwise fall back to mock data
  const mods = scannedMods.length > 0 
    ? scannedMods.map(sm => sm.mod)
    : MOCK_MODS;

  // Build config files map
  const configFilesMap: Record<string, ConfigFile[]> = {};
  if (scannedMods.length > 0) {
    scannedMods.forEach(sm => {
      configFilesMap[sm.mod.id] = sm.configs.map((cfg, idx) => ({
        fileName: cfg.fileName,
        index: idx
      }));
    });
  } else {
    // Mock data - create placeholder config files
    MOCK_MODS.forEach(mod => {
      configFilesMap[mod.id] = [{ fileName: "config.json", index: 0 }];
    });
  }

  const selectedScannedMod = scannedMods.find(m => m.mod.id === selectedModId);
  const selectedMod = selectedScannedMod?.mod || MOCK_MODS.find(m => m.id === selectedModId);

  // Get config data
  let configFile = "config.json";
  let configValues: ConfigValue[] = [];
  let rawJson = {};

  if (selectedScannedMod) {
    const config = selectedScannedMod.configs[selectedConfigIndex];
    if (config) {
      configFile = config.fileName;
      configValues = config.values;
      rawJson = config.rawJson;
    }
  } else if (selectedModId) {
    configValues = MOCK_CONFIGS[selectedModId] || [];
  }

  return (
    <>
      <div className="flex w-full h-screen overflow-hidden">
        <div className="w-80 border-r border-border bg-card flex flex-col h-full">
          <div className="border-b border-border px-4 pt-4 pb-2 shrink-0">
            <div className="flex gap-1 mb-2">
              <Button
                variant={activeTab === "mods" ? "default" : "ghost"}
                onClick={() => setActiveTab("mods")}
                className="flex-1"
              >
                Mods ({mods.filter(m => !favoritedModIds.has(m.id)).length})
              </Button>
              <Button
                variant={activeTab === "favorites" ? "default" : "ghost"}
                onClick={() => setActiveTab("favorites")}
                className="flex-1"
              >
                Favorites ({favoritedModIds.size})
              </Button>
            </div>
            {activeTab === "favorites" && favoritedModIds.size > 0 && (
              <div className="flex gap-1 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportFavorites}
                  className="flex-1"
                  title="Export favorites list"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleImportFavorites}
                  className="flex-1"
                  title="Import favorites list"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  Import
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFavorites}
                  className="flex-1"
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
            mods={activeTab === "mods" ? mods.filter(m => !favoritedModIds.has(m.id)) : mods.filter(m => favoritedModIds.has(m.id))}
            configFiles={configFilesMap}
            selectedModId={selectedModId}
            selectedConfigIndex={selectedConfigIndex}
            onSelectMod={handleSelectMod}
            favoritedModIds={favoritedModIds}
            onToggleFavorite={handleToggleFavorite}
            />
          </div>
        </div>
        {selectedMod && selectedModId ? (
          <ConfigEditor
            modName={selectedMod.name}
            configFile={configFile}
            values={configValues}
            rawJson={rawJson}
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
          />
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
    </>
  );
};

export default Index;
