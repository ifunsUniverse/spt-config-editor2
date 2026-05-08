const STORAGE_KEY = "spt-editor-settings";

export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  wordWrap: "on" | "off";
  theme: "vs-dark" | "vs" | "spt-dark" | "spt-light";
  minimap: boolean;
  stickyScroll: boolean;
  renderWhitespace: "none" | "selection" | "boundary" | "all";
  fontLigatures: boolean;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
  lineHeight: 1.6,
  wordWrap: "on",
  theme: "spt-dark",
  minimap: true,
  stickyScroll: true,
  renderWhitespace: "selection",
  fontLigatures: true,
};

export const FONT_OPTIONS = [
  { label: "JetBrains Mono", value: "JetBrains Mono, monospace" },
  { label: "Fira Code", value: "Fira Code, monospace" },
  { label: "Consolas", value: "Consolas, monospace" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Source Code Pro", value: "Source Code Pro, monospace" },
  { label: "Monaco", value: "Monaco, monospace" },
];

export const EDITOR_THEME_OPTIONS = [
  { label: "SPT Dark (Recommended)", value: "spt-dark" },
  { label: "SPT Light", value: "spt-light" },
  { label: "VS Code Dark", value: "vs-dark" },
  { label: "VS Code Light", value: "vs" },
] as const;

export const WHITESPACE_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Selection", value: "selection" },
  { label: "Boundary", value: "boundary" },
  { label: "All", value: "all" },
] as const;

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
