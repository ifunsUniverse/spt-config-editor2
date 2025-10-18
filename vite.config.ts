import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Only load Electron plugins when explicitly building for Electron
  const isElectronBuild = process.env.ELECTRON === "true";

  const plugins: any[] = [
    react(),
    mode === "development" && componentTagger(),
  ];

  // Add Electron plugins only when building for Electron
  if (isElectronBuild) {
    plugins.push(
      electron([
        {
          entry: "electron/main.ts",
          vite: {
            build: {
              outDir: "dist-electron",
              rollupOptions: {
                external: ["electron"],
              },
            },
          },
        },
        {
          entry: "electron/preload.ts",
          onstart(options) {
            options.reload();
          },
          vite: {
            build: {
              outDir: "dist-electron",
            },
          },
        },
      ]),
      renderer()
    );
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: plugins.filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "path": "path-browserify",
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
