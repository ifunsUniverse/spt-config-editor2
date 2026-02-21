

## Implement Updated Components from Electron Build

This plan brings in the updated code from your Electron build into this project. It covers 7 files: 2 new components, 4 updated components, and updated type definitions.

### Changes Overview

**New Files (2)**
- `src/components/SPTControlPanel.tsx` -- SPT Server/Launcher control panel with exe selection, launch buttons, and settings dialog
- `src/components/ItemDatabase.tsx` -- Tarkov item database browser that fetches from tarkov-dev.com API via Electron bridge, with search, category filter, and copy-to-clipboard

**Updated Files (5)**

1. **`src/components/PathSelector.tsx`** -- Full replacement with your updated version:
   - Removes the debug "Upload Single Mod Folder" section
   - Adds "Check for Updates" button linking to forge.sp-tarkov.com
   - Adds "NEW!" feature indicators with seen/unseen tracking
   - Adds responsive sizing (sm breakpoints)
   - Adds hover state tracking for feature lines
   - References SPT Control Panel in info text ("Easy SPT Server and Launcher startup")

2. **`src/components/ModList.tsx`** -- Full replacement with your updated version:
   - Replaces Collapsible-based expand with manual state toggle
   - Adds nested folder grouping for config files (files grouped by subdirectory with expandable folders)
   - Adds `filePath` to `ConfigFile` interface
   - Updates styling: cleaner card layout, improved chevron animations, better badge styling
   - Removes `editHistory` from destructured props (uses `getModEditTime` directly)
   - Extracts `ConfigButton` as a sub-component
   - Removes `formatDistanceToNow` dependency from this component

3. **`src/components/ConfigHistory.tsx`** -- Minor update: already matches, no changes needed (files are identical)

4. **`src/types/electron.d.ts`** -- Add new Electron bridge type definitions:
   - `selectExe` for exe file picker
   - `launchSPT` for launching executables
   - `getSPTStatus` for checking running state
   - `fetchTarkovItems` for Tarkov API proxy
   - `saveFile` for save dialog
   - `onSPTStatusChange` and `onSPTConsoleLog` event listeners

5. **`src/utils/electronBridge.ts`** -- Add new bridge function exports:
   - `selectExe` for exe selection dialog
   - `launchSPT` for launching SPT executables
   - `fetchTarkovItems` for Tarkov item database API
   - `saveFile` for save file dialog

**Reference files (not modified in this project but included for your Electron build)**
- `electron/main.ts` and `electron/preload.ts` -- These contain the IPC handlers. They will be replaced with your uploaded versions so the Electron build has all the new handlers (selectExe, launchSPT, fetch-items, etc.)

### Integration Points

- `SPTControlPanel` will need to be added to the sidebar in `Index.tsx` (rendered when `sptPath` is set)
- `ItemDatabase` will need to be added to the editor toolbar in `ConfigEditor.tsx`

### Technical Details

File-by-file implementation order:
1. Update `src/types/electron.d.ts` with new type definitions
2. Update `src/utils/electronBridge.ts` with new exports
3. Create `src/components/SPTControlPanel.tsx` (new file)
4. Create `src/components/ItemDatabase.tsx` (new file)
5. Replace `src/components/PathSelector.tsx` with updated version
6. Replace `src/components/ModList.tsx` with updated version
7. Replace `electron/main.ts` with uploaded version
8. Replace `electron/preload.ts` with uploaded version
9. Update `src/pages/Index.tsx` to integrate SPTControlPanel in sidebar
10. Update `src/components/ConfigEditor.tsx` to add ItemDatabase button in toolbar

