import {
  readdir,
  stat,
  exists,
  readFile,
} from "@/utils/electronBridge";

import { ConfigValue } from "@/utils/configHelpers";
import { Mod } from "@/components/ModList";
import JSON5 from "json5";

export interface ScannedFileInfo {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  fullPath: string;
}

export interface ElectronScannedConfig {
  fileName: string;
  rawJson: any;
  filePath: string;
  index: number;
}

export interface ElectronScannedMod {
  mod: Mod;
  configs: ElectronScannedConfig[];
  folderPath: string;
}

export async function scanFolder(folderPath: string): Promise<ScannedFileInfo[]> {
  try {
    const folderExists = await exists(folderPath);
    if (!folderExists) return [];

    const entries = await readdir(folderPath);
    if (!entries || !Array.isArray(entries)) return [];

    const scanned = await Promise.all(
      entries.map(async (entry) => {
        const separator = folderPath.includes("\\") ? "\\" : "/";
        const fullPath = folderPath + separator + entry.name;
        try {
          const info = await stat(fullPath);
          return {
            name: entry.name,
            fullPath,
            isDirectory: info.isDirectory,
            isFile: info.isFile,
          };
        } catch {
          return null;
        }
      })
    );

    return scanned.filter((x): x is ScannedFileInfo => x !== null);
  } catch (error) {
    console.error(`❌ scanFolder() failed for: ${folderPath}`, error);
    return [];
  }
}

export async function scanSPTFolderElectron(sptPath: string): Promise<ElectronScannedMod[]> {
  const separator = sptPath.includes("\\") ? "\\" : "/";
  
  // Check standard SPT locations
  const possibleModPaths = [
    sptPath + separator + "SPT" + separator + "user" + separator + "mods",
    sptPath + separator + "user" + separator + "mods",
    sptPath // Fallback: maybe they selected the mods folder directly?
  ];

  for (const modPath of possibleModPaths) {
    if (await exists(modPath)) {
      const mods = await scanFolder(modPath);
      // Ensure we are looking at a directory of folders, not just files
      const validModFolders = mods.filter(m => m.isDirectory);
      if (validModFolders.length > 0) {
        return scanMods(validModFolders);
      }
    }
  }

  return [];
}

async function scanMods(folderInfo: ScannedFileInfo[]) {
  const scannedMods: ElectronScannedMod[] = [];
  for (const folder of folderInfo) {
    if (!folder.isDirectory) continue;
    const modData = await scanModFolderElectron(folder.fullPath);
    // ✅ Fix: Load the mod even if it has 0 configs initially, so the user knows it's there
    if (modData) scannedMods.push(modData);
  }
  return scannedMods;
}

export async function scanModFolderElectron(
  modFolderPath: string
): Promise<ElectronScannedMod | null> {
  try {
    let packageJson: any = {};
    const separator = modFolderPath.includes("\\") ? "\\" : "/";
    const pkgPath = modFolderPath + separator + "package.json";

    if (await exists(pkgPath)) {
      try {
        const pkgContent = await readFile(pkgPath);
        packageJson = JSON5.parse(pkgContent);
      } catch {
        console.warn(`⚠️ Invalid package.json in ${modFolderPath}`);
      }
    }

    // ✅ Fix: Recursively scan for ALL files, not just JSON, but filter for editor compatibility
    const configs = await scanConfigFilesRecursiveElectron(modFolderPath, modFolderPath);
    
    configs.forEach((cfg, idx) => (cfg.index = idx));
    const folderName = modFolderPath.split(/[/\\]/).pop()!;

    const mod: Mod = {
      id: packageJson.name || folderName,
      name: packageJson.displayName || packageJson.name || folderName,
      version: packageJson.version || "unknown",
      author: packageJson.author || "unknown",
      description: packageJson.description || "",
      configCount: configs.length,
    };

    return { mod, configs, folderPath: modFolderPath };
  } catch (error) {
    console.error(`❌ Error scanning mod folder ${modFolderPath}`, error);
    return null;
  }
}

async function scanConfigFilesRecursiveElectron(
  currentPath: string,
  basePath: string
): Promise<ElectronScannedConfig[]> {
  const configs: ElectronScannedConfig[] = [];
  try {
    const entries = await scanFolder(currentPath);
    for (const entry of entries) {
      if (entry.isDirectory) {
        // Skip common heavy/non-mod folders to prevent hangs
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".svn") continue;
        const subConfigs = await scanConfigFilesRecursiveElectron(entry.fullPath, basePath);
        configs.push(...subConfigs);
      } else if (entry.isFile && /\.(json|jsonc|json5|txt|cfg|conf|log)$/i.test(entry.name)) {
        // ✅ Fix: Expanded file extension support to catch more config-like files
        try {
          const relative = entry.fullPath.replace(basePath, "").replace(/^[/\\]/, "");
          
          // For non-JSON files, we provide a null rawJson but the editor will load the string later
          let parsed = null;
          if (/\.json[c5]?$/i.test(entry.name)) {
            const rawText = await readFile(entry.fullPath);
            try {
              parsed = JSON5.parse(rawText);
            } catch (e) {
              // It's a JSON file but maybe broken? Keep it anyway so user can fix it
              parsed = {};
            }
          }

          configs.push({
            fileName: relative,
            rawJson: parsed,
            filePath: entry.fullPath,
            index: -1,
          });
        } catch (error) {
          console.warn(`❌ Failed scanning: ${entry.fullPath}`, error);
        }
      }
    }
  } catch (error) {
    console.error(`❌ scanConfigFilesRecursiveElectron failed in: ${currentPath}`, error);
  }
  return configs;
}

export async function saveConfigToFileElectron(
  filePath: string,
  values: ConfigValue[],
  originalJson: any
): Promise<void> {
  try {
    if (values.length === 1 && values[0].key === "__RAW_JSON__" && values[0].type === "raw") {
      await window.electronBridge.writeFile(filePath, values[0].value as string);
      return;
    }

    const updatedJson = structuredClone(originalJson);
    for (const val of values) {
      const keys = val.key.split(".");
      let current = updatedJson;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] ??= {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = val.value;
    }
    await window.electronBridge.writeFile(filePath, JSON.stringify(updatedJson, null, 2));
  } catch (error) {
    console.error("❌ Failed saving config:", error);
    throw error;
  }
}
