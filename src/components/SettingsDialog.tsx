import { useState } from "react";
import { Settings, ShieldAlert, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_EDITOR_SETTINGS,
  loadEditorSettings,
  saveEditorSettings,
  FONT_OPTIONS,
  WHITESPACE_OPTIONS,
  type EditorSettings,
} from "@/utils/editorSettings";
import { clearEditHistory } from "@/utils/editTracking";
import { DEFAULT_APP_SETTINGS, loadAppSettings, saveAppSettings, updateAppSettings, type AppSettings } from "@/utils/appSettings";
import { openExternal } from "@/utils/electronBridge";
import { toast } from "sonner";

export function SettingsDialog() {
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(loadEditorSettings);
  const [appSettings, setAppSettings] = useState<AppSettings>(loadAppSettings);

  const updateEditorSetting = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
    const updated = { ...editorSettings, [key]: value };
    setEditorSettings(updated);
    saveEditorSettings(updated);
    // Dispatch event so ConfigEditor can react
    window.dispatchEvent(new CustomEvent("editor-settings-changed", { detail: updated }));
  };

  const updateAppSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = updateAppSettings(appSettings, key, value);
    setAppSettings(updated);
  };

  const resetEditorSettings = () => {
    const defaults = { ...DEFAULT_EDITOR_SETTINGS };
    setEditorSettings(defaults);
    saveEditorSettings(defaults);
    window.dispatchEvent(new CustomEvent("editor-settings-changed", { detail: defaults }));
    toast.success("Editor settings reset to defaults");
  };

  const resetAppSettings = () => {
    const defaults = { ...DEFAULT_APP_SETTINGS };
    setAppSettings(defaults);
    saveAppSettings(defaults);
    window.dispatchEvent(new CustomEvent("app-settings-changed", { detail: defaults }));
    toast.success("App settings reset to defaults");
  };

  const handleCheckUpdates = () => {
    void openExternal("https://forge.sp-tarkov.com/mod/2379/spt-mod-config-editor#versions");
  };

  const clearFavorites = () => {
    localStorage.removeItem("spt-favorites");
    toast.success("Favorites cleared", { description: "Restart or reload to refresh the list immediately." });
  };

  const clearRecentEdits = () => {
    clearEditHistory();
    toast.success("Recent edit history cleared");
  };

  const clearSavedSession = () => {
    localStorage.removeItem("lastSession");
    toast.success("Saved session cleared");
  };

  const clearSavedFolder = () => {
    localStorage.removeItem("lastSPTFolder");
    localStorage.removeItem("lastSPTFolderPath");
    toast.success("Saved folder cleared");
  };

  const clearCategoryAssignments = () => {
    localStorage.removeItem("spt_categories");
    localStorage.removeItem("modCategories");
    toast.success("Category assignments cleared", {
      description: "Reload to fully refresh category badges and counts."
    });
  };

  const clearScanCache = async () => {
    localStorage.removeItem("spt_scan_cache_v1");
    try {
      if (window.sptElectron?.invoke) {
        await window.sptElectron.invoke("store:write", { key: "spt_scan_cache_v1", content: "" });
      }
      toast.success("Scan cache cleared");
    } catch {
      toast.success("Local cache cleared", { description: "Electron cache could not be cleared in this mode." });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <Settings className="h-4 w-4" />
          <span className="sr-only">Open settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[86vh] overflow-y-auto p-0 gap-0">
        <DialogHeader>
          <div className="px-6 pt-6 pb-3 border-b border-border bg-card/40">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-primary" />
              Settings
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Real controls for startup flow, editor behavior, and data maintenance.
            </p>
          </div>
        </DialogHeader>

        <Tabs defaultValue="app" className="w-full px-6 pb-6 pt-4">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="app" className="gap-1"><Sparkles className="h-3.5 w-3.5" /> App</TabsTrigger>
            <TabsTrigger value="editor" className="gap-1"><Wrench className="h-3.5 w-3.5" /> Editor</TabsTrigger>
            <TabsTrigger value="data" className="gap-1"><ShieldAlert className="h-3.5 w-3.5" /> Data</TabsTrigger>
          </TabsList>

          <TabsContent value="app" className="space-y-4 mt-0">
            <div className="rounded-lg border border-border bg-card/30 p-4 space-y-4">
              <h3 className="font-semibold text-sm">Startup & Workflow</h3>

              <div className="flex items-center justify-between">
                <Label className="text-xs flex flex-col gap-1">
                  <span className="font-medium">Remember Last Open File</span>
                  <span className="text-muted-foreground">Reopens your last mod/config when available.</span>
                </Label>
                <Switch
                  checked={appSettings.rememberLastSession}
                  onCheckedChange={(value) => updateAppSetting("rememberLastSession", value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs flex flex-col gap-1">
                  <span className="font-medium">Auto-Load Last Folder on Launch</span>
                  <span className="text-muted-foreground">Skips path picker and opens your previous SPT folder.</span>
                </Label>
                <Switch
                  checked={appSettings.autoLoadLastFolderOnLaunch}
                  onCheckedChange={(value) => updateAppSetting("autoLoadLastFolderOnLaunch", value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs flex flex-col gap-1">
                  <span className="font-medium">Use Cache When Loading Last Folder</span>
                  <span className="text-muted-foreground">Faster startup when mod folders are unchanged.</span>
                </Label>
                <Switch
                  checked={appSettings.useCacheWhenLoadingLastFolder}
                  onCheckedChange={(value) => updateAppSetting("useCacheWhenLoadingLastFolder", value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs flex flex-col gap-1">
                  <span className="font-medium">Show Startup Tips</span>
                  <span className="text-muted-foreground">Displays rotating tips on the folder selection screen.</span>
                </Label>
                <Switch
                  checked={appSettings.showStartupTips}
                  onCheckedChange={(value) => updateAppSetting("showStartupTips", value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card/30 p-4 space-y-3">
              <h3 className="font-semibold text-sm">Maintenance</h3>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCheckUpdates}>Check for Updates</Button>
                <Button variant="outline" size="sm" onClick={resetAppSettings}>Reset App Settings</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="editor" className="space-y-4 mt-0">
            <div className="rounded-lg border border-border bg-card/30 p-4 space-y-4">
              <h3 className="font-semibold text-sm">Code Editor</h3>

                <div className="space-y-2">
                  <Label className="text-xs">Font Family</Label>
                  <Select value={editorSettings.fontFamily} onValueChange={(v) => updateEditorSetting("fontFamily", v)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value} className="text-xs">
                          <span style={{ fontFamily: f.value }}>{f.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Font Size: {editorSettings.fontSize}px</Label>
                  <Slider
                    min={10}
                    max={24}
                    step={1}
                    value={[editorSettings.fontSize]}
                    onValueChange={([v]) => updateEditorSetting("fontSize", v)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Line Height: {editorSettings.lineHeight.toFixed(1)}</Label>
                  <Slider
                    min={1.0}
                    max={2.5}
                    step={0.1}
                    value={[editorSettings.lineHeight]}
                    onValueChange={([v]) => updateEditorSetting("lineHeight", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Word Wrap</Label>
                  <Switch
                    checked={editorSettings.wordWrap === "on"}
                    onCheckedChange={(v) => updateEditorSetting("wordWrap", v ? "on" : "off")}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Render Whitespace</Label>
                  <Select
                    value={editorSettings.renderWhitespace}
                    onValueChange={(v) =>
                      updateEditorSetting("renderWhitespace", v as EditorSettings["renderWhitespace"])
                    }
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WHITESPACE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Minimap</Label>
                  <Switch
                    checked={editorSettings.minimap}
                    onCheckedChange={(v) => updateEditorSetting("minimap", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Sticky Scroll</Label>
                  <Switch
                    checked={editorSettings.stickyScroll}
                    onCheckedChange={(v) => updateEditorSetting("stickyScroll", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Font Ligatures</Label>
                  <Switch
                    checked={editorSettings.fontLigatures}
                    onCheckedChange={(v) => updateEditorSetting("fontLigatures", v)}
                  />
                </div>

                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={resetEditorSettings}>Reset Editor Settings</Button>
                </div>
              </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-4 mt-0">
            <div className="rounded-lg border border-border bg-card/30 p-4 space-y-3">
              <h3 className="font-semibold text-sm">Clear Stored Data</h3>
              <p className="text-xs text-muted-foreground">
                Use these when troubleshooting stale state, startup issues, or cleaning your workspace.
              </p>

              <div className="grid sm:grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={clearFavorites}>Clear Favorites</Button>
                <Button variant="outline" size="sm" onClick={clearRecentEdits}>Clear Recent Edits</Button>
                <Button variant="outline" size="sm" onClick={clearSavedSession}>Clear Saved Session</Button>
                <Button variant="outline" size="sm" onClick={clearSavedFolder}>Clear Saved Folder</Button>
                <Button variant="outline" size="sm" onClick={clearScanCache}>Clear Scan Cache</Button>
                <Button variant="destructive" size="sm" onClick={clearCategoryAssignments}>Reset Categories</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
