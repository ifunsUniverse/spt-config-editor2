import { useEffect, useState } from "react";
import { FolderOpen, Upload, Loader2, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { selectFolder } from "@/utils/electronBridge";
import { tips } from "@/components/ui/tips";
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
  onFolderSelected: (handle: string) => void;
  onLoadLastFolder: () => void;
}

export const PathSelector = ({ onFolderSelected, onLoadLastFolder }: PathSelectorProps) => {
  const [path, setPath] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [tip, setTip] = useState("");
  const [showLoadConfirm, setShowLoadConfirm] = useState(false);
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);
  const [seenFeatures, setSeenFeatures] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("seen_new_features");
    return new Set(saved ? JSON.parse(saved) : []);
  });

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * tips.length);
    setTip(tips[randomIndex]);
  }, []);

  const markAsSeen = (featureId: string) => {
    if (seenFeatures.has(featureId)) return;
    const next = new Set(seenFeatures);
    next.add(featureId);
    setSeenFeatures(next);
    localStorage.setItem("seen_new_features", JSON.stringify(Array.from(next)));
  };

  const handleSelectFolder = async () => {
    try {
      setIsScanning(true);
      const result = await selectFolder();

      if (result.canceled || !result.path) {
        setIsScanning(false);
        return;
      }

      setPath(result.path);
      localStorage.setItem("lastSPTFolder", result.path);
      toast.success("Folder selected", { description: "Scanning for mods..." });

      onFolderSelected(result.path);
    } catch (error: any) {
      console.error("Error selecting folder:", error);
      toast.error("Failed to select folder", {
        description: error.message || "Could not access the selected folder",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleCheckUpdates = () => {
    window.open(
      "https://forge.sp-tarkov.com/mod/2379/spt-mod-config-editor#versions",
      "_blank"
    );
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4 sm:p-6">
      <Card className="w-full max-w-2xl p-4 sm:p-8 space-y-6 border-border overflow-hidden">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 mb-2 sm:mb-4">
            <FolderOpen className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">SPT Mod Config Editor</h1>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground">Select your SPT installation directory to begin</p>

          <div className="mt-4 p-3 rounded-lg bg-info/10 border border-info/20 max-w-md mx-auto">
            <p className="text-[10px] sm:text-xs text-foreground">{tip}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Select Your SPT Folder</label>

            <Button
              onClick={handleSelectFolder}
              disabled={isScanning}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-20 sm:h-24 text-base sm:text-lg gap-3"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                  Scanning folder...
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
                onClick={() => setShowLoadConfirm(true)}
                variant="outline"
                className="w-full h-12 sm:h-16 text-base sm:text-lg gap-3"
                disabled={!localStorage.getItem("lastSPTFolder")}
              >
                Load Last Folder
              </Button>

              <Button
                onClick={handleCheckUpdates}
                variant="ghost"
                className="w-full h-10 sm:h-12 gap-2 text-muted-foreground hover:text-foreground text-xs sm:text-sm"
              >
                <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
                Check for Updates
              </Button>

              <AlertDialog open={showLoadConfirm} onOpenChange={setShowLoadConfirm}>
                <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Load Last Folder</AlertDialogTitle>
                    <AlertDialogDescription className="break-all">
                      Are you sure you want to load&nbsp;
                      <span className="font-mono">{localStorage.getItem("lastSPTFolder")}</span>?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="mt-0">No</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setShowLoadConfirm(false);
                        onLoadLastFolder();
                      }}
                    >
                      Yes
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div 
            className="text-[10px] sm:text-xs text-muted-foreground space-y-1 bg-muted/30 p-3 rounded-md relative group z-10"
          >
            <p className="flex items-center gap-2 cursor-default">
              • The app will scan for mods in: <span className="text-foreground font-mono">{path || "[path]"}/SPT/user/mods/</span> or <span className="text-foreground font-mono">{path || "[path]"}/user/mods/</span>
            </p>
            <p>• Only compatible JSON config files will be loaded</p>
            <p>• You can change this path later in settings</p>
            <p 
              className="flex items-center gap-2 transition-opacity cursor-default"
              onMouseEnter={() => {
                setHoveredLine("test");
                markAsSeen("test");
              }}
              onMouseLeave={() => setHoveredLine(null)}
            >
              • Easy SPT Server and Launcher startup.
              {!seenFeatures.has("test") && hoveredLine !== "test" && (
                <span className="text-yellow-400 font-black text-[9px] animate-pulse shrink-0">NEW!</span>
              )}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};