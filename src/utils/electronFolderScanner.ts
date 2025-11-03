import {
  readdir,
  stat,
  exists,
  readFile,
  selectFolder,
} from "@/utils/electronBridge";


export interface ScannedFileInfo {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  fullPath: string;
}

export async function scanFolder(folderPath: string): Promise<ScannedFileInfo[]> {
  try {
    // Ensure the folder actually exists
    const folderExists = await exists(folderPath);
    if (!folderExists) {
      console.warn(`[Scanner] Folder does not exist: ${folderPath}`);
      return [];
    }

    const entries = await readdir(folderPath);

    const scannedItems = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = `${folderPath}/${entry.name}`;
        const info = await stat(fullPath);

        return {
          name: entry.name,
          fullPath,
          isDirectory: info.isDirectory,
          isFile: info.isFile,
        } as ScannedFileInfo;
      })
    );

    return scannedItems;
  } catch (error) {
    console.error("[Scanner] Failed to read folder:", error);
    return [];
  }
}
