import JSZip from "jszip";
import { ElectronScannedMod } from "./electronFolderScanner";
import { readdir, readFile } from "./electronBridge";

async function addDirectoryToZipBrowser(
  zip: JSZip,
  dirHandle: FileSystemDirectoryHandle,
  basePath: string
): Promise<void> {
  const entries = await readdir(dirHandle);

  for (const entry of entries) {
    const entryPath = `${basePath}/${entry.name}`;

    if (entry.isFile) {
      const fileHandle = entry.handle as FileSystemFileHandle;
      const content = await readFile(fileHandle);
      zip.file(entryPath, content);
    } else if (entry.isDirectory) {
      const subDir = entry.handle as FileSystemDirectoryHandle;
      await addDirectoryToZipBrowser(zip, subDir, entryPath);
    }
  }
}

export async function exportModsAsZip(
  scannedMods: ElectronScannedMod[],
  isFourOhStyle: boolean,
  onProgress?: (percent: number, currentFile?: string) => void
): Promise<void> {
  const zip = new JSZip();
  const baseFolder = isFourOhStyle ? "SPT/user/mods" : "user/mods";

  for (const mod of scannedMods) {
    if (!mod.dirHandle) continue;
    const modFolderName = mod.mod.id;
    const modZipPath = `${baseFolder}/${modFolderName}`;
    await addDirectoryToZipBrowser(zip, mod.dirHandle, modZipPath);
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

  // Browser download
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "SPT_Mods_Backup.zip";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
