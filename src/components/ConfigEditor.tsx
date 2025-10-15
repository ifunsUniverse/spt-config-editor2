import { useState, useEffect } from "react";
import { Save, RotateCcw, Search, Code, Columns, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfigField } from "./ConfigField";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface ConfigValue {
  key: string;
  value: any;
  type: "boolean" | "string" | "number" | "select" | "keybind";
  description?: string;
  options?: string[];
}

interface ConfigEditorProps {
  modName: string;
  configFile: string;
  values: ConfigValue[];
  rawJson: any;
  onSave: (values: ConfigValue[]) => void;
  hasUnsavedChanges?: boolean;
  onChangesDetected?: (hasChanges: boolean) => void;
  onExportMods?: () => void;
}

type ViewMode = "structured" | "raw";

export const ConfigEditor = ({ 
  modName, 
  configFile, 
  values: initialValues, 
  rawJson,
  onSave,
  hasUnsavedChanges,
  onChangesDetected,
  onExportMods
}: ConfigEditorProps) => {
  const [values, setValues] = useState<ConfigValue[]>(initialValues);
  const [rawText, setRawText] = useState<string>(JSON.stringify(rawJson, null, 2));
  const [searchQuery, setSearchQuery] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("structured");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Reset when config changes
  useEffect(() => {
    setValues(initialValues);
    setRawText(JSON.stringify(rawJson, null, 2));
    setHasChanges(false);
    setJsonError(null);
    if (onChangesDetected) {
      onChangesDetected(false);
    }
  }, [configFile, modName]);

  const handleValueChange = (key: string, newValue: any) => {
    setValues(prev => prev.map(v => 
      v.key === key ? { ...v, value: newValue } : v
    ));
    const newHasChanges = true;
    setHasChanges(newHasChanges);
    if (onChangesDetected) {
      onChangesDetected(newHasChanges);
    }
  };

  const handleRawTextChange = (text: string) => {
    setRawText(text);
    const newHasChanges = true;
    setHasChanges(newHasChanges);
    if (onChangesDetected) {
      onChangesDetected(newHasChanges);
    }
    
    // Validate JSON
    try {
      JSON.parse(text);
      setJsonError(null);
    } catch (error: any) {
      setJsonError(error.message);
    }
  };

  const handleSave = () => {
    if (viewMode === "raw") {
      // Validate and save raw JSON
      try {
        const parsedJson = JSON.parse(rawText);
        // Convert back to ConfigValues for structured mode
        const newValues = jsonToConfigValues(parsedJson);
        setValues(newValues);
        onSave(newValues);
        setHasChanges(false);
        if (onChangesDetected) {
          onChangesDetected(false);
        }
        toast.success("Config saved successfully", {
          description: `Changes to ${configFile} have been saved`
        });
      } catch (error: any) {
        toast.error("Invalid JSON", {
          description: error.message
        });
        return;
      }
    } else {
      onSave(values);
      setHasChanges(false);
      if (onChangesDetected) {
        onChangesDetected(false);
      }
      toast.success("Config saved successfully", {
        description: `Changes to ${configFile} have been saved`
      });
    }
  };

  const handleReset = () => {
    setValues(initialValues);
    setRawText(JSON.stringify(rawJson, null, 2));
    setHasChanges(false);
    setJsonError(null);
    if (onChangesDetected) {
      onChangesDetected(false);
    }
    toast.info("Changes discarded", {
      description: "Config has been reset to saved values"
    });
  };

  // Helper to convert JSON back to ConfigValues
  const jsonToConfigValues = (json: any, prefix = ""): ConfigValue[] => {
    const vals: ConfigValue[] = [];
    for (const [key, value] of Object.entries(json)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "boolean") {
        vals.push({ key: fullKey, value, type: "boolean" });
      } else if (typeof value === "number") {
        vals.push({ key: fullKey, value, type: "number" });
      } else if (typeof value === "string") {
        vals.push({ key: fullKey, value, type: "string" });
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        vals.push(...jsonToConfigValues(value, fullKey));
      }
    }
    return vals;
  };

  const filteredValues = values.filter(v =>
    v.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">{modName}</h2>
            <p className="text-sm text-muted-foreground">{configFile}</p>
          </div>
          <div className="flex gap-2 items-center">
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
              <ToggleGroupItem value="structured" aria-label="Structured view">
                <Columns className="w-4 h-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="raw" aria-label="Raw JSON view">
                <Code className="w-4 h-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              onClick={handleReset}
              disabled={!hasChanges}
              variant="outline"
              size="sm"
              className="gap-2 border-border"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || (viewMode === "raw" && jsonError !== null)}
              size="sm"
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
            {onExportMods && (
              <Button
                onClick={onExportMods}
                size="sm"
                variant="secondary"
                className="gap-2"
              >
                <Package className="w-4 h-4" />
                Pack & Export
              </Button>
            )}
          </div>
        </div>

        {viewMode === "structured" && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search config options..."
              className="pl-9 bg-input border-border"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {viewMode === "structured" ? (
          <div className="p-6 space-y-3">
            {filteredValues.length === 0 ? (
              <Card className="p-8 text-center border-border">
                <p className="text-muted-foreground">
                  No config options match your search
                </p>
              </Card>
            ) : (
              filteredValues.map((config) => (
                <ConfigField
                  key={config.key}
                  config={config}
                  onChange={(newValue) => handleValueChange(config.key, newValue)}
                />
              ))
            )}
          </div>
        ) : (
          <div className="p-6">
            <div className="space-y-2">
              <Textarea
                value={rawText}
                onChange={(e) => handleRawTextChange(e.target.value)}
                className="font-mono text-sm min-h-[600px] bg-card border-border"
                placeholder="Edit JSON here..."
              />
              {jsonError && (
                <Card className="p-4 border-destructive/50 bg-destructive/10">
                  <p className="text-sm text-destructive font-medium">JSON Error:</p>
                  <p className="text-sm text-destructive/80 mt-1">{jsonError}</p>
                </Card>
              )}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
