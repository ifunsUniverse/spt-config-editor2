// src/components/FormConfigEditor.tsx
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const prettyLabel = (key: string) =>
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_\-]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

const guessNumberRange = (value: number) => {
  if (value >= 0 && value <= 1) return { min: 0, max: 1, step: 0.01 };
  if (value <= 10) return { min: 0, max: 10, step: 0.1 };
  if (value <= 100) return { min: 0, max: 100, step: 1 };
  return { min: value * 0.25, max: value * 4, step: 1 };
};

interface FormConfigEditorProps {
  config: any;
  metadata?: Record<string, string>;
  onChange: (updatedJson: any) => void;
}

export function FormConfigEditor({ config, metadata = {}, onChange }: FormConfigEditorProps) {
  const [localData, setLocalData] = useState<any>(config);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalData(config);

    const newCollapsed: Record<string, boolean> = {};
    const walk = (obj: any, path: string[] = []) => {
      Object.entries(obj).forEach(([k, v]) => {
        const p = [...path, k].join(".");
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          newCollapsed[p] = true;
          walk(v, [...path, k]);
        }
      });
    };
    walk(config);

    setCollapsed(newCollapsed);
  }, [config]);

  const updateField = (path: string[], value: any) => {
    const newConfig = structuredClone(localData);
    let obj = newConfig;

    for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
    obj[path[path.length - 1]] = value;

    setLocalData(newConfig);
    onChange(newConfig);
  };

  const resetField = (path: string[]) => {
    const original = structuredClone(config);
    let obj = original;

    for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
    updateField(path, obj[path[path.length - 1]]);
  };

  const preventCollapse = {
    onClick: (e: any) => e.stopPropagation(),
    onMouseDown: (e: any) => e.stopPropagation(),
    onPointerDown: (e: any) => e.stopPropagation(),
  };

  const renderFields = (obj: any, parentPath: string[] = []) =>
    Object.entries(obj).map(([key, value]) => {
      const path = [...parentPath, key];
      const fullKey = path.join(".");
      const isNested = typeof value === "object" && value !== null && !Array.isArray(value);

      const comment = metadata[key] ?? "";
      const dropdownOptions = comment.includes("|")
        ? comment.split("|").map((x) => x.trim())
        : null;

      if (isNested) {
        const isOpen = !collapsed[fullKey];

        return (
          <div key={fullKey} className="mb-3 rounded-xl border border-border/70 bg-card/55 p-3 shadow-sm transition-colors hover:border-primary/35">
            <div
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [fullKey]: !prev[fullKey],
                }))
              }
            >
              <span className="font-semibold text-sm tracking-wide text-foreground">
                {isOpen ? "▼" : "▶"} {prettyLabel(key)}
              </span>

              <Button
                size="sm"
                variant="ghost"
                {...preventCollapse}
                onClick={() => resetField(path)}
                className="h-7 text-xs"
              >
                Reset
              </Button>
            </div>

            <div
              className={`overflow-hidden transition-all duration-200 ${
                isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="pl-4 pt-2">{renderFields(value, path)}</div>
            </div>
          </div>
        );
      }

      return (
        <div
          key={fullKey}
          title={comment}
          className="mb-3 border border-border/70 bg-card/65 p-4 rounded-xl shadow-sm
                     transition-all duration-150 hover:bg-accent/10 hover:border-primary/40"
          {...preventCollapse}
        >
          <div className="flex items-center justify-between gap-2">
            <label className="font-medium text-sm text-foreground">{prettyLabel(key)}</label>
            <Button size="sm" variant="ghost" {...preventCollapse} onClick={() => resetField(path)} className="h-7 text-xs">
              Reset
            </Button>
          </div>
          {comment && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{comment}</p>}

          {dropdownOptions && (
            <select
              value={String(value)}
              className="no-collapse w-full rounded-md border border-border bg-background p-2 mt-2 text-sm"
              onChange={(e) => updateField(path, e.target.value)}
              {...preventCollapse}
            >
              {dropdownOptions.map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
          )}

          {!dropdownOptions && typeof value === "boolean" && (
            <div className="no-collapse mt-3" {...preventCollapse}>
              <Switch checked={value} onCheckedChange={(v) => updateField(path, v)} />
            </div>
          )}

          {!dropdownOptions && typeof value === "number" && (
            <div className="no-collapse mt-3 space-y-2" {...preventCollapse}>
              <Input
                type="number"
                value={value}
                onChange={(e) => updateField(path, Number(e.target.value))}
                className="bg-background"
              />
              <input
                type="range"
                className="w-full"
                value={value}
                {...guessNumberRange(value)}
                onChange={(e) => updateField(path, Number(e.target.value))}
              />
            </div>
          )}

          {!dropdownOptions && typeof value === "string" && (
            <div className="no-collapse mt-3" {...preventCollapse}>
              <Input value={value} onChange={(e) => updateField(path, e.target.value)} className="bg-background" />
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-3 rounded-xl border border-border/70 bg-card/60 p-3">
          <p className="text-sm font-semibold">Form Editor</p>
          <p className="text-xs text-muted-foreground mt-1">Structured editing mode for quick field-level changes.</p>
        </div>
        {renderFields(localData)}
      </div>
    </div>
  );
}
