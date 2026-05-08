import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface ThemeConfig {
  fontFamily: string;
  fontSize: number;
  borderRadius: number;
}

const SINGLE_APP_COLOR = "217 91% 60%";

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "JetBrains Mono", label: "JetBrains Mono" },
  { value: "system-ui", label: "System Default" },
];

export function ThemeEditor() {
  const [config, setConfig] = useState<ThemeConfig>({
    fontFamily: "Inter",
    fontSize: 16,
    borderRadius: 0.75,
  });

  const [roundedUI, setRoundedUI] = useState(true);

  useEffect(() => {
    // Load saved theme from localStorage
    const saved = localStorage.getItem('themeConfig');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<ThemeConfig>;
        const normalized: ThemeConfig = {
          fontFamily: typeof parsed.fontFamily === "string" ? parsed.fontFamily : "Inter",
          fontSize: typeof parsed.fontSize === "number" ? parsed.fontSize : 16,
          borderRadius: typeof parsed.borderRadius === "number" ? parsed.borderRadius : 0.75,
        };
        setConfig(normalized);
        applyTheme(normalized);
      } catch (err) {
        console.error('Failed to load theme:', err);
      }
    }
  }, []);

  // Apply theme changes immediately for live preview
  useEffect(() => {
    applyTheme(config);
  }, [config]);

  const applyTheme = (cfg: ThemeConfig) => {
    const root = document.documentElement;
    
    // Keep the app on one consistent brand color (no separate accent color).
    root.style.setProperty('--primary', SINGLE_APP_COLOR);
    root.style.setProperty('--accent', SINGLE_APP_COLOR);
    
    // Apply font family via CSS variable with proper quoting
    const fontFamily = cfg.fontFamily.includes(' ') 
      ? `"${cfg.fontFamily}", system-ui, sans-serif`
      : `${cfg.fontFamily}, system-ui, sans-serif`;
    root.style.setProperty('--theme-font-family', fontFamily);
    
    // Apply font size via CSS variable
    root.style.setProperty('--theme-font-size', `${cfg.fontSize}px`);
    
    // Apply border radius
    root.style.setProperty('--radius', `${cfg.borderRadius}rem`);
  };

  const handleSave = () => {
    localStorage.setItem('themeConfig', JSON.stringify(config));
    applyTheme(config);
    toast.success('Theme saved successfully!');
  };

  const handleReset = () => {
    const defaultConfig: ThemeConfig = {
      fontFamily: "Inter",
      fontSize: 16,
      borderRadius: 0.75,
    };
    setConfig(defaultConfig);
    setRoundedUI(true);
    localStorage.removeItem('themeConfig');
    toast.success('Theme reset to default!');
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <h3 className="font-semibold text-lg">Appearance</h3>

      <div className="space-y-2">
        <Label htmlFor="font-size">Font Size: {config.fontSize}px</Label>
        <Slider
          id="font-size"
          min={12}
          max={20}
          step={1}
          value={[config.fontSize]}
          onValueChange={([value]) => setConfig({ ...config, fontSize: value })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="rounded-ui">Rounded UI</Label>
        <Switch
          id="rounded-ui"
          checked={roundedUI}
          onCheckedChange={(checked) => {
            setRoundedUI(checked);
            setConfig({ ...config, borderRadius: checked ? 0.75 : 0 });
          }}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button onClick={handleSave} className="flex-1">
          Save Theme
        </Button>
        <Button onClick={handleReset} variant="outline" className="flex-1">
          Reset to Default
        </Button>
      </div>
    </div>
  );
}
