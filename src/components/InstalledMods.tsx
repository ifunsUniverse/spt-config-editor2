import { useState, useMemo, useCallback } from "react";
import { Package, Search, FolderOpen, RefreshCw, Power, PowerOff, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export interface InstalledMod {
  name: string;
  folderName: string;
  version?: string;
  author?: string;
  description?: string;
  source: "plugins" | "mods";
}

interface InstalledModsProps {
  pluginsPath: string | null;
  rootDirHandle?: FileSystemDirectoryHandle | null;
  onClose?: () => void;
}

// --- File system helpers ---

async function getSubDir(parent: FileSystemDirectoryHandle, path: string): Promise<FileSystemDirectoryHandle | null> {
  const parts = path.split("/").filter(Boolean);
  let current = parent;
  for (const part of parts) {
    try {
      current = await current.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }
  return current;
}

async function getOrCreateSubDir(parent: FileSystemDirectoryHandle, path: string): Promise<FileSystemDirectoryHandle> {
  const parts = path.split("/").filter(Boolean);
  let current = parent;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

async function scanFolder(dirHandle: FileSystemDirectoryHandle, source: "plugins" | "mods"): Promise<InstalledMod[]> {
  const items: InstalledMod[] = [];
  try {
    for await (const entry of (dirHandle as any).values()) {
      if (entry.kind === "directory") {
        const mod: InstalledMod = { name: entry.name, folderName: entry.name, source };
        try {
          const manifestHandle = await entry.getFileHandle("package.json");
          const file = await manifestHandle.getFile();
          const data = JSON.parse(await file.text());
          mod.name = data.name || entry.name;
          mod.version = data.version;
          mod.author = data.author;
          mod.description = data.description;
        } catch {
          // no manifest
        }
        items.push(mod);
      } else if (entry.kind === "file" && entry.name.endsWith(".dll")) {
        items.push({ name: entry.name.replace(".dll", ""), folderName: entry.name, source });
      }
    }
  } catch (err) {
    console.error("Failed to scan folder:", err);
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

async function copyEntry(
  srcHandle: FileSystemDirectoryHandle | FileSystemFileHandle,
  destParent: FileSystemDirectoryHandle,
  name: string
) {
  if ((srcHandle as any).kind === "file") {
    const fileHandle = srcHandle as FileSystemFileHandle;
    const file = await fileHandle.getFile();
    const destFile = await destParent.getFileHandle(name, { create: true });
    const writable = await (destFile as any).createWritable();
    await writable.write(await file.arrayBuffer());
    await writable.close();
  } else {
    const srcDir = srcHandle as FileSystemDirectoryHandle;
    const destDir = await destParent.getDirectoryHandle(name, { create: true });
    for await (const entry of (srcDir as any).values()) {
      await copyEntry(entry, destDir, entry.name);
    }
  }
}

async function removeEntry(parent: FileSystemDirectoryHandle, name: string) {
  await (parent as any).removeEntry(name, { recursive: true });
}

async function moveEntry(
  srcParent: FileSystemDirectoryHandle,
  destParent: FileSystemDirectoryHandle,
  name: string
) {
  const entry = await getEntryHandle(srcParent, name);
  if (!entry) throw new Error(`Entry "${name}" not found`);
  await copyEntry(entry, destParent, name);
  await removeEntry(srcParent, name);
}

async function getEntryHandle(
  parent: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemDirectoryHandle | FileSystemFileHandle | null> {
  try {
    return await parent.getDirectoryHandle(name);
  } catch {
    try {
      return await parent.getFileHandle(name);
    } catch {
      return null;
    }
  }
}

// --- Component ---

export const InstalledMods = ({ pluginsPath, rootDirHandle, onClose }: InstalledModsProps) => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"plugins" | "mods" | "disabled">("plugins");
  const [pluginsMods, setPluginsMods] = useState<InstalledMod[]>([]);
  const [userMods, setUserMods] = useState<InstalledMod[]>([]);
  const [disabledMods, setDisabledMods] = useState<InstalledMod[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  // Manual folder handles (fallback if no rootDirHandle)
  const [manualPluginsHandle, setManualPluginsHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [manualModsHandle, setManualModsHandle] = useState<FileSystemDirectoryHandle | null>(null);

  // Disabled mods storage folder
  const [storageHandle, setStorageHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [showStorageSettings, setShowStorageSettings] = useState(false);
  const [storageFolderName, setStorageFolderName] = useState<string | null>(
    () => localStorage.getItem("spt-disabled-storage-name")
  );

  // Resolved handles
  const getPluginsDir = useCallback(async (): Promise<FileSystemDirectoryHandle | null> => {
    if (manualPluginsHandle) return manualPluginsHandle;
    if (rootDirHandle) return getSubDir(rootDirHandle, "BepInEx/plugins");
    return null;
  }, [rootDirHandle, manualPluginsHandle]);

  const getModsDir = useCallback(async (): Promise<FileSystemDirectoryHandle | null> => {
    if (manualModsHandle) return manualModsHandle;
    if (rootDirHandle) return getSubDir(rootDirHandle, "user/mods");
    return null;
  }, [rootDirHandle, manualModsHandle]);

  const doScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const pluginsDir = await getPluginsDir();
      const modsDir = await getModsDir();

      const [plugins, mods] = await Promise.all([
        pluginsDir ? scanFolder(pluginsDir, "plugins") : Promise.resolve([]),
        modsDir ? scanFolder(modsDir, "mods") : Promise.resolve([]),
      ]);

      setPluginsMods(plugins);
      setUserMods(mods);

      // Scan disabled storage
      if (storageHandle) {
        const disabledPluginsDir = await getSubDir(storageHandle, "BepInEx/plugins");
        const disabledModsDir = await getSubDir(storageHandle, "user/mods");
        const [dp, dm] = await Promise.all([
          disabledPluginsDir ? scanFolder(disabledPluginsDir, "plugins") : Promise.resolve([]),
          disabledModsDir ? scanFolder(disabledModsDir, "mods") : Promise.resolve([]),
        ]);
        setDisabledMods([...dp, ...dm]);
      } else {
        setDisabledMods([]);
      }

      setHasScanned(true);
      toast.success(`Found ${plugins.length} plugin(s) and ${mods.length} mod(s)`);
    } catch (err: any) {
      toast.error("Scan failed", { description: err.message });
    } finally {
      setIsScanning(false);
    }
  }, [getPluginsDir, getModsDir, storageHandle]);

  // Auto-scan when rootDirHandle is available
  const [autoScanned, setAutoScanned] = useState(false);
  if (rootDirHandle && !autoScanned) {
    setAutoScanned(true);
    // defer to avoid state updates during render
    setTimeout(() => doScan(), 0);
  }

  const handleSelectPluginsFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      setManualPluginsHandle(handle);
      toast.success("BepInEx/plugins folder set");
    } catch (err: any) {
      if (err.name !== "AbortError") toast.error("Failed to set folder");
    }
  };

  const handleSelectModsFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      setManualModsHandle(handle);
      toast.success("user/mods folder set");
    } catch (err: any) {
      if (err.name !== "AbortError") toast.error("Failed to set folder");
    }
  };

  const handleSetStorageFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      setStorageHandle(handle);
      setStorageFolderName(handle.name);
      localStorage.setItem("spt-disabled-storage-name", handle.name);

      // Create sub-structure
      await getOrCreateSubDir(handle, "BepInEx/plugins");
      await getOrCreateSubDir(handle, "user/mods");

      toast.success("Disabled mods storage set", { description: handle.name });
      setShowStorageSettings(false);
    } catch (err: any) {
      if (err.name !== "AbortError") toast.error("Failed to set storage folder");
    }
  };

  const handleDisable = async (mod: InstalledMod) => {
    if (!storageHandle) {
      toast.error("No storage folder set", { description: "Set a disabled mods storage folder first." });
      setShowStorageSettings(true);
      return;
    }

    try {
      const srcDir = mod.source === "plugins" ? await getPluginsDir() : await getModsDir();
      if (!srcDir) throw new Error("Source folder not available");

      const destPath = mod.source === "plugins" ? "BepInEx/plugins" : "user/mods";
      const destDir = await getOrCreateSubDir(storageHandle, destPath);

      await moveEntry(srcDir, destDir, mod.folderName);
      toast.success(`Disabled "${mod.name}"`);
      await doScan();
    } catch (err: any) {
      toast.error("Failed to disable mod", { description: err.message });
    }
  };

  const handleEnable = async (mod: InstalledMod) => {
    if (!storageHandle) return;

    try {
      const storagePath = mod.source === "plugins" ? "BepInEx/plugins" : "user/mods";
      const storageDir = await getSubDir(storageHandle, storagePath);
      if (!storageDir) throw new Error("Storage sub-folder not found");

      const destDir = mod.source === "plugins" ? await getPluginsDir() : await getModsDir();
      if (!destDir) throw new Error("Destination folder not available");

      await moveEntry(storageDir, destDir, mod.folderName);
      toast.success(`Re-enabled "${mod.name}"`);
      await doScan();
    } catch (err: any) {
      toast.error("Failed to enable mod", { description: err.message });
    }
  };

  const filterItems = (items: InstalledMod[]) => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.folderName.toLowerCase().includes(q) ||
        m.author?.toLowerCase().includes(q)
    );
  };

  const filteredPlugins = useMemo(() => filterItems(pluginsMods), [pluginsMods, search]);
  const filteredMods = useMemo(() => filterItems(userMods), [userMods, search]);
  const filteredDisabled = useMemo(() => filterItems(disabledMods), [disabledMods, search]);

  const renderModCard = (mod: InstalledMod, mode: "active" | "disabled") => (
    <Card key={`${mod.source}-${mod.folderName}`} className="border-border">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-4 h-4 text-primary shrink-0" />
            <h3 className="font-semibold text-sm text-foreground leading-tight truncate">{mod.name}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {mod.version && (
              <Badge variant="secondary" className="text-[10px]">v{mod.version}</Badge>
            )}
            <Badge variant={mod.source === "plugins" ? "outline" : "secondary"} className="text-[10px]">
              {mod.source === "plugins" ? "Plugin" : "Mod"}
            </Badge>
          </div>
        </div>
        {mod.author && <p className="text-xs text-muted-foreground">by {mod.author}</p>}
        {mod.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{mod.description}</p>
        )}
        <p className="text-[10px] text-muted-foreground/60 font-mono truncate">{mod.folderName}</p>
        {mode === "active" ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs text-destructive hover:text-destructive"
            onClick={() => handleDisable(mod)}
          >
            <PowerOff className="w-3.5 h-3.5" />
            Disable
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs text-primary hover:text-primary"
            onClick={() => handleEnable(mod)}
          >
            <Power className="w-3.5 h-3.5" />
            Enable
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const renderEmpty = (message: string) => (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Package className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );

  const needsSetup = !rootDirHandle && !manualPluginsHandle && !manualModsHandle;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search installed mods..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowStorageSettings(true)}
          className="gap-1.5 text-xs shrink-0"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Storage
        </Button>
        {!needsSetup && (
          <Button variant="ghost" size="icon" onClick={doScan} disabled={isScanning} className="shrink-0">
            <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      {needsSetup ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4 px-4">
          <FolderOpen className="w-12 h-12 text-muted-foreground/30" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">No Folders Selected</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Select your BepInEx/plugins and user/mods folders to view installed mods, or go back and select your SPT root folder.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSelectPluginsFolder} variant="outline" className="gap-2 text-xs">
              <FolderOpen className="w-4 h-4" />
              BepInEx/plugins
            </Button>
            <Button onClick={handleSelectModsFolder} variant="outline" className="gap-2 text-xs">
              <FolderOpen className="w-4 h-4" />
              user/mods
            </Button>
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex flex-col flex-1 min-h-0">
          <div className="px-4 pt-2 shrink-0">
            <TabsList>
              <TabsTrigger value="plugins">
                BepInEx Plugins
                {pluginsMods.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{pluginsMods.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="mods">
                User Mods
                {userMods.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{userMods.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="disabled">
                Disabled
                {disabledMods.length > 0 && (
                  <Badge variant="destructive" className="ml-1.5 text-[10px] h-4 px-1">{disabledMods.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="plugins" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPlugins.length > 0
                  ? filteredPlugins.map((m) => renderModCard(m, "active"))
                  : renderEmpty(search ? `No plugins matching "${search}"` : "No BepInEx plugins found")}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="mods" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMods.length > 0
                  ? filteredMods.map((m) => renderModCard(m, "active"))
                  : renderEmpty(search ? `No mods matching "${search}"` : "No user mods found")}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="disabled" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                {!storageHandle ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                    <FolderOpen className="w-10 h-10 text-muted-foreground/30" />
                    <div>
                      <h3 className="text-base font-semibold text-foreground">No Storage Folder Set</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Set a storage folder to hold disabled mods. They'll be moved here and can be re-enabled later.
                      </p>
                    </div>
                    <Button onClick={() => setShowStorageSettings(true)} className="gap-2">
                      <Settings2 className="w-4 h-4" />
                      Set Storage Folder
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredDisabled.length > 0
                      ? filteredDisabled.map((m) => renderModCard(m, "disabled"))
                      : renderEmpty(search ? `No disabled mods matching "${search}"` : "No disabled mods")}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      )}

      {/* Storage Settings Dialog */}
      <Dialog open={showStorageSettings} onOpenChange={setShowStorageSettings}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Disabled Mods Storage
            </DialogTitle>
            <DialogDescription>
              Choose a folder to store disabled mods. The app will create <code>BepInEx/plugins</code> and <code>user/mods</code> subfolders inside it to preserve structure.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Storage Folder</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={storageFolderName || "Not set"}
                  className="text-xs bg-muted/30"
                />
                <Button variant="outline" size="sm" onClick={handleSetStorageFolder} className="gap-1.5 shrink-0">
                  <FolderOpen className="w-3.5 h-3.5" />
                  Browse
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Disabled mods will be moved here and organized into BepInEx/plugins and user/mods subfolders.
              </p>
            </div>
            {!rootDirHandle && (
              <div className="space-y-2 border-t border-border pt-3">
                <Label className="text-xs">Manual Folder Selection</Label>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectPluginsFolder} className="flex-1 gap-1.5 text-xs">
                    <FolderOpen className="w-3.5 h-3.5" />
                    BepInEx/plugins
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSelectModsFolder} className="flex-1 gap-1.5 text-xs">
                    <FolderOpen className="w-3.5 h-3.5" />
                    user/mods
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
