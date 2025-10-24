import { useState, useEffect, useRef } from "react";
import { Save, RotateCcw, Package, AlertCircle, Home, CheckCircle, Search, X } from "lucide-react";
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
  modId: string;
  onSave: (values: ConfigValue[]) => void;
  hasUnsavedChanges?: boolean;
  onChangesDetected?: (hasChanges: boolean) => void;
  onExportMods?: () => void;
  onHome?: () => void;
  saveConfigRef?: React.MutableRefObject<(() => void) | null>;
  showThemeToggle?: boolean;
  currentCategory?: string | null;
  onCategoryChange?: (category: string | null) => void;
  onValidateAll?: () => void;
  devMode?: boolean;
  onDevModeChange?: (enabled: boolean) => void;
}

export const ConfigEditor = ({ 
  modName, 
  configFile, 
  values: initialValues, 
  rawJson,
  modId,
  onSave,
  hasUnsavedChanges,
  onChangesDetected,
  onExportMods,
  onHome,
  saveConfigRef,
  showThemeToggle = true,
  currentCategory,
  onCategoryChange,
  onValidateAll,
  devMode = false,
  onDevModeChange
}: ConfigEditorProps) => {
  const [rawText, setRawText] = useState<string>(JSON.stringify(rawJson, null, 2));
  const [hasChanges, setHasChanges] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset when config changes
  useEffect(() => {
    setRawText(JSON.stringify(rawJson, null, 2));
    setHasChanges(false);
    setJsonError(null);
    setSearchQuery("");
    setShowSearch(false);
    if (onChangesDetected) {
      onChangesDetected(false);
    }
  }, [configFile, modName]);

  // Search functionality
  useEffect(() => {
    if (searchQuery) {
      const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = rawText.match(regex);
      setMatchCount(matches ? matches.length : 0);
    } else {
      setMatchCount(0);
    }
  }, [searchQuery, rawText]);

  // Keyboard shortcut for search (Ctrl+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const handleSave = async () => {
    try {
      const parsedJson = JSON5.parse(rawText);
      
      await saveConfigHistory(modId, modName, configFile, rawJson, `Before save at ${new Date().toLocaleTimeString()}`);
      
      const formattedJson = JSON.stringify(parsedJson, null, 2);
      setRawText(formattedJson);
      
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

  // Expose save function to parent via ref
  useEffect(() => {
    if (saveConfigRef) {
      saveConfigRef.current = handleSave;
    }
  }, [rawText, hasChanges, jsonError]);

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
            <p className="text-sm text-muted-foreground">{configFile}</p>
            
            {/* Add to Category Button */}
            <Button
              onClick={() => setShowCategoryDialog(true)}
              variant="outline"
              size="sm"
              className="gap-2 mt-2"
            >
              ➕ Add to Category
              {currentCategory && (
                <Badge className={`${getCategoryBgColor(currentCategory)} text-white border-0`}>
                  {currentCategory}
                </Badge>
              )}
            </Button>
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
            <ConfigHistory 
              modId={modId}
              modName={modName}
              configFile={configFile}
              onRestore={handleRestoreHistory}
            />
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
              onClick={handleValidateJSON}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Validate JSON
            </Button>
            <Button
              onClick={handleFixCommonIssues}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              Fix Issues
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
            {onValidateAll && (
              <Button
                onClick={onValidateAll}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                Validate All
              </Button>
            )}
            {showThemeToggle && onDevModeChange && (
              <SettingsDialog devMode={devMode} onDevModeChange={onDevModeChange} />
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
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <div className="flex-1 flex flex-col space-y-2">
          {/* Search Bar */}
          {showSearch && (
            <div className="flex items-center gap-2 p-2 bg-accent rounded-md">
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
                  {matchCount} match{matchCount !== 1 ? 'es' : ''}
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
          
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={rawText}
              onChange={(e) => handleRawTextChange(e.target.value)}
              className="font-mono text-sm h-full resize-none leading-relaxed bg-card border-border"
              placeholder="Edit JSON/JSON5 configuration..."
              spellCheck={false}
            />
            {!showSearch && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 gap-1 text-xs"
                onClick={() => setShowSearch(true)}
              >
                <Search className="w-3 h-3" />
                <kbd className="text-[10px] opacity-60">Ctrl+F</kbd>
              </Button>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground shrink-0">
            Supports JSON and JSON5 syntax. Changes are validated in real-time. Auto-formats on save.
          </p>
        </div>
      </div>

      {/* Category Dialog */}
      <CategoryDialog
        modId={modId}
        modName={modName}
        currentCategory={currentCategory || null}
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        onCategoryAssigned={(category) => {
          if (onCategoryChange) {
            onCategoryChange(category);
          }
        }}
      />
    </div>
  );
};
