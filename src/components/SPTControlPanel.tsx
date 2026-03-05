/**
 * SPT Control Panel - Web version
 * Note: Launching executables is not possible from a web browser.
 * This panel is hidden in web mode.
 */

import { Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SPTControlPanelProps {
  sptPath: string;
}

export const SPTControlPanel = ({ sptPath }: SPTControlPanelProps) => {
  return (
    <Card className="mx-3 my-3 p-3 bg-card/40 border-primary/20 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">SPT Folder</h3>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[9px] truncate max-w-full">
          {sptPath}
        </Badge>
      </div>
      <p className="text-[9px] text-muted-foreground italic">
        Server/Launcher controls require the desktop app
      </p>
    </Card>
  );
};
