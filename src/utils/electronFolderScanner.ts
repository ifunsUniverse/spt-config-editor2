/**
 * Web-native folder scanner using File System Access API.
 * Replaces the former Electron-based scanner.
 */

import { ConfigValue } from "@/utils/configHelpers";
import { Mod } from "@/components/ModList";
import JSON5 from "json5";

export interface ElectronScannedConfig {
  fileName: string;
  rawJson: any;
  filePath: string;
  index: number;
  fileHandle: FileSystemFileHandle;
}

export interface ElectronScannedMod {
  mod: Mod;
  configs: ElectronScannedConfig[];
  folderPath: string;
  dirHandle: FileSystemDirectoryHandle;
}

/**
 * Scan an SPT installation directory for mods.
 * Accepts the root FileSystemDirectoryHandle from the picker.
 */
export async function scanSPTFolderElectron(rootHandle: FileSystemDirectoryHandle): Promise<ElectronScannedMod[]> {
  // Try standard SPT mod paths
  const paths = [
    ["SPT", "user", "mods"],
    ["user", "mods"],
    [], // root might be the mods folder itself
  ];

  for (const pathParts of paths) {
    try {
      let modsDir = rootHandle;
      for (const part of pathParts) {
        modsDir = await modsDir.getDirectoryHandle(part);
      }
      const mods = await scanModsDirectory(modsDir);
      if (mods.length > 0) return mods;
    } catch {
      continue;
    }
  }

  return [];
}

async function scanModsDirectory(modsDir: FileSystemDirectoryHandle): Promise<ElectronScannedMod[]> {
  const scannedMods: ElectronScannedMod[] = [];

  for await (const [name, handle] of (modsDir as any).entries()) {
    if (handle.kind !== "directory") continue;
    const modData = await scanModFolder(handle as FileSystemDirectoryHandle, name);
    if (modData) scannedMods.push(modData);
  }

  return scannedMods;
}

async function scanModFolder(
  dirHandle: FileSystemDirectoryHandle,
  folderName: string
): Promise<ElectronScannedMod | null> {
  try {
    let packageJson: any = {};

    try {
      const pkgHandle = await dirHandle.getFileHandle("package.json");
      const pkgFile = await pkgHandle.getFile();
      const pkgText = await pkgFile.text();
      packageJson = JSON5.parse(pkgText);
    } catch {
      // No package.json — that's fine
    }

    const configs = await scanConfigFilesRecursive(dirHandle, "");
    configs.forEach((cfg, idx) => (cfg.index = idx));

    const mod: Mod = {
      id: packageJson.name || folderName,
      name: packageJson.displayName || packageJson.name || folderName,
      version: packageJson.version || "unknown",
      author: packageJson.author || "unknown",
      description: packageJson.description || "",
      configCount: configs.length,
    };

    return { mod, configs, folderPath: folderName, dirHandle };
  } catch (error) {
    console.error(`Error scanning mod folder ${folderName}`, error);
    return null;
  }
}

async function scanConfigFilesRecursive(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string
): Promise<ElectronScannedConfig[]> {
  const configs: ElectronScannedConfig[] = [];

  for await (const [name, handle] of (dirHandle as any).entries()) {
    if (handle.kind === "directory") {
      if (name === "node_modules" || name === ".git" || name === ".svn") continue;
      const subDir = handle as FileSystemDirectoryHandle;
      const subPath = basePath ? `${basePath}/${name}` : name;
      const subConfigs = await scanConfigFilesRecursive(subDir, subPath);
      configs.push(...subConfigs);
    } else if (handle.kind === "file" && /\.(json|jsonc|json5|txt|cfg|conf|log)$/i.test(name)) {
      try {
        const fileHandle = handle as FileSystemFileHandle;
        const relativePath = basePath ? `${basePath}/${name}` : name;

        let parsed = null;
        if (/\.json[c5]?$/i.test(name)) {
          const file = await fileHandle.getFile();
          const rawText = await file.text();
          try {
            parsed = JSON5.parse(rawText);
          } catch {
            parsed = {};
          }
        }

        configs.push({
          fileName: relativePath,
          rawJson: parsed,
          filePath: relativePath,
          index: -1,
          fileHandle,
        });
      } catch (error) {
        console.warn(`Failed scanning: ${basePath}/${name}`, error);
      }
    }
  }

  return configs;
}

export async function saveConfigToFileElectron(
  config: ElectronScannedConfig,
  values: ConfigValue[],
  originalJson: any
): Promise<void> {
  try {
    let content: string;

    if (values.length === 1 && values[0].key === "__RAW_JSON__" && values[0].type === "raw") {
      content = values[0].value as string;
    } else {
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
      content = JSON.stringify(updatedJson, null, 2);
    }

    const writable = await (config.fileHandle as any).createWritable();
    await writable.write(content);
    await writable.close();
  } catch (error) {
    console.error("Failed saving config:", error);
    throw error;
  }
}
