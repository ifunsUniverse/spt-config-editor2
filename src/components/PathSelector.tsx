import { useState } from "react";
import { FolderOpen, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { electronAPI } from "@/utils/electronBridge";


interface PathSelectorProps {
  onFolderSelected: (path: string) => void;
  onLoadLastFolder?: () => void;
}

export const PathSelector = ({ onFolderSelected }: PathSelectorProps) => {
  const [path, setPath] = useState("");
  const [isScanning, setIsScanning] = useState(false);


  const handleSelectFolder = async () => {
    try {
      setIsScanning(true);
      const api = electronAPI();
      const result = await api.selectFolder();

      if (result.canceled || !result.path) {
        setIsScanning(false);
        return;
      }

      setPath(result.path);
      toast.success("Folder selected", {
        description: "Scanning for mods..."
      });

      onFolderSelected(result.path);
    } catch (error: any) {
      console.error("Error selecting folder:", error);
      toast.error("Failed to select folder", {
        description: error.message || "Could not access the selected folder"
      });
    } finally {
      setIsScanning(false);
    }
  };




  return (
    <div className="flex items-center justify-center min-h-screen bg-background/95 backdrop-blur-sm p-6">
      <Card className="w-full max-w-2xl p-10 space-y-8 border-border/50 shadow-2xl bg-card/80 backdrop-blur">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 mb-6 shadow-lg shadow-primary/20">
            <FolderOpen className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground tracking-tight">SPT Mod Config Editor</h1>
          <p className="text-muted-foreground text-lg">
            Select your SPT installation directory to begin
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground/90">
              Select Your SPT Folder
            </label>
            <Button
              onClick={handleSelectFolder}
              disabled={isScanning}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-28 text-xl gap-4 font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-7 h-7 animate-spin" />
                  Scanning folder...
                </>
              ) : (
                <>
                  <Upload className="w-7 h-7" />
                  Select SPT Installation Folder
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground/80 text-center">
              Click to browse and select your SPT installation directory
            </p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground/70 space-y-1.5 pt-2 border-t border-border/50">
          <p>• The app will scan for mods in: <span className="text-foreground/60 font-mono text-xs">{path || "[path]"}/user/mods/</span></p>
          <p>• Only compatible JSON config files will be loaded</p>
          <p>• You can change this path later in settings</p>
        </div>
      </Card>
    </div>
  );
};
