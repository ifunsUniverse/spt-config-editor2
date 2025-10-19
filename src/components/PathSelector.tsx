import { useState, useEffect } from "react";
import { FolderOpen, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { isElectron as isElectronAPI, electronAPI } from "@/utils/electronBridge";

// More reliable Electron detection for drag-and-drop
const isElectron = () => {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
};

interface PathSelectorProps {
  onFolderSelected: (handle: FileSystemDirectoryHandle | string) => void;
  onLoadLastFolder?: () => void;
}

export const PathSelector = ({ onFolderSelected, onLoadLastFolder }: PathSelectorProps) => {
  const [path, setPath] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [hasLastFolder, setHasLastFolder] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Check if there's a last folder on mount
  useEffect(() => {
    console.log('🔍 Electron detection:', {
      isElectron: isElectron(),
      hasElectronAPI: typeof window !== 'undefined' && !!window.electronAPI,
      electronAPI: window.electronAPI
    });
    
    const lastFolder = localStorage.getItem('lastSPTFolder');
    console.log('🔎 PathSelector checking for last folder:', lastFolder);
    const hasFolder = !!lastFolder && lastFolder !== 'browser-handle';
    console.log('🔘 Load Last Folder button will be:', hasFolder ? 'enabled' : 'disabled');
    setHasLastFolder(hasFolder);
  }, []);

  const handleSelectFolder = async () => {
    try {
      setIsScanning(true);

      if (isElectronAPI()) {
        // Use Electron dialog
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
          description: "The folder picker doesn't work in web preview. Please download the desktop app.",
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const uaElectron = isElectron();
    const dt = e.dataTransfer;

    console.log('🎯 Drop event triggered');
    console.log('🖥️ Electron mode (UA):', uaElectron);
    console.log('👤 User agent:', navigator.userAgent);
    console.log('📦 Dropped files:', dt?.files);
    console.log('📜 Dropped items:', dt?.items);

    if (!uaElectron) {
      toast.error("Drag and drop only works in desktop app", {
        description: "Please use the folder picker or download the desktop app."
      });
      return;
    }

    try {
      if (!dt || (dt.types && !dt.types.includes('Files'))) {
        console.log('❌ DataTransfer has no Files type');
        toast.error('No files detected in drop');
        return;
      }

      const file = dt.files?.[0] as any;
      console.log('Dropped item:', file);
      console.log('Path (from File):', file?.path);

      // Helper to normalize file:// URIs into system paths (handles Windows and POSIX)
      const normalizeFileUriToPath = (uri: string): string => {
        try {
          let decoded = decodeURI(uri);
          if (decoded.startsWith('file://')) {
            decoded = decoded.replace('file://', '');
            // On Windows, remove leading slash in /C:/...
            decoded = decoded.replace(/^\/(?:([A-Za-z]:))\//, '$1/');
          }
          return decoded;
        } catch {
          return uri;
        }
      };

      // Fallbacks for when Electron doesn't populate file.path on some drags
      let folderPath: string | undefined = file?.path as string | undefined;
      if (!folderPath) {
        const uriList = dt.getData('text/uri-list') || dt.getData('text/plain');
        console.log('text/uri-list:', uriList);
        if (uriList) {
          const firstLine = uriList.split('\n').find(l => l.trim().length && !l.startsWith('#'))?.trim();
          if (firstLine) {
            folderPath = normalizeFileUriToPath(firstLine);
            console.log('Path (from URI list):', folderPath);
          }
        }
      }

      if (!folderPath || typeof folderPath !== 'string') {
        toast.error("Could not read folder path", {
          description: "The dropped item doesn't have a valid path."
        });
        return;
      }

      const api = electronAPI();
      const stats = await api.stat(folderPath);

      if (!stats.isDirectory) {
        console.log('❌ Dropped item is not a directory:', folderPath);
        toast.error('Please drop a folder', {
          description: 'Files are not supported. Drop the SPT root folder.'
        });
        return;
      }

      setPath(folderPath);
      toast.success("Folder dropped", { description: "Scanning for mods..." });
      console.log('✅ Passing folder path to handler:', folderPath);
      onFolderSelected(folderPath);
    } catch (error: any) {
      console.error("❌ Error handling dropped folder:", error);
      toast.error("Failed to process dropped folder", {
        description: error.message || "Could not access the dropped folder"
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
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
          {!isElectronAPI() && (
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
            <p className="text-xs text-muted-foreground text-center">
              Click to browse and select your SPT installation directory
            </p>
          </div>

          {onLoadLastFolder && (
            <div className="space-y-2">
              <Button
                onClick={onLoadLastFolder}
                disabled={isScanning || !hasLastFolder}
                variant="secondary"
                className="w-full h-14 text-base gap-2"
              >
                <FolderOpen className="w-5 h-5" />
                Load Previous Folder
              </Button>
              {!hasLastFolder && (
                <p className="text-xs text-muted-foreground text-center">
                  No previous folder found
                </p>
              )}
            </div>
          )}

          {/* Drag and Drop Zone */}
          <div
            onDrop={handleDrop}
            onDropCapture={handleDrop}
            onDragOver={handleDragOver}
            onDragOverCapture={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-all
              ${isDragOver 
                ? 'border-primary bg-primary/10 scale-[1.02]' 
                : 'border-border bg-primary/5 hover:bg-primary/10'
              }
              ${isElectron() ? 'cursor-pointer' : 'opacity-60 pointer-events-none'}
            `}
          >
            <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className={`text-sm font-medium ${isDragOver ? 'text-primary' : 'text-foreground'}`}>
              📂 Drag your SPT folder here
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isElectron() ? 'Drop a folder to scan it instantly' : 'Only available in desktop app'}
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
