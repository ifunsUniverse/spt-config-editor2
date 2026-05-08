import { editor } from "monaco-editor";

export const registerTransparentTheme = () => {
  editor.defineTheme("transparent-theme", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#00000000",
      "editor.foreground": "#E5E7EB",
      "editorGutter.background": "#00000000",
      "editorLineNumber.foreground": "#888888",
      "editorCursor.foreground": "#60A5FA",
      "editor.lineHighlightBackground": "#FFFFFF08",
      "editor.selectionBackground": "#60A5FA33",
      "editor.inactiveSelectionBackground": "#60A5FA1F",
      "scrollbarSlider.background": "#88888844",
      "scrollbarSlider.hoverBackground": "#88888866",
      "scrollbarSlider.activeBackground": "#88888888",
    },
  });
};

/** VS Code Dark+ style JSON syntax highlighting */
export const registerSptDarkTheme = (monacoInstance: any) => {
  monacoInstance.editor.defineTheme("spt-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      // JSON keys (property names in quotes before the colon)
      { token: "string.key.json",        foreground: "9CDCFE" }, // light blue
      // String values
      { token: "string.value.json",      foreground: "CE9178" }, // orange
      // Numbers
      { token: "number.json",            foreground: "B5CEA8" }, // light green
      // Booleans & null
      { token: "keyword.json",           foreground: "569CD6" }, // blue
      // Punctuation / delimiters
      { token: "delimiter.bracket.json", foreground: "FFD700" }, // gold braces
      { token: "delimiter.array.json",   foreground: "FFD700" }, // gold brackets
      { token: "delimiter.colon.json",   foreground: "D4D4D4" }, // light grey
      { token: "delimiter.comma.json",   foreground: "D4D4D4" },
      // Comments (JSONC)
      { token: "comment",                foreground: "6A9955", fontStyle: "italic" },
    ],
    colors: {
      "editor.background":                  "#1E1E1E",
      "editor.foreground":                  "#D4D4D4",
      "editorLineNumber.foreground":        "#858585",
      "editorLineNumber.activeForeground":  "#C6C6C6",
      "editorCursor.foreground":            "#60A5FA",
      "editor.lineHighlightBackground":     "#FFFFFF0A",
      "editor.selectionBackground":         "#264F78",
      "editor.inactiveSelectionBackground": "#3A3D41",
      "scrollbarSlider.background":         "#88888844",
      "scrollbarSlider.hoverBackground":    "#88888866",
      "scrollbarSlider.activeBackground":   "#88888888",
    },
  });
};

/** VS Code Light style JSON syntax highlighting */
export const registerSptLightTheme = (monacoInstance: any) => {
  monacoInstance.editor.defineTheme("spt-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "string.key.json",        foreground: "0451A5" }, // dark blue
      { token: "string.value.json",       foreground: "A31515" }, // red
      { token: "number.json",             foreground: "098658" }, // green
      { token: "keyword.json",            foreground: "0000FF" }, // blue
      { token: "delimiter.bracket.json",  foreground: "000000" },
      { token: "delimiter.array.json",    foreground: "000000" },
      { token: "comment",                 foreground: "008000", fontStyle: "italic" },
    ],
    colors: {
      "editor.background":                  "#FFFFFF",
      "editor.foreground":                  "#000000",
      "editorLineNumber.foreground":        "#237893",
      "editorCursor.foreground":            "#000000",
      "editor.selectionBackground":         "#ADD6FF",
      "editor.lineHighlightBackground":     "#F3F3F3",
    },
  });
};
