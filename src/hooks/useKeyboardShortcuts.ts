import { useEffect } from "react";

interface ShortcutHandlers {
  onSave?: () => void;
  onSearch?: () => void;
}

export const useKeyboardShortcuts = ({ onSave, onSearch }: ShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl/Cmd key
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      if (!modifierKey) return;

      // Ctrl+S / Cmd+S - Save
      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        if (onSave) {
          onSave();
        }
      }

      // Ctrl+F / Cmd+F - Focus search
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        if (onSearch) {
          onSearch();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onSearch]);
};
