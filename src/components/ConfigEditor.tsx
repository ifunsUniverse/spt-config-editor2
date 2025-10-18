import { useState, useEffect, useRef } from "react";
import { Save, RotateCcw, Package, AlertCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import JSON5 from "json5";
import CodeMirror, { EditorView, ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { linter, Diagnostic } from "@codemirror/lint";

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
  const [errors, setErrors] = useState<Diagnostic[]>([]);
  const [currentErrorIndex, setCurrentErrorIndex] = useState(0);
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  // JSON5 linter for CodeMirror
  const json5Linter = linter((view) => {
    const diagnostics: Diagnostic[] = [];
    const text = view.state.doc.toString();
    
    try {
      JSON5.parse(text);
    } catch (error: any) {
      // Try to extract line and column from error message
      const match = error.message.match(/at (\d+):(\d+)/);
      if (match) {
        const line = parseInt(match[1]) - 1;
        const col = parseInt(match[2]) - 1;
        const lineObj = view.state.doc.line(Math.min(line + 1, view.state.doc.lines));
        const from = lineObj.from + Math.min(col, lineObj.length);
        const to = Math.min(from + 1, lineObj.to);
        
        diagnostics.push({
          from,
          to,
          severity: "error",
          message: error.message.replace(/JSON5: /, ""),
        });
      } else {
        // Generic error at start of document
        diagnostics.push({
          from: 0,
          to: 1,
          severity: "error",
          message: error.message.replace(/JSON5: /, ""),
        });
      }
    }
    
    setErrors(diagnostics);
    return diagnostics;
  });

  // Reset when config changes
  useEffect(() => {
    setRawText(JSON.stringify(rawJson, null, 2));
    setHasChanges(false);
    setErrors([]);
    setCurrentErrorIndex(0);
    if (onChangesDetected) {
      onChangesDetected(false);
    }
  }, [configFile, modName]);

  const handleRawTextChange = (text: string) => {
    setRawText(text);
    const newHasChanges = true;
    setHasChanges(newHasChanges);
    setCurrentErrorIndex(0);
    if (onChangesDetected) {
      onChangesDetected(newHasChanges);
    }
  };

  const jumpToNextError = () => {
    if (errors.length === 0) return;
    
    const nextIndex = (currentErrorIndex + 1) % errors.length;
    setCurrentErrorIndex(nextIndex);
    
    const error = errors[nextIndex];
    const view = editorRef.current?.view;
    if (view) {
      view.dispatch({
        selection: { anchor: error.from, head: error.to },
        scrollIntoView: true,
      });
      view.focus();
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
    setErrors([]);
    setCurrentErrorIndex(0);
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
    <div className="flex-1 flex flex-col h-full bg-background">
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
              disabled={!hasChanges || errors.length > 0}
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

        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">
                {errors.length} syntax {errors.length === 1 ? "error" : "errors"} found
              </span>
              {errors.length > 0 && ": " + errors[currentErrorIndex].message}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        <div className="flex-1 flex flex-col space-y-2 relative">
          <div className="flex-1 border border-border rounded-md overflow-hidden relative">
            <div className="h-full overflow-auto">
              <CodeMirror
                ref={editorRef}
                value={rawText}
                onChange={handleRawTextChange}
                extensions={[json(), json5Linter]}
                theme="dark"
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLineGutter: true,
                  highlightSpecialChars: true,
                  foldGutter: true,
                  drawSelection: true,
                  dropCursor: true,
                  allowMultipleSelections: true,
                  indentOnInput: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  autocompletion: true,
                  rectangularSelection: true,
                  crosshairCursor: true,
                  highlightActiveLine: true,
                  highlightSelectionMatches: true,
                  closeBracketsKeymap: true,
                  searchKeymap: true,
                  foldKeymap: true,
                  completionKeymap: true,
                  lintKeymap: true,
                }}
                height="100%"
                style={{ fontSize: "14px" }}
              />
            </div>
            
            {/* Error Counter and Navigation */}
            <div className="absolute bottom-2 right-2 flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-border rounded-md px-3 py-1.5 shadow-lg z-10">
              {errors.length > 0 ? (
                <>
                  <Badge variant="destructive" className="gap-1.5">
                    <AlertCircle className="h-3 w-3" />
                    {errors.length} {errors.length === 1 ? "error" : "errors"}
                  </Badge>
                  <Button
                    onClick={jumpToNextError}
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs gap-1"
                  >
                    Next Error
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Badge variant="secondary" className="gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  No errors
                </Badge>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground shrink-0">
            Supports JSON, JSON5, and JSONC syntax. Errors are highlighted in real-time. Auto-formats on save.
          </p>
        </div>
      </div>
    </div>
  );
};
