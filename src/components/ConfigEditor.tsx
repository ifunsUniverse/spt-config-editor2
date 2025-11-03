import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import React, { useState, useEffect, useRef } from "react";
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
import { FormConfigEditor } from "@/components/FormConfigEditor";
import { parseConfigWithMetadata, ConfigValue, jsonToConfigValues } from "@/utils/configHelpers";

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
  const [liveJson, setLiveJson] = useState(rawJson);
  const [hasChanges, setHasChanges] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [config, setConfig] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const configPath = configFile || null;
  const [editorMode, setEditorMode] = useState<"json" | "form">("json");
  const [formMetadata, setFormMetadata] = useState<Record<string, string>>({});


      useEffect(() => {
      setLiveJson(rawJson);
      setRawText(JSON.stringify(rawJson, null, 2));
    }, [rawJson, configFile]);

    // ✅ Sync Form editor when user switches mods/configs
    useEffect(() => {
      setLiveJson(rawJson);
      setRawText(JSON.stringify(rawJson, null, 2));
    }, [rawJson, configFile]);


    // Reset when config changes
    useEffect(() => {
      setRawText(JSON.stringify(rawJson, null, 2));
      setHasChanges(false);
      setJsonError(null);
      if (onChangesDetected) onChangesDetected(false);
    }, [configFile, modName]);
    
    const handleRawTextChange = (text: string) => {
      setRawText(text);

      try {
        const { parsed, metadata } = parseConfigWithMetadata(text);

        setLiveJson(parsed);     // ✅ now updating live JSON
        setFormMetadata(metadata);
        setJsonError(null);

        setHasChanges(true);
        if (onChangesDetected) onChangesDetected(true);

      } catch (error: any) {
        setJsonError(error.message);
      }
    };

  const handleSave = async () => {
    try {
      const parsedJson = liveJson;
      const formattedJson = JSON.stringify(parsedJson, null, 2);
      setRawText(formattedJson);

      const newValues = jsonToConfigValues(parsedJson);
      onSave(newValues);

      await saveConfigHistory(modId, modName, configFile, parsedJson);
      console.log("[HISTORY] Saved entry for", modId, configFile);


      setHasChanges(false);
      if (onChangesDetected) onChangesDetected(false);

      toast.success("Config saved successfully", {
        description: `Changes to ${configFile} have been saved`,
      });
    } catch (error: any) {
      toast.error("Invalid JSON/JSON5", { description: error.message });
    }
  };

  const displayPath = React.useMemo(() => {
  if (!configFile) return "";

  // Convert Windows backslashes to forward slashes
  const normalized = configFile.replace(/\\/g, "/");

  // Grab only the part starting from "user/mods/"
  const match = normalized.match(/SPT\/user\/mods\/[^/]+/i);
  return match ? match[0] : normalized;
}, [configFile]);


useEffect(() => {
  if (!configPath) {
    console.warn("Missing path info — cannot load config");
    setLoading(false);
    setError(true);
    return;
  }

  if (window.electronBridge?.readFile) {
    window.electronBridge.readFile(configPath)
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load config:", err);
        setError(true);
        setLoading(false);
      });
  } else {
    console.warn("electronBridge not available — running in browser?");
    setLoading(false);
    setError(true);
  }
}, [configPath]);


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

      // ✅ this updates the JSON when the user edits in Form view
    // ✅ When form editor changes values
    const handleFormEdit = (updatedJson: any) => {
      setLiveJson(updatedJson);
      setRawText(JSON.stringify(updatedJson, null, 2));
      setHasChanges(true);
    };


return (
  <div className="flex-1 flex flex-col h-full bg-background">

    {/* ─────────────────── Header ───────────────────*/}
    <div className="border-b border-border p-4">
      <div className="flex items-center justify-between mb-4">

        {/* Left: mod name + path + category */}
        <div>
          <h2 className="text-xl font-bold text-foreground">{modName}</h2>
          <p className="text-sm text-muted-foreground">📂 {displayPath}</p>

          {/* Add / Remove category */}
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

        {/* Right: Home / Reset / Save / Export / Settings */}
        <div className="flex gap-2 items-center">
          {onHome && (
            <Button variant="outline" size="sm" onClick={onHome} className="gap-2 border-border">
              <Home className="w-4 h-4" /> Home
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={!hasChanges}
            onClick={handleReset}
            className="gap-2 border-border"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>

          <Button
            size="sm"
            disabled={!hasChanges || jsonError !== null}
            onClick={handleSave}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Save className="w-4 h-4" /> Save <kbd className="ml-1 text-[10px] opacity-60">Ctrl+S</kbd>
          </Button>

          {onExportMods && (
            <Button variant="secondary" size="sm" onClick={onExportMods} className="gap-2">
              <Package className="w-4 h-4" /> Pack & Export
            </Button>
          )}

          <SettingsDialog devMode={devMode} onDevModeChange={onDevModeChange || (() => {})} />
        </div>
      </div>

      {jsonError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">JSON Error:</span> {jsonError}
          </AlertDescription>
        </Alert>
      )}
    </div>

    {/* ─────────────────── Controls Row ───────────────────*/}
    <div className="flex items-center justify-between px-6 py-2 border-b border-border">
      {/* Search (left side) */}
      {showSearch ? (
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
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
            setShowSearch(false);
            setSearchQuery("");
          }}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <div />
      )}

      {/* Right side controls (Tools + History + View Toggle) */}
      <div className="flex items-center gap-2">

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <Wrench className="w-3 h-3" />
              Tools
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><button onClick={handleValidateJSON}>Validate JSON</button></DropdownMenuItem>
            <DropdownMenuItem asChild><button onClick={handleFixCommonIssues}>Fix Common Issues</button></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ConfigHistory
          modId={modId}
          modName={modName}
          configFile={configFile}
          onRestore={handleRestoreHistory}
        />

        {/* ✅ JSON <-> FORM toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditorMode(editorMode === "json" ? "form" : "json")}
          className="gap-2"
        >
          {editorMode === "json" ? "Form View" : "JSON View"}
        </Button>
      </div>
    </div>

    {/* ─────────────────── Config Editor ───────────────────*/}
    <div className="flex flex-col flex-grow overflow-hidden p-6">

      {!loading && !error && config && (
        <div className="flex flex-col flex-grow overflow-hidden">

          {/* ✅ prevents bubbling click events from collapsing Form sections */}
          <div
            className="flex-grow rounded-md border border-border bg-card overflow-hidden"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {editorMode === "json" ? (
              <Editor
                height="100%"
                language="json"
                value={rawText}
                onChange={(v) => v && handleRawTextChange(v)}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  automaticLayout: true,
                }}
              />
            ) : (
              <FormConfigEditor
                config={liveJson}
                metadata={formMetadata}
                onChange={handleFormEdit}
              />
            )}
          </div>

          <p className="text-xs text-muted-foreground shrink-0 mt-2">
            {editorMode === "json"
              ? "Supports JSON, JSON5, and JSONC syntax. Auto-formats on save."
              : "Form view automatically updates the JSON configuration."}
          </p>
        </div>
      )}

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