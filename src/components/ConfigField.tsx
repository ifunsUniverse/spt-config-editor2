import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ConfigValue } from "@/utils/configHelpers";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ConfigFieldProps {
  config: ConfigValue;
  onChange: (value: any) => void;
}

export const ConfigField = ({ config, onChange }: ConfigFieldProps) => {
  const renderControl = () => {
    switch (config.type) {
      case "boolean":
        return (
          <Switch
            checked={config.value}
            onCheckedChange={onChange}
          />
        );

      case "string":
        return (
          <Input
            value={config.value}
            onChange={(e) => onChange(e.target.value)}
            className="max-w-xs bg-input border-border"
          />
        );

      case "number":
        return (
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <Slider
              value={[config.value]}
              onValueChange={([value]) => onChange(value)}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <Input
              type="number"
              value={config.value}
              onChange={(e) => onChange(Number(e.target.value))}
              className="w-20 bg-input border-border"
            />
          </div>
        );

      case "select":
        return (
          <Select value={config.value} onValueChange={onChange}>
            <SelectTrigger className="max-w-xs bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {config.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "keybind":
        return (
          <Input
            value={config.value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Press a key..."
            className="max-w-xs bg-input border-border"
          />
        );

      default:
        return null;
    }
  };

  return (
    <Card className="p-4 border-border hover:border-primary/50 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-foreground">{config.key}</h4>
            {config.description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-popover border-border">
                    <p className="max-w-xs">{config.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {config.description && (
            <p className="text-sm text-muted-foreground">{config.description}</p>
          )}
        </div>
        <div className="flex items-center">
          {renderControl()}
        </div>
      </div>
    </Card>
  );
};
