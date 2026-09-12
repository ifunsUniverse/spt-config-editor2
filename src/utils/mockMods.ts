import type { ElectronScannedMod, ElectronScannedConfig } from "@/utils/electronFolderScanner";
import type { DirectoryHandleLike } from "@/utils/electronBridge";

/**
 * Dev Load: generates fully in-memory mock mods so the UI can be exercised
 * without a real SPT installation. Nothing touches the disk.
 */

const createMockFileHandle = (fileName: string, initialContent: string) => {
  let content = initialContent;
  return {
    kind: "file" as const,
    name: fileName,
    isMock: true,
    async getFile() {
      return new File([content], fileName, { type: "application/json" });
    },
    async createWritable() {
      let buffer = "";
      return {
        async write(data: string) {
          buffer += typeof data === "string" ? data : String(data);
        },
        async close() {
          content = buffer;
        },
      };
    },
  };
};

const createMockDirHandle = (name: string) =>
  ({
    kind: "directory",
    name,
    isMock: true,
    async getDirectoryHandle() {
      throw new Error("Mock directory");
    },
    async getFileHandle() {
      throw new Error("Mock directory");
    },
    async *entries() {},
  }) as unknown as DirectoryHandleLike;

interface MockModSpec {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  configs: { fileName: string; json: any }[];
}

const MOCK_SPECS: MockModSpec[] = [
  {
    id: "dev-traderplus",
    name: "Trader Plus",
    version: "2.4.1",
    author: "DevMock",
    description: "Expanded trader stock, prices and reputation tuning.",
    configs: [
      {
        fileName: "config.json",
        json: {
          enabled: true,
          priceMultiplier: 1.25,
          restockMinutes: 30,
          traders: { prapor: true, therapist: true, skier: false },
        },
      },
      {
        fileName: "traders/prices.json",
        json: { baseMarkup: 0.15, currency: "RUB", blacklist: ["ammo_12x70"] },
      },
    ],
  },
  {
    id: "dev-raidoverhaul",
    name: "Raid Overhaul",
    version: "1.9.0",
    author: "DevMock",
    description: "Changes raid timers, spawn waves and loot density.",
    configs: [
      {
        fileName: "config.json",
        json: {
          raidTimeMinutes: 60,
          lootMultiplier: 2,
          bossChance: { reshala: 35, killa: 25, shturman: 20 },
        },
      },
      { fileName: "waves/scavs.json", json: { waveCount: 8, delaySeconds: 90, maxAlive: 14 } },
    ],
  },
  {
    id: "dev-weaponpack",
    name: "Weapon Pack",
    version: "0.8.3",
    author: "DevMock",
    description: "Adds custom weapons, attachments and ballistics tweaks.",
    configs: [
      { fileName: "config.json", json: { addToTraders: true, recoilScale: 0.85, spawnInLoot: false } },
      { fileName: "ballistics.json", json: { damageMultiplier: 1.1, penetrationMultiplier: 1 } },
    ],
  },
  {
    id: "dev-questmaster",
    name: "Quest Master",
    version: "3.0.2",
    author: "DevMock",
    description: "Custom quest chains with configurable rewards.",
    configs: [
      { fileName: "config.json", json: { enableCustomQuests: true, rewardMultiplier: 1.5, maxActive: 12 } },
    ],
  },
  {
    id: "dev-uitweaks",
    name: "UI Tweaks",
    version: "1.2.0",
    author: "DevMock",
    description: "Quality of life interface adjustments.",
    configs: [
      { fileName: "config.json", json: { compactInventory: true, showItemValue: true, fontScale: 1 } },
      { fileName: "themes/dark.json", json: { accent: "#3b82f6", background: "#0b0f17" } },
    ],
  },
];

export function generateMockMods(): ElectronScannedMod[] {
  return MOCK_SPECS.map((spec) => {
    const configs: ElectronScannedConfig[] = spec.configs.map((cfg, index) => {
      const content = JSON.stringify(cfg.json, null, 2);
      return {
        fileName: cfg.fileName,
        rawJson: cfg.json,
        filePath: `${spec.id}/${cfg.fileName}`,
        index,
        fileHandle: createMockFileHandle(cfg.fileName, content) as any,
      };
    });

    return {
      mod: {
        id: spec.id,
        name: spec.name,
        version: spec.version,
        configCount: configs.length,
        author: spec.author,
        description: spec.description,
      },
      configs,
      folderPath: spec.id,
      dirHandle: createMockDirHandle(spec.id),
    };
  });
}
