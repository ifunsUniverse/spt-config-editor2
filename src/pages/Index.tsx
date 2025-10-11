import { useState } from "react";
import { PathSelector } from "@/components/PathSelector";
import { ModList, Mod } from "@/components/ModList";
import { ConfigEditor, ConfigValue } from "@/components/ConfigEditor";
import { scanSPTFolder, ScannedMod, saveConfigToFile } from "@/utils/folderScanner";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

  const handlePathSelected = (path: string) => {
    setSptPath(path);
    // Use mock data for demo
    setScannedMods([]);
    if (MOCK_MODS.length > 0) {
      setSelectedModId(MOCK_MODS[0].id);
    }
  };

  const handleFolderSelected = async (handle: FileSystemDirectoryHandle) => {
    setIsScanning(true);
    
    try {
      const mods = await scanSPTFolder(handle);
      
      if (mods.length === 0) {
        toast.warning("No mods found", {
          description: "No compatible mod configs were found in the user/mods directory"
        });
        return;
      }

      setScannedMods(mods);
      setSptPath(handle.name);
      
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

  const handleSaveConfig = async (values: ConfigValue[]) => {
    if (scannedMods.length === 0) {
      // Demo mode - just log
      console.log("Saving config:", values);
      return;
    }

    const selectedMod = scannedMods.find(m => m.mod.id === selectedModId);
    if (!selectedMod) return;

    const config = selectedMod.configs[selectedConfigIndex];
    if (!config) return;

    try {
      await saveConfigToFile(
        selectedMod.folderHandle,
        config.fileName,
        values,
        config.rawJson
      );
    } catch (error: any) {
      toast.error("Save failed", {
        description: error.message || "Could not save the config file"
      });
      throw error;
    }
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

  const selectedScannedMod = scannedMods.find(m => m.mod.id === selectedModId);
  const selectedMod = selectedScannedMod?.mod || MOCK_MODS.find(m => m.id === selectedModId);

  // Get config data
  let configFile = "config.json";
  let configValues: ConfigValue[] = [];

  if (selectedScannedMod) {
    const config = selectedScannedMod.configs[selectedConfigIndex];
    if (config) {
      configFile = config.fileName;
      configValues = config.values;
    }
  } else if (selectedModId) {
    configValues = MOCK_CONFIGS[selectedModId] || [];
  }

  return (
    <div className="flex w-full h-screen overflow-hidden">
      <ModList
        mods={mods}
        selectedModId={selectedModId}
        onSelectMod={(id) => {
          setSelectedModId(id);
          setSelectedConfigIndex(0);
        }}
      />
      {selectedMod && selectedModId ? (
        <ConfigEditor
          modName={selectedMod.name}
          configFile={configFile}
          values={configValues}
          onSave={handleSaveConfig}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-background">
          <p className="text-muted-foreground">Select a mod to view configs</p>
        </div>
      )}
    </div>
  );
};

export default Index;
