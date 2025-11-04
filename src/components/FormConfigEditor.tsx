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

// ⭐ Guess slider ranges dynamically for numbers
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

  // ✅ Sync form with new config when switching files
  useEffect(() => {
    setLocalData(config);

    const newCollapsed: Record<string, boolean> = {};
    const walk = (obj: any, path: string[] = []) => {
      Object.entries(obj).forEach(([k, v]) => {
        const p = [...path, k].join(".");
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          newCollapsed[p] = true; // default collapsed
          walk(v, [...path, k]);
        }
      });
    };
    walk(config);

    setCollapsed(newCollapsed);
  }, [config]);

  // ✅ Update JSON value as form edits
  const updateField = (path: string[], value: any) => {
    const newConfig = structuredClone(localData);
    let obj = newConfig;

    for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
    obj[path[path.length - 1]] = value;

    setLocalData(newConfig);
    onChange(newConfig);
  };

  // ✅ Reset one field back to original config
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
          <div key={fullKey} className="border border-border rounded-lg bg-card p-3 mb-2">
            {/* Collapsible header */}
            <div
              className="flex justify-between items-center cursor-pointer select-none"
              onClick={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [fullKey]: !prev[fullKey],
                }))
              }
            >
              <span className="font-semibold">
                {isOpen ? "▼" : "▶"} {prettyLabel(key)}
              </span>

              <Button
                size="sm"
                variant="ghost"
                {...preventCollapse}
                onClick={() => resetField(path)}
              >
                Reset
              </Button>
            </div>

            {/* Animated expand */}
            <div
              className={`overflow-hidden transition-all duration-200 ${
                isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="pl-4">{renderFields(value, path)}</div>
            </div>
          </div>
        );
      }

      return (
        <div
          key={fullKey}
          title={comment}
          className="mb-3 border border-border bg-card p-4 rounded-xl shadow-sm 
                     transition-all duration-150 hover:bg-accent/10 hover:border-primary/40"
          {...preventCollapse}
        >
          <label className="font-medium">{prettyLabel(key)}</label>

          {/* Dropdown */}
          {dropdownOptions && (
            <select
              value={String(value)}
              className="no-collapse w-full rounded-md border bg-background p-2 mt-1"
              onChange={(e) => updateField(path, e.target.value)}
              {...preventCollapse}
            >
              {dropdownOptions.map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
          )}

          {/* Boolean */}
          {!dropdownOptions && typeof value === "boolean" && (
            <div className="no-collapse mt-2" {...preventCollapse}>
              <Switch checked={value} onCheckedChange={(v) => updateField(path, v)} />
            </div>
          )}

          {/* Number */}
          {!dropdownOptions && typeof value === "number" && (
            <div className="no-collapse mt-2" {...preventCollapse}>
              <Input
                type="number"
                value={value}
                onChange={(e) => updateField(path, Number(e.target.value))}
              />
              <input
                type="range"
                className="w-full mt-2"
                value={value}
                {...guessNumberRange(value)}
                onChange={(e) => updateField(path, Number(e.target.value))}
              />
            </div>
          )}

          {/* String */}
          {!dropdownOptions && typeof value === "string" && (
            <div className="no-collapse mt-2" {...preventCollapse}>
              <Input value={value} onChange={(e) => updateField(path, e.target.value)} />
            </div>
          )}

          <Button size="sm" variant="ghost" {...preventCollapse} onClick={() => resetField(path)}>
            Reset
          </Button>
        </div>
      );
    });

  return <div className="overflow-y-auto h-full p-2">{renderFields(localData)}</div>;
}
