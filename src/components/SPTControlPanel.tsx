import { useEffect, useMemo, useState } from "react";
import { Play, Power, Activity, Settings2, FileSearch, HelpCircle } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { launchExecutable, selectExecutable } from "@/utils/electronBridge";

interface SPTControlPanelProps {
  sptPath: string;
}

export const SPTControlPanel = ({ sptPath }: SPTControlPanelProps) => {
  const isDesktop = Boolean(window.sptElectron?.invoke);
  const [serverExePath, setServerExePath] = useState<string>(() => localStorage.getItem("spt_server_exe_path") || "");
  const [launcherExePath, setLauncherExePath] = useState<string>(() => localStorage.getItem("spt_launcher_exe_path") || "");
  const [isLaunchingServer, setIsLaunchingServer] = useState(false);
  const [isLaunchingLauncher, setIsLaunchingLauncher] = useState(false);

  const rootPathCandidates = useMemo(() => {
    const candidates: string[] = [];
    const savedPath = localStorage.getItem("lastSPTFolderPath") || "";
    if (savedPath) {
      const normalized = savedPath.replace(/[\\/]+$/, "");
      candidates.push(normalized);
      candidates.push(`${normalized}/SPT`);
    }
    if (sptPath && /[\\/]/.test(sptPath)) candidates.push(sptPath);
    return Array.from(new Set(candidates));
  }, [sptPath]);

  const normalizePath = (value: string): string =>
    value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

  const isPathInCurrentSelection = (candidatePath: string): boolean => {
    const normalizedCandidate = normalizePath(candidatePath);
    return rootPathCandidates.some((rootPath) => {
      const normalizedRoot = normalizePath(rootPath);
      return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`);
    });
  };

  const checkPathExists = async (candidatePath: string): Promise<boolean> => {
    if (!window.sptElectron?.invoke || !candidatePath) return false;
    try {
      return await window.sptElectron.invoke("fs:exists", { path: candidatePath, kind: "file" });
    } catch {
      return false;
    }
  };

  const detectExecutable = async (names: string[]): Promise<string | null> => {
    if (!isDesktop) return null;

    for (const rootPath of rootPathCandidates) {
      const normalized = rootPath.replace(/[\\/]+$/, "");
      for (const fileName of names) {
        const candidatePath = `${normalized}/${fileName}`;
        if (await checkPathExists(candidatePath)) {
          return candidatePath;
        }
      }
    }

    return null;
  };

  useEffect(() => {
    if (!isDesktop) return;

    let disposed = false;

    const detect = async () => {
      // Keep existing valid paths first.
      if (serverExePath && !(await checkPathExists(serverExePath))) {
        setServerExePath("");
        localStorage.removeItem("spt_server_exe_path");
      }
      if (launcherExePath && !(await checkPathExists(launcherExePath))) {
        setLauncherExePath("");
        localStorage.removeItem("spt_launcher_exe_path");
      }

      const shouldRedetectServer =
        !serverExePath ||
        !isPathInCurrentSelection(serverExePath);

      if (shouldRedetectServer) {
        const serverDetected = await detectExecutable([
          "Aki.Server.exe",
          "SPT.Server.exe",
          "Aki.Server.lnk",
          "SPT.Server.lnk",
        ]);
        if (!disposed && serverDetected) {
          setServerExePath(serverDetected);
          localStorage.setItem("spt_server_exe_path", serverDetected);
        }
      }

      const shouldRedetectLauncher =
        !launcherExePath ||
        !isPathInCurrentSelection(launcherExePath);

      if (shouldRedetectLauncher) {
        const launcherDetected = await detectExecutable([
          "Aki.Launcher.exe",
          "SPT.Launcher.exe",
          "Aki.Launcher.lnk",
          "SPT.Launcher.lnk",
        ]);
        if (!disposed && launcherDetected) {
          setLauncherExePath(launcherDetected);
          localStorage.setItem("spt_launcher_exe_path", launcherDetected);
        }
      }
    };

    void detect();
    return () => {
      disposed = true;
    };
  }, [isDesktop, rootPathCandidates, serverExePath, launcherExePath]);

  const handleSelectServerExe = async () => {
    if (!isDesktop) {
      toast.info("Desktop feature", { description: "Executable selection requires the desktop app." });
      return;
    }

    const selected = await selectExecutable("Select SPT Server executable", serverExePath || rootPathCandidates[0]);
    if (!selected.canceled && selected.path) {
      setServerExePath(selected.path);
      localStorage.setItem("spt_server_exe_path", selected.path);
    }
  };

  const handleSelectLauncherExe = async () => {
    if (!isDesktop) {
      toast.info("Desktop feature", { description: "Executable selection requires the desktop app." });
      return;
    }

    const selected = await selectExecutable("Select SPT Launcher executable", launcherExePath || rootPathCandidates[0]);
    if (!selected.canceled && selected.path) {
      setLauncherExePath(selected.path);
      localStorage.setItem("spt_launcher_exe_path", selected.path);
    }
  };

  const handleLaunchServer = async () => {
    if (!isDesktop) {
      toast.info("Desktop feature", { description: "Launching the SPT Server requires the desktop app." });
      return;
    }
    if (!serverExePath) {
      toast.error("Server executable not set");
      return;
    }

    setIsLaunchingServer(true);
    try {
      await launchExecutable(serverExePath, [], { openInTerminal: true });
      toast.success("SPT Server launched");
    } catch (error: any) {
      toast.error("Failed to launch server", { description: error?.message || "Unknown error" });
    } finally {
      setIsLaunchingServer(false);
    }
  };

  const handleLaunchLauncher = async () => {
    if (!isDesktop) {
      toast.info("Desktop feature", { description: "Launching the SPT Launcher requires the desktop app." });
      return;
    }
    if (!launcherExePath) {
      toast.error("Launcher executable not set");
      return;
    }

    setIsLaunchingLauncher(true);
    try {
      await launchExecutable(launcherExePath);
      toast.success("SPT Launcher launched");
    } catch (error: any) {
      toast.error("Failed to launch launcher", { description: error?.message || "Unknown error" });
    } finally {
      setIsLaunchingLauncher(false);
    }
  };

  return (
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
                <p>{isDesktop ? "Controls are active. Verify server/launcher paths in settings if launch fails." : "Server & Launcher controls require the desktop app. In the web version you can still browse and edit configs."}</p>
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
              <DialogDescription>
                {isDesktop ? "Set or verify executable paths used by the control panel." : "Server/Launcher launching requires the desktop version of SPT Mod Config Editor."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Server Executable / Shortcut</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted px-3 py-2 rounded-md text-xs truncate border border-border">
                    {serverExePath || (isDesktop ? "Not set" : "Not available in web mode")}
                  </div>
                  <Button size="sm" variant="outline" onClick={handleSelectServerExe} disabled={!isDesktop}>
                    <FileSearch className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Launcher Executable / Shortcut</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted px-3 py-2 rounded-md text-xs truncate border border-border">
                    {launcherExePath || (isDesktop ? "Not set" : "Not available in web mode")}
                  </div>
                  <Button size="sm" variant="outline" onClick={handleSelectLauncherExe} disabled={!isDesktop}>
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
          disabled={!isDesktop || !serverExePath || isLaunchingServer}
        >
          <div className="flex items-center gap-1.5">
            <Power className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-bold">SERVER</span>
          </div>
          <Badge 
            variant="outline" 
            className={cn("text-[8px] h-3.5 px-1 font-medium", (!isDesktop || !serverExePath) && "opacity-50")}
          >
            {isLaunchingServer ? "STARTING" : "START"}
          </Badge>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="w-full h-12 flex flex-col gap-0.5 border-dashed hover:border-primary/50"
          onClick={handleLaunchLauncher}
          disabled={!isDesktop || !launcherExePath || isLaunchingLauncher}
        >
          <div className="flex items-center gap-1.5">
            <Play className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] font-bold">CLIENT</span>
          </div>
          <Badge 
            variant="outline" 
            className={cn("text-[8px] h-3.5 px-1 font-medium", (!isDesktop || !launcherExePath) && "opacity-50")}
          >
            {isLaunchingLauncher ? "LAUNCHING" : "LAUNCH"}
          </Badge>
        </Button>
      </div>

      <p className="text-[9px] text-muted-foreground text-center italic">
        {isDesktop ? "Launch controls are active in desktop mode" : "Launch controls require the desktop app"}
      </p>
    </Card>
  );
};
