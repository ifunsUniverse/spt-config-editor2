import { useState, useEffect } from "react";
import { Save, RotateCcw, Package, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import JSON5 from "json5";

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
  const [rawText, setRawText] = useState<string>(JSON.stringify(rawJson, null, 2));
  const [hasChanges, setHasChanges] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Reset when config changes
  useEffect(() => {
    setRawText(JSON.stringify(rawJson, null, 2));
    setHasChanges(false);
    setJsonError(null);
    if (onChangesDetected) {
      onChangesDetected(false);
    }
  }, [configFile, modName]);

  const handleRawTextChange = (text: string) => {
    setRawText(text);
    const newHasChanges = true;
    setHasChanges(newHasChanges);
    if (onChangesDetected) {
      onChangesDetected(newHasChanges);
    }
    
    // Validate JSON/JSON5
    try {
      JSON5.parse(text);
      setJsonError(null);
    } catch (error: any) {
      setJsonError(error.message);
    }
  };

  const handleSave = () => {
    // Validate and save raw JSON/JSON5
    try {
      const parsedJson = JSON5.parse(rawText);
      
      // Auto-format the JSON
      const formattedJson = JSON.stringify(parsedJson, null, 2);
      setRawText(formattedJson);
      
      // Convert to ConfigValues for compatibility
      const newValues = jsonToConfigValues(parsedJson);
      onSave(newValues);
      setHasChanges(false);
      if (onChangesDetected) {
        onChangesDetected(false);
      }
      toast.success("Config saved successfully", {
        description: `Changes to ${configFile} have been saved`
      });
    } catch (error: any) {
      toast.error("Invalid JSON/JSON5", {
        description: error.message
      });
      return;
    }
  };

  const handleReset = () => {
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

  return (
    <div className="flex-1 flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{modName}</h2>
            <p className="text-sm text-muted-foreground">{configFile}</p>
          </div>
          <div className="flex gap-2 items-center">
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
              disabled={!hasChanges || jsonError !== null}
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

        {jsonError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">JSON/JSON5 Error:</span> {jsonError}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="space-y-2">
            <Textarea
              value={rawText}
              onChange={(e) => handleRawTextChange(e.target.value)}
              className="font-mono text-sm min-h-[600px] leading-relaxed bg-card border-border"
              placeholder="Edit JSON/JSON5 configuration..."
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Supports JSON and JSON5 syntax. Changes are validated in real-time. Auto-formats on save.
            </p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
