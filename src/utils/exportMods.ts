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
 * Returns the blob URL for downloading
 */
export async function exportModsAsZip(
  scannedMods: ScannedMod[],
  onProgress?: (percent: number, currentFile?: string) => void
): Promise<string> {
  const zip = new JSZip();

  // Add each mod folder to user/mods/[modFolder]
  for (const scannedMod of scannedMods) {
    const modFolderName = scannedMod.folderHandle.name;
    const modPath = `user/mods/${modFolderName}`;
    
    await addDirectoryToZip(zip, scannedMod.folderHandle, modPath);
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
