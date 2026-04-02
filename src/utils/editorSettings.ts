const STORAGE_KEY = "spt-editor-settings";

export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  wordWrap: "on" | "off";
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
  lineHeight: 1.6,
  wordWrap: "on",
};

export const FONT_OPTIONS = [
  { label: "JetBrains Mono", value: "JetBrains Mono, monospace" },
  { label: "Fira Code", value: "Fira Code, monospace" },
  { label: "Consolas", value: "Consolas, monospace" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Source Code Pro", value: "Source Code Pro, monospace" },
  { label: "Monaco", value: "Monaco, monospace" },
];

export function loadEditorSettings(): EditorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_EDITOR_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_EDITOR_SETTINGS };
}

export function saveEditorSettings(settings: EditorSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
