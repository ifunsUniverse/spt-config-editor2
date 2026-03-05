import { useState } from "react";
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

interface SPTControlPanelProps {
  sptPath: string;
}

export const SPTControlPanel = ({ sptPath }: SPTControlPanelProps) => {
  const [serverExePath, setServerExePath] = useState<string>(() => localStorage.getItem("spt_server_exe_path") || "");
  const [launcherExePath, setLauncherExePath] = useState<string>(() => localStorage.getItem("spt_launcher_exe_path") || "");

  const handleSelectServerExe = () => {
    toast.info("Desktop feature", { description: "Executable selection requires the desktop app." });
  };

  const handleSelectLauncherExe = () => {
    toast.info("Desktop feature", { description: "Executable selection requires the desktop app." });
  };

  const handleLaunchServer = () => {
    toast.info("Desktop feature", { description: "Launching the SPT Server requires the desktop app." });
  };

  const handleLaunchLauncher = () => {
    toast.info("Desktop feature", { description: "Launching the SPT Launcher requires the desktop app." });
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
                <p>Server & Launcher controls require the desktop app. In the web version you can still browse and edit configs.</p>
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
                Server/Launcher launching requires the desktop version of SPT Mod Config Editor.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Server Executable</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted px-3 py-2 rounded-md text-xs truncate border border-border">
                    {serverExePath || "Not available in web mode"}
                  </div>
                  <Button size="sm" variant="outline" onClick={handleSelectServerExe} disabled>
                    <FileSearch className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Launcher Executable</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-muted px-3 py-2 rounded-md text-xs truncate border border-border">
                    {launcherExePath || "Not available in web mode"}
                  </div>
                  <Button size="sm" variant="outline" onClick={handleSelectLauncherExe} disabled>
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
        Launch controls require the desktop app
      </p>
    </Card>
  );
};
