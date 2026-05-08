/**
 * Web-native folder scanner using File System Access API.
 * Replaces the former Electron-based scanner.
 */

import { ConfigValue } from "@/utils/configHelpers";
import { Mod } from "@/components/ModList";
import { DirectoryHandleLike, ElectronDirectoryHandle, ElectronFileHandle } from "@/utils/electronBridge";
import JSON5 from "json5";

// ─── Scan Cache ──────────────────────────────────────────────────────────────
const SCAN_CACHE_KEY = "spt_scan_cache_v1";

interface ScanCache {
  rootPath: string;
  /** Sorted list of mod folder names — used as a quick staleness check. */
  modFolderNames: string[];
  mods: Array<{
    mod: Mod;
    folderPath: string;
    absoluteFolderPath: string;
    configs: Array<{
      fileName: string;
      rawJson: any;
      filePath: string;
      index: number;
      absoluteFilePath: string;
    }>;
  }>;
}

const isElectronAvailable = () => Boolean((window as any).sptElectron?.invoke);

/** Persist a scan result so it can be restored without re-scanning. */
export async function saveScanCache(
  rootHandle: DirectoryHandleLike,
  mods: ElectronScannedMod[]
): Promise<void> {
  if (!isElectronAvailable() || !(rootHandle instanceof ElectronDirectoryHandle)) return;
  try {
    const cache: ScanCache = {
      rootPath: rootHandle.path,
      modFolderNames: mods.map((m) => m.folderPath).sort(),
      mods: mods.map((m) => ({
        mod: m.mod,
        folderPath: m.folderPath,
        absoluteFolderPath: (m.dirHandle as ElectronDirectoryHandle).path,
        configs: m.configs.map((c) => ({
          fileName: c.fileName,
          rawJson: c.rawJson,
          filePath: c.filePath,
          index: c.index,
          absoluteFilePath: (c.fileHandle as ElectronFileHandle).path,
        })),
      })),
    };
    await (window as any).sptElectron.invoke("store:write", {
      key: SCAN_CACHE_KEY,
      content: JSON.stringify(cache),
    });
  } catch (e) {
    console.warn("[scanCache] Failed to save", e);
  }
}

/**
 * Try to restore a previous scan result.
 * Returns null if nothing is cached, the cache is stale, or reconstruction fails.
 * Staleness is checked with a single readdir against the mods directory.
 */
export async function loadScanCache(
  rootHandle: DirectoryHandleLike
): Promise<ElectronScannedMod[] | null> {
  if (!isElectronAvailable() || !(rootHandle instanceof ElectronDirectoryHandle)) return null;
  try {
    const raw = await (window as any).sptElectron.invoke("store:read", { key: SCAN_CACHE_KEY });
    if (!raw) return null;

    const cache: ScanCache = JSON.parse(raw);
    if (cache.rootPath !== rootHandle.path) return null;

    // Find the mods directory with one existence check per candidate.
    const candidates = [
      rootHandle.path + "/SPT/user/mods",
      rootHandle.path + "/user/mods",
    ];
    let modsDirPath: string | null = null;
    for (const p of candidates) {
      const exists = await (window as any).sptElectron.invoke("fs:exists", { path: p, kind: "directory" });
      if (exists) { modsDirPath = p; break; }
    }
    if (!modsDirPath) return null;

    // Single fast readdir to check for added/removed mod folders.
    const entries: Array<{ name: string; kind: string }> = await (window as any).sptElectron.invoke(
      "fs:readDir", { path: modsDirPath }
    );
    const currentFolders = entries
      .filter((e) => e.kind === "directory")
      .map((e) => e.name)
      .sort()
      .join(",");
    if (currentFolders !== cache.modFolderNames.join(",")) return null;

    // Cache is valid — reconstruct handles from stored paths.
    return cache.mods.map((cm) => ({
      mod: cm.mod,
      folderPath: cm.folderPath,
      dirHandle: new ElectronDirectoryHandle(cm.absoluteFolderPath),
      configs: cm.configs.map((cc) => ({
        fileName: cc.fileName,
        rawJson: cc.rawJson,
        filePath: cc.filePath,
        index: cc.index,
        fileHandle: new ElectronFileHandle(cc.absoluteFilePath),
      })),
    }));
  } catch (e) {
    console.warn("[scanCache] Failed to load", e);
    return null;
  }
}

export interface ElectronScannedConfig {
  fileName: string;
  rawJson: any;
  filePath: string;
  index: number;
  fileHandle: FileSystemFileHandle | ElectronFileHandle;
}

export interface ElectronScannedMod {
  mod: Mod;
  configs: ElectronScannedConfig[];
  folderPath: string;
  dirHandle: DirectoryHandleLike;
}

/**
 * Scan an SPT installation directory for mods.
 * Accepts the root FileSystemDirectoryHandle from the picker.
 */
export async function scanSPTFolderElectron(rootHandle: DirectoryHandleLike): Promise<ElectronScannedMod[]> {
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

async function scanModsDirectory(modsDir: DirectoryHandleLike): Promise<ElectronScannedMod[]> {
  const scannedMods: ElectronScannedMod[] = [];

  for await (const [name, handle] of (modsDir as any).entries()) {
    if (handle.kind !== "directory") continue;
    const modData = await scanModFolder(handle as DirectoryHandleLike, name);
    if (modData) scannedMods.push(modData);
  }

  return scannedMods;
}

async function scanModFolder(
  dirHandle: DirectoryHandleLike,
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
  dirHandle: DirectoryHandleLike,
  basePath: string
): Promise<ElectronScannedConfig[]> {
  const configs: ElectronScannedConfig[] = [];

  for await (const [name, handle] of (dirHandle as any).entries()) {
    if (handle.kind === "directory") {
      if (name === "node_modules" || name === ".git" || name === ".svn") continue;
      const subDir = handle as DirectoryHandleLike;
      const subPath = basePath ? `${basePath}/${name}` : name;
      const subConfigs = await scanConfigFilesRecursive(subDir, subPath);
      configs.push(...subConfigs);
    } else if (handle.kind === "file" && /\.(json|jsonc|json5|txt|cfg|conf|log)$/i.test(name)) {
      try {
        const fileHandle = handle as FileSystemFileHandle | ElectronFileHandle;
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
