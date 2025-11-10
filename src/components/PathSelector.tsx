import { useEffect, useState } from "react";
import { FolderOpen, Upload, Loader2 } from "lucide-react";
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
import { scanModFolderElectron } from "@/utils/electronFolderScanner";


interface PathSelectorProps {
  onFolderSelected: (handle: string) => void;
  onLoadLastFolder: () => void;
}

export const PathSelector = ({ onFolderSelected, onLoadLastFolder }: PathSelectorProps) => {
  const [path, setPath] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [tip, setTip] = useState("");
  const [showLoadConfirm, setShowLoadConfirm] = useState(false);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * tips.length);
    setTip(tips[randomIndex]);
  }, []);

  // ✅ MAIN SELECT SPT FOLDER
  const handleSelectFolder = async () => {
    try {
      const canOpen = typeof window !== "undefined" && !!(window as any).electronBridge?.selectFolder;
      if (!canOpen) {
        toast.error("Desktop feature not available here", {
          description: "Folder dialog requires the desktop app. Build and run the Electron app to browse folders.",
        });
        return;
      }

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

  // ✅ UPLOAD SINGLE MOD DEBUG BUTTON
  const handleSingleModUpload = async () => {
    try {
      const result = await selectFolder();
      if (result.canceled || !result.path) return;

      console.log("🧪 Manual Mod Upload →", result.path);

      // 👇 IMPORTANT: import this at the top
      // import { scanModFolderElectron } from "@/utils/electronFolderScanner";
      const scanResult = await scanModFolderElectron(result.path);

      if (!scanResult) {
        toast.error("Mod has no readable config files", {
          description: "Scanner could not detect any .json / .jsonc / .json5 files",
        });
        console.error("❌ Scanner could not read any configs in this folder");
        return;
      }

      toast.success(`Loaded mod: ${scanResult.mod.name}`, {
        description: `${scanResult.configs.length} configs detected`,
      });

      console.log("✅ Scanner result:", scanResult);
    } catch (err) {
      console.error("⚠️ Upload error:", err);
      toast.error("Error reading mod folder");
    }
  };



  // --- Render ---
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-6">
      <Card className="w-full max-w-2xl p-8 space-y-6 border-border">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <FolderOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">SPT Mod Config Editor</h1>
          <p className="text-muted-foreground">Select your SPT installation directory to begin</p>

          <div className="mt-4 p-3 rounded-lg bg-info/10 border border-info/20">
            <p className="text-xs text-foreground">{tip}</p>
          </div>
        </div>

        {/* Folder selection + Load Last Folder */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Select Your SPT Folder</label>

            {/* Select Folder button */}
            <Button
              onClick={handleSelectFolder}
              disabled={isScanning}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-24 text-lg gap-3"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Scanning folder...
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6" />
                  Select SPT Installation Folder
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Click to browse and select your SPT installation directory
            </p>

            {/* Load Last Folder button + dialog */}
            <>
              <Button
                onClick={() => setShowLoadConfirm(true)}
                variant="outline"
                className="w-full h-16 text-lg gap-3"
                disabled={!localStorage.getItem("lastSPTFolder")}
              >
                Load Last Folder
              </Button>

              <AlertDialog open={showLoadConfirm} onOpenChange={setShowLoadConfirm}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Load Last Folder</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to load&nbsp;
                      <span className="font-mono">{localStorage.getItem("lastSPTFolder")}</span>?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>No</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setShowLoadConfirm(false);
                        onLoadLastFolder(); // callback from Index
                      }}
                    >
                      Yes
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          </div>

          {false && (
              <>
                {/* NEW: Upload single mod for testing */}
                <Button
                  onClick={handleSingleModUpload}
                  variant="secondary"
                  className="w-full h-16 text-lg gap-3"
                >
                  Upload Single Mod Folder (Debug)
                </Button>
              </>
            )}

          {/* Info text */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• The app will scan for mods in: {path || "[path]"}/SPT/user/mods/</p>
            <p>• Only compatible JSON config files will be loaded</p>
            <p>• You can change this path later in settings</p>
          </div>
        </div>
      </Card>
    </div>
  );
};