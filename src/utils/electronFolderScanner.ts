import {
  readdir,
  stat,
  exists,
  readFile,
  selectFolder,
} from "@/utils/electronBridge";
import { ConfigValue } from "@/components/ConfigEditor";
import { Mod } from "@/components/ModList";

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
    // Ensure the folder actually exists
    const folderExists = await exists(folderPath);
    if (!folderExists) {
      console.warn(`[Scanner] Folder does not exist: ${folderPath}`);
      return [];
    }

    const entries = await readdir(folderPath);

    const scannedItems = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = `${folderPath}/${entry.name}`;
        const info = await stat(fullPath);

        return {
          name: entry.name,
          fullPath,
          isDirectory: info.isDirectory,
          isFile: info.isFile,
        } as ScannedFileInfo;
      })
    );

    return scannedItems;
  } catch (error) {
    console.error("[Scanner] Failed to read folder:", error);
    return [];
  }
}

/**
 * Scans the entire SPT folder and returns all mods with their configs
 */
export async function scanSPTFolderElectron(sptPath: string): Promise<ElectronScannedMod[]> {
  const modsPath = `${sptPath}/user/mods`;
  const modFolders = await scanFolder(modsPath);
  
  const scannedMods: ElectronScannedMod[] = [];
  
  for (const folder of modFolders) {
    if (!folder.isDirectory) continue;
    
    const modData = await scanModFolderElectron(folder.fullPath);
    if (modData && modData.configs.length > 0) {
      scannedMods.push(modData);
    }
  }
  
  return scannedMods;
}

/**
 * Scans a single mod folder and extracts package.json + config files
 */
export async function scanModFolderElectron(modFolderPath: string): Promise<ElectronScannedMod | null> {
  try {
    // Read package.json
    const packageJsonPath = `${modFolderPath}/package.json`;
    const packageExists = await exists(packageJsonPath);
    
    if (!packageExists) {
      return null;
    }
    
    const packageContent = await readFile(packageJsonPath);
    const packageJson = JSON.parse(packageContent);
    
    // Scan for config files
    const configs = await scanConfigFilesRecursiveElectron(modFolderPath, modFolderPath);
    
    // Assign sequential indices after all configs are collected
    configs.forEach((config, idx) => {
      config.index = idx;
    });
    
    const mod: Mod = {
      id: packageJson.name || modFolderPath.split(/[/\\]/).pop() || "unknown",
      name: packageJson.displayName || packageJson.name || "Unknown Mod",
      version: packageJson.version || "1.0.0",
      author: packageJson.author || "Unknown",
      description: packageJson.description || "",
      configCount: configs.length,
    };
    
    return {
      mod,
      configs,
      folderPath: modFolderPath,
    };
  } catch (error) {
    console.error(`[Scanner] Failed to scan mod folder ${modFolderPath}:`, error);
    return null;
  }
}

/**
 * Recursively scans for JSON config files in a directory
 */
async function scanConfigFilesRecursiveElectron(
  currentPath: string,
  basePath: string
): Promise<ElectronScannedConfig[]> {
  const configs: ElectronScannedConfig[] = [];
  
  try {
    const entries = await scanFolder(currentPath);
    
    for (const entry of entries) {
      if (entry.isDirectory) {
        // Skip node_modules and other common ignore folders
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }
        
        // Recursively scan subdirectories
        const subConfigs = await scanConfigFilesRecursiveElectron(entry.fullPath, basePath);
        configs.push(...subConfigs);
      } else if (entry.isFile && entry.name.endsWith('.json') && entry.name !== 'package.json') {
        // Try to read and parse the config file
        try {
          const content = await readFile(entry.fullPath);
          const parsed = JSON.parse(content);
          
          // Calculate relative path from mod base
          const relativePath = entry.fullPath.replace(basePath, '').replace(/^[/\\]/, '');
          
          configs.push({
            fileName: relativePath,
            rawJson: parsed,
            filePath: entry.fullPath,
            index: -1, // Will be assigned later
          });
        } catch (error) {
          console.warn(`[Scanner] Failed to parse ${entry.fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`[Scanner] Failed to scan directory ${currentPath}:`, error);
  }
  
  return configs;
}

/**
 * Saves config changes to a file (Electron version)
 */
export async function saveConfigToFileElectron(
  filePath: string,
  values: ConfigValue[],
  originalJson: any
): Promise<void> {
  try {
    // Reconstruct the JSON from values
    const updatedJson = { ...originalJson };
    
    for (const val of values) {
      const keys = val.key.split(".");
      let current = updatedJson;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = val.value;
    }
    
    const content = JSON.stringify(updatedJson, null, 2);
    
    // Use electronBridge to write file
    if (window.electronBridge?.writeFile) {
      await window.electronBridge.writeFile(filePath, content);
    } else {
      throw new Error("Electron bridge not available");
    }
  } catch (error) {
    console.error("[Scanner] Failed to save config:", error);
    throw error;
  }
}
