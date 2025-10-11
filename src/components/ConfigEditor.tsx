import { useState } from "react";
import { Save, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfigField } from "./ConfigField";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

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
  onSave: (values: ConfigValue[]) => void;
}

export const ConfigEditor = ({ modName, configFile, values: initialValues, onSave }: ConfigEditorProps) => {
  const [values, setValues] = useState<ConfigValue[]>(initialValues);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const handleValueChange = (key: string, newValue: any) => {
    setValues(prev => prev.map(v => 
      v.key === key ? { ...v, value: newValue } : v
    ));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(values);
    setHasChanges(false);
    toast.success("Config saved successfully", {
      description: `Changes to ${configFile} have been saved`
    });
  };

  const handleReset = () => {
    setValues(initialValues);
    setHasChanges(false);
    toast.info("Changes discarded", {
      description: "Config has been reset to saved values"
    });
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
          <div className="flex gap-2">
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
              disabled={!hasChanges}
              size="sm"
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search config options..."
            className="pl-9 bg-input border-border"
          />
        </div>
      </div>

      {/* Config Fields */}
      <ScrollArea className="flex-1">
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
      </ScrollArea>
    </div>
  );
};
