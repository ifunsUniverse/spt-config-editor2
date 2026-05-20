import { Settings, Globe, ArrowLeft, MessageSquarePlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FeatureSelectProps {
  onSelectFeature: (feature: "configEditor" | "modBrowser" | "community") => void;
  onBack: () => void;
  modCount: number;
}

export const FeatureSelect = ({ onSelectFeature, onBack, modCount }: FeatureSelectProps) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-3 sm:p-4">
      <div className="w-full max-w-2xl space-y-4">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Choose Feature
          </h1>
          <p className="text-sm text-muted-foreground">
            {modCount} mod(s) loaded — select what you'd like to do
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card
            className="cursor-pointer border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
            onClick={() => onSelectFeature("configEditor")}
          >
            <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                <Settings className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Config Editor</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Edit mod configuration files with a visual editor
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
            onClick={() => onSelectFeature("modBrowser")}
          >
            <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                <Globe className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Mod Browser</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Browse and discover mods from the community
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-border hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all group"
            onClick={() => onSelectFeature("community")}
          >
            <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10 transition-colors group-hover:bg-yellow-500/20">
                <MessageSquarePlus className="w-7 h-7 text-yellow-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Community Board</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Suggest features and report bugs
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to folder selection
          </Button>
        </div>
      </div>
    </div>
  );
};
