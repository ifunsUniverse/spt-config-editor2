import JSZip from "jszip";
import { ElectronScannedMod } from "./electronFolderScanner";
import { readdir, readFile } from "./electronBridge";
import path from "path-browserify";

/**
 * Recursively adds all files from an Electron directory path to a JSZip instance
 */
async function addDirectoryToZipElectron(
  zip: JSZip,
  dirPath: string,
  basePath: string
): Promise<void> {
  const entries = await readdir(dirPath);
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const entryPath = `${basePath}/${entry.name}`;

    if (entry.isFile) {
      const content = await readFile(fullPath);
      zip.file(entryPath, content);
    } else if (entry.isDirectory) {
      await addDirectoryToZipElectron(zip, fullPath, entryPath);
    }
  }
}

/**
 * Exports all scanned mods as a ZIP file with user/mods structure (Electron version)
 * Returns the blob URL for downloading
 */
export async function exportModsAsZip(
  scannedMods: ElectronScannedMod[],
  configFiles: Record<string, any>,
  isFourOhStyle: boolean,                      // <-- version flag
  onProgress?: (percent: number, currentFile?: string) => void
): Promise<string> {                           // <-- return blob URL
  const zip = new JSZip();

  // decide folder layout here
  const baseFolder = isFourOhStyle ? "SPT/user/mods" : "user/mods";

  for (const mod of scannedMods) {
    const modFolderName = mod.mod.id;
    const modZipPath = `${baseFolder}/${modFolderName}`;

    await addDirectoryToZipElectron(zip, mod.folderPath, modZipPath);
  }

  const blob = await zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 5 },
    },
    (meta) => {
      onProgress?.(meta.percent ?? 0, meta.currentFile);
    }
  );

  return URL.createObjectURL(blob); // ✅ return blob url for downloading
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
