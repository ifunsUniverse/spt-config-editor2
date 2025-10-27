import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface ThemeConfig {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  fontSize: number;
  borderRadius: number;
}

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "JetBrains Mono", label: "JetBrains Mono" },
  { value: "system-ui", label: "System Default" },
];

export function ThemeEditor() {
  const [config, setConfig] = useState<ThemeConfig>({
    primaryColor: "217 91% 60%",
    accentColor: "262 83% 58%",
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
        const parsed = JSON.parse(saved);
        setConfig(parsed);
        applyTheme(parsed);
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
    
    // Apply colors to CSS variables
    root.style.setProperty('--primary', cfg.primaryColor);
    root.style.setProperty('--accent', cfg.accentColor);
    
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
      primaryColor: "217 91% 60%",
      accentColor: "262 83% 58%",
      fontFamily: "Inter",
      fontSize: 16,
      borderRadius: 0.75,
    };
    setConfig(defaultConfig);
    setRoundedUI(true);
    localStorage.removeItem('themeConfig');
    toast.success('Theme reset to default!');
  };

  const hslToHex = (hsl: string) => {
    const [h, s, l] = hsl.split(' ').map(v => parseFloat(v));
    const hDecimal = h / 360;
    const sDecimal = s / 100;
    const lDecimal = l / 100;
    
    const c = (1 - Math.abs(2 * lDecimal - 1)) * sDecimal;
    const x = c * (1 - Math.abs((hDecimal * 6) % 2 - 1));
    const m = lDecimal - c / 2;
    
    let r = 0, g = 0, b = 0;
    
    if (hDecimal < 1/6) [r, g, b] = [c, x, 0];
    else if (hDecimal < 2/6) [r, g, b] = [x, c, 0];
    else if (hDecimal < 3/6) [r, g, b] = [0, c, x];
    else if (hDecimal < 4/6) [r, g, b] = [0, x, c];
    else if (hDecimal < 5/6) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    
    const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const hexToHsl = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card">
      <h3 className="font-semibold text-lg">Theme Customization</h3>

      <div className="space-y-2">
        <Label htmlFor="primary-color">Primary Color</Label>
        <div className="flex gap-2">
          <Input
            id="primary-color"
            type="color"
            value={hslToHex(config.primaryColor)}
            onChange={(e) => setConfig({ ...config, primaryColor: hexToHsl(e.target.value) })}
            className="w-20 h-10 cursor-pointer"
          />
          <Input
            value={config.primaryColor}
            onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
            placeholder="217 91% 60%"
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="accent-color">Accent Color</Label>
        <div className="flex gap-2">
          <Input
            id="accent-color"
            type="color"
            value={hslToHex(config.accentColor)}
            onChange={(e) => setConfig({ ...config, accentColor: hexToHsl(e.target.value) })}
            className="w-20 h-10 cursor-pointer"
          />
          <Input
            value={config.accentColor}
            onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
            placeholder="262 83% 58%"
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="font-family">Font Family</Label>
        <Select value={config.fontFamily} onValueChange={(value) => setConfig({ ...config, fontFamily: value })}>
          <SelectTrigger id="font-family">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map(font => (
              <SelectItem key={font.value} value={font.value}>
                {font.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
