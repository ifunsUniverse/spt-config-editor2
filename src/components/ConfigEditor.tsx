import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Home, RotateCcw, Save, Package, X, Search, AlertCircle, Settings, MoreVertical, FileJson, Terminal, Trash2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfigHistory } from "@/components/ConfigHistory";
import { SettingsDialog } from "@/components/SettingsDialog";
import { CategoryDialog } from "@/components/CategoryDialog";
import { ItemDatabase } from "./ItemDatabase";
import { saveConfigHistory } from "@/utils/configHistory";
import { getCategoryBgColor } from "@/utils/categoryDefinitions";
import { toast } from "sonner";
import JSON5 from "json5";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";
import { registerTransparentTheme } from "@/utils/monaco-theme";
import { ConfigValue } from "@/utils/configHelpers";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ConfigEditorProps {
  modName: string;
  configFile: string;
  activeConfigIndex: number;
  openConfigIndices: number[];
  allConfigs: any[];
  onSelectTab: (index: number) => void;
  onCloseTab: (index: number) => void;
  rawJson: any;
  modId: string;
  onSave: (values: ConfigValue[]) => void;
  onChangesDetected?: (hasChanges: boolean) => void;
  saveConfigRef?: React.MutableRefObject<(() => void) | null>;
  currentCategory?: string | null;
  sptPath?: string | null;
  onCategoryChange?: (category: string | null) => void;
  onHome?: () => void;
  onExportMods?: () => void;
  showThemeToggle?: boolean;
}

export const ConfigEditor = ({
  modName,
  configFile,
  activeConfigIndex,
  openConfigIndices,
  allConfigs,
  onSelectTab,
  onCloseTab,
  rawJson,
  modId,
  onSave,
  onChangesDetected,
  saveConfigRef,
  currentCategory,
  onCategoryChange,
  onHome,
  onExportMods,
  sptPath,
}: ConfigEditorProps) => {
  const [rawText, setRawText] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const configPath = configFile || null;
  const isMobile = useIsMobile();

  const viewStatesRef = useRef<Record<string, any>>({});
  const editorRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const loadFileContent = async () => {
      if (!configPath) return;
      
      try {
        setLoading(true);
        const content = await window.electronBridge.readFile(configPath);
        if (isMounted) {
          setRawText(content);
          setHasChanges(false);
          setJsonError(null);
          if (onChangesDetected) onChangesDetected(false);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to read file content:", err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    loadFileContent();
    return () => { isMounted = false; };
  }, [configPath, onChangesDetected]);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    if (configPath && viewStatesRef.current[configPath]) {
      editor.restoreViewState(viewStatesRef.current[configPath]);
      editor.focus();
    }
  };

  useEffect(() => {
    return () => {
      if (editorRef.current && configPath) {
        viewStatesRef.current[configPath] = editorRef.current.saveViewState();
      }
    };
  }, [configPath]);

  const handleRawTextChange = (text: string | undefined) => {
    const newText = text || "";
    setRawText(newText);
    setHasChanges(true);
    if (onChangesDetected) onChangesDetected(true);

    try {
      JSON5.parse(newText);
      setJsonError(null);
    } catch (error: any) {
      setJsonError(error.message);
    }
  };

  const handleSave = useCallback(async () => {
    try {
      JSON5.parse(rawText);
      onSave([{ key: "__RAW_JSON__", type: "raw", value: rawText }]);
      await saveConfigHistory(modId, modName, configFile, rawText);
      setHasChanges(false);
      if (onChangesDetected) onChangesDetected(false);
      toast.success("Config saved successfully");
    } catch (error: any) {
      toast.error("Invalid JSON/JSON5", { description: error.message });
    }
  }, [configFile, rawText, modId, modName, onSave, onChangesDetected]);

  const displayPath = React.useMemo(() => {
    if (!configFile) return "";
    const normalized = configFile.replace(/\\/g, "/");
    const match = normalized.match(/SPT\/user\/mods\/[^/]+/i);
    return match ? match[0] : normalized;
  }, [configFile]);

  useEffect(() => {
    const remember = JSON.parse(localStorage.getItem("rememberLastSession") || "false");
    if (remember && sptPath && modId && configFile) {
      localStorage.setItem("lastSession", JSON.stringify({ sptPath, modId, configFile }));
    }
  }, [sptPath, modId, configFile]);

  useEffect(() => {
    if (saveConfigRef) {
      saveConfigRef.current = handleSave;
    }
  }, [rawText, handleSave, saveConfigRef]);

  useEffect(() => {
    registerTransparentTheme();
  }, []);

  const handleReset = async () => {
    if (!configPath) return;
    try {
      const content = await window.electronBridge.readFile(configPath);
      setRawText(content);
      setHasChanges(false);
      setJsonError(null);
      if (onChangesDetected) onChangesDetected(false);
      toast.info("Changes discarded");
    } catch (err) {
      toast.error("Failed to reset file");
    }
  };

  const handleRestoreHistory = (restoredJson: any) => {
    const text = typeof restoredJson === 'string' 
      ? restoredJson 
      : (restoredJson?.rawJson || JSON.stringify(restoredJson, null, 2));
    
    setRawText(text);
    setHasChanges(true);
    setJsonError(null);
    if (onChangesDetected) onChangesDetected(true);
    toast.success("Restored from history");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background min-w-0 overflow-hidden">
      {/* Top Header Section */}
      <div className="border-b border-border p-3 sm:p-4 bg-card/30">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between min-w-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
                {modName}
              </h2>
              <p className="text-xs text-muted-foreground truncate max-w-full">
                {`📂 ${displayPath}`}
              </p>
              
              <div className="flex flex-wrap gap-2 mt-2">
                {currentCategory ? (
                  <Button
                    onClick={() => onCategoryChange?.(null)}
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] sm:text-xs gap-1 sm:gap-2 hover:bg-red-900 hover:text-white px-2"
                  >
                    ➖ Remove from{" "}
                    <Badge
                      className={cn(
                        "rounded-full px-2 py-0 h-4 text-[9px] sm:text-[10px] font-medium text-white border-0",
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
                    className="h-7 text-[10px] sm:text-xs gap-1 sm:gap-2 px-2"
                  >
                    ➕ Add to Category
                  </Button>
                )}
              </div>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex gap-2 items-center">
              <ItemDatabase />
              {onHome && (
                <Button variant="outline" size="sm" onClick={onHome} className="gap-2">
                  <Home className="w-4 h-4" /> Home
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={!hasChanges}
                onClick={handleReset}
                className="gap-2"
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
                  <Package className="w-4 h-4" /> Export
                </Button>
              )}
              <SettingsDialog />
            </div>

            {/* Mobile/Tablet Overflow Menu */}
            <div className="md:hidden flex items-center gap-1">
              <ItemDatabase />
              <Button 
                size="sm" 
                variant={hasChanges ? "default" : "outline"}
                disabled={!hasChanges || jsonError !== null}
                onClick={handleSave}
                className="h-9 px-3"
              >
                <Save className="h-4 w-4" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onHome && (
                    <DropdownMenuItem onClick={onHome}>
                      <Home className="w-4 h-4 mr-2" /> Home
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem disabled={!hasChanges} onClick={handleReset}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Reset
                  </DropdownMenuItem>
                  {onExportMods && (
                    <DropdownMenuItem onClick={onExportMods}>
                      <Package className="w-4 h-4 mr-2" /> Export
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" /> Settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {jsonError && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm">
                <span className="font-medium">JSON Error:</span> {jsonError}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-card/20 border-b border-border">
        <ScrollArea className="w-full">
          <div className="flex items-center px-2 py-1 gap-1">
            {openConfigIndices.map((idx) => {
              const config = allConfigs[idx];
              const isActive = activeConfigIndex === idx;
              if (!config) return null;
              
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs cursor-pointer transition-all border",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm font-medium"
                      : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50 hover:text-foreground"
                  )}
                  onClick={() => onSelectTab(idx)}
                >
                  <FileJson className={cn("w-3 h-3", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                  <span className="truncate max-w-[150px]">{config.fileName.split(/[\\/]/).pop()}</span>
                  {openConfigIndices.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(idx);
                      }}
                      className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })} 
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Toolbar Section (Only for Editor) */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 border-b border-border bg-card/10">
        <div className="flex-1">
          {showSearch ? (
            <div className="flex items-center gap-2 bg-accent/50 rounded-md px-2 py-1 max-w-sm">
              <Search className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => {
                setShowSearch(false);
                setSearchQuery("");
              }}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setShowSearch(true)} className="h-8 px-2">
              <Search className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <ConfigHistory
            modId={modId}
            modName={modName}
            configFile={configFile}
            onRestore={handleRestoreHistory}
          />
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex flex-col flex-grow overflow-hidden p-2 sm:p-4 lg:p-6">
        {!loading && !error && (
          <div className="flex flex-col flex-grow overflow-hidden">
            <div className="flex-grow rounded-md border border-border bg-card overflow-hidden">
              <Editor
                height="100%"
                language="jsonc"
                value={rawText}
                onMount={handleEditorDidMount}
                onChange={handleRawTextChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  automaticLayout: true,
                  formatOnPaste: true,
                  formatOnType: true,
                  fontSize: isMobile ? 12 : 14,
                  lineNumbers: isMobile ? 'off' : 'on',
                  folding: !isMobile,
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground shrink-0 mt-2 text-center sm:text-left">
              Direct text editing preserves JSON5 comments and syntax.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground animate-pulse">Reading file content...</p>
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