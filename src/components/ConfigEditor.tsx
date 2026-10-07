import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Home, RotateCcw, Save, Package, X, Search, AlertCircle, MoreVertical, FileJson, Download } from "lucide-react";
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
import { ElectronScannedMod } from "@/utils/electronFolderScanner";
import { DirectoryHandleLike } from "@/utils/electronBridge";
import { loadEditorSettings, type EditorSettings } from "@/utils/editorSettings";
import { registerSptDarkTheme } from "@/utils/monaco-theme";
import { loadAppSettings } from "@/utils/appSettings";
import { ConfigAssistant } from "@/components/ConfigAssistant";

interface ConfigEditorProps {
  modName: string;
  configFile: string;
  activeConfigFileIndex: number;
  activeConfigIndex: number;
  openConfigIndices: number[];
  allConfigs: ElectronScannedConfig[];
  scannedMods: ElectronScannedMod[];
  onSelectTab: (index: number) => void;
  onCloseTab: (index: number) => void;
  rawJson: any;
  modId: string;
  onSave: (values: ConfigValue[]) => Promise<void> | void;
  onChangesDetected?: (hasChanges: boolean) => void;
  onJsonErrorChange?: (configFileIndex: number, hasError: boolean) => void;
  saveConfigRef?: React.MutableRefObject<(() => void) | null>;
  currentCategory?: string | null;
  sptPath?: string | null;
  rootDirHandle?: DirectoryHandleLike | null;
  onCategoryChange?: (category: string | null) => void;
  onNavigateToConfig?: (modId: string, configIndex: number) => void;
  onHome?: () => void;
  onExportMods?: () => void;
  showThemeToggle?: boolean;
}

interface ConfigSearchResult {
  modId: string;
  modName: string;
  configIndex: number;
  configFileName: string;
  matchPath: string;
  matchType: "key" | "value" | "file";
  preview: string;
}

const MAX_GLOBAL_SEARCH_RESULTS = 50;

function summarizeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.length} item${value.length === 1 ? "" : "s"}]`;
  if (typeof value === "object") return "{...}";
  return "";
}

function collectConfigSearchMatches(
  value: unknown,
  query: string,
  modId: string,
  modName: string,
  configIndex: number,
  configFileName: string,
  path = "",
  matches: ConfigSearchResult[] = [],
): ConfigSearchResult[] {
  if (matches.length >= MAX_GLOBAL_SEARCH_RESULTS) return matches;

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (matches.length >= MAX_GLOBAL_SEARCH_RESULTS) return;
      collectConfigSearchMatches(item, query, modId, modName, configIndex, configFileName, `${path}[${index}]`, matches);
    });
    return matches;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, nestedValue]) => {
      if (matches.length >= MAX_GLOBAL_SEARCH_RESULTS) return;
      const nextPath = path ? `${path}.${key}` : key;
      if (key.toLowerCase().includes(query)) {
        matches.push({
          modId,
          modName,
          configIndex,
          configFileName,
          matchPath: nextPath,
          matchType: "key",
          preview: `${nextPath}: ${summarizeValue(nestedValue)}`,
        });
      }
      collectConfigSearchMatches(nestedValue, query, modId, modName, configIndex, configFileName, nextPath, matches);
    });
    return matches;
  }

  const primitive = summarizeValue(value);
  if (primitive.toLowerCase().includes(query)) {
    matches.push({
      modId,
      modName,
      configIndex,
      configFileName,
      matchPath: path || configFileName,
      matchType: "value",
      preview: `${path || configFileName}: ${primitive}`,
    });
  }

  return matches;
}

export const ConfigEditor = ({
  modName,
  configFile,
  activeConfigFileIndex,
  activeConfigIndex,
  openConfigIndices,
  allConfigs,
  scannedMods,
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
  onNavigateToConfig,
  onHome,
  onExportMods,
  sptPath,
  rootDirHandle,
}: ConfigEditorProps) => {
  const [rawText, setRawText] = useState<string>("");
  const [originalRawText, setOriginalRawText] = useState<string>("");
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
  const [secondaryOriginalRawText, setSecondaryOriginalRawText] = useState("");
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
          setOriginalRawText(content);
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
        setSecondaryOriginalRawText(content);
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

  const performPrimarySave = useCallback(async () => {
    try {
      JSON5.parse(rawText);
      const previousSnapshot = originalRawText;
      await Promise.resolve(onSave([{ key: "__RAW_JSON__", type: "raw", value: rawText }]));
      await saveConfigHistory(modId, modName, configFile, rawText, undefined, previousSnapshot);
      setOriginalRawText(rawText);
      setHasChanges(false);
      if (onChangesDetected) onChangesDetected(false);
      toast.success("Config saved successfully");
    } catch (error: any) {
      toast.error("Invalid JSON/JSON5", { description: error.message });
    }
  }, [configFile, rawText, modId, modName, onSave, onChangesDetected, originalRawText]);

  const handleSave = useCallback(async () => {
    try {
      JSON5.parse(rawText);
      await performPrimarySave();
    } catch (error: any) {
      toast.error("Invalid JSON/JSON5", { description: error.message });
    }
  }, [performPrimarySave, rawText]);


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

  const performSecondarySave = async () => {
    if (!secondaryConfig?.fileHandle) return;

    try {
      JSON5.parse(secondaryRawText);
      const previousSnapshot = secondaryOriginalRawText;
      const writable = await (secondaryConfig.fileHandle as any).createWritable();
      await writable.write(secondaryRawText);
      await writable.close();

      await saveConfigHistory(modId, modName, secondaryConfig.filePath, secondaryRawText, undefined, previousSnapshot);
      setSecondaryOriginalRawText(secondaryRawText);
      setSecondaryHasChanges(false);
      if (onJsonErrorChange) onJsonErrorChange(secondaryConfig.index, false);
      toast.success(`Saved ${secondaryConfig.fileName.split(/[\\/]/).pop()}`);
    } catch (saveError: any) {
      toast.error("Invalid JSON/JSON5", { description: saveError?.message || "Could not save file" });
    }
  };

  const handleSecondarySave = async () => {
    if (!secondaryConfig?.fileHandle) return;

    try {
      JSON5.parse(secondaryRawText);
      await performSecondarySave();
    } catch (error: any) {
      toast.error("Invalid JSON/JSON5", { description: error?.message || "Could not save file" });
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
      setOriginalRawText(content);
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

  const globalSearchResults = React.useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return [] as ConfigSearchResult[];

    const results: ConfigSearchResult[] = [];

    for (const scannedMod of scannedMods) {
      for (const config of scannedMod.configs) {
        if (results.length >= MAX_GLOBAL_SEARCH_RESULTS) return results;

        const fileName = config.fileName.split(/[\\/]/).pop() || config.fileName;
        if (fileName.toLowerCase().includes(trimmed)) {
          results.push({
            modId: scannedMod.mod.id,
            modName: scannedMod.mod.name,
            configIndex: config.index,
            configFileName: fileName,
            matchPath: fileName,
            matchType: "file",
            preview: `${fileName} in ${scannedMod.mod.name}`,
          });
        }

        let searchSource = config.rawJson;
        if (scannedMod.mod.id === modId && config.index === activeConfigIndex) {
          try {
            searchSource = JSON5.parse(rawText);
          } catch {
            searchSource = config.rawJson;
          }
        } else if (scannedMod.mod.id === modId && config.index === secondaryConfigIndex && isSplitView) {
          try {
            searchSource = JSON5.parse(secondaryRawText);
          } catch {
            searchSource = config.rawJson;
          }
        }

        collectConfigSearchMatches(
          searchSource,
          trimmed,
          scannedMod.mod.id,
          scannedMod.mod.name,
          config.index,
          fileName,
          "",
          results,
        );
      }
    }

    return results.slice(0, MAX_GLOBAL_SEARCH_RESULTS);
  }, [searchQuery, scannedMods, modId, activeConfigIndex, rawText, secondaryConfigIndex, isSplitView, secondaryRawText]);

  const handleSelectGlobalSearchResult = useCallback((result: ConfigSearchResult) => {
    onNavigateToConfig?.(result.modId, result.configIndex);
    setShowSearch(false);
    setSearchQuery("");
  }, [onNavigateToConfig]);

  return (
    <div className="relative flex-1 flex flex-col h-full bg-background min-w-0 overflow-hidden">
      {/* TOP BAR: title, category, primary actions */}
      <header className="shrink-0 border-b border-border/40 bg-card/60 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.7)]" />
            <div className="min-w-0">
              <h2 className="font-display truncate text-base font-bold leading-tight text-foreground sm:text-lg">{modName}</h2>
              <p className="truncate font-mono text-[10px] text-muted-foreground">{displayPath}</p>
            </div>
            {currentCategory ? (
              <button
                onClick={() => onCategoryChange?.(null)}
                title="Remove category"
                className="group hidden shrink-0 items-center gap-1 sm:flex"
              >
                <Badge className={cn("h-5 rounded px-2 text-[9px] font-bold uppercase tracking-wider text-white border-0", getCategoryBgColor(currentCategory))}>
                  {currentCategory}
                </Badge>
                <X className="h-3 w-3 text-muted-foreground group-hover:text-destructive" />
              </button>
            ) : (
              <button
                onClick={() => setShowCategoryDialog(true)}
                className="hidden shrink-0 rounded border border-dashed border-border/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary sm:block"
              >
                + Category
              </button>
            )}
            {hasChanges && (
              <span className="hidden shrink-0 items-center gap-1.5 rounded border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning md:flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
                Unsaved
              </span>
            )}
          </div>

          {/* Desktop actions */}
          <div className="hidden shrink-0 items-center gap-2 xl:flex">
            <Button
              size="sm"
              variant="ghost"
              disabled={!hasChanges}
              onClick={handleReset}
              className="h-8 gap-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              title="Discard all changes (Ctrl+Z)"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button
              size="sm"
              disabled={!hasChanges || jsonError !== null}
              onClick={handleSave}
              className="h-8 gap-1.5 rounded-lg px-5 text-[11px] font-bold uppercase tracking-wider shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
              title="Save changes (Ctrl+S)"
            >
              <Save className="h-3.5 w-3.5" /> Save Changes
            </Button>
            <div className="mx-1 h-6 w-px bg-border/60" />
            {onExportMods && (
              <Button variant="ghost" size="icon" onClick={onExportMods} className="h-8 w-8" title="Export mods">
                <Download className="h-4 w-4" />
              </Button>
            )}
            {onHome && (
              <Button variant="ghost" size="icon" onClick={onHome} className="h-8 w-8" title="Home">
                <Home className="h-4 w-4" />
              </Button>
            )}
            <SettingsDialog />
          </div>

          {/* Compact actions */}
          <div className="flex items-center gap-1 xl:hidden">
            <Button
              size="icon"
              variant={hasChanges ? "default" : "outline"}
              disabled={!hasChanges || jsonError !== null}
              onClick={handleSave}
              className="h-8 w-8"
              title="Save (Ctrl+S)"
            >
              <Save className="h-4 w-4" />
            </Button>
            <SettingsDialog />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setShowInstalledMods(true)}>
                  <Package className="w-4 h-4 mr-2" /> Installed Mods
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowCategoryDialog(true)}>
                  <span className="mr-2 w-4 text-center">+</span> Category
                </DropdownMenuItem>
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
                    <Download className="w-4 h-4 mr-2" /> Export
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* FILE TABS + TOOLS */}
        <div className="flex h-11 items-center gap-2 border-t border-border/30 px-4">
          <ScrollArea className="min-w-0 flex-1">
            <div className="flex items-center gap-1 py-1">
              {openConfigIndices.map((idx) => {
                const config = allConfigs[idx];
                const isActive = activeConfigIndex === idx;
                if (!config) return null;
                return (
                  <div
                    key={idx}
                    className={cn(
                      "group relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1 text-[11px] font-bold tracking-tight transition-colors",
                      isActive
                        ? "border-primary/25 bg-primary/10 text-primary"
                        : "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
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
                    <FileJson className="h-3 w-3 shrink-0" />
                    <span className="max-w-[140px] truncate sm:max-w-[200px]">{config.fileName.split(/[\\/]/).pop()}</span>
                    {openConfigIndices.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTab(idx);
                        }}
                        className="ml-0.5 rounded p-0.5 opacity-50 transition-opacity hover:bg-muted/60 hover:opacity-100"
                        title="Close tab (Middle click to close)"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <div className="flex shrink-0 items-center gap-1">
            {showSearch ? (
              <div className="flex h-8 w-44 items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-2 sm:w-56">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search all configs..."
                  className="min-w-0 flex-1 border-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery("");
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label="Close search"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <Button variant="ghost" size="icon" onClick={() => setShowSearch(true)} className="h-8 w-8" title="Search configs">
                <Search className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center rounded-lg border border-border/50 bg-muted/20 p-0.5">
              <label
                title="Upload a config file to replace this one (review, then Save)"
                className="cursor-pointer rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                Upload
                <input
                  type="file"
                  accept=".json,.json5,.jsonc,.cfg,.txt,application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("File too large", { description: "Max 5 MB" });
                      return;
                    }
                    const text = await file.text();
                    try {
                      JSON5.parse(text);
                    } catch (err: any) {
                      toast.warning("Uploaded file has syntax errors", { description: err?.message });
                    }
                    handleRawTextChange(text);
                    toast.success(`Loaded ${file.name}`, { description: "Review it, then press Save to apply." });
                  }}
                />
              </label>
              <button
                onClick={toggleSplitView}
                disabled={allConfigs.length < 2}
                title={allConfigs.length < 2 ? "Need at least 2 files" : "Split view (Ctrl+\\)"}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  isSplitView ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                )}
              >
                Split
              </button>
            </div>
            {isSplitView && (
              <select
                value={secondaryConfigIndex ?? ""}
                onChange={(e) => setSecondaryConfigIndex(Number(e.target.value))}
                className="h-8 max-w-[150px] cursor-pointer rounded-lg border border-border/50 bg-muted/20 px-2 text-[11px]"
              >
                {allConfigs
                  .filter((cfg) => cfg.index !== activeConfigIndex)
                  .map((cfg) => (
                    <option key={cfg.index} value={cfg.index}>
                      {cfg.fileName.split(/[\\/]/).pop()?.substring(0, 20)}
                    </option>
                  ))}
              </select>
            )}
            <div className="mx-1 h-5 w-px bg-border/60" />
            <ConfigHistory modId={modId} modName={modName} configFile={configFile} onRestore={handleRestoreHistory} />
            <ItemDatabase />
          </div>
        </div>
      </header>

      {jsonError && (
        <div className="shrink-0 px-4 pt-2">
          <Alert variant="destructive" className="py-2 text-xs sm:text-sm">
            <AlertCircle className="mr-2 h-4 w-4 flex-shrink-0" />
            <AlertDescription>
              <span className="font-semibold">JSON Error:</span> {jsonError}
              {jsonErrorLine && <span className="ml-2 text-xs opacity-75">(Line {jsonErrorLine})</span>}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {showSearch && (
        <div className="shrink-0 px-3 pt-2 sm:px-4">
          <div className="rounded-lg border border-border/50 bg-gradient-to-b from-card/60 to-card/30 shadow-sm overflow-hidden">
            <div className="flex flex-col items-start justify-between gap-2 border-b border-border/50 bg-card/40 px-3 py-2 sm:flex-row sm:items-center sm:px-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Global Search</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Searching across {scannedMods.length} mod{scannedMods.length !== 1 ? "s" : ""}
                </p>
              </div>
              {searchQuery.trim() && (
                <Badge className="bg-primary/20 text-primary border border-primary/30 text-xs">
                  {globalSearchResults.length} result{globalSearchResults.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {!searchQuery.trim() ? (
              <div className="px-3 py-5 text-center sm:px-4">
                <Search className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Type to search file names, keys, and values</p>
              </div>
            ) : globalSearchResults.length === 0 ? (
              <div className="px-3 py-5 text-center sm:px-4">
                <AlertCircle className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No matches found for "<span className="font-medium">{searchQuery}</span>"</p>
              </div>
            ) : (
              <ScrollArea className="max-h-80">
                <div className="divide-y divide-border/40">
                  {globalSearchResults.map((result, index) => (
                    <button
                      key={`${result.modId}:${result.configIndex}:${result.matchPath}:${index}`}
                      onClick={() => handleSelectGlobalSearchResult(result)}
                      className="group w-full border-l-2 border-l-transparent px-3 py-2 text-left transition-colors hover:border-l-primary hover:bg-primary/5 sm:px-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                            {result.modName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            <span className="font-mono bg-card/60 px-1.5 py-0.5 rounded text-[10px]">{result.configFileName}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {result.preview}
                          </p>
                        </div>
                        <Badge variant="secondary" className="capitalize text-[10px] shrink-0">
                          {result.matchType}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            )}
          </div>
        </div>
      )}

      {/* EDITOR WORKSPACE */}
      <div className="flex flex-grow flex-col gap-2 overflow-hidden p-2 pt-2 sm:p-3 sm:pt-2">
        {!loading && !error && (
          <div className={cn("flex flex-grow min-h-0 flex-col gap-2 overflow-hidden", isSplitView && "lg:grid lg:grid-cols-2")}>
            {/* Primary Editor Pane */}
            <div className="flex flex-col min-h-0 flex-1 rounded-lg border border-border/50 overflow-hidden shadow-lg bg-gradient-to-br from-[#1e1e1e] to-[#252526]">
              {/* Pane Header */}
              <div className="flex h-8 items-center justify-between border-b border-border/50 bg-gradient-to-r from-card/80 to-card/40 px-3 text-xs font-medium">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-blue-500/70"></div>
                  <span className="text-foreground truncate">Primary Editor</span>
                  <span className="text-muted-foreground/60">—</span>
                  <span className="text-muted-foreground text-[11px] truncate">{activeConfig?.fileName.split(/[\\/]/).pop()}</span>
                </div>
                <span className="text-muted-foreground/50 text-[10px]">JSON5</span>
              </div>

              {/* Editor */}
              <div className="mod-editor-shell flex-grow overflow-hidden bg-[#1e1e1e]">
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

              {/* Editor Footer */}
              <div className="flex h-7 items-center justify-between gap-2 border-t border-border/30 bg-card/30 px-3 text-[10px] text-muted-foreground/70">
                <span className="truncate">
                  {jsonError ? `Error${jsonErrorLine ? ` on Line ${jsonErrorLine}` : ""}` : "Valid JSON5"}
                </span>
                <div className="flex items-center gap-3 whitespace-nowrap text-muted-foreground/50">
                  <span>Ln {cursorPosition.line}</span>
                  <span>Col {cursorPosition.column}</span>
                </div>
              </div>
            </div>

            {/* Secondary Editor Pane (Split View) */}
            {isSplitView && secondaryConfig && (
              <div className="flex flex-col min-h-0 flex-1 rounded-lg border border-border/50 overflow-hidden shadow-lg bg-gradient-to-br from-[#1e1e1e] to-[#252526]">
                {/* Pane Header */}
                <div className="flex h-8 items-center justify-between border-b border-border/50 bg-gradient-to-r from-card/80 to-card/40 px-3 text-xs font-medium">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-purple-500/70"></div>
                    <span className="text-foreground truncate">Secondary Editor</span>
                    <span className="text-muted-foreground/60">—</span>
                    <span className="text-muted-foreground text-[11px] truncate">{secondaryConfig.fileName.split(/[\\/]/).pop()}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!secondaryHasChanges || secondaryJsonError !== null || secondaryLoading}
                    onClick={handleSecondarySave}
                    className="h-6 px-2 text-[10px] hover:bg-primary/20 hover:text-primary"
                    title="Save secondary file"
                  >
                    <Save className="w-3 h-3 mr-1" /> Save
                  </Button>
                </div>

                {/* Editor */}
                <div className="mod-editor-shell flex-grow overflow-hidden bg-[#1e1e1e]">
                  {secondaryLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-xs text-muted-foreground">Loading...</p>
                      </div>
                    </div>
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

                      }}
                      onChange={handleSecondaryRawTextChange}
                      theme="spt-dark"
                      options={editorOptions}
                    />
                  )}
                </div>

                {/* Editor Footer */}
                <div className="flex h-7 items-center justify-between border-t border-border/30 bg-card/30 px-3 text-[10px] text-muted-foreground/70">
                  <span className="truncate">
                    {secondaryJsonError ? "Error on secondary pane" : "Valid JSON5"}
                  </span>
                  <span className="text-muted-foreground/50">UTF-8</span>
                </div>
              </div>
            )}

            {/* Status Info */}
            <div className="text-xs text-muted-foreground/60 text-center">
              <p>
                {isSplitView 
                  ? "Split view enabled — edit both files side-by-side"
                  : "Single pane mode — use split view to edit multiple files"}
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            <p className="text-sm text-muted-foreground">Loading configuration file...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-sm rounded-lg border border-border/50 bg-card/40 p-4 text-center">
              <AlertCircle className="w-12 h-12 text-destructive/60 mx-auto mb-3" />
              <p className="text-base font-medium text-foreground mb-2">Failed to Load File</p>
              <p className="text-sm text-muted-foreground mb-4">The configuration file could not be read. Try reloading or selecting another file.</p>
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="w-4 h-4" /> Try Reload
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && activeConfig && (
          <ConfigAssistant
            key={`${modId}:${activeConfigIndex}`}
            modName={modName}
            configs={allConfigs}
            activeIndex={activeConfigIndex}
            rawText={rawText}
            secondaryIndex={isSplitView ? secondaryConfigIndex : null}
            secondaryText={secondaryRawText}
            onApply={async (text, before) => {
              if (rawText !== before) throw new Error("The editor changed. Request a fresh suggestion.");
              const diskText = await (await activeConfig.fileHandle.getFile()).text();
              if (diskText !== originalRawText) throw new Error("The file changed on disk. Reload it before applying a suggestion.");
              JSON5.parse(text);
              await Promise.resolve(onSave([{ key: "__RAW_JSON__", type: "raw", value: text }]));
              await saveConfigHistory(modId, modName, configFile, text, "AI-assisted edit", before);
              setRawText(text);
              setOriginalRawText(text);
              setHasChanges(false);
              setJsonError(null);
              setJsonErrorLine(null);
              onChangesDetected?.(false);
              onJsonErrorChange?.(activeConfig.index, false);
              toast.success("Reviewed change saved");
            }}
          />
        )}

        {/* Dialogs */}
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
