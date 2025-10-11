import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface PathSelectorProps {
  onPathSelected: (path: string) => void;
}

export const PathSelector = ({ onPathSelected }: PathSelectorProps) => {
  const [path, setPath] = useState("");

  const handleSelectPath = () => {
    if (path.trim()) {
      onPathSelected(path);
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
              Installation Path
            </label>
            <div className="flex gap-2">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="e.g., C:/SPT/"
                className="flex-1 bg-input border-border text-foreground"
              />
              <Button
                onClick={handleSelectPath}
                disabled={!path.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Browse
              </Button>
            </div>
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
            Use Demo Path (for testing)
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
