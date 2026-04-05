import { useState, useMemo, useEffect, useCallback } from "react";
import { ArrowLeft, Search, KeyRound, Download, Settings2, ChevronLeft, ChevronRight, Calendar, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InstalledMods } from "@/components/InstalledMods";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModVersion {
  version: string;
  releasedAt: string;
  downloadUrl?: string;
  fileSize?: string;
  downloads?: number;
}

interface BrowsableMod {
  id: string;
  name: string;
  author: string;
  description: string;
  thumbnail?: string;
  versions: ModVersion[];
  tags?: string[];
  sptVersion?: string;
  totalDownloads?: number;
  category?: string;
}

interface ApiKeyPermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

const FORGE_API_BASE = "https://forge.sp-tarkov.com/api/v0";

function useMods(apiKey: string | null, page: number, searchQuery: string, sortBy: string) {
  const [mods, setMods] = useState<BrowsableMod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);

  const fetchMods = useCallback(async () => {
    if (!apiKey) {
      setMods([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        include: "versions,category",
      });

      if (searchQuery.trim()) {
        params.set("query", searchQuery.trim());
      }

      // Map sort UI values to API sort params
      switch (sortBy) {
        case "downloads":
          params.set("sort", "-downloads");
          break;
        case "name":
          params.set("sort", "name");
          break;
        case "recent":
        default:
          params.set("sort", "-updated");
          break;
      }

      const res = await fetch(`${FORGE_API_BASE}/mods?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new Error("Invalid or expired API key. Please re-enter your key.");
        }
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      const json = await res.json();

      // The API returns { data: [...], meta: { current_page, last_page, ... } }
      const rawMods = json.data || json;
      const meta = json.meta;

      const mapped: BrowsableMod[] = (Array.isArray(rawMods) ? rawMods : []).map((m: any) => {
        const versions: ModVersion[] = (m.versions || []).map((v: any) => ({
          version: v.version || v.spt_version || "unknown",
          releasedAt: v.created_at || v.updated_at || "",
          downloadUrl: v.link || v.download_url || "",
          fileSize: v.file_size ? `${(v.file_size / 1024 / 1024).toFixed(2)} MB` : undefined,
          downloads: v.downloads || 0,
        }));

        // Sort versions by date descending so [0] is latest
        versions.sort((a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime());

        return {
          id: String(m.id),
          name: m.name || "Unknown Mod",
          author: m.user?.name || m.author || "Unknown",
          description: m.description || m.summary || "",
          thumbnail: m.thumbnail || m.banner || m.image || undefined,
          versions,
          tags: m.tags || [],
          sptVersion: m.spt_version || versions[0]?.version || undefined,
          totalDownloads: m.downloads || 0,
          category: m.category?.name || m.category || undefined,
        };
      });

      setMods(mapped);
      setTotalPages(meta?.last_page || Math.max(1, Math.ceil((meta?.total || mapped.length) / 6)));
    } catch (err: any) {
      console.error("Forge API error:", err);
      setError(err.message || "Failed to fetch mods");
      setMods([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiKey, page, searchQuery, sortBy]);

  useEffect(() => {
    fetchMods();
  }, [fetchMods]);

  return { mods, isLoading, error, totalPages, refetch: fetchMods };
}

interface ModBrowserProps {
  onBack: () => void;
  rootDirHandle?: FileSystemDirectoryHandle | null;
}

const MODS_PER_PAGE = 15;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today at " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday at " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " at " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDownloads(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

// Check if mod is installed (placeholder - compares by name)
function getInstalledVersion(_modName: string): string | null {
  // In real implementation, compare against scanned installed mods
  return null;
}

export const ModBrowser = ({ onBack, rootDirHandle }: ModBrowserProps) => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>("browse");
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem("spt-mod-browser-api-key"));
  const [permissions, setPermissions] = useState<ApiKeyPermissions>(() => {
    try {
      const saved = localStorage.getItem("spt-mod-browser-api-permissions");
      return saved ? JSON.parse(saved) : { create: false, read: true, update: false, delete: false };
    } catch { return { create: false, read: true, update: false, delete: false }; }
  });
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [permissionsInput, setPermissionsInput] = useState<ApiKeyPermissions>(permissions);
  const [pluginsPath] = useState<string | null>(() => localStorage.getItem("spt-plugins-folder-name"));
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("recent");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input for API calls
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { mods, isLoading, error, totalPages } = useMods(apiKey, currentPage, debouncedSearch, sortBy);

  const paginatedMods = mods;

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) return;
    localStorage.setItem("spt-mod-browser-api-key", apiKeyInput.trim());
    localStorage.setItem("spt-mod-browser-api-permissions", JSON.stringify(permissionsInput));
    setApiKey(apiKeyInput.trim());
    setPermissions(permissionsInput);
    setShowApiKeyDialog(false);
    toast.success("API key saved");
  };

  const handleClearApiKey = () => {
    localStorage.removeItem("spt-mod-browser-api-key");
    localStorage.removeItem("spt-mod-browser-api-permissions");
    setApiKey(null);
    setApiKeyInput("");
    setPermissions({ create: false, read: true, update: false, delete: false });
    setPermissionsInput({ create: false, read: true, update: false, delete: false });
    setShowApiKeyDialog(true);
  };

  const handleDownload = async (mod: BrowsableMod) => {
    if (!pluginsPath && !localStorage.getItem("spt-plugins-folder-name")) {
      toast.error("No plugins folder set", {
        description: "Open Settings and set your BepInEx/plugins folder first.",
      });
      setShowSettingsDialog(true);
      return;
    }

    setDownloadingIds((prev) => new Set(prev).add(mod.id));
    toast.info(`Download "${mod.name}" v${mod.versions[0]?.version}`, {
      description: "Download functionality will be connected once the API is integrated.",
    });
    setTimeout(() => {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(mod.id);
        return next;
      });
    }, 1500);
  };

  const handleSelectPluginsFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      localStorage.setItem("spt-plugins-folder-name", handle.name);
      toast.success("Plugins folder set", { description: handle.name });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error("Failed to set folder");
      }
    }
  };

  const renderModCard = (mod: BrowsableMod) => {
    const latestVersion = mod.versions[0];
    const installedVersion = getInstalledVersion(mod.name);
    const needsUpdate = installedVersion && latestVersion && installedVersion !== latestVersion.version;
    const isDownloading = downloadingIds.has(mod.id);

    return (
      <div
        key={mod.id}
        className="group relative flex rounded-lg border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors"
      >
        {/* Thumbnail */}
        <div className="w-[140px] shrink-0 bg-muted/30 flex items-center justify-center overflow-hidden">
          {mod.thumbnail ? (
            <img src={mod.thumbnail} alt={mod.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-4xl font-bold text-muted-foreground/15 select-none">{mod.name.charAt(0)}</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-3 flex flex-col gap-1.5 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-foreground leading-tight truncate">
                {mod.name}{" "}
                <span className="font-normal text-muted-foreground">{latestVersion?.version}</span>
              </h3>
              <p className="text-xs text-muted-foreground">Created by {mod.author}</p>
            </div>
          </div>

          {/* SPT version badge */}
          {mod.sptVersion && (
            <div>
              <Badge className="bg-emerald-700/80 text-emerald-100 hover:bg-emerald-700 border-0 text-[10px] px-1.5 py-0 rounded">
                SPT {mod.sptVersion}
              </Badge>
            </div>
          )}

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">{mod.description}</p>

          {/* Bottom row: date, downloads, download button */}
          <div className="flex items-center justify-between gap-2 mt-auto pt-1">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {latestVersion?.releasedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(latestVersion.releasedAt)}
                </span>
              )}
              {mod.totalDownloads != null && (
                <span className="flex items-center gap-1">
                  {formatDownloads(mod.totalDownloads)}
                  <ArrowDownToLine className="w-3 h-3" />
                </span>
              )}
            </div>

            {/* Download / Update button */}
            <Button
              size="sm"
              variant={needsUpdate ? "default" : "outline"}
              className={`gap-1.5 text-xs shrink-0 h-7 px-3 transition-colors ${
                needsUpdate
                  ? "bg-success text-success-foreground hover:bg-success/90"
                  : "hover:bg-primary hover:text-primary-foreground"
              }`}
              disabled={isDownloading}
              onClick={() => handleDownload(mod)}
            >
              {isDownloading ? (
                <>
                  <Download className="w-3 h-3 animate-bounce" />
                  Downloading...
                </>
              ) : needsUpdate ? (
                <>
                  <Download className="w-3 h-3" />
                  Update
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" />
                  Download
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Mod Browser</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettingsDialog(true)} className="gap-2 text-xs">
            <Settings2 className="w-3.5 h-3.5" />
            Settings
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowApiKeyDialog(true)} className="gap-2 text-xs">
            <KeyRound className="w-3.5 h-3.5" />
            {apiKey ? "API Key" : "Set API Key"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="px-4 pt-2 shrink-0">
          <TabsList>
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="installed">Installed Mods</TabsTrigger>
          </TabsList>
        </div>

        {/* Browse Tab */}
        <TabsContent value="browse" className="flex-1 flex flex-col min-h-0 mt-0">
          <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-3">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search mods..." value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} className="pl-9" />
            </div>
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[150px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="downloads">Most Downloads</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              {!apiKey ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                  <KeyRound className="w-12 h-12 text-muted-foreground/30" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">API Key Required</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      You need to create an API key on the SPT mod hub site, then paste it here to browse mods.
                    </p>
                  </div>
                  <Button onClick={() => setShowApiKeyDialog(true)} className="gap-2">
                    <KeyRound className="w-4 h-4" />
                    Enter API Key
                  </Button>
                </div>
              ) : isLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex rounded-lg border border-border bg-card overflow-hidden">
                      <Skeleton className="w-[140px] h-[130px] shrink-0 rounded-none" />
                      <div className="flex-1 p-3 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-7 w-24 mt-2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                  <p className="text-destructive font-medium">{error}</p>
                  <Button variant="outline" onClick={handleClearApiKey}>Re-enter API Key</Button>
                </div>
              ) : mods.length === 0 && !isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <p>No mods found matching "{search}"</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {paginatedMods.map(renderModCard)}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6 pb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                        className="gap-1 text-xs"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Prev
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={page === currentPage ? "default" : "ghost"}
                            size="sm"
                            className="w-8 h-8 p-0 text-xs"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        className="gap-1 text-xs"
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Installed Mods Tab */}
        <TabsContent value="installed" className="flex-1 flex flex-col min-h-0 mt-0">
          <InstalledMods pluginsPath={pluginsPath} rootDirHandle={rootDirHandle} />
        </TabsContent>
      </Tabs>

      {/* API Key Dialog */}
      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              API Key
            </DialogTitle>
            <DialogDescription>
              Create your own API key on the SPT mod hub site and paste it here. Do not share your key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Paste your API key..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
            />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">API Key Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["create", "read", "update", "delete"] as const).map((perm) => (
                  <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={permissionsInput[perm]}
                      onCheckedChange={(checked) =>
                        setPermissionsInput((prev) => ({ ...prev, [perm]: !!checked }))
                      }
                    />
                    <span className="capitalize">{perm}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Select the permissions you enabled when creating your API key on the SPT site.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()} className="flex-1">Save Key</Button>
              {apiKey && (
                <Button variant="destructive" onClick={handleClearApiKey}>Clear</Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Mod Browser Settings
            </DialogTitle>
            <DialogDescription>
              Configure your BepInEx plugins folder for downloading and viewing installed mods.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">BepInEx Plugins Folder</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={localStorage.getItem("spt-plugins-folder-name") || "Not set"}
                  className="text-xs bg-muted/30"
                />
                <Button variant="outline" size="sm" onClick={handleSelectPluginsFolder} className="gap-1.5 shrink-0">
                  Browse
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Usually located at: SPT/BepInEx/plugins
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
