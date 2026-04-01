import { useState, useMemo } from "react";
import { ArrowLeft, Search, KeyRound, Download, Settings2, Package, FolderOpen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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

interface BrowsableMod {
  id: string;
  name: string;
  author: string;
  description: string;
  thumbnail?: string;
  version?: string;
  tags?: string[];
  downloadUrl?: string;
}

interface ApiKeyPermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

// Placeholder hook — will be replaced with real API integration
function useMods(apiKey: string | null) {
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const mods: BrowsableMod[] = apiKey
    ? [
        { id: "1", name: "Realism Mod", author: "AssAssIn", description: "Overhauls ballistics, health, and economics for a more realistic experience.", version: "2.4.1", tags: ["Gameplay", "Hardcore"] },
        { id: "2", name: "Algorithmic Level Progression", author: "DrakiaXYZ", description: "Adjusts AI difficulty and spawn rates based on player level progression.", version: "1.8.0", tags: ["AI", "Progression"] },
        { id: "3", name: "Looting Bots", author: "Skwizzy", description: "Allows AI bots to loot containers and dead bodies dynamically.", version: "1.3.2", tags: ["AI", "Immersion"] },
        { id: "4", name: "SWAG + DONUTS", author: "nooky", description: "Advanced spawn management and AI patrol patterns for all maps.", version: "3.1.0", tags: ["Spawns", "AI"] },
        { id: "5", name: "Amands Graphics", author: "Amands", description: "Post-processing and graphics enhancement tweaks for better visuals.", version: "1.5.4", tags: ["Graphics", "Visual"] },
        { id: "6", name: "SAIN - AI Overhaul", author: "Solarint", description: "Complete AI behavior overhaul with advanced combat tactics and awareness.", version: "3.0.1", tags: ["AI", "Combat"] },
      ]
    : [];

  return { mods, isLoading, error };
}

interface ModBrowserProps {
  onBack: () => void;
  rootDirHandle?: FileSystemDirectoryHandle | null;
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

  const { mods, isLoading, error } = useMods(apiKey);

  const filteredMods = useMemo(() => {
    if (!search.trim()) return mods;
    const q = search.toLowerCase();
    return mods.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.author.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }, [mods, search]);

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
    // Placeholder: real download logic will use the API
    toast.info(`Download "${mod.name}"`, {
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
          <div className="px-4 py-3 border-b border-border shrink-0">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search mods..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="border-border">
                      <CardContent className="p-4 space-y-3">
                        <Skeleton className="h-32 w-full rounded-md" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                  <p className="text-destructive font-medium">{error}</p>
                  <Button variant="outline" onClick={handleClearApiKey}>Re-enter API Key</Button>
                </div>
              ) : filteredMods.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <p>No mods found matching "{search}"</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMods.map((mod) => (
                    <Card key={mod.id} className="border-border hover:border-primary/30 transition-colors group">
                      <CardContent className="p-4 space-y-3">
                        <div className="h-32 rounded-md bg-muted/50 flex items-center justify-center">
                          {mod.thumbnail ? (
                            <img src={mod.thumbnail} alt={mod.name} className="h-full w-full object-cover rounded-md" />
                          ) : (
                            <span className="text-3xl font-bold text-muted-foreground/20">{mod.name.charAt(0)}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-sm text-foreground leading-tight">{mod.name}</h3>
                            {mod.version && <Badge variant="secondary" className="text-[10px] shrink-0">v{mod.version}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">by {mod.author}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{mod.description}</p>
                        {mod.tags && mod.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {mod.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                            ))}
                          </div>
                        )}
                        <Button
                          size="sm"
                          className="w-full gap-2 text-xs"
                          disabled={downloadingIds.has(mod.id)}
                          onClick={() => handleDownload(mod)}
                        >
                          {downloadingIds.has(mod.id) ? (
                            <>
                              <Download className="w-3.5 h-3.5 animate-bounce" />
                              Downloading...
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              Download & Install
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
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
                  <FolderOpen className="w-3.5 h-3.5" />
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
