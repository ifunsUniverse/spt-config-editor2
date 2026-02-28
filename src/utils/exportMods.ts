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
    const fullPath = dirPath.includes("\\") 
      ? `${dirPath}\\${entry.name}` 
      : `${dirPath}/${entry.name}`;
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
 * Exports all scanned mods as a ZIP file using Native Electron Save Dialog
 */
export async function exportModsAsZip(
  scannedMods: ElectronScannedMod[],
  isFourOhStyle: boolean,                      
  onProgress?: (percent: number, currentFile?: string) => void
): Promise<void> {                           
  const zip = new JSZip();
  const baseFolder = isFourOhStyle ? "SPT/user/mods" : "user/mods";

  for (const mod of scannedMods) {
    const modFolderName = mod.mod.id;
    const modZipPath = `${baseFolder}/${modFolderName}`;
    await addDirectoryToZipElectron(zip, mod.folderPath, modZipPath);
  }

  const blob = await zip.generateAsync(
    {
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 5 },
    },
    (meta) => {
      onProgress?.(meta.percent ?? 0, meta.currentFile);
    }
  );

  // Use native save dialog
  const saveResult = await (window as any).electronBridge.saveFile({
    title: 'Export Mods ZIP',
    defaultPath: 'SPT_Mods_Backup.zip',
    filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
  });

  if (!saveResult.canceled && saveResult.filePath) {
    // Convert Uint8Array to Buffer-like string for the bridge
    // Actually, Electron's fs.writeFile handles Buffers/Uint8Arrays directly if passed correctly
    // But since our bridge expects string, we'll convert or ensure the bridge can handle binary
    await (window as any).electronBridge.writeFile(saveResult.filePath, blob);
  }
}