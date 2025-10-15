import JSZip from "jszip";
import { ScannedMod } from "./folderScanner";

/**
 * Recursively adds all files from a directory handle to a JSZip instance
 */
async function addDirectoryToZip(
  zip: JSZip,
  dirHandle: FileSystemDirectoryHandle,
  basePath: string
): Promise<void> {
  // @ts-ignore - values() exists but TypeScript doesn't recognize it
  for await (const entry of dirHandle.values()) {
    const entryPath = `${basePath}/${entry.name}`;

    if (entry.kind === "file") {
      const fileHandle = entry as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      zip.file(entryPath, file);
    } else if (entry.kind === "directory") {
      const subDirHandle = entry as FileSystemDirectoryHandle;
      await addDirectoryToZip(zip, subDirHandle, entryPath);
    }
  }
}

/**
 * Exports all scanned mods as a ZIP file with user/mods structure
 */
export async function exportModsAsZip(scannedMods: ScannedMod[]): Promise<void> {
  const zip = new JSZip();

  // Add each mod folder to user/mods/[modFolder]
  for (const scannedMod of scannedMods) {
    const modFolderName = scannedMod.folderHandle.name;
    const modPath = `user/mods/${modFolderName}`;
    
    await addDirectoryToZip(zip, scannedMod.folderHandle, modPath);
  }

  // Generate and download the ZIP
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = "SPT Mods.zip";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
