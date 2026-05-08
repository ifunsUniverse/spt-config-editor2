import { useEffect, useState } from "react";
import { FolderOpen, Upload, Loader2, RefreshCw, History, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { DirectoryHandleLike, openExternal, rememberLastSelectedFolder, selectFolder } from "@/utils/electronBridge";
import { tips } from "@/components/ui/tips";
import { loadAppSettings } from "@/utils/appSettings";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PathSelectorProps {
  onFolderSelected: (handle: DirectoryHandleLike) => void;
  onLoadLastFolder: () => void;
  /** True while Index.tsx is running the actual scan */
  isLoading?: boolean;
  /** Which action is currently loading */
  loadingSource?: "select" | "last";
}

export const PathSelector = ({ onFolderSelected, onLoadLastFolder, isLoading = false, loadingSource }: PathSelectorProps) => {
  const appSettings = loadAppSettings();
  const [path, setPath] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tip, setTip] = useState("");
  const lastFolderName = localStorage.getItem("lastSPTFolder");
  const hasLastFolder = Boolean(localStorage.getItem("lastSPTFolderPath") || lastFolderName);

  // True while either the dialog is open OR Index is scanning
  const isBusy = isDialogOpen || isLoading;

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * tips.length);
    setTip(tips[randomIndex]);
  }, []);

  const handleSelectFolder = async () => {
    try {
      setIsDialogOpen(true);
      const result = await selectFolder();

      if (result.canceled || !result.handle) {
        setIsDialogOpen(false);
        return;
      }

      setPath(result.handle.name);
      rememberLastSelectedFolder(result.handle, result.path);
      // Dialog is done — Index.tsx takes over scanning (isLoading becomes true)
      setIsDialogOpen(false);
      onFolderSelected(result.handle);
    } catch (error: any) {
      console.error("Error selecting folder:", error);
      toast.error("Failed to select folder", {
        description: error.message || "Could not access the selected folder",
      });
      setIsDialogOpen(false);
    }
  };

  const handleCheckUpdates = () => {
    void openExternal("https://forge.sp-tarkov.com/mod/2379/spt-mod-config-editor#versions");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 sm:p-6 relative">

      {/* Scanning overlay — covers full viewport */}
      {isLoading && (
        <div className="fixed inset-0 z-50 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/90 backdrop-blur-[6px]" />

          {/* Content — slides up gently after backdrop */}
          <div className="relative h-full flex flex-col items-center justify-center gap-5
                          animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both [animation-delay:60ms]">

            {/* Spinner with ambient glow */}
            <div className="relative flex items-center justify-center w-20 h-20">
              {/* Soft glow blob behind the ring */}
              <div className="absolute inset-0 rounded-full bg-primary/25 blur-2xl scale-[1.8] animate-pulse [animation-duration:2200ms]" />
              {/* Track ring */}
              <div className="absolute inset-0 rounded-full border-[3px] border-primary/12" />
              {/* Spinning arc */}
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary animate-spin" />
              {/* Icon */}
              <Package className="w-7 h-7 text-primary relative z-10" />
            </div>

            {/* Labels */}
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-foreground tracking-wide">
                {loadingSource === "last" ? "Loading saved folder..." : "Scanning folder..."}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {loadingSource === "last"
                  ? "Checking cache and reading mod configs"
                  : "Reading mod configs and package files"}
              </p>
            </div>

            {/* Comet progress bar */}
            <div className="w-52 h-[3px] bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full w-2/5 rounded-full
                bg-gradient-to-r from-primary/0 via-primary to-primary/0
                animate-[comet_1.65s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      )}

      <Card className="w-full max-w-2xl p-4 sm:p-8 space-y-6 border-border relative">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 mb-2 sm:mb-4">
            <FolderOpen className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">SPT Mod Config Editor</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">Select your SPT installation directory to begin</p>

          {appSettings.showStartupTips && (
            <div className="mt-4 p-3 rounded-lg bg-info/10 border border-info/20 max-w-md mx-auto">
              <p className="text-[10px] sm:text-xs text-foreground">{tip}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Select Your SPT Folder</label>

            <Button
              onClick={handleSelectFolder}
              disabled={isBusy}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-20 sm:h-24 text-base sm:text-lg gap-3"
            >
              {isLoading && loadingSource === "select" ? (
                <>
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                  Scanning folder...
                </>
              ) : isDialogOpen ? (
                <>
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                  Opening picker...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
                  Select SPT Installation Folder
                </>
              )}
            </Button>

            <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
              Click to browse and select your SPT installation directory
            </p>

            <div className="flex flex-col gap-2 sm:gap-3 pt-2">
              <Button
                onClick={onLoadLastFolder}
                disabled={isBusy}
                variant="outline"
                className="w-full h-12 sm:h-16 text-base sm:text-lg gap-3"
              >
                {isLoading && loadingSource === "last" ? (
                  <>
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <History className="w-5 h-5 sm:w-6 sm:h-6" />
                    {hasLastFolder
                      ? `Load: ${lastFolderName || "Last Folder"}`
                      : "Load Last Folder"}
                  </>
                )}
              </Button>

              <Button
                onClick={handleCheckUpdates}
                variant="ghost"
                className="w-full h-10 sm:h-12 gap-2 text-muted-foreground hover:text-foreground text-xs sm:text-sm"
              >
                <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                Check for Updates
              </Button>
            </div>
          </div>

          <div className="text-[10px] sm:text-xs text-muted-foreground bg-muted/30 p-3 rounded-md z-10 space-y-3">
            <div className="space-y-1.5">
              <p className="text-foreground font-semibold tracking-wide">Current Setup</p>
              <p>
                • Saved folder: <span className="text-foreground font-medium">{hasLastFolder ? (lastFolderName || "Detected") : "Not set"}</span>
              </p>
              <p>
                • Auto-load on launch: <span className="text-foreground font-medium">{appSettings.autoLoadLastFolderOnLaunch ? "Enabled" : "Disabled"}</span>
              </p>
              <p>
                • Remember last open file: <span className="text-foreground font-medium">{appSettings.rememberLastSession ? "Enabled" : "Disabled"}</span>
              </p>
              <p>
                • Load-last uses cache: <span className="text-foreground font-medium">{appSettings.useCacheWhenLoadingLastFolder ? "Enabled (faster)" : "Disabled (fresh scan)"}</span>
              </p>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-border/50">
              <p className="text-foreground font-semibold tracking-wide">What Happens Next</p>
              <p className="flex items-start gap-1.5">
                • Mod scan paths:
                <span className="text-foreground font-mono">{path || lastFolderName || "[folder]"}/SPT/user/mods/</span>
                <span>or</span>
                <span className="text-foreground font-mono">{path || lastFolderName || "[folder]"}/user/mods/</span>
              </p>
              <p>• Only JSON/JSONC-compatible mod config files are loaded into the editor.</p>
              <p>• Your files are accessed directly from desktop storage via Electron.</p>
              {isLoading && (
                <p>
                  • Status: <span className="text-foreground font-medium">{loadingSource === "last" ? "Loading saved folder" : "Scanning selected folder"}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
