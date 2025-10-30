# SPT Mod Config Editor - Desktop Application

**A powerful Electron desktop application for managing your SPT mod configurations.**

## Overview

The SPT Mod Config Editor is a sleek, modern **desktop-only** application built with Electron that puts all your SPT mod configurations in one beautiful interface. No more juggling multiple JSON files and text editors!

## Key Features

- **One-Click Scanning** - Point to your SPT folder and instantly see all your installed mods with their config files
- **Smart Editor** - Real-time JSON/JSON5 validation with Monaco editor ensures you never save a broken config
- **Safe & Reliable** - Auto-formatting and validation before saving prevents configuration errors
- **Powerful Search** - Quickly find any mod with instant search and filtering
- **Favorites System** - Pin your frequently edited mods for quick access
- **Category Management** - Organize your mods into custom categories for better workflow
- **Configuration History** - Every save creates a backup. View and restore previous versions (keeps up to 10 versions per config for 30 days)
- **Bulk Export** - Export all your configurations at once for easy backup or sharing
- **Edit Tracking** - Visual indicators show which mods have been edited and when
- **Recently Edited Tab** - Quick access to your most recently modified mods
- **Modern UI** - Clean, intuitive interface with dark/light theme support
- **Keyboard Shortcuts** - Ctrl+S (Cmd+S on Mac) to save, Ctrl+F (Cmd+F on Mac) to search
- **Lightning Fast** - Built with modern technologies for instant responsiveness
- **Native File System Access** - Full desktop integration for seamless file management

## Installation

### Download Pre-built Binaries

Download the latest version for your platform from the releases page:
- **Windows**: `SPT-Mod-Config-Editor-Setup.exe`
- **macOS**: `SPT-Mod-Config-Editor.dmg`
- **Linux**: `SPT-Mod-Config-Editor.AppImage`

### Building from Source

See [ELECTRON-README.md](ELECTRON-README.md) for detailed build instructions.

## Usage

1. Launch the SPT Mod Config Editor application
2. Click "Select SPT Installation Folder" and browse to your SPT root directory
3. The app will automatically scan for mods in `SPT/user/mods/`
4. Select a mod from the sidebar to view and edit its configuration files
5. Make your changes in the Monaco editor
6. Press Ctrl+S or click "Save" to save your changes

## System Requirements

- **Operating System**: Windows 10+, macOS 10.13+, or Linux (64-bit)
- **Memory**: 4GB RAM minimum
- **Disk Space**: 200MB for application
- **Node.js**: Not required for pre-built binaries (required for development only)

## Why Electron-Only?

This application is built exclusively for desktop use to provide:
- Full file system access without browser security restrictions
- Native folder picker dialogs
- Persistent folder access without repeated permissions
- Better performance for large config files
- Native integration with your operating system
- Offline capability - no internet connection required

## Development

This project is built with:
- **Electron** - Desktop application framework
- **React** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tooling
- **Monaco Editor** - VS Code's editor
- **Tailwind CSS** - Utility-first styling

For development setup and build instructions, see [ELECTRON-README.md](ELECTRON-README.md).

## Features in Detail

### Configuration History & Rollback
Every time you save a config file, a backup is automatically created. Use the "History" button in the config editor to:
- View all previous versions (up to 10 per file)
- See when each version was saved
- Restore any previous version with one click
- Backups are kept for 30 days

### Category Management
Organize your mods into custom categories:
- Create unlimited categories
- Assign mods to categories for better organization
- Filter mods by category
- Categories are persistent across sessions

### Smart Validation
The editor provides real-time validation:
- JSON/JSON5 syntax checking
- Automatic formatting on save
- Error highlighting with line numbers
- "Fix Common Issues" tool for quick repairs

## Perfect For

- Players who frequently tweak mod settings
- Anyone who wants a better way to manage their SPT mods
- Users who need to organize large mod collections
- Anyone tired of hunting through folder structures

## Support & Feedback

Created by **ifunsUniverse**

I will be updating things as I go and add any features the community wants! Happy editing!

*This tool was built with some AI assistance but not entirely AI-generated.*

## License

See LICENSE file for details.
