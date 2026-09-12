import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Upload, Loader2, RefreshCw, History, Package, ShieldCheck, Clock, Flame, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { DirectoryHandleLike, openExternal, rememberLastSelectedFolder, selectFolder } from "@/utils/electronBridge";
import { tips } from "@/components/ui/tips";
import { loadAppSettings } from "@/utils/appSettings";
import { getEditHistory } from "@/utils/editTracking";
import { cn } from "@/lib/utils";

interface PathSelectorProps {
  onFolderSelected: (handle: DirectoryHandleLike) => void;
  onLoadLastFolder: () => void;
  /** Loads mock mod data for testing without an SPT install */
  onDevLoad?: () => void;
  /** True while Index.tsx is running the actual scan */
  isLoading?: boolean;
  /** Which action is currently loading */
  loadingSource?: "select" | "last";
}

const SCAN_TARGETS = [
  {
    version: "SPT 3.0.x",
    path: "user/mods",
    blurb: "Classic layout — mods sit directly inside the install root.",
  },
  {
    version: "SPT 4.0.x",
    path: "SPT/user/mods",
    blurb: "Server files moved one level down into an SPT folder.",
  },
  {
    version: "SPT 4.1.x",
    path: "SPT_Runtime/user/mods",
    blurb: "Newest runtime layout — scanned first when detected.",
  },
];

const timeAgo = (ts: number) => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const PathSelector = ({ onFolderSelected, onLoadLastFolder, onDevLoad, isLoading = false, loadingSource }: PathSelectorProps) => {
  const appSettings = loadAppSettings();
  const [path, setPath] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tip, setTip] = useState("");
  const lastFolderName = localStorage.getItem("lastSPTFolder");
  const lastFolderPath = localStorage.getItem("lastSPTFolderPath") || "";
  const hasLastFolder = Boolean(lastFolderPath || lastFolderName);

  // True while either the dialog is open OR Index is scanning
  const isBusy = isDialogOpen || isLoading;

  const activity = useMemo(() => {
    const history = getEditHistory();
    const counts = new Map<string, { modId: string; count: number; last: number }>();
    for (const entry of history) {
      const existing = counts.get(entry.modId);
      if (existing) {
        existing.count += 1;
        existing.last = Math.max(existing.last, entry.timestamp);
      } else {
        counts.set(entry.modId, { modId: entry.modId, count: 1, last: entry.timestamp });
      }
    }
    const mostEdited = [...counts.values()].sort((a, b) => b.count - a.count)[0] || null;
    return { mostEdited, recent: history.slice(0, 4) };
  }, []);

  const detectedVersion = useMemo(() => {
    const p = lastFolderPath.replace(/\\/g, "/");
    if (/SPT_Runtime/i.test(p)) return "SPT 4.1.x";
    if (/\/SPT(\/|$)/i.test(p)) return "SPT 4.0.x";
    return null;
  }, [lastFolderPath]);

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
    <div className="relative min-h-screen bg-background">
      {/* Scanning overlay — covers full viewport */}
      {isLoading && (
        <div className="fixed inset-0 z-50 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-background/90 backdrop-blur-[6px]" />
          <div className="relative flex h-full flex-col items-center justify-center gap-4
                          animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both [animation-delay:60ms]">
            <div className="relative flex items-center justify-center w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-primary/25 blur-2xl scale-[1.8] animate-pulse [animation-duration:2200ms]" />
              <div className="absolute inset-0 rounded-full border-[3px] border-primary/12" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary animate-spin" />
              <Package className="w-7 h-7 text-primary relative z-10" />
            </div>
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
            <div className="w-52 h-[3px] bg-primary/10 rounded-full overflow-hidden">
              <div className="h-full w-2/5 rounded-full
                bg-gradient-to-r from-primary/0 via-primary to-primary/0
                animate-[comet_1.65s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-5 px-5 py-8 sm:px-10">
        {/* Hero + activity */}
        <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
          {/* Hero card */}
          <Card className="rounded-[14px] border-primary/25 bg-gradient-to-br from-primary/[0.10] via-card to-card p-5 sm:p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[26px]">
                  SPT Mod Config Editor
                </h1>
                <p className="text-sm text-muted-foreground">
                  Select your SPT installation directory to read and edit mod config files.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Files stay on your machine. Nothing is uploaded — the app reads and writes your
                mod configs directly from local storage.
              </p>
            </div>

            <Button
              onClick={handleSelectFolder}
              disabled={isBusy}
              className="mt-4 h-14 w-full gap-2.5 text-base"
            >
              {isLoading && loadingSource === "select" ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Scanning folder...</>
              ) : isDialogOpen ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Opening picker...</>
              ) : (
                <><Upload className="h-5 w-5" /> Select SPT Installation Folder</>
              )}
            </Button>

            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={onLoadLastFolder}
                disabled={isBusy}
                variant="outline"
                className="h-10 flex-1 gap-2 text-sm"
              >
                {isLoading && loadingSource === "last" ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Loading...</>
                ) : (
                  <><History className="h-4 w-4" /> {hasLastFolder ? `Load: ${lastFolderName || "Last Folder"}` : "Load Last Folder"}</>
                )}
              </Button>
              <Button
                onClick={handleCheckUpdates}
                variant="ghost"
                className="h-10 gap-2 text-sm text-muted-foreground hover:text-foreground sm:w-36"
              >
                <RefreshCw className="h-4 w-4" /> Updates
              </Button>
            </div>

            {onDevLoad && (
              <Button
                onClick={onDevLoad}
                disabled={isBusy}
                variant="outline"
                className="mt-2.5 h-10 w-full gap-2 border-dashed text-sm text-muted-foreground hover:text-foreground"
              >
                <FlaskConical className="h-4 w-4" /> Dev Load (mock mods)
              </Button>
            )}

            {appSettings.showStartupTips && tip && (
              <p className="mt-3 rounded-lg border border-info/20 bg-info/10 p-2.5 text-[11px] text-foreground">
                {tip}
              </p>
            )}
          </Card>

          {/* Activity card */}
          <Card className="rounded-[14px] border-border bg-card p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Your activity
            </p>

            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">Most edited</p>
              {activity.mostEdited ? (
                <div className="flex items-center gap-2.5 rounded-lg border border-primary/25 bg-primary/[0.07] p-3">
                  <Flame className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{activity.mostEdited.modId}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {activity.mostEdited.count} edit{activity.mostEdited.count === 1 ? "" : "s"} · {timeAgo(activity.mostEdited.last)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">
                  No edits yet — your most edited mod shows up here.
                </p>
              )}
            </div>

            <div className="mt-4 space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">Recently edited</p>
              {activity.recent.length > 0 ? (
                <ul className="space-y-1">
                  {activity.recent.map((entry) => (
                    <li
                      key={`${entry.modId}-${entry.configFile}-${entry.timestamp}`}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-foreground">{entry.modId}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">{entry.configFile}</p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> {timeAgo(entry.timestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 text-[11px] text-muted-foreground">Nothing here yet.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Folders we scan */}
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Folders we scan
            </p>
            <span className="text-[10px] text-muted-foreground/70">detected automatically</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {SCAN_TARGETS.map((target) => {
              const isDetected = detectedVersion === target.version;
              return (
                <Card
                  key={target.version}
                  className={cn(
                    "rounded-[14px] border-border bg-card p-4 transition-colors",
                    isDetected && "border-primary/60 bg-primary/[0.07]"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{target.version}</p>
                    {isDetected && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                        detected
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 truncate font-mono text-[11px] text-foreground/90">
                    {(path || lastFolderName || "[folder]")}/{target.path}/
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{target.blurb}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
