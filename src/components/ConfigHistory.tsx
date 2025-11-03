import { useState, forwardRef } from "react";
import { History, Trash2, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  ConfigHistory as ConfigHistoryType,
  getConfigHistory,
  clearConfigHistory,
} from "@/utils/configHistory";

interface ConfigHistoryProps {
  modId: string;
  modName: string;
  configFile: string;
  onRestore: (rawJson: any) => void;
}

export const ConfigHistory = forwardRef<HTMLDivElement, ConfigHistoryProps>(
  ({ modId, modName, configFile, onRestore }, ref) => {
    const [history, setHistory] = useState<ConfigHistoryType[]>([]);
    const [selectedEntry, setSelectedEntry] = useState<ConfigHistoryType | null>(null);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const refreshHistory = async () => {
      setIsLoading(true);
      const historyData = await getConfigHistory(modId, modName, configFile);
      setHistory(historyData);
      setIsLoading(false);
    };

    const handleRestore = (entry: ConfigHistoryType) => {
      setSelectedEntry(entry);
      setShowRestoreConfirm(true);
    };

    const confirmRestore = () => {
      if (selectedEntry) {
        onRestore(selectedEntry.rawJson);
        setShowRestoreConfirm(false);
        setIsOpen(false);
      }
    };

    const confirmClearHistory = async () => {
      setIsLoading(true);
      await clearConfigHistory(modId, modName, configFile);
      await refreshHistory();
      setShowClearConfirm(false);
      setIsLoading(false);
    };

    const groupHistoryByDate = (entries: ConfigHistoryType[]) => {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const oneWeek = 7 * oneDay;

      const groups = {
        today: [] as ConfigHistoryType[],
        yesterday: [] as ConfigHistoryType[],
        thisWeek: [] as ConfigHistoryType[],
        older: [] as ConfigHistoryType[],
      };

      entries.forEach(entry => {
        const age = now - entry.timestamp;
        if (age < oneDay) groups.today.push(entry);
        else if (age < 2 * oneDay) groups.yesterday.push(entry);
        else if (age < oneWeek) groups.thisWeek.push(entry);
        else groups.older.push(entry);
      });

      return groups;
    };

    const groups = groupHistoryByDate(history);

    // ✅ Normalize configFile into human-readable SPT mod path
      const cleanPath = (() => {
        if (!configFile) return modId;

        // normalize slashes for Windows paths
        const normalized = configFile.replace(/\\/g, "/");

        // extract from /SPT/user/mods/... onward
        const match = normalized.match(/(SPT\/user\/mods\/[^/]+)/i);

        if (match) {
          return `/${match[1]}`;
        }

        // fallback: just show mod folder
        return `/SPT/user/mods/${modId}`;
      })();


    return (
      <div ref={ref}>
        <Sheet
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            if (open) refreshHistory();
          }}
        >
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 border-border">
              <History className="w-4 h-4" />
              History
            </Button>
          </SheetTrigger>

          <SheetContent className="w-[400px] sm:w-[540px]">
            <SheetHeader>
              <SheetTitle>Configuration History</SheetTitle>
              <SheetDescription>
                Previous versions of 📂{cleanPath}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 flex justify-between items-center mb-4">
              <Badge variant="secondary">
                {history.length} {history.length === 1 ? "entry" : "entries"}
              </Badge>
              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  className="gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </Button>
              )}
            </div>

            <ScrollArea className="h-[calc(100vh-200px)]">
              {history.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No history entries found
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groups).map(([label, entries]) =>
                    entries.length > 0 ? (
                      <div key={label}>
                        <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
                          {label === "thisWeek"
                            ? "This Week"
                            : label.charAt(0).toUpperCase() + label.slice(1)}
                        </h3>
                        <div className="space-y-2">
                          {entries.map((entry) => (
                            <HistoryEntry
                              key={entry.timestamp}
                              entry={entry}
                              onRestore={handleRestore}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* --- Restore Confirmation --- */}
        <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restore Configuration?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to restore this version? Current unsaved changes will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRestore}>Restore</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* --- Clear Confirmation --- */}
        <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear History?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all history entries for this configuration file. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmClearHistory}
                className="bg-destructive hover:bg-destructive/90"
              >
                Clear All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }
);

ConfigHistory.displayName = "ConfigHistory";

type HistoryEntryProps = {
  entry: ConfigHistoryType;
  onRestore: (entry: ConfigHistoryType) => void;
};

export const HistoryEntry = forwardRef<HTMLDivElement, HistoryEntryProps>(
  ({ entry, onRestore }, ref) => (
    <div
      ref={ref}
      className="flex items-start justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.label}</p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRestore(entry)}
        className="gap-2 shrink-0 ml-2"
      >
        <RotateCcw className="w-3 h-3" />
        Restore
      </Button>
    </div>
  )
);

HistoryEntry.displayName = "HistoryEntry";
