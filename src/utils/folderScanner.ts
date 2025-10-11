import { Mod } from "@/components/ModList";
import { ConfigValue } from "@/components/ConfigEditor";

export interface ScannedConfig {
  fileName: string;
  values: ConfigValue[];
  rawJson: any;
}

export interface ScannedMod {
  mod: Mod;
  configs: ScannedConfig[];
  folderHandle: FileSystemDirectoryHandle;
}

/**
 * Scans a folder structure for SPT mods and their configs
 */
export async function scanSPTFolder(
  rootHandle: FileSystemDirectoryHandle
): Promise<ScannedMod[]> {
  const scannedMods: ScannedMod[] = [];

  try {
    // Navigate to user/mods directory
    const userHandle = await rootHandle.getDirectoryHandle("user", { create: false });
    const modsHandle = await userHandle.getDirectoryHandle("mods", { create: false });

    // Iterate through mod folders
    // @ts-ignore - values() exists but TypeScript doesn't recognize it
    for await (const entry of modsHandle.values()) {
      if (entry.kind === "directory") {
        const modData = await scanModFolder(entry);
        if (modData) {
          scannedMods.push(modData);
        }
      }
    }
  } catch (error) {
    console.error("Error scanning SPT folder:", error);
    throw new Error(
      "Could not find user/mods directory. Make sure you selected your SPT installation folder."
    );
  }

  return scannedMods;
}

/**
 * Scans a single mod folder for package.json and config files
 */
async function scanModFolder(
  modHandle: FileSystemDirectoryHandle
): Promise<ScannedMod | null> {
  try {
    // Look for package.json to get mod info
    let modName = modHandle.name;
    let modVersion = "1.0.0";

    try {
      const packageFile = await modHandle.getFileHandle("package.json");
      const file = await packageFile.getFile();
      const text = await file.text();
      const packageJson = JSON.parse(text);
      
      if (packageJson.name) modName = packageJson.name;
      if (packageJson.version) modVersion = packageJson.version;
    } catch {
      // No package.json, use folder name
    }

    // Scan for config files
    const configs: ScannedConfig[] = [];
    
    // Look for config folder
    try {
      const configHandle = await modHandle.getDirectoryHandle("config", { create: false });
      const configFiles = await scanConfigFiles(configHandle);
      configs.push(...configFiles);
    } catch {
      // No config folder, check root
    }

    // Also check root level for config files
    const rootConfigs = await scanConfigFiles(modHandle);
    configs.push(...rootConfigs);

    if (configs.length === 0) {
      return null; // Skip mods with no configs
    }

    const mod: Mod = {
      id: modHandle.name,
      name: modName,
      version: modVersion,
      configCount: configs.length,
    };

    return {
      mod,
      configs,
      folderHandle: modHandle,
    };
  } catch (error) {
    console.error(`Error scanning mod ${modHandle.name}:`, error);
    return null;
  }
}

/**
 * Scans a directory for JSON config files
 */
async function scanConfigFiles(
  dirHandle: FileSystemDirectoryHandle
): Promise<ScannedConfig[]> {
  const configs: ScannedConfig[] = [];

  // @ts-ignore - values() exists but TypeScript doesn't recognize it
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "file" && entry.name.endsWith(".json")) {
      try {
        const fileHandle = entry as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        const text = await file.text();
        const json = JSON.parse(text);

        // Only include if it looks like a config (has usable properties)
        if (isValidConfig(json)) {
          const values = jsonToConfigValues(json);
          configs.push({
            fileName: entry.name,
            values,
            rawJson: json,
          });
        }
      } catch (error) {
        console.warn(`Could not parse ${entry.name}:`, error);
      }
    }
  }

  return configs;
}

/**
 * Checks if a JSON object is a valid config file
 */
function isValidConfig(json: any): boolean {
  if (!json || typeof json !== "object") return false;
  
  // Exclude package.json and other metadata files
  const excludedFields = ["name", "version", "author", "license", "main", "dependencies"];
  const keys = Object.keys(json);
  
  // If it only has metadata fields, it's not a config
  if (keys.every(key => excludedFields.includes(key))) return false;
  
  // Must have at least one configurable field
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
      // Detect if it looks like a keybind
      if (value.length === 1 || ["F1", "F2", "ESC"].some(k => value.includes(k))) {
        values.push({
          key: fullKey,
          value,
          type: "keybind",
          description: `Keybind for ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`,
        });
      } else {
        values.push({
          key: fullKey,
          value,
          type: "string",
          description: `Set ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`,
        });
      }
    } else if (Array.isArray(value)) {
      // Handle arrays as select dropdowns if they contain strings
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
      // Recursively handle nested objects
      const nested = jsonToConfigValues(value, fullKey);
      values.push(...nested);
    }
  }

  return values;
}

/**
 * Saves config values back to a file
 */
export async function saveConfigToFile(
  modHandle: FileSystemDirectoryHandle,
  fileName: string,
  values: ConfigValue[],
  originalJson: any
): Promise<void> {
  try {
    // Reconstruct JSON from values
    const updatedJson = configValuesToJson(values, originalJson);

    // Get file handle
    let fileHandle: FileSystemFileHandle;
    
    try {
      // Try config folder first
      const configHandle = await modHandle.getDirectoryHandle("config", { create: false });
      fileHandle = await configHandle.getFileHandle(fileName, { create: false });
    } catch {
      // Fall back to root
      fileHandle = await modHandle.getFileHandle(fileName, { create: false });
    }

    // Write file
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(updatedJson, null, 2));
    await writable.close();
  } catch (error) {
    console.error("Error saving config:", error);
    throw new Error(`Failed to save ${fileName}`);
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
