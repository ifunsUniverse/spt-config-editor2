import JSZip from "jszip";
import { ElectronScannedMod } from "./electronFolderScanner";
import { electronAPI } from "./electronBridge";
import path from "path-browserify";

/**
 * Recursively adds all files from an Electron directory path to a JSZip instance
 */
async function addDirectoryToZipElectron(
  zip: JSZip,
  dirPath: string,
  basePath: string,
  api: ReturnType<typeof electronAPI>
): Promise<void> {
  const entries = await api.readdir(dirPath);
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const entryPath = `${basePath}/${entry.name}`;

    if (entry.isFile) {
      const content = await api.readFile(fullPath);
      zip.file(entryPath, content);
    } else if (entry.isDirectory) {
      await addDirectoryToZipElectron(zip, fullPath, entryPath, api);
    }
  }
}

/**
 * Exports all scanned mods as a ZIP file with user/mods structure (Electron version)
 * Returns the blob URL for downloading
 */
export async function exportModsAsZip(
  scannedMods: ElectronScannedMod[],
  onProgress?: (percent: number, currentFile?: string) => void
): Promise<string> {
  const zip = new JSZip();
  const api = electronAPI();

  // Add each mod folder to user/mods/[modFolder]
  for (const scannedMod of scannedMods) {
    const modFolderName = scannedMod.mod.id;
    const modPath = `user/mods/${modFolderName}`;
    
    await addDirectoryToZipElectron(zip, scannedMod.folderPath, modPath, api);
  }

  // Generate the ZIP with streaming and compression
  const blob = await zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 5 },
      streamFiles: true
    },
    (metadata: any) => {
      try {
        const percent = typeof metadata?.percent === "number" ? metadata.percent : 0;
        const currentFile = (metadata as any)?.currentFile as string | undefined;
        onProgress?.(percent, currentFile);
      } catch {}
    }
  );
  
  const url = URL.createObjectURL(blob);
  return url;
}

/**
 * Triggers download of the ZIP file from a blob URL
 */
export function downloadZipFromUrl(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = "SPT Mods.zip";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object after download
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
