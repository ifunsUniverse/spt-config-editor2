import { useState, useEffect, useRef, useMemo } from "react";
import { PathSelector } from "@/components/PathSelector";
import { ModList, Mod, ConfigFile } from "@/components/ModList";
import { ConfigEditor, ConfigValue } from "@/components/ConfigEditor";
import { CategorySidebar } from "@/components/CategorySidebar";
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
  { id: "1", name: "Ammo Stats Tweaker", version: "1.2.0", configCount: 1 },
  { id: "2", name: "Realism Mod", version: "2.5.1", configCount: 1 },
  { id: "3", name: "Trader Plus", version: "1.0.5", configCount: 1 },
  { id: "4", name: "Quest Editor", version: "3.1.0", configCount: 1 },
  { id: "5", name: "Loot Enhancer", version: "1.8.2", configCount: 1 },
  { id: "6", name: "SAIN AI", version: "3.4.2", configCount: 1 },
  { id: "7", name: "Fika Multiplayer", version: "2.1.8", configCount: 1 },
  { id: "8", name: "Path to Tarkov", version: "4.2.1", configCount: 1 },
  { id: "9", name: "Munitions Expert", version: "1.5.3", configCount: 1 },
  { id: "10", name: "Better Spawns", version: "2.8.0", configCount: 1 },
  { id: "11", name: "Advanced Ballistics", version: "1.9.4", configCount: 1 },
  { id: "12", name: "Scav Raiders", version: "1.3.7", configCount: 1 },
  { id: "13", name: "Rogue Rogues", version: "2.0.1", configCount: 1 },
  { id: "14", name: "Boss Spawner", version: "3.2.5", configCount: 1 },
  { id: "15", name: "Item Spawn Multiplier", version: "1.4.0", configCount: 1 },
  { id: "16", name: "Hideout Plus", version: "2.7.3", configCount: 1 },
  { id: "17", name: "Flea Market Tweaks", version: "1.6.8", configCount: 1 },
  { id: "18", name: "Insurance Timer", version: "1.1.2", configCount: 1 },
  { id: "19", name: "Skill Progression", version: "2.3.4", configCount: 1 },
  { id: "20", name: "Map Tweaker", version: "1.8.9", configCount: 1 },
  { id: "21", name: "PMC Extended", version: "3.5.1", configCount: 1 },
  { id: "22", name: "Weapon Durability", version: "1.2.6", configCount: 1 },
  { id: "23", name: "Medical Overhaul", version: "2.4.2", configCount: 1 },
  { id: "24", name: "Stamina Rework", version: "1.7.5", configCount: 1 },
  { id: "25", name: "Armor Penetration Fix", version: "2.1.3", configCount: 1 },
  { id: "26", name: "Container Looting", version: "1.5.8", configCount: 1 },
  { id: "27", name: "Custom Traders", version: "3.3.0", configCount: 1 },
  { id: "28", name: "Raid Timer Control", version: "1.9.1", configCount: 1 },
  { id: "29", name: "Secured Container Edit", version: "2.2.4", configCount: 1 },
  { id: "30", name: "Labs Key Manager", version: "1.4.7", configCount: 1 },
  { id: "31", name: "Extract Camping", version: "2.6.2", configCount: 1 },
  { id: "32", name: "Weather Manager", version: "1.8.3", configCount: 1 },
  { id: "33", name: "Night Vision Plus", version: "2.0.9", configCount: 1 },
  { id: "34", name: "Scav Loadout", version: "1.3.5", configCount: 1 },
  { id: "35", name: "Starting Gear", version: "2.5.6", configCount: 1 },
  { id: "36", name: "Economy Balancer", version: "3.1.8", configCount: 1 },
  { id: "37", name: "Repair Costs", version: "1.6.4", configCount: 1 },
  { id: "38", name: "Food & Water Tweaks", version: "2.3.7", configCount: 1 },
  { id: "39", name: "Fence Reputation", version: "1.7.2", configCount: 1 },
  { id: "40", name: "Scav Karma Plus", version: "2.4.9", configCount: 1 },
  { id: "41", name: "Doors Unlocked", version: "1.2.1", configCount: 1 },
  { id: "42", name: "Grenade Tweaks", version: "1.5.3", configCount: 1 },
  { id: "43", name: "Pain System", version: "2.1.6", configCount: 1 },
  { id: "44", name: "Bleed Damage", version: "1.4.8", configCount: 1 },
  { id: "45", name: "Task Rewards", version: "3.2.2", configCount: 1 },
];

const MOCK_CONFIGS: Record<string, ConfigValue[]> = {
  "1": [
    { key: "enableDamageModifier", value: true, type: "boolean", description: "Enable custom damage modifications" },
    { key: "damageMultiplier", value: 1.5, type: "number", description: "Global damage multiplier" },
    { key: "penetrationMode", value: "realistic", type: "select", options: ["arcade", "realistic", "hardcore"], description: "Armor penetration calculation mode" },
  ],
  "2": [
    { key: "realismLevel", value: 75, type: "number", description: "Overall realism intensity (0-100)" },
    { key: "enableStamina", value: true, type: "boolean", description: "Enable realistic stamina system" },
    { key: "difficultyMode", value: "hard", type: "select", options: ["easy", "normal", "hard", "extreme"], description: "AI difficulty preset" },
  ],
  "3": [
    { key: "unlockAllTraders", value: false, type: "boolean", description: "Unlock all traders at level 1" },
    { key: "traderStockMultiplier", value: 1.0, type: "number", description: "Trader inventory size multiplier" },
  ],
  "4": [
    { key: "skipIntroQuests", value: false, type: "boolean", description: "Automatically complete intro quests" },
    { key: "questRewardMultiplier", value: 1.0, type: "number", description: "Multiply quest rewards" },
  ],
  "5": [
    { key: "lootMultiplier", value: 1.2, type: "number", description: "Loot spawn rate multiplier" },
    { key: "rareItemChance", value: 25, type: "number", description: "Rare item spawn chance %" },
  ],
  "6": [
    { key: "aiDifficulty", value: 50, type: "number", description: "AI difficulty level (0-100)" },
    { key: "hearingDistance", value: 75, type: "number", description: "AI hearing range in meters" },
  ],
  "7": [
    { key: "maxPlayers", value: 4, type: "number", description: "Maximum players per raid" },
    { key: "enableFriendlyFire", value: true, type: "boolean", description: "Allow damage to teammates" },
  ],
  "8": [
    { key: "progressionSpeed", value: 1.5, type: "number", description: "Quest progression multiplier" },
    { key: "openWorldMode", value: false, type: "boolean", description: "Enable open world features" },
  ],
  "9": [
    { key: "showAmmoStats", value: true, type: "boolean", description: "Display detailed ammo statistics" },
    { key: "penetrationChanceBonus", value: 10, type: "number", description: "Bonus penetration %" },
  ],
  "10": [
    { key: "bossSpawnChance", value: 35, type: "number", description: "Boss spawn chance %" },
    { key: "dynamicSpawns", value: true, type: "boolean", description: "Enable dynamic spawn system" },
  ],
  "11": [
    { key: "bulletDrop", value: true, type: "boolean", description: "Enable realistic bullet drop" },
    { key: "windEffect", value: false, type: "boolean", description: "Wind affects bullets" },
  ],
  "12": [
    { key: "raiderSpawnChance", value: 40, type: "number", description: "Raider spawn chance %" },
    { key: "raiderDifficulty", value: 80, type: "number", description: "Raider AI difficulty" },
  ],
  "13": [
    { key: "rogueAggression", value: 65, type: "number", description: "Rogue aggression level" },
    { key: "roguePatrolRadius", value: 150, type: "number", description: "Patrol radius in meters" },
  ],
  "14": [
    { key: "reshalaChance", value: 30, type: "number", description: "Reshala spawn chance %" },
    { key: "glukharChance", value: 25, type: "number", description: "Gluhar spawn chance %" },
  ],
  "15": [
    { key: "globalLootMultiplier", value: 1.5, type: "number", description: "Global loot multiplier" },
    { key: "containerMultiplier", value: 2.0, type: "number", description: "Container loot multiplier" },
  ],
  "16": [
    { key: "craftingSpeedBonus", value: 50, type: "number", description: "Crafting speed bonus %" },
    { key: "fuelConsumption", value: 0.5, type: "number", description: "Fuel consumption rate" },
  ],
  "17": [
    { key: "fleaLevelRequirement", value: 15, type: "number", description: "Level required for flea market" },
    { key: "fleaTaxMultiplier", value: 1.0, type: "number", description: "Flea market tax multiplier" },
  ],
  "18": [
    { key: "insuranceReturnTime", value: 24, type: "number", description: "Insurance return hours" },
    { key: "insuranceSuccessRate", value: 80, type: "number", description: "Insurance success rate %" },
  ],
  "19": [
    { key: "skillGainMultiplier", value: 2.0, type: "number", description: "Skill gain multiplier" },
    { key: "maxSkillLevel", value: 51, type: "number", description: "Maximum skill level" },
  ],
  "20": [
    { key: "extractTime", value: 45, type: "number", description: "Raid time in minutes" },
    { key: "scavExtractTime", value: 25, type: "number", description: "Scav raid time in minutes" },
  ],
  "21": [
    { key: "pmcInventorySize", value: 10, type: "number", description: "PMC inventory rows" },
    { key: "startingLevel", value: 1, type: "number", description: "Starting PMC level" },
  ],
  "22": [
    { key: "durabilityLossRate", value: 0.8, type: "number", description: "Durability loss multiplier" },
    { key: "jamChanceMultiplier", value: 1.2, type: "number", description: "Weapon jam chance multiplier" },
  ],
  "23": [
    { key: "healingSpeed", value: 1.5, type: "number", description: "Healing speed multiplier" },
    { key: "surgerySuccessRate", value: 90, type: "number", description: "Surgery success rate %" },
  ],
  "24": [
    { key: "staminaDrainRate", value: 1.0, type: "number", description: "Stamina drain multiplier" },
    { key: "sprintSpeedBonus", value: 5, type: "number", description: "Sprint speed bonus %" },
  ],
  "25": [
    { key: "armorEffectiveness", value: 1.2, type: "number", description: "Armor effectiveness multiplier" },
    { key: "penetrationDamage", value: 1.1, type: "number", description: "Penetration damage multiplier" },
  ],
  "26": [
    { key: "instantLooting", value: false, type: "boolean", description: "Enable instant looting" },
    { key: "lootingSpeed", value: 1.5, type: "number", description: "Looting speed multiplier" },
  ],
  "27": [
    { key: "customTraderStock", value: true, type: "boolean", description: "Enable custom trader inventory" },
    { key: "traderLoyaltyBonus", value: 10, type: "number", description: "Loyalty gain bonus %" },
  ],
  "28": [
    { key: "raidDuration", value: 60, type: "number", description: "Raid duration in minutes" },
    { key: "noTimeLimit", value: false, type: "boolean", description: "Remove time limit" },
  ],
  "29": [
    { key: "containerSize", value: 9, type: "number", description: "Secured container slots" },
    { key: "allowWeapons", value: false, type: "boolean", description: "Allow weapons in container" },
  ],
  "30": [
    { key: "labsKeycardRequired", value: false, type: "boolean", description: "Labs requires keycard" },
    { key: "labsKeycardConsume", value: true, type: "boolean", description: "Consume keycard on use" },
  ],
  "31": [
    { key: "extractCampersEnabled", value: true, type: "boolean", description: "Spawn extract campers" },
    { key: "camperSpawnChance", value: 20, type: "number", description: "Camper spawn chance %" },
  ],
  "32": [
    { key: "weatherVariety", value: true, type: "boolean", description: "Enable varied weather" },
    { key: "rainChance", value: 30, type: "number", description: "Rain chance %" },
  ],
  "33": [
    { key: "nvgBrightness", value: 1.3, type: "number", description: "Night vision brightness" },
    { key: "thermalRange", value: 150, type: "number", description: "Thermal range in meters" },
  ],
  "34": [
    { key: "scavStartingGear", value: "random", type: "select", options: ["poor", "random", "good"], description: "Scav starting gear quality" },
    { key: "weaponChance", value: 80, type: "number", description: "Weapon spawn chance %" },
  ],
  "35": [
    { key: "startingRubles", value: 500000, type: "number", description: "Starting rubles" },
    { key: "startingDollars", value: 5000, type: "number", description: "Starting dollars" },
  ],
  "36": [
    { key: "priceMultiplier", value: 1.0, type: "number", description: "Global price multiplier" },
    { key: "fleaPriceAdjust", value: 0, type: "number", description: "Flea price adjustment %" },
  ],
  "37": [
    { key: "armorRepairCost", value: 0.5, type: "number", description: "Armor repair cost multiplier" },
    { key: "weaponRepairCost", value: 0.7, type: "number", description: "Weapon repair cost multiplier" },
  ],
  "38": [
    { key: "hungerRate", value: 1.0, type: "number", description: "Hunger rate multiplier" },
    { key: "hydrationRate", value: 1.0, type: "number", description: "Hydration rate multiplier" },
  ],
  "39": [
    { key: "fenceRepGainBonus", value: 20, type: "number", description: "Fence rep gain bonus %" },
    { key: "scavCooldownReduction", value: 10, type: "number", description: "Scav cooldown reduction %" },
  ],
  "40": [
    { key: "karmaGainMultiplier", value: 1.5, type: "number", description: "Karma gain multiplier" },
    { key: "karmaLossMultiplier", value: 0.8, type: "number", description: "Karma loss multiplier" },
  ],
  "41": [
    { key: "unlockAllDoors", value: false, type: "boolean", description: "Unlock all locked doors" },
    { key: "requireKeys", value: true, type: "boolean", description: "Still require keys" },
  ],
  "42": [
    { key: "grenadeRadius", value: 1.2, type: "number", description: "Grenade blast radius multiplier" },
    { key: "fuzeTime", value: 3.5, type: "number", description: "Grenade fuse time in seconds" },
  ],
  "43": [
    { key: "painDuration", value: 1.0, type: "number", description: "Pain effect duration multiplier" },
    { key: "painkillersEffectiveness", value: 1.2, type: "number", description: "Painkillers effectiveness" },
  ],
  "44": [
    { key: "bleedDamageRate", value: 1.0, type: "number", description: "Bleed damage multiplier" },
    { key: "heavyBleedMultiplier", value: 1.5, type: "number", description: "Heavy bleed damage multiplier" },
  ],
  "45": [
    { key: "experienceReward", value: 1.5, type: "number", description: "Task XP multiplier" },
    { key: "moneyReward", value: 1.3, type: "number", description: "Task money multiplier" },
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
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
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
  const [activeTab, setActiveTab] = useState<"mods" | "favorites" | "recent">("mods");
  const [modCategories, setModCategories] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
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
      } else {
        // Browser FileSystemDirectoryHandle
        // For browser, we can't persist the handle directly, save marker first
        localStorage.setItem('lastSPTFolder', 'browser-handle');
        console.log('✅ Saved browser handle marker to localStorage');
        
        mods = await scanSPTFolder(handle as FileSystemDirectoryHandle);
        pathName = (handle as FileSystemDirectoryHandle).name;
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

  // Filter mods based on selected category
  const filteredModsByCategory = useMemo(() => {
    if (!selectedCategory) return mods;
    return mods.filter(m => getModCategory(m.id, modCategories) === selectedCategory);
  }, [mods, selectedCategory, modCategories]);

  // Get recently edited mods
  const editHistory = getEditHistory();
  const recentlyEditedModIds = [...new Set(editHistory.map(h => h.modId))];
  const recentlyEditedMods = filteredModsByCategory.filter(m => recentlyEditedModIds.includes(m.id))
    .sort((a, b) => {
      const aTime = getModEditTime(a.id) || 0;
      const bTime = getModEditTime(b.id) || 0;
      return bTime - aTime;
    });

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
           
           {/* Category Sidebar */}
           <CategorySidebar
             categories={modCategories}
             selectedCategory={selectedCategory}
             onSelectCategory={setSelectedCategory}
             mods={mods}
           />
           
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
             />
           </div>
        </div>
        {selectedMod && selectedModId ? (
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
    </>
  );
};

export default Index;
