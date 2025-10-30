import { editor } from "monaco-editor";

export const registerTransparentTheme = () => {
  editor.defineTheme("transparent-theme", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#00000000",
      "editorGutter.background": "#00000000",
      "editorLineNumber.foreground": "#888888",
      "scrollbarSlider.background": "#88888844",
      "scrollbarSlider.hoverBackground": "#88888866",
      "scrollbarSlider.activeBackground": "#88888888",
    },
  });
};