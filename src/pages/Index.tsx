import { useState } from "react";
import { PathSelector } from "@/components/PathSelector";
import { ModList, Mod } from "@/components/ModList";
import { ConfigEditor, ConfigValue } from "@/components/ConfigEditor";

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

  const handlePathSelected = (path: string) => {
    setSptPath(path);
    // Auto-select first mod
    if (MOCK_MODS.length > 0) {
      setSelectedModId(MOCK_MODS[0].id);
    }
  };

  const handleSaveConfig = (values: ConfigValue[]) => {
    console.log("Saving config:", values);
    // In a real app, this would save to the file system
  };

  if (!sptPath) {
    return <PathSelector onPathSelected={handlePathSelected} />;
  }

  const selectedMod = MOCK_MODS.find(m => m.id === selectedModId);

  return (
    <div className="flex w-full h-screen overflow-hidden">
      <ModList
        mods={MOCK_MODS}
        selectedModId={selectedModId}
        onSelectMod={setSelectedModId}
      />
      {selectedMod && selectedModId ? (
        <ConfigEditor
          modName={selectedMod.name}
          configFile="config.json"
          values={MOCK_CONFIGS[selectedModId] || []}
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
