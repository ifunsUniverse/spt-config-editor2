import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Home, RotateCcw, Save, Package, X, Search, AlertCircle, MoreVertical, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfigHistory } from "@/components/ConfigHistory";
import { SettingsDialog } from "@/components/SettingsDialog";
import { CategoryDialog } from "@/components/CategoryDialog";
import { ItemDatabase } from "./ItemDatabase";
import { InstalledMods } from "./InstalledMods";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { saveConfigHistory } from "@/utils/configHistory";
import { getCategoryBgColor } from "@/utils/categoryDefinitions";
import { toast } from "sonner";
import JSON5 from "json5";
import { cn } from "@/lib/utils";
import Editor from "@monaco-editor/react";
import { ConfigValue } from "@/utils/configHelpers";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ElectronScannedConfig } from "@/utils/electronFolderScanner";
import { DirectoryHandleLike } from "@/utils/electronBridge";
import { loadEditorSettings, type EditorSettings } from "@/utils/editorSettings";
import { registerSptDarkTheme } from "@/utils/monaco-theme";
import { loadAppSettings } from "@/utils/appSettings";

interface ConfigEditorProps {
  modName: string;
  configFile: string;
  activeConfigFileIndex: number;
  activeConfigIndex: number;
  openConfigIndices: number[];
  allConfigs: ElectronScannedConfig[];
  onSelectTab: (index: number) => void;
  onCloseTab: (index: number) => void;
  rawJson: any;
  modId: string;
  onSave: (values: ConfigValue[]) => void;
  onChangesDetected?: (hasChanges: boolean) => void;
  onJsonErrorChange?: (configFileIndex: number, hasError: boolean) => void;
  saveConfigRef?: React.MutableRefObject<(() => void) | null>;
  currentCategory?: string | null;
  sptPath?: string | null;
  rootDirHandle?: DirectoryHandleLike | null;
  onCategoryChange?: (category: string | null) => void;
  onHome?: () => void;
  onExportMods?: () => void;
  showThemeToggle?: boolean;
}

export const ConfigEditor = ({
  modName,
  configFile,
  activeConfigFileIndex,
  activeConfigIndex,
  openConfigIndices,
  allConfigs,
  onSelectTab,
  onCloseTab,
  rawJson,
  modId,
  onSave,
  onChangesDetected,
  onJsonErrorChange,
  saveConfigRef,
  currentCategory,
  onCategoryChange,
  onHome,
  onExportMods,
  sptPath,
  rootDirHandle,
}: ConfigEditorProps) => {
  const [rawText, setRawText] = useState<string>("");
  const [hasChanges, setHasChanges] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonErrorLine, setJsonErrorLine] = useState<number | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showInstalledMods, setShowInstalledMods] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSplitView, setIsSplitView] = useState(false);
  const [secondaryConfigIndex, setSecondaryConfigIndex] = useState<number | null>(null);
  const [secondaryRawText, setSecondaryRawText] = useState("");
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [secondaryHasChanges, setSecondaryHasChanges] = useState(false);
  const [secondaryJsonError, setSecondaryJsonError] = useState<string | null>(null);
  const [secondaryJsonErrorLine, setSecondaryJsonErrorLine] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(loadEditorSettings);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  // Listen for settings changes from SettingsDialog
  useEffect(() => {
    const handler = (e: Event) => {
      setEditorSettings((e as CustomEvent).detail);
    };
    window.addEventListener("editor-settings-changed", handler);
    return () => window.removeEventListener("editor-settings-changed", handler);
  }, []);

  const viewStatesRef = useRef<Record<string, any>>({});
  const editorRef = useRef<any>(null);
  const secondaryEditorRef = useRef<any>(null);
  const activeEditorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const errorDecorationIdsRef = useRef<string[]>([]);
  const secondaryErrorDecorationIdsRef = useRef<string[]>([]);
  const cursorPositionDisposableRef = useRef<any>(null);
  const hasLoadedPrimaryOnceRef = useRef(false);
  const lastRestoredModIdRef = useRef<string | null>(null);

  const getSplitStateKey = (id: string) => `splitViewState:${id}`;

  const pickFallbackSecondary = useCallback(
    (excludeIndex: number): number | null =>
      allConfigs.find((cfg) => cfg.index !== excludeIndex)?.index ?? null,
    [allConfigs]
  );

  const extractErrorLine = (error: any): number | null => {
    const message = String(error?.message || "");
    const positionMatch = message.match(/at\s+(\d+):(\d+)/i);
    if (positionMatch) {
      const line = Number(positionMatch[1]);
      return Number.isFinite(line) && line > 0 ? line : null;
    }

    const lineMatch = message.match(/line\s+(\d+)/i);
    if (lineMatch) {
      const line = Number(lineMatch[1]);
      return Number.isFinite(line) && line > 0 ? line : null;
    }

    return null;
  };

  // Get the active config object to read its fileHandle
  const activeConfig = allConfigs[activeConfigIndex];
  const secondaryConfig =
    typeof secondaryConfigIndex === "number" ? allConfigs[secondaryConfigIndex] : null;

  const parseText = useCallback(
    (text: string): { hasError: boolean; message: string | null; line: number | null } => {
      try {
        JSON5.parse(text);
        return { hasError: false, message: null, line: null };
      } catch (error: any) {
        return {
          hasError: true,
          message: error?.message || "Invalid JSON/JSON5 syntax",
          line: extractErrorLine(error),
        };
      }
    },
    []
  );

  const toggleSplitView = () => {
    if (isSplitView) {
      if (secondaryConfig && onJsonErrorChange) {
        onJsonErrorChange(secondaryConfig.index, false);
      }
      setIsSplitView(false);
      setSecondaryConfigIndex(null);
      setSecondaryRawText("");
      setSecondaryHasChanges(false);
      setSecondaryJsonError(null);
      setSecondaryJsonErrorLine(null);
      return;
    }

    const fallbackIndex = pickFallbackSecondary(activeConfigIndex);
    setSecondaryConfigIndex(fallbackIndex);
    setIsSplitView(true);
  };

  useEffect(() => {
    if (!isSplitView) return;
    if (secondaryConfigIndex === null || secondaryConfigIndex === activeConfigIndex) {
      const fallbackIndex = pickFallbackSecondary(activeConfigIndex);
      setSecondaryConfigIndex(fallbackIndex);
    }
  }, [isSplitView, secondaryConfigIndex, activeConfigIndex, pickFallbackSecondary]);

  useEffect(() => {
    if (allConfigs.length < 2 && isSplitView) {
      setIsSplitView(false);
      setSecondaryConfigIndex(null);
      return;
    }

    if (lastRestoredModIdRef.current === modId) return;
    lastRestoredModIdRef.current = modId;

    try {
      const raw = sessionStorage.getItem(getSplitStateKey(modId));
      if (!raw) {
        setIsSplitView(false);
        setSecondaryConfigIndex(null);
        return;
      }

      const parsed = JSON.parse(raw) as { enabled?: boolean; secondaryConfigIndex?: number | null };
      const enabled = Boolean(parsed.enabled) && allConfigs.length >= 2;

      if (!enabled) {
        setIsSplitView(false);
        setSecondaryConfigIndex(null);
        return;
      }

      const requested =
        typeof parsed.secondaryConfigIndex === "number" ? parsed.secondaryConfigIndex : null;

      const isValidRequested =
        requested !== null &&
        requested !== activeConfigIndex &&
        allConfigs.some((cfg) => cfg.index === requested);

      setSecondaryConfigIndex(isValidRequested ? requested : pickFallbackSecondary(activeConfigIndex));
      setIsSplitView(true);
    } catch {
      setIsSplitView(false);
      setSecondaryConfigIndex(null);
    }
  }, [modId, allConfigs, activeConfigIndex, isSplitView, pickFallbackSecondary]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        getSplitStateKey(modId),
        JSON.stringify({
          enabled: isSplitView,
          secondaryConfigIndex: isSplitView ? secondaryConfigIndex : null,
        })
      );
    } catch {
      // Ignore storage quota/session restrictions.
    }
  }, [modId, isSplitView, secondaryConfigIndex]);

  useEffect(() => {
    let isMounted = true;

    const loadFileContent = async () => {
      if (!activeConfig?.fileHandle) return;
      
      try {
        // Keep the editor mounted on subsequent tab switches to avoid
        // split-view flicker; only show the full loading state initially.
        if (!hasLoadedPrimaryOnceRef.current) {
          setLoading(true);
        }
        const file = await activeConfig.fileHandle.getFile();
        const content = await file.text();
        if (isMounted) {
          let hasParseError = false;
          let parseErrorMessage: string | null = null;
          let parseErrorLine: number | null = null;
          try {
            JSON5.parse(content);
          } catch (parseError: any) {
            hasParseError = true;
            parseErrorMessage = parseError?.message || "Invalid JSON/JSON5 syntax";
            parseErrorLine = extractErrorLine(parseError);
          }
          setRawText(content);
          setHasChanges(false);
          setJsonError(hasParseError ? parseErrorMessage : null);
          setJsonErrorLine(hasParseError ? parseErrorLine : null);
          if (onJsonErrorChange) onJsonErrorChange(activeConfig.index, hasParseError);
          setError(false);
          if (onChangesDetected) onChangesDetected(false);
          hasLoadedPrimaryOnceRef.current = true;
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
  }, [activeConfig, onChangesDetected, onJsonErrorChange]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    activeEditorRef.current = editor;

    editor.onDidFocusEditorWidget(() => {
      activeEditorRef.current = editor;
    });

    editor.addAction({
      id: "spt-format-json-primary",
      label: "Format JSON",
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      ],
      run: async () => {
        const action = editor.getAction("editor.action.formatDocument");
        if (!action) return;
        await action.run();
      },
    });

    if (cursorPositionDisposableRef.current) {
      cursorPositionDisposableRef.current.dispose();
      cursorPositionDisposableRef.current = null;
    }

    cursorPositionDisposableRef.current = editor.onDidChangeCursorPosition((event: any) => {
      setCursorPosition({
        line: event.position.lineNumber,
        column: event.position.column,
      });
    });

    const initial = editor.getPosition();
    if (initial) {
      setCursorPosition({ line: initial.lineNumber, column: initial.column });
    }

    const key = activeConfig?.fileName || "";
    if (key && viewStatesRef.current[key]) {
      editor.restoreViewState(viewStatesRef.current[key]);
      editor.focus();
    }
  };

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const validLine =
      jsonErrorLine && jsonErrorLine >= 1 && jsonErrorLine <= model.getLineCount()
        ? jsonErrorLine
        : null;

    const nextDecorations = validLine
      ? [
          {
            range: new monacoRef.current.Range(validLine, 1, validLine, 1),
            options: {
              isWholeLine: true,
              className: "json-error-line",
              lineNumberClassName: "json-error-line-number",
            },
          },
        ]
      : [];

    errorDecorationIdsRef.current = editorRef.current.deltaDecorations(
      errorDecorationIdsRef.current,
      nextDecorations
    );
  }, [jsonErrorLine, activeConfig?.fileName]);

  useEffect(() => {
    if (!secondaryEditorRef.current || !monacoRef.current) return;

    const model = secondaryEditorRef.current.getModel();
    if (!model) return;

    const validLine =
      secondaryJsonErrorLine &&
      secondaryJsonErrorLine >= 1 &&
      secondaryJsonErrorLine <= model.getLineCount()
        ? secondaryJsonErrorLine
        : null;

    const nextDecorations = validLine
      ? [
          {
            range: new monacoRef.current.Range(validLine, 1, validLine, 1),
            options: {
              isWholeLine: true,
              className: "json-error-line",
              lineNumberClassName: "json-error-line-number",
            },
          },
        ]
      : [];

    secondaryErrorDecorationIdsRef.current = secondaryEditorRef.current.deltaDecorations(
      secondaryErrorDecorationIdsRef.current,
      nextDecorations
    );
  }, [secondaryJsonErrorLine, secondaryConfig?.fileName]);

  useEffect(() => {
    let isMounted = true;

    const loadSecondaryContent = async () => {
      if (!isSplitView || !secondaryConfig?.fileHandle) return;
      try {
        setSecondaryLoading(true);
        const file = await secondaryConfig.fileHandle.getFile();
        const content = await file.text();
        if (!isMounted) return;

        const parsed = parseText(content);
        setSecondaryRawText(content);
        setSecondaryHasChanges(false);
        setSecondaryJsonError(parsed.message);
        setSecondaryJsonErrorLine(parsed.line);
        if (onJsonErrorChange) onJsonErrorChange(secondaryConfig.index, parsed.hasError);
      } catch (loadError) {
        console.error("Failed to read secondary file:", loadError);
        if (isMounted) {
          setSecondaryRawText("");
          setSecondaryHasChanges(false);
          setSecondaryJsonError("Failed to read file content");
          setSecondaryJsonErrorLine(null);
        }
      } finally {
        if (isMounted) setSecondaryLoading(false);
      }
    };

    loadSecondaryContent();
    return () => {
      isMounted = false;
    };
  }, [isSplitView, secondaryConfig, parseText, onJsonErrorChange]);

  useEffect(() => {
    const viewStates = viewStatesRef.current;
    return () => {
      if (editorRef.current) {
        errorDecorationIdsRef.current = editorRef.current.deltaDecorations(errorDecorationIdsRef.current, []);
      }
      if (secondaryEditorRef.current) {
        secondaryErrorDecorationIdsRef.current = secondaryEditorRef.current.deltaDecorations(
          secondaryErrorDecorationIdsRef.current,
          []
        );
      }
      if (editorRef.current && activeConfig?.fileName) {
        viewStates[activeConfig.fileName] = editorRef.current.saveViewState();
      }
    };
  }, [activeConfig?.fileName]);

  const handleRawTextChange = (text: string | undefined) => {
    const newText = text || "";
    setRawText(newText);
    setHasChanges(true);
    if (onChangesDetected) onChangesDetected(true);

    try {
      JSON5.parse(newText);
      setJsonError(null);
      setJsonErrorLine(null);
      if (onJsonErrorChange) onJsonErrorChange(activeConfig.index, false);
    } catch (error: any) {
      setJsonError(error.message);
      setJsonErrorLine(extractErrorLine(error));
      if (onJsonErrorChange) onJsonErrorChange(activeConfig.index, true);
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

  const handleFormatJson = useCallback(async () => {
    const targetEditor = activeEditorRef.current || editorRef.current;
    if (!targetEditor) return;

    try {
      const action = targetEditor.getAction("editor.action.formatDocument");
      if (!action) {
        toast.error("Format action unavailable for this file");
        return;
      }
      await action.run();
    } catch (formatError: any) {
      toast.error("Could not format JSON", {
        description: formatError?.message || "Fix syntax issues and try again",
      });
    }
  }, []);

  const handleSecondaryRawTextChange = (text: string | undefined) => {
    if (!secondaryConfig) return;
    const newText = text || "";
    const parsed = parseText(newText);

    setSecondaryRawText(newText);
    setSecondaryHasChanges(true);
    setSecondaryJsonError(parsed.message);
    setSecondaryJsonErrorLine(parsed.line);
    if (onJsonErrorChange) onJsonErrorChange(secondaryConfig.index, parsed.hasError);
  };

  const handleSecondarySave = async () => {
    if (!secondaryConfig?.fileHandle) return;

    try {
      JSON5.parse(secondaryRawText);
      const writable = await (secondaryConfig.fileHandle as any).createWritable();
      await writable.write(secondaryRawText);
      await writable.close();

      await saveConfigHistory(modId, modName, secondaryConfig.filePath, secondaryRawText);
      setSecondaryHasChanges(false);
      if (onJsonErrorChange) onJsonErrorChange(secondaryConfig.index, false);
      toast.success(`Saved ${secondaryConfig.fileName.split(/[\\/]/).pop()}`);
    } catch (saveError: any) {
      toast.error("Invalid JSON/JSON5", { description: saveError?.message || "Could not save file" });
    }
  };

  const displayPath = React.useMemo(() => {
    if (!configFile) return "";
    return configFile;
  }, [configFile]);

  const editorOptions = React.useMemo(() => {
    const lineHeight = Math.round(editorSettings.fontSize * editorSettings.lineHeight);
    return {
      minimap: { enabled: !isMobile && editorSettings.minimap },
      automaticLayout: true,
      formatOnPaste: true,
      formatOnType: true,
      smoothScrolling: true,
      cursorBlinking: "smooth" as const,
      cursorSmoothCaretAnimation: "on" as const,
      renderLineHighlight: "line" as const,
      roundedSelection: true,
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
      },
      fontSize: isMobile ? 12 : editorSettings.fontSize,
      fontFamily: editorSettings.fontFamily,
      lineHeight,
      wordWrap: editorSettings.wordWrap,
      lineNumbers: isMobile ? "off" as const : "on" as const,
      folding: !isMobile,
      scrollBeyondLastLine: false,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      overviewRulerBorder: false,
      stickyScroll: { enabled: editorSettings.stickyScroll },
      renderWhitespace: editorSettings.renderWhitespace,
      renderIndentGuides: true,
      fontLigatures: editorSettings.fontLigatures,
      tabSize: 2,
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true,
      },
      suggestOnTriggerCharacters: true,
      scrollbar: {
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        alwaysConsumeMouseWheel: false,
      },
    };
  }, [editorSettings, isMobile]);

  useEffect(() => {
    const appSettings = loadAppSettings();
    if (appSettings.rememberLastSession && sptPath && modId && configFile) {
      localStorage.setItem("lastSession", JSON.stringify({ sptPath, modId, configFile }));
    }
  }, [sptPath, modId, configFile]);

  useEffect(() => {
    if (saveConfigRef) {
      saveConfigRef.current = handleSave;
    }
  }, [handleSave, saveConfigRef]);

  useEffect(() => {
    return () => {
      if (cursorPositionDisposableRef.current) {
        cursorPositionDisposableRef.current.dispose();
      }
    };
  }, []);

  const handleReset = async () => {
    if (!activeConfig?.fileHandle) return;
    try {
      const file = await activeConfig.fileHandle.getFile();
      const content = await file.text();
      let hasParseError = false;
      let parseErrorMessage: string | null = null;
      let parseErrorLine: number | null = null;
      try {
        JSON5.parse(content);
      } catch (parseError: any) {
        hasParseError = true;
        parseErrorMessage = parseError?.message || "Invalid JSON/JSON5 syntax";
        parseErrorLine = extractErrorLine(parseError);
      }
      setRawText(content);
      setHasChanges(false);
      setJsonError(hasParseError ? parseErrorMessage : null);
      setJsonErrorLine(hasParseError ? parseErrorLine : null);
      if (onJsonErrorChange) onJsonErrorChange(activeConfigFileIndex, hasParseError);
      setError(false);
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
    let hasParseError = false;
    try {
      JSON5.parse(text);
    } catch {
      hasParseError = true;
    }
    if (hasParseError) {
      try {
        JSON5.parse(text);
      } catch (parseError: any) {
        setJsonError(parseError?.message || "Invalid JSON/JSON5 syntax");
        setJsonErrorLine(extractErrorLine(parseError));
      }
    } else {
      setJsonError(null);
      setJsonErrorLine(null);
    }
    if (onJsonErrorChange) onJsonErrorChange(activeConfigFileIndex, hasParseError);
    if (onChangesDetected) onChangesDetected(true);
    toast.success("Restored from history");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background min-w-0 overflow-hidden">
      {/* Top Header Section */}
      <div className="border-b border-border p-3 sm:p-4 bg-gradient-to-b from-card/60 to-card/25">
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

            {/* Desktop Actions — shown at lg+ so the editor has ≥736 px to fit all buttons */}
            <div className="hidden lg:flex gap-2 items-center">
              <ItemDatabase />
              <Button variant="outline" size="sm" onClick={() => setShowInstalledMods(true)} className="gap-2">
                <Package className="w-4 h-4" /> Installed Mods
              </Button>
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

            {/* Compact menu — shown below lg (covers both mobile and medium widths) */}
            <div className="lg:hidden flex items-center gap-1">
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
              <SettingsDialog />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowInstalledMods(true)}>
                    <Package className="w-4 h-4 mr-2" /> Installed Mods
                  </DropdownMenuItem>
                  {onHome && (
                    <DropdownMenuItem onClick={onHome}>
                      <Home className="w-4 h-4 mr-2" /> Home
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem disabled={!hasChanges} onClick={handleReset}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Reset
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleFormatJson}>
                    <FileJson className="w-4 h-4 mr-2" /> Format JSON
                  </DropdownMenuItem>
                  {onExportMods && (
                    <DropdownMenuItem onClick={onExportMods}>
                      <Package className="w-4 h-4 mr-2" /> Export
                    </DropdownMenuItem>
                  )}
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

      {/* Config Chrome (Tabs + Toolbar) */}
      <div className="px-2 sm:px-4 lg:px-6 pt-3 shrink-0">
        <div className="rounded-xl border border-border bg-card/35 shadow-sm overflow-hidden">
          <div className="border-b border-border/70 bg-card/50">
            <ScrollArea className="w-full">
              <div className="flex items-center px-2 py-2 gap-1 min-h-[42px]">
                {openConfigIndices.map((idx) => {
                  const config = allConfigs[idx];
                  const isActive = activeConfigIndex === idx;
                  if (!config) return null;

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-all border rounded-md",
                        isActive
                          ? "bg-background text-foreground border-primary/40 font-medium"
                          : "bg-card text-muted-foreground border-transparent hover:text-foreground hover:border-border"
                      )}
                      onMouseDown={(e) => {
                        if (e.button === 1 && openConfigIndices.length > 1) {
                          e.preventDefault();
                          e.stopPropagation();
                          onCloseTab(idx);
                        }
                      }}
                      onClick={() => onSelectTab(idx)}
                    >
                      <FileJson className={cn("w-3 h-3", isActive ? "text-primary" : "text-muted-foreground")} />
                      <span className="truncate max-w-[150px]">{config.fileName.split(/[\\/]/).pop()}</span>
                      {openConfigIndices.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCloseTab(idx);
                          }}
                          className="ml-1 hover:bg-muted rounded-full p-0.5"
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

          <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-card/20">
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleFormatJson}
                className="text-[11px] sm:text-xs"
                title="Format JSON (Shift+Alt+F)"
              >
                Format JSON
              </Button>
              <Button
                variant={isSplitView ? "default" : "outline"}
                size="sm"
                onClick={toggleSplitView}
                className="text-[11px] sm:text-xs"
                disabled={allConfigs.length < 2}
                title={allConfigs.length < 2 ? "Need at least 2 files to split" : "Toggle split view"}
              >
                {isSplitView ? "Split On" : "Split View"}
              </Button>
              {isSplitView && (
                <select
                  value={secondaryConfigIndex ?? ""}
                  onChange={(e) => setSecondaryConfigIndex(Number(e.target.value))}
                  className="h-8 rounded-md border border-border bg-background px-2 text-[11px] sm:text-xs max-w-[180px]"
                >
                  {allConfigs
                    .filter((cfg) => cfg.index !== activeConfigIndex)
                    .map((cfg) => (
                      <option key={cfg.index} value={cfg.index}>
                        {cfg.fileName.split(/[\\/]/).pop()}
                      </option>
                    ))}
                </select>
              )}
              <ConfigHistory
                modId={modId}
                modName={modName}
                configFile={configFile}
                onRestore={handleRestoreHistory}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex flex-col flex-grow overflow-hidden p-2 sm:p-4 lg:p-6 pt-3">
        {!loading && !error && (
          <div className={cn("flex flex-col flex-grow min-h-0 overflow-hidden gap-3", isSplitView && "lg:grid lg:grid-cols-2") }>
            <div className="flex flex-col min-h-0 flex-1">
              <div className="h-8 px-3 bg-card/60 text-foreground border border-border border-b-0 rounded-t-md flex items-center justify-between text-[11px]">
                <div className="truncate font-medium">Primary: {activeConfig?.fileName.split(/[\\/]/).pop()}</div>
                <div className="text-muted-foreground">JSON with comments</div>
              </div>
              <div className="mod-editor-shell flex-grow rounded-b-md border border-[#333333] overflow-hidden min-h-[260px] bg-[#1e1e1e]">
                <Editor
                  height="100%"
                  language="jsonc"
                  value={rawText}
                  beforeMount={(monaco) => { registerSptDarkTheme(monaco); }}
                  onMount={handleEditorDidMount}
                  onChange={handleRawTextChange}
                  theme="spt-dark"
                  options={editorOptions}
                />
              </div>
            </div>

            {isSplitView && secondaryConfig && (
              <div className="flex flex-col min-h-0 flex-1">
                <div className="h-8 px-3 bg-card/60 text-foreground border border-border border-b-0 rounded-t-md flex items-center justify-between text-[11px] gap-2">
                  <div className="truncate">
                    Secondary: {secondaryConfig.fileName.split(/[\\/]/).pop()}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!secondaryHasChanges || secondaryJsonError !== null || secondaryLoading}
                    onClick={handleSecondarySave}
                    className="h-7 px-2 text-[11px]"
                  >
                    <Save className="w-3 h-3 mr-1" /> Save Pane
                  </Button>
                </div>
                <div className="mod-editor-shell flex-grow rounded-md border border-border overflow-hidden min-h-[260px] bg-[#1e1e1e]">
                  {secondaryLoading ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Reading file content...</div>
                  ) : (
                    <Editor
                      height="100%"
                      language="jsonc"
                      value={secondaryRawText}
                      beforeMount={(monaco) => { registerSptDarkTheme(monaco); }}
                      onMount={(editor, monaco) => {
                        secondaryEditorRef.current = editor;
                        monacoRef.current = monaco;

                        editor.onDidFocusEditorWidget(() => {
                          activeEditorRef.current = editor;
                        });

                        editor.addAction({
                          id: "spt-format-json-secondary",
                          label: "Format JSON",
                          keybindings: [
                            monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
                          ],
                          run: async () => {
                            const action = editor.getAction("editor.action.formatDocument");
                            if (!action) return;
                            await action.run();
                          },
                        });
                      }}
                      onChange={handleSecondaryRawTextChange}
                      theme="spt-dark"
                      options={editorOptions}
                    />
                  )}
                </div>
                {secondaryJsonError && (
                  <p className="text-[11px] text-red-300 mt-1 truncate">Secondary Error: {secondaryJsonError}</p>
                )}
              </div>
            )}

            <p className="text-[10px] sm:text-xs text-muted-foreground shrink-0 mt-2 text-center sm:text-left">
              Direct text editing preserves JSON5 comments and syntax{isSplitView ? " across both panes" : ""}.
            </p>

            <div className="h-7 mt-1 rounded-md border border-border bg-card/45 text-foreground px-2 sm:px-3 flex items-center justify-between text-[10px] sm:text-xs">
              <div className="truncate">
                {jsonError ? `JSON Error${jsonErrorLine ? ` (Line ${jsonErrorLine})` : ""}` : "No Problems"}
              </div>
              <div className="flex items-center gap-3 whitespace-nowrap text-muted-foreground">
                <span>{editorSettings.wordWrap === "on" ? "Wrap: On" : "Wrap: Off"}</span>
                <span>UTF-8</span>
                <span>JSON5</span>
                <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground animate-pulse">Reading file content...</p>
          </div>
        )}

        {error && !loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <p className="text-destructive font-medium">Failed to read file content.</p>
              <Button variant="outline" onClick={handleReset}>Try Reload</Button>
            </div>
          </div>
        )}

        {showCategoryDialog && (
          <CategoryDialog
            modName={modName}
            currentCategory={currentCategory}
            open={showCategoryDialog}
            onOpenChange={setShowCategoryDialog}
            onCategoryAssigned={(category) => onCategoryChange?.(category)}
          />
        )}

        <Dialog open={showInstalledMods} onOpenChange={setShowInstalledMods}>
          <DialogContent className="w-[96vw] max-w-[1240px] h-[88vh] max-h-[920px] flex flex-col p-0 gap-0 [&>button]:top-3 [&>button]:right-3 [&>button]:z-10">
            <div className="flex-1 min-h-0">
              <InstalledMods rootDirHandle={rootDirHandle} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
