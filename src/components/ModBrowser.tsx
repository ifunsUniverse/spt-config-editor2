import { ArrowLeft, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DirectoryHandleLike } from "@/utils/electronBridge";

interface ModBrowserProps {
  onBack: () => void;
  rootDirHandle?: DirectoryHandleLike | null;
}

/**
 * Mod Browser is temporarily disabled. The previous remote mod API integration
 * was removed; a new data source will be wired in here later.
 */
export const ModBrowser = ({ onBack }: ModBrowserProps) => (
  <div className="flex min-h-screen items-center justify-center bg-background p-4">
    <div className="w-full max-w-md rounded-[2rem] border border-border/60 bg-card p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Globe className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="font-display text-lg font-bold text-foreground">Mod Browser is offline</h1>
      <p className="mt-2 text-sm text-muted-foreground">This feature is being rebuilt and will return soon.</p>
      <Button variant="ghost" size="sm" onClick={onBack} className="mt-5 gap-2">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
    </div>
  </div>
);
