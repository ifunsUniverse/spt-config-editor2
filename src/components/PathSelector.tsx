import { useState, useEffect } from "react";
import { FolderOpen, Upload, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { isElectron, electronAPI } from "@/utils/electronBridge";

interface PathSelectorProps {
  onPathSelected: (path: string) => void;
  onFolderSelected: (handle: FileSystemDirectoryHandle) => void;
}

const LAST_FOLDER_KEY = "spt-last-folder-path";

export const PathSelector = ({ onPathSelected, onFolderSelected }: PathSelectorProps) => {
  const [path, setPath] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [lastFolderPath, setLastFolderPath] = useState<string | null>(null);

  // Load last folder path from localStorage on mount
  useEffect(() => {
    const savedPath = localStorage.getItem(LAST_FOLDER_KEY);
    if (savedPath) {
      setLastFolderPath(savedPath);
    }
  }, []);

  const handleSelectPath = () => {
    if (path.trim()) {
      onPathSelected(path);
    }
  };

  const handleSelectFolder = async () => {
    try {
      setIsScanning(true);

      if (isElectron()) {
        // Use Electron dialog
        const api = electronAPI();
        const result = await api.selectFolder();

        if (result.canceled || !result.path) {
          setIsScanning(false);
          return;
        }

        setPath(result.path);
        // Save to localStorage for Electron
        localStorage.setItem(LAST_FOLDER_KEY, result.path);
        setLastFolderPath(result.path);
        
        toast.success("Folder selected", {
          description: "Scanning for mods..."
        });

        onFolderSelected(result.path as any);
      } else {
        // Use File System Access API for browser
        if (!("showDirectoryPicker" in window)) {
          toast.error("Browser not supported", {
            description: "Your browser doesn't support folder selection. Try Chrome, Edge, or Opera."
          });
          setIsScanning(false);
          return;
        }

        const dirHandle = await (window as any).showDirectoryPicker({
          mode: "readwrite",
        });

        setPath(dirHandle.name);
        // Save folder name for browser (note: can't persist FileSystemDirectoryHandle)
        localStorage.setItem(LAST_FOLDER_KEY, dirHandle.name);
        setLastFolderPath(dirHandle.name);
        
        toast.success("Folder selected", {
          description: "Scanning for mods..."
        });

        onFolderSelected(dirHandle);
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        // User cancelled, do nothing
        return;
      }

      console.error("Error selecting folder:", error);

      if (error.message?.includes("cross origin") || error.message?.includes("iframe")) {
        toast.error("Can't use folder picker in preview", {
          description: "The folder picker doesn't work in Lovable's preview. Deploy your app or download the desktop app.",
          duration: 6000
        });
      } else {
        toast.error("Failed to select folder", {
          description: error.message || "Could not access the selected folder"
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleLoadLastFolder = async () => {
    if (!lastFolderPath) return;

    try {
      setIsScanning(true);

      if (isElectron()) {
        // Directly load the saved path in Electron
        const api = electronAPI();
        const exists = await api.exists(lastFolderPath);
        
        if (!exists) {
          toast.error("Folder not found", {
            description: "The last folder path no longer exists."
          });
          localStorage.removeItem(LAST_FOLDER_KEY);
          setLastFolderPath(null);
          setIsScanning(false);
          return;
        }

        setPath(lastFolderPath);
        toast.success("Loading last folder", {
          description: "Scanning for mods..."
        });

        onFolderSelected(lastFolderPath as any);
      } else {
        // Browser: Still need to request permission via folder picker
        toast.info("Browser security", {
          description: "Please select the folder again to grant permission."
        });
        
        if (!("showDirectoryPicker" in window)) {
          toast.error("Browser not supported", {
            description: "Your browser doesn't support folder selection."
          });
          setIsScanning(false);
          return;
        }

        const dirHandle = await (window as any).showDirectoryPicker({
          mode: "readwrite",
        });

        setPath(dirHandle.name);
        localStorage.setItem(LAST_FOLDER_KEY, dirHandle.name);
        setLastFolderPath(dirHandle.name);
        
        toast.success("Folder selected", {
          description: "Scanning for mods..."
        });

        onFolderSelected(dirHandle);
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        // User cancelled, do nothing
        return;
      }

      console.error("Error loading last folder:", error);
      toast.error("Failed to load folder", {
        description: error.message || "Could not access the folder"
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSimulatePath = () => {
    // Simulate a valid SPT installation path for demo
    const demoPath = "C:/SPT/";
    setPath(demoPath);
    onPathSelected(demoPath);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-6">
      <Card className="w-full max-w-2xl p-8 space-y-6 border-border">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <FolderOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">SPT Mod Config Editor</h1>
          <p className="text-muted-foreground">
            Select your SPT installation directory to begin
          </p>
          
          {/* Info */}
          {!isElectron() && (
            <div className="mt-4 p-3 rounded-lg bg-info/10 border border-info/20">
              <p className="text-xs text-foreground">
                <strong>Tip:</strong> Without the desktop app, you're basically editing with a broken arm.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Select Your SPT Folder
            </label>
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
            
            {/* Load Last Folder Button */}
            {lastFolderPath && (
              <Button
                onClick={handleLoadLastFolder}
                disabled={isScanning}
                variant="secondary"
                className="w-full h-14 text-base gap-3"
              >
                <History className="w-5 h-5" />
                Load Last Folder
                <span className="text-xs text-muted-foreground ml-2">
                  ({lastFolderPath.length > 30 ? '...' + lastFolderPath.slice(-30) : lastFolderPath})
                </span>
              </Button>
            )}
            
            <p className="text-xs text-muted-foreground text-center">
              {lastFolderPath 
                ? "Click above to browse, or load your last selected folder" 
                : "Click to browse and select your SPT installation directory"}
            </p>
          </div>

        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• The app will scan for mods in: {path || "[path]"}/user/mods/</p>
          <p>• Only compatible JSON config files will be loaded</p>
          <p>• You can change this path later in settings</p>
        </div>
      </Card>
    </div>
  );
};
