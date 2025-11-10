import {
  readdir,
  stat,
  exists,
  readFile,
  selectFolder,
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

/* -------------------------------------------------------
   scanFolder()
-------------------------------------------------------- */
export async function scanFolder(folderPath: string): Promise<ScannedFileInfo[]> {
  console.log(`\n📂 scanFolder → ${folderPath}`);

  try {
    const folderExists = await exists(folderPath);
    if (!folderExists) {
      console.warn(`❌ Folder does NOT exist: ${folderPath}`);
      return [];
    }

    const entries = await readdir(folderPath);
    if (!entries || !Array.isArray(entries)) return [];

    const scanned = await Promise.all(
      entries.map(async (entry) => {
        // ✅ Use platform-agnostic path joining
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

/* -------------------------------------------------------
   Detect SPT version (3.11.x OR 4.0.x)
-------------------------------------------------------- */
export async function scanSPTFolderElectron(sptPath: string): Promise<ElectronScannedMod[]> {
  // ✅ Detect Windows vs Unix paths and use correct separator
  const separator = sptPath.includes("\\") ? "\\" : "/";
  const path40 = sptPath + separator + "SPT" + separator + "user" + separator + "mods";
  const path311 = sptPath + separator + "user" + separator + "mods";

  console.log("\n🔍 Checking SPT mod paths...");

  const mods40 = await scanFolder(path40);
  if (mods40.length > 0) {
    console.log(`✅ Detected SPT 4.0.x path: ${path40}`);
    return scanMods(mods40);
  }

  const mods311 = await scanFolder(path311);
  if (mods311.length > 0) {
    console.log(`✅ Detected SPT 3.11.x path: ${path311}`);
    return scanMods(mods311);
  }

  console.warn("❌ No mod directory found in either format.");
  return [];
}

/* -------------------------------------------------------
   Scan all mod folders
-------------------------------------------------------- */
async function scanMods(folderInfo: ScannedFileInfo[]) {
  const scannedMods: ElectronScannedMod[] = [];

  for (const folder of folderInfo) {
    if (!folder.isDirectory) continue;

    const modData = await scanModFolderElectron(folder.fullPath);
    if (modData && modData.configs.length > 0) scannedMods.push(modData);
  }

  return scannedMods;
}

/* -------------------------------------------------------
   Scan a single mod folder
-------------------------------------------------------- */
export async function scanModFolderElectron(
  modFolderPath: string
): Promise<ElectronScannedMod | null> {
  try {
    console.log(`🔍 Scanning mod: ${modFolderPath}`);

    let packageJson: any = {};
    const separator = modFolderPath.includes("\\") ? "\\" : "/";
    const pkgPath = modFolderPath + separator + "package.json";

    if (await exists(pkgPath)) {
      try {
        packageJson = JSON.parse(await readFile(pkgPath));
      } catch {
        console.warn(`⚠️ Invalid package.json in ${modFolderPath}`);
      }
    }

    const configs = await scanConfigFilesRecursiveElectron(modFolderPath, modFolderPath);

    if (configs.length === 0) {
      console.warn(`⚠️ No config files found in ${modFolderPath}`);
      return null;
    }

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

/* -------------------------------------------------------
   Recursive scan for config files (.json, .jsonc, .json5)
-------------------------------------------------------- */
async function scanConfigFilesRecursiveElectron(
  currentPath: string,
  basePath: string
): Promise<ElectronScannedConfig[]> {
  const configs: ElectronScannedConfig[] = [];

  try {
    const entries = await scanFolder(currentPath);

    for (const entry of entries) {
      if (entry.isDirectory) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;

        const subConfigs = await scanConfigFilesRecursiveElectron(entry.fullPath, basePath);
        configs.push(...subConfigs);
      } else if (entry.isFile && /\.(json|jsonc|json5)$/i.test(entry.name)) {
        try {
          const rawText = await readFile(entry.fullPath);

          // ✅ JSON5 handles json, jsonc, and json5
          const parsed = JSON5.parse(rawText);

          const relative = entry.fullPath.replace(basePath, "").replace(/^[/\\]/, "");

          configs.push({
            fileName: relative,
            rawJson: parsed,
            filePath: entry.fullPath,
            index: -1,
          });
        } catch (error) {
          console.warn(`❌ Failed parsing: ${entry.fullPath}`, error);
        }
      }
    }
  } catch (error) {
    console.error(`❌ scanConfigFilesRecursiveElectron failed in: ${currentPath}`, error);
  }

  return configs;
}

/* -------------------------------------------------------
   Write config changes back to disk
-------------------------------------------------------- */
export async function saveConfigToFileElectron(
  filePath: string,
  values: ConfigValue[],
  originalJson: any
): Promise<void> {
  try {
    // ✅ If raw JSON mode, write exactly what user typed
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
