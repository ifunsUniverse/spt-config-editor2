# 🚀 Electron Desktop App Setup Guide

## Quick Start

### 1. Update package.json

Add these scripts to your `package.json`:

```json
{
  "name": "spt-mod-config-editor",
  "version": "1.0.0",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "electron:dev": "vite",
    "build": "tsc && vite build",
    "electron:build": "electron-builder",
    "preview": "vite preview"
  }
}
```

### 2. Install Dependencies

```bash
npm install
# or
bun install
```

All Electron dependencies are already added:
- electron
- electron-builder
- vite-plugin-electron
- vite-plugin-electron-renderer
- path-browserify

### 3. Run in Development

```bash
npm run electron:dev
```

This will:
- Start Vite dev server
- Launch Electron window with your app
- Enable hot-reload
- Open DevTools for debugging

### 4. Build Desktop App

#### For Windows:
```bash
npm run build
npm run electron:build
```

Output: `release/SPT Mod Config Editor-1.0.0-Setup.exe`

#### For macOS:
```bash
npm run build
npm run electron:build
```

Output: `release/SPT Mod Config Editor-1.0.0.dmg`

#### For Linux:
```bash
npm run build
npm run electron:build
```

Output: `release/SPT Mod Config Editor-1.0.0.AppImage`

## 📦 What's Been Added

### New Files

```
electron/
├── main.ts          # Main Electron process (window, IPC handlers)
├── preload.ts       # Secure IPC bridge
└── tsconfig.json    # TypeScript config for Electron

src/
├── types/
│   └── electron.d.ts          # TypeScript definitions
├── utils/
│   ├── electronBridge.ts      # Environment detection
│   └── electronFolderScanner.ts  # Electron file scanner

electron-builder.yml   # Build configuration
```

### Modified Files

- `vite.config.ts` - Added Electron plugins
- `src/pages/Index.tsx` - Dual mode support (browser/Electron)
- `src/components/PathSelector.tsx` - Native folder dialog
- `index.html` - Updated title

## 🔧 How It Works

### Dual Mode Operation

The app automatically detects its environment and adapts:

```typescript
if (isElectron()) {
  // Use Electron APIs (full file system access)
  const api = electronAPI();
  const result = await api.selectFolder();
  // ... use native dialogs and Node.js fs
} else {
  // Use browser File System Access API
  const dirHandle = await showDirectoryPicker();
  // ... browser-based file access
}
```

### Architecture

```
┌──────────────────────────────────────┐
│     Electron Main Process            │
│  (Node.js with full file access)    │
│                                      │
│  IPC Handlers:                       │
│  • dialog:selectFolder               │
│  • fs:readdir                        │
│  • fs:readFile                       │
│  • fs:writeFile                      │
│  • fs:exists                         │
│  • fs:stat                           │
└──────────────┬───────────────────────┘
               │
        IPC Communication
               │
┌──────────────▼───────────────────────┐
│    Electron Renderer Process         │
│    (Your React App)                  │
│                                      │
│  • Vite + React + TypeScript         │
│  • Tailwind CSS + shadcn/ui          │
│  • Detects environment               │
│  • Uses appropriate APIs             │
└──────────────────────────────────────┘
```

### Security

- **Context Isolation**: Enabled ✅
- **Node Integration**: Disabled ✅
- **Preload Script**: Secure IPC bridge ✅
- **Web Security**: Enabled ✅

Only explicitly exposed APIs are available to the renderer.

## 🎨 Customization

### Change App Icon

Replace `public/favicon.ico` with your icon file.

For best results, provide multiple sizes:
- Windows: `.ico` file with multiple resolutions
- macOS: `.icns` file
- Linux: `.png` files (multiple sizes)

### Change App Name

Update in:
1. `electron-builder.yml` - `productName`
2. `electron-builder.yml` - `appId`
3. `electron/main.ts` - `title` in BrowserWindow
4. `index.html` - `<title>` tag

### Window Settings

Edit `electron/main.ts`:

```typescript
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,          // Initial width
    height: 900,          // Initial height
    minWidth: 1200,       // Minimum width
    minHeight: 700,       // Minimum height
    title: 'Your Title',  // Window title
    // ... more options
  });
};
```

## 📋 Features Working in Electron

✅ Full file system access (no browser limitations)
✅ Native folder selection dialog
✅ Recursive folder scanning
✅ Read/write JSON and JSON5 files
✅ Favorites system
✅ ZIP export
✅ Mod configuration editing
✅ Real-time JSON validation
✅ Dark mode UI

## 🌐 Cloud Features

**Note**: Lovable Cloud features require an internet connection.

- Translation API (when you re-enable it)
- Any backend edge functions
- Authentication (if added)
- Database operations (if used)

All local file operations work completely offline.

## 🐛 Troubleshooting

### "Cannot find module 'electron'"
```bash
npm install
```

### Build fails with "main not found"
Ensure `package.json` has:
```json
"main": "dist-electron/main.js"
```

### Window is blank
Check DevTools console (F12) for errors.
Make sure Vite dev server is running.

### Can't package app
1. Run `npm run build` first
2. Then run `npm run electron:build`

### App won't start after packaging
Check antivirus settings - it may block unsigned apps.

For Windows: Right-click installer → Properties → Unblock

## 📦 Distribution

### For Users

1. Build the app: `npm run electron:build`
2. Find installer in `release/` folder
3. Share the installer file

Users just need to:
- Download the installer
- Run it
- Launch the app
- No Node.js or dependencies needed!

### Code Signing (Optional)

For production distribution, consider code signing:

**Windows**: Need a code signing certificate
**macOS**: Need an Apple Developer account
**Linux**: Optional, AppImage works without signing

Add to `electron-builder.yml`:
```yaml
win:
  certificateFile: path/to/certificate.pfx
  certificatePassword: ${env.CERTIFICATE_PASSWORD}

mac:
  identity: "Developer ID Application: Your Name (TEAMID)"
```

## 🔄 Updates

To add auto-updates, integrate `electron-updater`:

```bash
npm install electron-updater
```

Configure in `electron/main.ts` and `electron-builder.yml`.

## 💡 Tips

1. **Development**: Use `npm run electron:dev` for hot-reload
2. **Debugging**: DevTools open automatically in dev mode
3. **Performance**: The Electron build is optimized for production
4. **File Size**: Packaged app will be ~100-150MB (includes Chromium)
5. **Testing**: Test the packaged app before distributing

## 📚 Next Steps

1. Test the app in both dev and production modes
2. Customize the app icon and branding
3. Add any additional features you need
4. Build and test installers for your target platforms
5. Optionally set up auto-updates
6. Distribute to users!

## 🆘 Need Help?

- Check `ELECTRON-README.md` for architecture details
- See Electron docs: https://www.electronjs.org/docs
- See electron-builder docs: https://www.electron.build/

---

**Your app is now a fully-functional desktop application!** 🎉

Run `npm run electron:dev` to see it in action!
