import { useState, useMemo, useEffect } from "react";
import { Package, Search, FolderOpen, Trash2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export interface InstalledMod {
  name: string;
  folderName: string;
  version?: string;
  author?: string;
  description?: string;
}

interface InstalledModsProps {
  pluginsPath: string | null;
  onClose?: () => void;
}

async function scanPluginsFolder(dirHandle: FileSystemDirectoryHandle): Promise<InstalledMod[]> {
  const mods: InstalledMod[] = [];
  try {
    for await (const entry of (dirHandle as any).values()) {
      if (entry.kind === "directory") {
        const mod: InstalledMod = {
          name: entry.name,
          folderName: entry.name,
        };
        // Try to read package.json or manifest
        try {
          const manifestHandle = await entry.getFileHandle("package.json");
          const file = await manifestHandle.getFile();
          const text = await file.text();
          const data = JSON.parse(text);
          mod.name = data.name || entry.name;
          mod.version = data.version;
          mod.author = data.author;
          mod.description = data.description;
        } catch {
          // No package.json, just use folder name
        }
        mods.push(mod);
      } else if (entry.kind === "file" && entry.name.endsWith(".dll")) {
        mods.push({
          name: entry.name.replace(".dll", ""),
          folderName: entry.name,
        });
      }
    }
  } catch (err) {
    console.error("Failed to scan plugins folder:", err);
  }
  return mods.sort((a, b) => a.name.localeCompare(b.name));
}

export const InstalledMods = ({ pluginsPath, onClose }: InstalledModsProps) => {
  const [search, setSearch] = useState("");
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const filteredMods = useMemo(() => {
    if (!search.trim()) return installedMods;
    const q = search.toLowerCase();
    return installedMods.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.folderName.toLowerCase().includes(q) ||
        m.author?.toLowerCase().includes(q)
    );
  }, [installedMods, search]);

  const handleSelectFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "read" });
      setDirHandle(handle);
      setIsScanning(true);
      const mods = await scanPluginsFolder(handle);
      setInstalledMods(mods);
      localStorage.setItem("spt-plugins-folder-name", handle.name);
      toast.success(`Found ${mods.length} installed mod(s)`);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error("Failed to scan folder", { description: err.message });
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleRescan = async () => {
    if (!dirHandle) return;
    setIsScanning(true);
    try {
      const mods = await scanPluginsFolder(dirHandle);
      setInstalledMods(mods);
      toast.success(`Found ${mods.length} installed mod(s)`);
    } catch (err: any) {
      toast.error("Rescan failed", { description: err.message });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
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
        <Button variant="outline" size="sm" onClick={handleSelectFolder} className="gap-1.5 text-xs shrink-0">
          <FolderOpen className="w-3.5 h-3.5" />
          {dirHandle ? "Change Folder" : "Select Plugins Folder"}
        </Button>
        {dirHandle && (
          <Button variant="ghost" size="icon" onClick={handleRescan} disabled={isScanning} className="shrink-0">
            <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {!dirHandle ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <FolderOpen className="w-12 h-12 text-muted-foreground/30" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">No Plugins Folder Selected</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Select your BepInEx/plugins folder to view installed mods.
                </p>
              </div>
              <Button onClick={handleSelectFolder} className="gap-2">
                <FolderOpen className="w-4 h-4" />
                Select Plugins Folder
              </Button>
            </div>
          ) : filteredMods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <p>{search ? `No mods matching "${search}"` : "No mods found in this folder"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMods.map((mod) => (
                <Card key={mod.folderName} className="border-border">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary shrink-0" />
                        <h3 className="font-semibold text-sm text-foreground leading-tight">{mod.name}</h3>
                      </div>
                      {mod.version && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">v{mod.version}</Badge>
                      )}
                    </div>
                    {mod.author && (
                      <p className="text-xs text-muted-foreground">by {mod.author}</p>
                    )}
                    {mod.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{mod.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 font-mono truncate">{mod.folderName}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
