# SPT Mod Config Editor - Electron Desktop App

This app now supports running as a native desktop application using Electron!

## Features

✅ Full file system access without browser limitations
✅ Native OS dialogs for folder selection  
✅ Better performance for large mod folders
✅ Cross-platform support (Windows, macOS, Linux)
✅ Packagable as standalone executable

## Development

### Prerequisites
- Node.js 18+ installed
- npm or bun package manager

### Running in Development Mode

#### Web Preview (Browser):
```bash
npm run dev
```

#### Electron Desktop App:
```bash
ELECTRON=true npm run electron:dev
# or on Windows:
set ELECTRON=true && npm run electron:dev
```

The app will:
- Start Vite dev server
- Launch Electron window (Electron mode only)
- Enable hot-reload for instant updates
- Open DevTools for debugging (Electron mode)

### Building for Production

#### Build for Windows:
```bash
npm run build
npm run electron:build
```

This creates:
- `SPT Mod Config Editor-{version}-Setup.exe` installer
- Located in `release/` folder

#### Build for macOS:
```bash
npm run build
npm run electron:build
```

Creates `.dmg` installer in `release/`

#### Build for Linux:
```bash
npm run build
npm run electron:build
```

Creates `.AppImage` in `release/`

## Package.json Scripts

You need to add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "electron:dev": "cross-env ELECTRON=true vite",
    "electron:build": "electron-builder",
    "build": "tsc && vite build",
    "build:electron": "cross-env ELECTRON=true vite build",
    "preview": "vite preview"
  },
  "main": "dist-electron/main.js"
}
```

Also install `cross-env` for cross-platform environment variables:
```bash
npm install -D cross-env
```

## How It Works

### Architecture

```
┌─────────────────────────────────────────┐
│         Electron Main Process           │
│  (Node.js + Full File System Access)   │
│                                         │
│  • Handles file operations              │
│  • Opens native dialogs                 │
│  • Manages window lifecycle             │
└────────────┬────────────────────────────┘
             │ IPC Communication
             │
┌────────────▼────────────────────────────┐
│       Electron Renderer Process         │
│       (React + Vite Frontend)           │
│                                         │
│  • Your existing React UI               │
│  • Detects Electron environment         │
│  • Uses IPC for file operations         │
└─────────────────────────────────────────┘
```

### Key Files

- **electron/main.ts** - Main Electron process (creates window, handles IPC)
- **electron/preload.ts** - Secure bridge between main and renderer
- **src/utils/electronBridge.ts** - Helper to detect Electron environment
- **src/utils/electronFolderScanner.ts** - File scanner using Electron APIs
- **electron-builder.yml** - Build configuration for packaging

### Browser vs Electron

The app automatically detects its environment:

- **In Browser**: Uses File System Access API (Chrome, Edge only)
- **In Electron**: Uses native Node.js file system with Electron dialogs

All your existing functionality works in both modes!

## Differences from Browser Version

### ✅ Advantages
- No browser security restrictions
- Works with any folder structure
- Better performance on large file trees
- Native file dialogs
- Can run offline
- Distributable as standalone app

### ⚠️ Considerations
- Lovable Cloud features require internet connection
- Larger app size (~100MB+ for packaged app)
- Need to maintain Electron dependencies

## Packaging Notes

### Windows
- Creates NSIS installer
- Allows custom install location
- Desktop shortcut automatically created
- Installs to Program Files by default

### macOS
- Creates DMG image
- User drags app to Applications folder
- Requires code signing for distribution (optional)

### Linux
- Creates AppImage (portable, no install needed)
- Works on most distros
- Just download and run

## Troubleshooting

### "Cannot find module 'electron'"
```bash
npm install electron electron-builder -D
```

### Build fails
Make sure you:
1. Run `npm run build` first to build the React app
2. Then run `npm run electron:build` to package

### App doesn't launch
Check:
- Node.js version (needs 18+)
- All dependencies installed
- No antivirus blocking

## Distribution

Once built, share the installer from the `release/` folder with users.

They simply:
1. Download the installer
2. Run it
3. Launch "SPT Mod Config Editor"
4. Select their SPT folder
5. Start editing mods!

No browser or technical setup required! 🚀
