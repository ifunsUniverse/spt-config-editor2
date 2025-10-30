import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect, useRef } from "react";
import { Home, RotateCcw, Save, Package, X, Search, AlertCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfigHistory } from "@/components/ConfigHistory";
import { SettingsDialog } from "@/components/SettingsDialog";
import { CategoryDialog } from "@/components/CategoryDialog";
import { saveConfigHistory } from "@/utils/configHistory";
import { getCategoryBgColor } from "@/utils/categoryDefinitions";
import { toast } from "sonner";
import JSON5 from "json5";
import { Dropdown } from "react-day-picker";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";
import { registerTransparentTheme } from "@/utils/monaco-theme";
import { Dialog, DialogContent } from "@/components/ui/dialog";


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
  rawJson: any;
  modId: string;
  onSave: (values: ConfigValue[]) => void;
  onChangesDetected?: (hasChanges: boolean) => void;
  saveConfigRef?: React.MutableRefObject<(() => void) | null>;
  currentCategory?: string | null;          // 👈 required for your JSX
  sptPath?: string | null;
  onCategoryChange?: (category: string | null) => void;
  onHome?: () => void;
  onExportMods?: () => void;
  showThemeToggle?: boolean;
  devMode?: boolean;
  onDevModeChange?: (enabled: boolean) => void;
}



export const ConfigEditor = ({
  modName,
  configFile,
  rawJson,
  modId,
  onSave,
  onChangesDetected,
  saveConfigRef,
  currentCategory,
  onCategoryChange,
  onHome,
  onExportMods,
  showThemeToggle,
  devMode,
  onDevModeChange,
  sptPath
}: ConfigEditorProps) => {
  // 🔑 All hooks go here, inside the component
  const [rawText, setRawText] = useState<string>(JSON.stringify(rawJson, null, 2));
  const [hasChanges, setHasChanges] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);

  // 👇 your search-related state must also be inside
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);


  // Reset when config changes
  useEffect(() => {
    setRawText(JSON.stringify(rawJson, null, 2));
    setHasChanges(false);
    setJsonError(null);
    if (onChangesDetected) onChangesDetected(false);
  }, [configFile, modName]);

  const handleRawTextChange = (text: string) => {
    setRawText(text);
    setHasChanges(true);
    if (onChangesDetected) onChangesDetected(true);

    try {
      JSON5.parse(text);
      setJsonError(null);
    } catch (error: any) {
      setJsonError(error.message);
    }
  };

  const handleSave = async () => {
    try {
      const parsedJson = JSON5.parse(rawText);
      const formattedJson = JSON.stringify(parsedJson, null, 2);
      setRawText(formattedJson);

      const newValues = jsonToConfigValues(parsedJson);
      onSave(newValues);

      setHasChanges(false);
      if (onChangesDetected) onChangesDetected(false);

      toast.success("Config saved successfully", {
        description: `Changes to ${configFile} have been saved`,
      });
    } catch (error: any) {
      toast.error("Invalid JSON/JSON5", { description: error.message });
    }
  };

  useEffect(() => {
  const remember = JSON.parse(localStorage.getItem("rememberLastSession") || "false");
  if (remember && sptPath && modId && configFile) {
    localStorage.setItem("lastSession", JSON.stringify({ sptPath, modId, configFile }));
  }
}, [sptPath, modId, configFile]);
  // Expose save function to parent
  useEffect(() => {
    if (saveConfigRef) {
      saveConfigRef.current = handleSave;
    }
  }, [rawText, hasChanges, jsonError]);

  useEffect(() => {
  registerTransparentTheme();
}, []);


  const handleReset = () => {
    setRawText(JSON.stringify(rawJson, null, 2));
    setHasChanges(false);
    setJsonError(null);
    if (onChangesDetected) onChangesDetected(false);
    toast.info("Changes discarded", {
      description: "Config has been reset to saved values",
    });
  };

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
      } else if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        vals.push(...jsonToConfigValues(value, fullKey));
      }
    }
    return vals;
  };


  const handleRestoreHistory = (restoredJson: any) => {
    setRawText(JSON.stringify(restoredJson, null, 2));
    setHasChanges(true);
    setJsonError(null);
    if (onChangesDetected) {
      onChangesDetected(true);
    }
    toast.success("Restored from history", {
      description: "Click Save to apply changes"
    });
  };

  const handleValidateJSON = () => {
    try {
      JSON5.parse(rawText);
      toast.success("Valid JSON", {
        description: "Configuration is properly formatted"
      });
    } catch (error: any) {
      const lineMatch = error.message.match(/line (\d+)/);
      const line = lineMatch ? parseInt(lineMatch[1]) : null;
      
      toast.error("Invalid JSON", {
        description: line ? `Error at line ${line}: ${error.message}` : error.message
      });

      // Highlight error line
      if (line && textareaRef.current) {
        const lines = rawText.split('\n');
        let charCount = 0;
        for (let i = 0; i < line - 1; i++) {
          charCount += lines[i].length + 1; // +1 for newline
        }
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(charCount, charCount + lines[line - 1].length);
      }
    }
  };

  const handleFixCommonIssues = () => {
    let fixed = rawText;
    
    // Add missing commas between properties
    fixed = fixed.replace(/("\s*)\n(\s*")/g, '$1,\n$2');
    
    // Remove trailing commas
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    
    // Normalize quotes
    fixed = fixed.replace(/'/g, '"');
    
    setRawText(fixed);
    setHasChanges(true);
    if (onChangesDetected) {
      onChangesDetected(true);
    }
    
    toast.success("Fixed common issues", {
      description: "Added missing commas, removed trailing commas, normalized quotes"
    });
  };

return (
  <div className="flex-1 flex flex-col h-full bg-background">
    {/* Header */}
    <div className="border-b border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">{modName}</h2>
          <p className="text-sm text-muted-foreground">
            📂user/mods/{modId}/{configFile}
          </p>

          {/* Add to Category Button */}
          {currentCategory ? (
            <Button
              onClick={() => onCategoryChange?.(null)}
              variant="outline"
              size="sm"
              className="gap-2 mt-2 hover:bg-red-900 hover:text-white"
            >
              ➖ Remove from{" "}
              <Badge
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium text-white border-0",
                  getCategoryBgColor(currentCategory)
                )}
              >
                {currentCategory}
              </Badge>
            </Button>
          ) : (
            <Button
              onClick={() => setShowCategoryDialog(true)}
              variant="outline"
              size="sm"
              className="gap-2 mt-2"
            >
              ➕ Add to Category
            </Button>
          )}
        </div>

        <div className="flex gap-2 items-center">
          {onHome && (
            <Button
              onClick={onHome}
              variant="outline"
              size="sm"
              className="gap-2 border-border"
            >
              <Home className="w-4 h-4" />
              Home
            </Button>
          )}

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
            title="Save changes (Ctrl+S)"
          >
            <Save className="w-4 h-4" />
            Save <kbd className="ml-1 text-[10px] opacity-60">Ctrl+S</kbd>
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

          {/* Settings button + dialog */}
          <SettingsDialog devMode={devMode || false} onDevModeChange={onDevModeChange || (() => {})} />
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
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Controls row (search + tools) */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-border">
        {showSearch && (
          <div className="flex items-center gap-2 bg-accent rounded-md px-2 py-1">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in config..."
              className="flex-1 bg-transparent border-none outline-none text-sm"
              autoFocus
            />
            {matchCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {matchCount} match{matchCount !== 1 ? "es" : ""}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                setShowSearch(false);
                setSearchQuery("");
              }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <Wrench className="w-3 h-3" />
              Tools
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <ConfigHistory
                modId={modId}
                modName={modName}
                configFile={configFile}
                onRestore={handleRestoreHistory}
              />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleValidateJSON}>
              Validate JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleFixCommonIssues}>
              Fix Common Issues
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Config editor area */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <div className="flex-1 rounded-md border border-border bg-card overflow-hidden">
          <Editor
            height="100%"
            language="json"
            value={rawText}
            onChange={(val) => val && handleRawTextChange(val)}
            onValidate={(markers) => {
              if (markers.length > 0) {
                setJsonError(markers[0].message);
              } else {
                setJsonError(null);
              }
            }}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              formatOnPaste: true,
              formatOnType: true,
              automaticLayout: true,
              renderWhitespace: "none",
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground shrink-0 mt-2">
          Supports JSONC, JSON and JSON5 syntax. Changes are validated in
          real-time. Auto-formats on save.
        </p>
      </div>
      
{/* Category dialog */}
{showCategoryDialog && (
  <CategoryDialog
      modId={modId}
      modName={modName}
      currentCategory={currentCategory}
      open={showCategoryDialog}
      onOpenChange={setShowCategoryDialog}
      onCategoryAssigned={(category) => onCategoryChange?.(category)}
       />
       )}
      </div>
    </div>
);
};