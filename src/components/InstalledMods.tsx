import { useState, useMemo, useCallback, useEffect } from "react";
import { Package, Search, FolderOpen, RefreshCw, Power, PowerOff, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DirectoryHandleLike, ElectronFileHandle } from "@/utils/electronBridge";

type InstalledModsTab = "plugins" | "mods" | "disabled";

interface DirectoryEntryLike {
  kind: "file" | "directory";
  name: string;
  getFile?: () => Promise<File>;
  getFileHandle?: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandle | ElectronFileHandle>;
}

interface DirectoryEntriesSource {
  entries: () => AsyncIterable<[string, DirectoryEntryLike]>;
}

interface WritableLike {
  write: (data: unknown) => Promise<void>;
  close: () => Promise<void>;
}

interface WritableFileLike {
  createWritable: () => Promise<WritableLike>;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
}

interface RemovableDirectoryLike {
  removeEntry: (name: string, options: { recursive: boolean }) => Promise<void>;
}

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

const asEntriesSource = (directory: DirectoryHandleLike): DirectoryEntriesSource =>
  directory as unknown as DirectoryEntriesSource;

const isWritableFileLike = (value: unknown): value is WritableFileLike =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { createWritable?: unknown }).createWritable === "function";

const isRemovableDirectoryLike = (value: DirectoryHandleLike): value is DirectoryHandleLike & RemovableDirectoryLike =>
  typeof (value as { removeEntry?: unknown }).removeEntry === "function";

const getDirectoryPath = (value: DirectoryHandleLike): string | null => {
  const maybePath = (value as { path?: unknown }).path;
  return typeof maybePath === "string" ? maybePath : null;
};

const getElectronInvoker =
  (): ((channel: string, payload?: Record<string, unknown>) => Promise<unknown>) | null => {
    if (!window.sptElectron?.invoke) return null;
    return window.sptElectron.invoke.bind(window.sptElectron);
  };

const isInstalledModsTab = (value: string): value is InstalledModsTab =>
  value === "plugins" || value === "mods" || value === "disabled";

const pickDirectory = async (): Promise<FileSystemDirectoryHandle> => {
  const pickerWindow = window as unknown as DirectoryPickerWindow;
  return pickerWindow.showDirectoryPicker({ mode: "readwrite" });
};

interface ModPackageJson {
  name?: string;
  version?: string;
  author?: string;
  description?: string;
}

export interface InstalledMod {
  name: string;
  folderName: string;
  version?: string;
  author?: string;
  description?: string;
  source: "plugins" | "mods";
}

interface InstalledModsProps {
  rootDirHandle?: DirectoryHandleLike | null;
}

// --- File system helpers ---


async function getSubDir(parent: DirectoryHandleLike, path: string): Promise<DirectoryHandleLike | null> {
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

async function getOrCreateSubDir(parent: DirectoryHandleLike, path: string): Promise<DirectoryHandleLike> {
  const parts = path.split("/").filter(Boolean);
  let current = parent;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  return current;
}

async function scanFolder(dirHandle: DirectoryHandleLike, source: "plugins" | "mods"): Promise<InstalledMod[]> {
  const items: InstalledMod[] = [];

  try {
    for await (const [, entry] of asEntriesSource(dirHandle).entries()) {
      // =========================
      // 🧱 MODS (user/mods - JS/TS server mods)
      // =========================
      if (source === "mods") {
        if (entry.kind !== "directory") continue;

        const mod: InstalledMod = {
          name: entry.name,
          folderName: entry.name,
          source,
        };

        try {
          let data: ModPackageJson | null = null;

          // package.json
          try {
            const manifestHandle = await entry.getFileHandle("package.json");
            const file = await manifestHandle.getFile();
            data = JSON.parse(await file.text()) as ModPackageJson;
          } catch {
            data = null;
          }

          // metadata
          if (data) {
            mod.name = data.name || entry.name;
            mod.version = data.version;
            mod.author = data.author;
            mod.description = data.description;
          }
        } catch (err) {
          console.warn("Failed to parse mod:", entry.name, err);
        }

        items.push(mod);
        continue;
      }

      // =========================
      // 🔌 PLUGINS (BepInEx - compiled .NET DLLs)
      // =========================
      if (source === "plugins") {
        if (entry.kind === "file" && entry.name.endsWith(".dll")) {
          items.push({
            name: entry.name.replace(".dll", ""),
            folderName: entry.name,
            source,
          });
          continue;
        }

        if (entry.kind === "directory") {
          items.push({
            name: entry.name,
            folderName: entry.name,
            source,
          });
        }
      }
    }
  } catch (err) {
    console.error("Failed to scan folder:", err);
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

async function copyEntry(
  srcHandle: DirectoryHandleLike | FileSystemFileHandle | ElectronFileHandle | DirectoryEntryLike,
  destParent: DirectoryHandleLike,
  name: string,
) {
  if ((srcHandle as { kind?: string }).kind === "file") {
    const fileHandle = srcHandle as FileSystemFileHandle | ElectronFileHandle;
    const file = await fileHandle.getFile();
    const destFile = await destParent.getFileHandle(name, { create: true });
    if (!isWritableFileLike(destFile)) {
      throw new Error("Destination file handle is not writable");
    }
    const writable = await destFile.createWritable();
    await writable.write(await file.arrayBuffer());
    await writable.close();
  } else {
    const srcDir = srcHandle as DirectoryHandleLike;
    const destDir = await destParent.getDirectoryHandle(name, { create: true });
    for await (const [, entry] of asEntriesSource(srcDir).entries()) {
      await copyEntry(entry, destDir, entry.name);
    }
  }
}

async function removeEntry(parent: DirectoryHandleLike, name: string) {
  if (isRemovableDirectoryLike(parent)) {
    await parent.removeEntry(name, { recursive: true });
    return;
  }

  const parentPath = getDirectoryPath(parent);
  const invoke = getElectronInvoker();
  if (parentPath && invoke) {
    const targetPath = `${String(parentPath).replace(/[\\/]$/, "")}/${name}`;
    await invoke("fs:remove", { path: targetPath });
    return;
  }

  throw new Error(`Unable to remove entry: ${name}`);
}

async function moveEntry(srcParent: DirectoryHandleLike, destParent: DirectoryHandleLike, name: string) {
  const entry = await getEntryHandle(srcParent, name);
  if (!entry) throw new Error(`Entry "${name}" not found`);
  await copyEntry(entry, destParent, name);
  await removeEntry(srcParent, name);
}

async function getEntryHandle(
  parent: DirectoryHandleLike,
  name: string,
): Promise<DirectoryHandleLike | FileSystemFileHandle | ElectronFileHandle | null> {
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

export const InstalledMods = ({ rootDirHandle }: InstalledModsProps) => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<InstalledModsTab>("plugins");
  const [pluginsMods, setPluginsMods] = useState<InstalledMod[]>([]);
  const [userMods, setUserMods] = useState<InstalledMod[]>([]);
  const [disabledMods, setDisabledMods] = useState<InstalledMod[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  // Manual folder handles (fallback if no rootDirHandle)
  const [manualPluginsHandle, setManualPluginsHandle] = useState<DirectoryHandleLike | null>(null);
  const [manualModsHandle, setManualModsHandle] = useState<DirectoryHandleLike | null>(null);

  // Disabled mods storage folder
  const [storageHandle, setStorageHandle] = useState<DirectoryHandleLike | null>(null);
  const [showStorageSettings, setShowStorageSettings] = useState(false);
  const [storageFolderName, setStorageFolderName] = useState<string | null>(() =>
    localStorage.getItem("spt-disabled-storage-name"),
  );

  // Resolved handles
  const getPluginsDir = useCallback(async () => {
    if (manualPluginsHandle) return manualPluginsHandle;

    if (!rootDirHandle) return null;

    let dir = await getSubDir(rootDirHandle, "BepInEx/plugins");
    if (dir) return dir;

    const nestedSPT = await getSubDir(rootDirHandle, "SPT");
    if (nestedSPT) {
      dir = await getSubDir(nestedSPT, "BepInEx/plugins");
      if (dir) return dir;
    }

    console.warn("❌ BepInEx/plugins not found anywhere");
    return null;
  }, [rootDirHandle, manualPluginsHandle]);

  const getModsDir = useCallback(async () => {
    if (manualModsHandle) return manualModsHandle;

    if (!rootDirHandle) return null;

    // Try standard path
    let dir = await getSubDir(rootDirHandle, "user/mods");
    if (dir) return dir;

    // Try nested SPT folder
    const nestedSPT = await getSubDir(rootDirHandle, "SPT");
    if (nestedSPT) {
      dir = await getSubDir(nestedSPT, "user/mods");
      if (dir) return dir;
    }

    console.warn("❌ user/mods not found anywhere");
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
    } catch (err: unknown) {
      toast.error("Scan failed", { description: getErrorMessage(err, "Could not scan folders") });
    } finally {
      setIsScanning(false);
    }
  }, [getPluginsDir, getModsDir, storageHandle]);

  // Auto-scan when rootDirHandle is available
  const [autoScanned, setAutoScanned] = useState(false);
  useEffect(() => {
    if (!rootDirHandle || autoScanned) return;
    setAutoScanned(true);
    void doScan();
  }, [rootDirHandle, autoScanned, doScan]);

  useEffect(() => {
    if (!manualPluginsHandle && !manualModsHandle) return;
    void doScan();
  }, [manualPluginsHandle, manualModsHandle, doScan]);

  const handleSelectPluginsFolder = async () => {
    try {
      const handle = await pickDirectory();
      setManualPluginsHandle(handle);
      toast.success("BepInEx/plugins folder set");
    } catch (err: unknown) {
      if (!isAbortError(err)) toast.error("Failed to set folder");
    }
  };

  const handleSelectModsFolder = async () => {
    try {
      const handle = await pickDirectory();
      setManualModsHandle(handle);
      toast.success("user/mods folder set");
    } catch (err: unknown) {
      if (!isAbortError(err)) toast.error("Failed to set folder");
    }
  };

  const handleSetStorageFolder = async () => {
    try {
      const handle = await pickDirectory();
      setStorageHandle(handle);
      setStorageFolderName(handle.name);
      localStorage.setItem("spt-disabled-storage-name", handle.name);

      // Create sub-structure
      await getOrCreateSubDir(handle, "BepInEx/plugins");
      await getOrCreateSubDir(handle, "user/mods");

      toast.success("Disabled mods storage set", { description: handle.name });
      setShowStorageSettings(false);
    } catch (err: unknown) {
      if (!isAbortError(err)) toast.error("Failed to set storage folder");
    }
  };

  const handleDisable = async (mod: InstalledMod) => {
    if (!storageHandle) {
      toast.error("No storage folder set", {
        description: "Set a disabled mods storage folder first.",
      });
      setShowStorageSettings(true);
      return;
    }

    await actuallyDisable(mod);
  };

  const actuallyDisable = async (mod: InstalledMod) => {
    try {
      const srcDir = mod.source === "plugins" ? await getPluginsDir() : await getModsDir();

      if (!srcDir) throw new Error("Source folder not available");

      const destPath = mod.source === "plugins" ? "BepInEx/plugins" : "user/mods";

      const destDir = await getOrCreateSubDir(storageHandle!, destPath);

      await moveEntry(srcDir, destDir, mod.folderName);

      toast.success(`Disabled "${mod.name}"`);
      await doScan();
    } catch (err: unknown) {
      toast.error("Failed to disable mod", {
        description: getErrorMessage(err, "Unable to disable mod"),
      });
    }
  };

  const handleEnable = async (mod: InstalledMod) => {
    if (!storageHandle) {
      toast.error("No storage folder set");
      return;
    }

    try {
      // Where the mod currently is (disabled storage)
      const srcPath = mod.source === "plugins" ? "BepInEx/plugins" : "user/mods";

      const srcDir = await getSubDir(storageHandle, srcPath);
      if (!srcDir) throw new Error("Disabled mod source not found");

      // Where it should go (active install)
      const destDir = mod.source === "plugins" ? await getPluginsDir() : await getModsDir();

      if (!destDir) throw new Error("Destination folder not available");

      await moveEntry(srcDir, destDir, mod.folderName);

      toast.success(`Enabled "${mod.name}"`);
      await doScan();
    } catch (err: unknown) {
      toast.error("Failed to enable mod", {
        description: getErrorMessage(err, "Unable to enable mod"),
      });
    }
  };

  const filterItems = useCallback(
    (items: InstalledMod[]) => {
      if (!search.trim()) return items;
      const q = search.toLowerCase();
      return items.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.folderName.toLowerCase().includes(q) ||
          m.author?.toLowerCase().includes(q),
      );
    },
    [search]
  );

  const filteredPlugins = useMemo(() => filterItems(pluginsMods), [pluginsMods, filterItems]);
  const filteredMods = useMemo(() => filterItems(userMods), [userMods, filterItems]);
  const filteredDisabled = useMemo(() => filterItems(disabledMods), [disabledMods, filterItems]);
  const totalActiveMods = pluginsMods.length + userMods.length;

  const currentTabMeta = {
    plugins: {
      title: "BepInEx Plugins",
      description: "Compiled client-side plugins detected in your current install.",
      items: filteredPlugins,
      empty: search ? `No plugins matching "${search}"` : "No BepInEx plugins found",
    },
    mods: {
      title: "User Mods",
      description: "Server-side mods discovered in your user/mods directory.",
      items: filteredMods,
      empty: search ? `No mods matching "${search}"` : "No user mods found",
    },
    disabled: {
      title: "Disabled Mods",
      description: "Mods moved into storage so they stay available but inactive.",
      items: filteredDisabled,
      empty: search ? `No disabled mods matching "${search}"` : "No disabled mods",
    },
  } as const;

  const renderModCard = (mod: InstalledMod, mode: "active" | "disabled") => {
    return (
      <Card
        key={`${mod.source}-${mod.folderName}`}
        className="overflow-hidden border-border/80 bg-card/70 shadow-sm transition-colors hover:border-primary/30"
      >
        <CardContent className="p-0">
          <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/80">
                  <Package className="w-4 h-4 text-primary shrink-0" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-foreground leading-tight truncate">{mod.name}</h3>
                  <p className="text-[11px] text-muted-foreground font-mono truncate mt-1">{mod.folderName}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {mod.version && (
                  <Badge variant="secondary" className="text-[10px] h-5 px-2">
                    v{mod.version}
                  </Badge>
                )}
                <Badge variant={mod.source === "plugins" ? "outline" : "secondary"} className="text-[10px] h-5 px-2">
                  {mod.source === "plugins" ? "Plugin" : "Mod"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full border border-border/70 bg-background px-2 py-1">
                {mod.author ? `by ${mod.author}` : "Unknown author"}
              </span>
              <span className="rounded-full border border-border/70 bg-background px-2 py-1">
                {mode === "disabled" ? "Disabled" : "Active"}
              </span>
            </div>

            {mod.description ? (
              <p className="text-xs text-muted-foreground leading-relaxed min-h-10 line-clamp-2">{mod.description}</p>
            ) : (
              <p className="text-xs text-muted-foreground/70 leading-relaxed min-h-10">
                No description was found for this installed {mod.source === "plugins" ? "plugin" : "mod"}.
              </p>
            )}

            <div className="rounded-lg border border-border/60 bg-background/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-2">Status</p>
              <p className="text-xs text-foreground/85 leading-relaxed">
                {mode === "disabled"
                  ? "Stored in disabled mods storage and ready to re-enable."
                  : mod.source === "plugins"
                    ? "Loaded from your BepInEx/plugins directory."
                    : "Loaded from your user/mods directory."}
              </p>
            </div>

            {mode === "active" ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs h-9 border-border bg-background/60"
                onClick={() => handleDisable(mod)}
              >
                <PowerOff className="w-3.5 h-3.5" />
                Disable This {mod.source === "plugins" ? "Plugin" : "Mod"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs h-9 border-border bg-background/60"
                onClick={() => handleEnable(mod)}
              >
                <Power className="w-3.5 h-3.5" />
                Re-Enable This {mod.source === "plugins" ? "Plugin" : "Mod"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderEmpty = (message: string) => (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/30 py-16 text-muted-foreground">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/80">
        <Package className="w-6 h-6 opacity-40" />
      </div>
      <p className="text-sm font-medium text-foreground/80">Nothing to show here yet</p>
      <p className="text-xs mt-1 max-w-sm text-center">{message}</p>
    </div>
  );

  const needsSetup = !rootDirHandle && !manualPluginsHandle && !manualModsHandle;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card/85 via-card/55 to-background/95 shadow-sm">
      <div className="shrink-0 border-b border-border/70 bg-muted/10 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background/80 shadow-sm">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Installed Mods</h2>
                  <p className="text-sm text-muted-foreground">
                    Browse active plugins, user mods, and anything moved into disabled storage.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Active Total</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{totalActiveMods}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Plugins</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{pluginsMods.length}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Disabled Stored</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{disabledMods.length}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 xl:items-end">
              <div className="relative w-full xl:w-[360px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search installed mods..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 border-border/70 bg-background/85 pl-9"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStorageSettings(true)}
                  className="gap-1.5 text-xs shrink-0 border-border/70 bg-background/70"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Storage
                </Button>
                {!needsSetup && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={doScan}
                    disabled={isScanning}
                    className="gap-1.5 text-xs shrink-0 border-border/70 bg-background/70"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
                    {isScanning ? "Refreshing..." : hasScanned ? "Refresh Scan" : "Scan Now"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {needsSetup ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-border/70 bg-background/70">
            <FolderOpen className="w-9 h-9 text-muted-foreground/40" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground">No folders selected yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Select your BepInEx/plugins and user/mods folders to view installed mods, or go back and select your SPT
              root folder.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleSelectPluginsFolder} variant="outline" className="gap-2 text-xs h-10 px-4">
              <FolderOpen className="w-4 h-4" />
              BepInEx/plugins
            </Button>
            <Button onClick={handleSelectModsFolder} variant="outline" className="gap-2 text-xs h-10 px-4">
              <FolderOpen className="w-4 h-4" />
              user/mods
            </Button>
          </div>
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (isInstalledModsTab(value)) {
              setActiveTab(value);
            }
          }}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="px-4 pt-4 shrink-0 sm:px-5">
            <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 md:grid-cols-3">
              <TabsTrigger
                value="plugins"
                className="justify-between rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-left data-[state=active]:border-primary/30 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <span className="flex flex-col items-start">
                  <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Client</span>
                  <span className="text-sm font-medium">BepInEx Plugins</span>
                </span>
                {pluginsMods.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] h-5 px-2">
                    {pluginsMods.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="mods"
                className="justify-between rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-left data-[state=active]:border-primary/30 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <span className="flex flex-col items-start">
                  <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Server</span>
                  <span className="text-sm font-medium">User Mods</span>
                </span>
                {userMods.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] h-5 px-2">
                    {userMods.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="disabled"
                className="justify-between rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-left data-[state=active]:border-primary/30 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <span className="flex flex-col items-start">
                  <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Storage</span>
                  <span className="text-sm font-medium">Disabled</span>
                </span>
                {disabledMods.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] h-5 px-2">
                    {disabledMods.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="plugins" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 sm:p-5 space-y-4">
                <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{currentTabMeta.plugins.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{currentTabMeta.plugins.description}</p>
                    </div>
                    <Badge variant="outline" className="h-6 px-2 text-[11px]">
                      {currentTabMeta.plugins.items.length} visible
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {filteredPlugins.length > 0
                    ? filteredPlugins.map((m) => renderModCard(m, "active"))
                    : renderEmpty(currentTabMeta.plugins.empty)}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="mods" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 sm:p-5 space-y-4">
                <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{currentTabMeta.mods.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{currentTabMeta.mods.description}</p>
                    </div>
                    <Badge variant="outline" className="h-6 px-2 text-[11px]">
                      {currentTabMeta.mods.items.length} visible
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                  {filteredMods.length > 0
                    ? filteredMods.map((m) => renderModCard(m, "active"))
                    : renderEmpty(currentTabMeta.mods.empty)}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="disabled" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 sm:p-5 space-y-4">
                <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{currentTabMeta.disabled.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{currentTabMeta.disabled.description}</p>
                    </div>
                    <Badge variant="outline" className="h-6 px-2 text-[11px]">
                      {currentTabMeta.disabled.items.length} visible
                    </Badge>
                  </div>
                </div>

                {!storageHandle ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/30 py-16 text-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-background/80">
                      <FolderOpen className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">No storage folder set</h3>
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
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                    {filteredDisabled.length > 0
                      ? filteredDisabled.map((m) => renderModCard(m, "disabled"))
                      : renderEmpty(currentTabMeta.disabled.empty)}
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
              Choose a folder to store disabled mods. The app will create <code>BepInEx/plugins</code> and{" "}
              <code>user/mods</code> subfolders inside it to preserve structure.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Storage Folder</Label>
              <div className="flex gap-2">
                <Input readOnly value={storageFolderName || "Not set"} className="text-xs bg-muted/30" />
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectPluginsFolder}
                    className="flex-1 gap-1.5 text-xs"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    BepInEx/plugins
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectModsFolder}
                    className="flex-1 gap-1.5 text-xs"
                  >
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
