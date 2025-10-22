import { Mod } from "@/components/ModList";
import { ConfigValue } from "@/components/ConfigEditor";
import JSON5 from "json5";
import { electronAPI } from "./electronBridge";
import path from "path-browserify";

export interface ElectronScannedConfig {
  fileName: string;
  values: ConfigValue[];
  rawJson: any;
  filePath: string;
}

export interface ElectronScannedMod {
  mod: Mod;
  configs: ElectronScannedConfig[];
  folderPath: string;
}

/**
 * Scans a folder structure for SPT mods and their configs using Electron APIs
 */
export async function scanSPTFolderElectron(
  rootPath: string
): Promise<ElectronScannedMod[]> {
  const scannedMods: ElectronScannedMod[] = [];
  const api = electronAPI();

  try {
    // Navigate to user/mods directory
    const userPath = path.join(rootPath, "user");
    const modsPath = path.join(userPath, "mods");

    const userExists = await api.exists(userPath);
    const modsExists = await api.exists(modsPath);

    if (!userExists || !modsExists) {
      throw new Error(
        "Could not find user/mods directory. Make sure you selected your SPT installation folder."
      );
    }

    // Iterate through mod folders
    const entries = await api.readdir(modsPath);

    for (const entry of entries) {
      if (entry.isDirectory) {
        const modPath = path.join(modsPath, entry.name);
        const modData = await scanModFolderElectron(modPath, entry.name);
        if (modData) {
          scannedMods.push(modData);
        }
      }
    }
  } catch (error: any) {
    console.error("Error scanning SPT folder:", error);
    throw new Error(error.message || "Could not scan the folder structure");
  }

  return scannedMods;
}

/**
 * Scans a single mod folder for package.json and config files
 */
async function scanModFolderElectron(
  modPath: string,
  folderName: string
): Promise<ElectronScannedMod | null> {
  const api = electronAPI();

  try {
    // Look for package.json to get mod info
    let modName = folderName;
    let modVersion = "1.0.0";

    try {
      const packagePath = path.join(modPath, "package.json");
      const packageExists = await api.exists(packagePath);

      if (packageExists) {
        const packageText = await api.readFile(packagePath);
        const packageJson = JSON.parse(packageText);

        if (packageJson.name) modName = packageJson.name;
        if (packageJson.version) modVersion = packageJson.version;
      }
    } catch {
      // No package.json, use folder name
    }

    // Recursively scan entire mod folder for all config files
    const configs = await scanConfigFilesRecursiveElectron(modPath);

    if (configs.length === 0) {
      return null; // Skip mods with no configs
    }

    const mod: Mod = {
      id: folderName,
      name: modName,
      version: modVersion,
      configCount: configs.length,
    };

    return {
      mod,
      configs,
      folderPath: modPath,
    };
  } catch (error) {
    console.error(`Error scanning mod ${folderName}:`, error);
    return null;
  }
}

/**
 * Recursively scans a directory and all subdirectories for JSON and JSON5 config files
 */
async function scanConfigFilesRecursiveElectron(
  dirPath: string,
  relativePath: string = ""
): Promise<ElectronScannedConfig[]> {
  const api = electronAPI();
  const configs: ElectronScannedConfig[] = [];

  try {
    const entries = await api.readdir(dirPath);

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory) {
        // Skip dev/build directories
        if (["node_modules", ".git", "dist", "build", ".vscode"].includes(entry.name)) {
          continue;
        }
        // Recursively scan subdirectories
        const subPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        const subConfigs = await scanConfigFilesRecursiveElectron(fullPath, subPath);
        configs.push(...subConfigs);
      } else if (entry.isFile) {
        const fileName = entry.name;
        
        // Skip dev/build files
        if (
          fileName === "package.json" ||
          fileName.startsWith("tsconfig") ||
          fileName === "package-lock.json" ||
          fileName === "pnpm-lock.yaml" ||
          fileName === "yarn.lock" ||
          fileName.startsWith(".eslintrc") ||
          fileName.startsWith(".prettierrc")
        ) {
          continue;
        }
        
        // Check if file is a JSON variant
        if (
          fileName.endsWith(".json") ||
          fileName.endsWith(".json5") ||
          fileName.endsWith(".jsonc")
        ) {
          try {
            const fileText = await api.readFile(fullPath);
            
            // Always use JSON5 to support comments and trailing commas
            const json = JSON5.parse(fileText);

            // Only include if it looks like a config (has usable properties)
            if (isValidConfig(json)) {
              const values = jsonToConfigValues(json);
              const displayName = relativePath
                ? `${relativePath}/${entry.name}`
                : entry.name;
              configs.push({
                fileName: displayName,
                values,
                rawJson: json,
                filePath: fullPath,
              });
            }
          } catch (error) {
            console.warn(`Could not parse ${entry.name}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }

  return configs;
}

/**
 * Checks if a JSON object is a valid config file
 */
function isValidConfig(json: any): boolean {
  if (!json || typeof json !== "object") return false;

  // Exclude package.json and other metadata files
  const excludedFields = ["name", "version", "author", "license", "main", "dependencies", "scripts", "devDependencies"];
  const keys = Object.keys(json);

  // If it only has metadata fields, it's not a config
  if (keys.every(key => excludedFields.includes(key))) return false;

  return keys.length > 0;
}

/**
 * Converts JSON object to ConfigValue array
 */
function jsonToConfigValues(json: any, prefix = ""): ConfigValue[] {
  const values: ConfigValue[] = [];

  for (const [key, value] of Object.entries(json)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "boolean") {
      values.push({
        key: fullKey,
        value,
        type: "boolean",
        description: `Toggle ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`,
      });
    } else if (typeof value === "number") {
      values.push({
        key: fullKey,
        value,
        type: "number",
        description: `Adjust ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`,
      });
    } else if (typeof value === "string") {
      values.push({
        key: fullKey,
        value,
        type: "string",
        description: `Set ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`,
      });
    } else if (Array.isArray(value)) {
      if (value.every(v => typeof v === "string")) {
        values.push({
          key: fullKey,
          value: value[0] || "",
          type: "select",
          options: value,
          description: `Choose ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`,
        });
      }
    } else if (typeof value === "object" && value !== null) {
      const nested = jsonToConfigValues(value, fullKey);
      values.push(...nested);
    }
  }

  return values;
}

/**
 * Saves config values back to a file using Electron APIs
 */
export async function saveConfigToFileElectron(
  filePath: string,
  values: ConfigValue[],
  originalJson: any
): Promise<void> {
  const api = electronAPI();

  try {
    // Reconstruct JSON from values
    const updatedJson = configValuesToJson(values, originalJson);

    // Write file - use JSON5 for non-standard JSON files to preserve syntax
    const lowerFilePath = filePath.toLowerCase();
    const useJSON5 = lowerFilePath.endsWith(".json5") || 
                     lowerFilePath.endsWith(".jsonc") ||
                     /\.json[a-z0-9]+$/i.test(filePath); // Any .json* variant
    const content = useJSON5
      ? JSON5.stringify(updatedJson, null, 2)
      : JSON.stringify(updatedJson, null, 2);

    await api.writeFile(filePath, content);
  } catch (error: any) {
    console.error("Error saving config:", error);
    throw new Error(`Failed to save file: ${error.message}`);
  }
}

/**
 * Converts ConfigValue array back to JSON object
 */
function configValuesToJson(values: ConfigValue[], originalJson: any): any {
  const result = { ...originalJson };

  for (const config of values) {
    const keys = config.key.split(".");
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = config.value;
  }

  return result;
}
