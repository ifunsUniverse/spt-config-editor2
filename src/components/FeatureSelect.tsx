import { Settings, Globe, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FeatureSelectProps {
  onSelectFeature: (feature: "configEditor" | "modBrowser") => void;
  onBack: () => void;
  modCount: number;
}

export const FeatureSelect = ({ onSelectFeature, onBack, modCount }: FeatureSelectProps) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Choose Feature
          </h1>
          <p className="text-sm text-muted-foreground">
            {modCount} mod(s) loaded — select what you'd like to do
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            className="cursor-pointer border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
            onClick={() => onSelectFeature("configEditor")}
          >
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
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
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
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
