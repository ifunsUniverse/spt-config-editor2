import { useState } from "react";
import { FolderOpen, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface PathSelectorProps {
  onPathSelected: (path: string) => void;
  onFolderSelected: (handle: FileSystemDirectoryHandle) => void;
}

export const PathSelector = ({ onPathSelected, onFolderSelected }: PathSelectorProps) => {
  const [path, setPath] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const handleSelectPath = () => {
    if (path.trim()) {
      onPathSelected(path);
    }
  };

  const handleSelectFolder = async () => {
    try {
      // Check if File System Access API is supported
      if (!("showDirectoryPicker" in window)) {
        toast.error("Browser not supported", {
          description: "Your browser doesn't support folder selection. Try Chrome, Edge, or Opera."
        });
        return;
      }

      setIsScanning(true);
      
      // Open folder picker
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: "readwrite",
      });

      setPath(dirHandle.name);
      
      toast.success("Folder selected", {
        description: "Scanning for mods..."
      });

      onFolderSelected(dirHandle);
      
    } catch (error: any) {
      if (error.name === "AbortError") {
        // User cancelled, do nothing
        return;
      }
      
      console.error("Error selecting folder:", error);
      toast.error("Failed to select folder", {
        description: error.message || "Could not access the selected folder"
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
            <p className="text-xs text-muted-foreground text-center">
              Click to browse and select your SPT installation directory
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            onClick={handleSimulatePath}
            variant="outline"
            className="w-full border-border hover:bg-secondary"
          >
            Use Demo Data (for testing)
          </Button>
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
