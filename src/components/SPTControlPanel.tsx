import { useState, useEffect } from "react";
import { Play, Power, Activity, Settings2, FileSearch, HelpCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SPTControlPanelProps {
  sptPath: string;
}

export const SPTControlPanel = ({ sptPath }: SPTControlPanelProps) => {
  const [isLaunchingServer, setIsLaunchingServer] = useState(false);
  const [isLaunchingLauncher, setIsLaunchingLauncher] = useState(false);
  const [showDetectionDialog, setShowDetectionDialog] = useState(false);
  const [detectionMessage, setDetectionMessage] = useState("");
  
  const [serverExePath, setServerExePath] = useState<string>(() => localStorage.getItem("spt_server_exe_path") || "");
  const [launcherExePath, setLauncherExePath] = useState<string>(() => localStorage.getItem("spt_launcher_exe_path") || "");

  // Auto-detect executables when sptPath changes
  useEffect(() => {
    const detectExecutables = async () => {
      if (!sptPath) return;

      // Common executable names including Fika variations
      const serverNames = ["Server.exe", "SPT.Server.exe", "Aki.Server.exe"];
      const launcherNames = ["Launcher.exe", "SPT.Launcher.exe", "Aki.Launcher.exe"];
      
      let foundServer = "";
      let foundLauncher = "";

      const separator = sptPath.includes("\\") ? "\\" : "/";

      // Define search sub-paths (root, and /SPT/ subdirectory)
      const subPaths = ["", `${separator}SPT`];

      // Search for server
      for (const sub of subPaths) {
        for (const name of serverNames) {
          const fullPath = `${sptPath}${sub}${separator}${name}`;
          if (await window.electronBridge.exists(fullPath)) {
            foundServer = fullPath;
            break;
          }
        }
        if (foundServer) break;
      }

      // Search for launcher
      for (const sub of subPaths) {
        for (const name of launcherNames) {
          const fullPath = `${sptPath}${sub}${separator}${name}`;
          if (await window.electronBridge.exists(fullPath)) {
            foundLauncher = fullPath;
            break;
          }
        }
        if (foundLauncher) break;
      }

      if (foundServer) {
        setServerExePath(foundServer);
        localStorage.setItem("spt_server_exe_path", foundServer);
      }

      if (foundLauncher) {
        setLauncherExePath(foundLauncher);
        localStorage.setItem("spt_launcher_exe_path", foundLauncher);
      }

      if (foundServer || foundLauncher) {
        const serverLabel = foundServer ? "Server" : "";
        const launcherLabel = foundLauncher ? "Launcher" : "";
        const connector = foundServer && foundLauncher ? " and " : "";
        
        setDetectionMessage(`Found ${serverLabel}${connector}${launcherLabel} in ${sptPath}.`);
        setShowDetectionDialog(true);
      }
    };

    detectExecutables();
  }, [sptPath]);

  const handleSelectServerExe = async () => {
    const result = await window.electronBridge.selectExe({
      title: "Select SPT Server Executable (Server.exe)",
      defaultPath: sptPath
    });
    if (!result.canceled && result.path) {
      setServerExePath(result.path);
      localStorage.setItem("spt_server_exe_path", result.path);
      toast.success("Server executable set");
    }
  };

  const handleSelectLauncherExe = async () => {
    const result = await window.electronBridge.selectExe({
      title: "Select SPT Launcher Executable (Launcher.exe)",
      defaultPath: sptPath
    });
    if (!result.canceled && result.path) {
      setLauncherExePath(result.path);
      localStorage.setItem("spt_launcher_exe_path", result.path);
      toast.success("Launcher executable set");
    }
  };

  const handleLaunchServer = async () => {
    if (!serverExePath) {
      toast.error("Executable Required", { description: "Please select the Server.exe in settings (cog icon)." });
      return;
    }
    setIsLaunchingServer(true);
    try {
      const result = await window.electronBridge.launchSPT(serverExePath);
      if (result.success) {
        toast.success("SPT Server starting in new window");
      }
    } catch (error: any) {
      toast.error("Failed to launch Server", { description: error.message });
    } finally {
      setIsLaunchingServer(false);
    }
  };

  const handleLaunchLauncher = async () => {
    if (!launcherExePath) {
      toast.error("Executable Required", { description: "Please select the Launcher.exe in settings (cog icon)." });
      return;
    }
    setIsLaunchingLauncher(true);
    try {
      const result = await window.electronBridge.launchSPT(launcherExePath);
      if (result.success) {
        toast.success("SPT Launcher starting...");
      }
    } catch (error: any) {
      toast.error("Failed to launch Launcher", { description: error.message });
    } finally {
      setIsLaunchingLauncher(false);
    }
  };

  return (
    <>
      <Card className="mx-3 my-3 p-3 bg-card/40 border-primary/20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SPT Control Panel</h3>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help relative">
                    <HelpCircle className="w-3.5 h-3.5 text-primary/60" />
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[200px] text-[11px] leading-relaxed">
                  <p>Paths are auto-detected when you select an SPT folder. Click the gear to change them manually.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Launch Settings</DialogTitle>
                <DialogHeader>
                  <DialogDescription>
                    Select the specific .exe files used to start your SPT server and launcher.
                  </DialogDescription>
                </DialogHeader>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Server Executable</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-muted px-3 py-2 rounded-md text-xs truncate border border-border">
                      {serverExePath || "No file selected"}
                    </div>
                    <Button size="sm" variant="outline" onClick={handleSelectServerExe}>
                      <FileSearch className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Launcher Executable</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-muted px-3 py-2 rounded-md text-xs truncate border border-border">
                      {launcherExePath || "No file selected"}
                    </div>
                    <Button size="sm" variant="outline" onClick={handleSelectLauncherExe}>
                      <FileSearch className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-12 flex flex-col gap-0.5 border-dashed hover:border-primary/50"
            onClick={handleLaunchServer}
            disabled={isLaunchingServer}
          >
            <div className="flex items-center gap-1.5">
              <Power className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-bold">SERVER</span>
            </div>
            <Badge 
              variant="outline" 
              className="text-[8px] h-3.5 px-1 font-medium opacity-50"
            >
              START
            </Badge>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full h-12 flex flex-col gap-0.5 border-dashed hover:border-primary/50"
            onClick={handleLaunchLauncher}
            disabled={isLaunchingLauncher}
          >
            <div className="flex items-center gap-1.5">
              <Play className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-bold">CLIENT</span>
            </div>
            <Badge 
              variant="outline" 
              className="text-[8px] h-3.5 px-1 font-medium opacity-50"
            >
              LAUNCH
            </Badge>
          </Button>
        </div>

        <p className="text-[9px] text-muted-foreground text-center italic">
          Paths are auto-configured based on your selected SPT folder.
        </p>
      </Card>

      {/* Detection Confirmation Modal */}
      <Dialog open={showDetectionDialog} onOpenChange={setShowDetectionDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <DialogTitle>SPT Detected</DialogTitle>
            </div>
            <div className="space-y-4">
              <DialogDescription className="text-base break-all">
                {detectionMessage}
              </DialogDescription>
              <p className="text-sm text-muted-foreground">
                You can find the Control Panel in the top left of the screen to manage your server and launcher.
              </p>
            </div>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button 
              className="w-full sm:w-auto px-8" 
              onClick={() => setShowDetectionDialog(false)}
            >
              Okay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};