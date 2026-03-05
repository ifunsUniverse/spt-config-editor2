import { readdir, readFile, exists } from "@/utils/electronBridge";
import { ConfigValue } from "@/utils/configHelpers";
import { Mod } from "@/components/ModList";
import JSON5 from "json5";

export interface ScannedFileInfo {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  handle: FileSystemHandle;
}

export interface ElectronScannedConfig {
  fileName: string;
  rawJson: any;
  filePath: string;
  fileHandle?: FileSystemFileHandle;
  index: number;
}

export interface ElectronScannedMod {
  mod: Mod;
  configs: ElectronScannedConfig[];
  folderPath: string;
  dirHandle?: FileSystemDirectoryHandle;
}

async function getSubDir(handle: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await handle.getDirectoryHandle(name);
  } catch {
    return null;
  }
}

export async function scanSPTFolderElectron(rootHandle: FileSystemDirectoryHandle): Promise<ElectronScannedMod[]> {
  // Check standard SPT locations
  const paths = [
    ["SPT", "user", "mods"],
    ["user", "mods"],
  ];

  for (const segments of paths) {
    let current: FileSystemDirectoryHandle | null = rootHandle;
    for (const seg of segments) {
      if (!current) break;
      current = await getSubDir(current, seg);
    }
    if (current) {
      const entries = await readdir(current);
      const dirs = entries.filter(e => e.isDirectory);
      if (dirs.length > 0) {
        return scanMods(dirs, current);
      }
    }
  }

  // Fallback: maybe they selected the mods folder directly
  const entries = await readdir(rootHandle);
  const dirs = entries.filter(e => e.isDirectory);
  if (dirs.length > 0) {
    return scanMods(dirs, rootHandle);
  }

  return [];
}

async function scanMods(
  folders: { name: string; handle: FileSystemHandle }[],
  parentHandle: FileSystemDirectoryHandle
): Promise<ElectronScannedMod[]> {
  const scannedMods: ElectronScannedMod[] = [];
  for (const folder of folders) {
    const dirHandle = folder.handle as FileSystemDirectoryHandle;
    const modData = await scanModFolder(dirHandle, folder.name);
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
      const content = await readFile(pkgHandle);
      packageJson = JSON5.parse(content);
    } catch {
      // No package.json, that's fine
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
    console.error(`❌ Error scanning mod folder ${folderName}`, error);
    return null;
  }
}

async function scanConfigFilesRecursive(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string
): Promise<ElectronScannedConfig[]> {
  const configs: ElectronScannedConfig[] = [];
  try {
    const entries = await readdir(dirHandle);
    for (const entry of entries) {
      if (entry.isDirectory) {
        if (["node_modules", ".git", ".svn"].includes(entry.name)) continue;
        const subDir = entry.handle as FileSystemDirectoryHandle;
        const prefix = basePath ? `${basePath}/${entry.name}` : entry.name;
        const subConfigs = await scanConfigFilesRecursive(subDir, prefix);
        configs.push(...subConfigs);
      } else if (entry.isFile && /\.(json|jsonc|json5|txt|cfg|conf|log)$/i.test(entry.name)) {
        try {
          const relative = basePath ? `${basePath}/${entry.name}` : entry.name;
          const fileHandle = entry.handle as FileSystemFileHandle;

          let parsed = null;
          if (/\.json[c5]?$/i.test(entry.name)) {
            const rawText = await readFile(fileHandle);
            try {
              parsed = JSON5.parse(rawText);
            } catch {
              parsed = {};
            }
          }

          configs.push({
            fileName: relative,
            rawJson: parsed,
            filePath: relative,
            fileHandle,
            index: -1,
          });
        } catch (error) {
          console.warn(`❌ Failed scanning: ${entry.name}`, error);
        }
      }
    }
  } catch (error) {
    console.error(`❌ scanConfigFilesRecursive failed`, error);
  }
  return configs;
}

export async function saveConfigToFileElectron(
  config: ElectronScannedConfig,
  values: ConfigValue[],
  originalJson: any
): Promise<void> {
  if (!config.fileHandle) {
    throw new Error("No file handle available for saving");
  }

  try {
    if (values.length === 1 && values[0].key === "__RAW_JSON__" && values[0].type === "raw") {
      const writable = await (config.fileHandle as any).createWritable();
      await writable.write(values[0].value as string);
      await writable.close();
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
    const writable = await (config.fileHandle as any).createWritable();
    await writable.write(JSON.stringify(updatedJson, null, 2));
    await writable.close();
  } catch (error) {
    console.error("❌ Failed saving config:", error);
    throw error;
  }
}
