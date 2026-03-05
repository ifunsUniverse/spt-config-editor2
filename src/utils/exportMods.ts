import JSZip from "jszip";
import { ElectronScannedMod } from "./electronFolderScanner";
import { saveFile } from "./electronBridge";

/**
 * Recursively adds all files from a FileSystemDirectoryHandle to a JSZip instance
 */
async function addDirectoryToZip(
  zip: JSZip,
  dirHandle: FileSystemDirectoryHandle,
  basePath: string
): Promise<void> {
  for await (const [name, handle] of (dirHandle as any).entries()) {
    const entryPath = `${basePath}/${name}`;
    if (handle.kind === "file") {
      const file = await (handle as FileSystemFileHandle).getFile();
      const content = await file.arrayBuffer();
      zip.file(entryPath, content);
    } else if (handle.kind === "directory") {
      await addDirectoryToZip(zip, handle as FileSystemDirectoryHandle, entryPath);
    }
  }
}

/**
 * Exports all scanned mods as a ZIP file using the web File System Access API
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
    await addDirectoryToZip(zip, mod.dirHandle, modZipPath);
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

  await saveFile(blob, "SPT_Mods_Backup.zip");
}
