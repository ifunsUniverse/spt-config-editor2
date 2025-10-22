import { Mod } from "@/components/ModList";
import { ConfigValue } from "@/components/ConfigEditor";
import JSON5 from "json5";

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

    // Recursively scan entire mod folder for all config files
    const configs = await scanConfigFilesRecursive(modHandle);

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
 * Recursively scans a directory and all subdirectories for JSON and JSON5 config files
 */
async function scanConfigFilesRecursive(
  dirHandle: FileSystemDirectoryHandle,
  relativePath: string = ""
): Promise<ScannedConfig[]> {
  const configs: ScannedConfig[] = [];

  // @ts-ignore - values() exists but TypeScript doesn't recognize it
  for await (const entry of dirHandle.values()) {
    if (entry.kind === "directory") {
      // Skip dev/build directories
      if (["node_modules", ".git", "dist", "build", ".vscode"].includes(entry.name)) {
        continue;
      }
      // Recursively scan subdirectories
      const subDirHandle = entry as FileSystemDirectoryHandle;
      const subPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      const subConfigs = await scanConfigFilesRecursive(subDirHandle, subPath);
      configs.push(...subConfigs);
    } else if (entry.kind === "file") {
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
          const fileHandle = entry as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          const text = await file.text();
          
          // Always use JSON5 to support comments and trailing commas
          const json = JSON5.parse(text);

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
            });
          }
        } catch (error) {
          console.warn(`Could not parse ${entry.name}:`, error);
        }
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
  const excludedFields = ["name", "version", "author", "license", "main", "dependencies", "scripts", "devDependencies"];
  const keys = Object.keys(json);
  
  // If it only has metadata fields, it's not a config
  if (keys.every(key => excludedFields.includes(key))) return false;
  
  // Exclude files named package.json
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

    // Navigate to the correct file handle using the path
    const pathParts = fileName.split("/");
    let currentHandle: FileSystemDirectoryHandle = modHandle;
    
    // Navigate through directories
    for (let i = 0; i < pathParts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(pathParts[i], { create: false });
    }
    
    // Get the file handle
    const fileHandle = await currentHandle.getFileHandle(pathParts[pathParts.length - 1], { create: false });

    // Write file - use JSON5 for non-standard JSON files to preserve syntax
    const writable = await fileHandle.createWritable();
    const lowerFileName = fileName.toLowerCase();
    const useJSON5 = lowerFileName.endsWith(".json5") || 
                     lowerFileName.endsWith(".jsonc") ||
                     /\.json[a-z0-9]+$/i.test(fileName); // Any .json* variant
    const content = useJSON5
      ? JSON5.stringify(updatedJson, null, 2)
      : JSON.stringify(updatedJson, null, 2);
    await writable.write(content);
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
