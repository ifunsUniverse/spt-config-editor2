import { useMemo, useState, forwardRef } from "react";
import { History, Trash2, RotateCcw, Eye, GitCompare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { DiffEditor } from "@monaco-editor/react";

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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  ConfigHistory as ConfigHistoryType,
  getConfigHistory,
  clearConfigHistory,
} from "@/utils/configHistory";
import { registerSptDarkTheme } from "@/utils/monaco-theme";
import { toast } from "sonner";

interface ConfigHistoryProps {
  modId: string;
  modName: string;
  configFile: string;
  onRestore: (rawJson: any) => void;
}

function historyToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatHistoryDateLabel(label: string): string {
  if (label === "today") return "Today";
  if (label === "yesterday") return "Yesterday";
  if (label === "thisWeek") return "This Week";
  return "Older";
}

export const ConfigHistory = forwardRef<HTMLDivElement, ConfigHistoryProps>(
  ({ modId, modName, configFile, onRestore }, ref) => {
    const [history, setHistory] = useState<ConfigHistoryType[]>([]);
    const [selectedEntry, setSelectedEntry] = useState<ConfigHistoryType | null>(null);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showDiffDialog, setShowDiffDialog] = useState(false);
    const [diffEntry, setDiffEntry] = useState<ConfigHistoryType | null>(null);
    const [diffOriginalText, setDiffOriginalText] = useState("");
    const [diffModifiedText, setDiffModifiedText] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const refreshHistory = async () => {
      setIsLoading(true);
      try {
        const historyData = await getConfigHistory(modId, modName, configFile);
        setHistory(historyData);
      } catch (error) {
        console.error("Failed to load config history:", error);
        toast.error("Failed to load history");
      } finally {
        setIsLoading(false);
      }
    };

    const handleRestore = (entry: ConfigHistoryType) => {
      setSelectedEntry(entry);
      setShowRestoreConfirm(true);
    };

    const handleViewDiff = (entry: ConfigHistoryType, index: number) => {
      const fallbackPrevious = history[index + 1]?.rawJson;
      const previousSnapshot = entry.previousRawJson ?? fallbackPrevious ?? "";

      setDiffEntry(entry);
      setDiffOriginalText(historyToText(previousSnapshot));
      setDiffModifiedText(historyToText(entry.rawJson));
      setShowDiffDialog(true);
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
      try {
        await clearConfigHistory(modId, modName, configFile);
        await refreshHistory();
        toast.success("History cleared");
      } catch (error) {
        console.error("Failed to clear config history:", error);
        toast.error("Failed to clear history");
      } finally {
        setShowClearConfirm(false);
        setIsLoading(false);
      }
    };

    const groupedHistory = useMemo(() => {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const oneWeek = 7 * oneDay;
      const groups = {
        today: [] as Array<{ entry: ConfigHistoryType; index: number }>,
        yesterday: [] as Array<{ entry: ConfigHistoryType; index: number }>,
        thisWeek: [] as Array<{ entry: ConfigHistoryType; index: number }>,
        older: [] as Array<{ entry: ConfigHistoryType; index: number }>,
      };

      history.forEach((entry, index) => {
        const age = now - entry.timestamp;
        const item = { entry, index };

        if (age < oneDay) groups.today.push(item);
        else if (age < 2 * oneDay) groups.yesterday.push(item);
        else if (age < oneWeek) groups.thisWeek.push(item);
        else groups.older.push(item);
      });

      return groups;
    }, [history]);

    const cleanPath = (() => {
      if (!configFile) return modId;
      const normalized = configFile.replace(/\\/g, "/");
      const match = normalized.match(/(SPT\/user\/mods\/[^/]+)/i);
      if (match) return `/${match[1]}`;
      return `/SPT/user/mods/${modId}`;
    })();

    return (
      <div ref={ref}>
        <Sheet
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            if (open) void refreshHistory();
          }}
        >
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 border-border">
              <History className="w-4 h-4" />
              History
            </Button>
          </SheetTrigger>

          <SheetContent className="flex h-full w-[420px] flex-col gap-0 overflow-hidden p-0 sm:w-[620px]">
            <div className="border-b border-border/70 px-5 pb-4 pt-5">
              <SheetHeader className="space-y-1.5">
                <SheetTitle>Configuration History</SheetTitle>
                <SheetDescription className="break-all">Saved snapshots for {cleanPath}</SheetDescription>
              </SheetHeader>

              <div className="mt-4 flex items-center justify-between">
                <Badge variant="secondary">{history.length} {history.length === 1 ? "entry" : "entries"}</Badge>
                {history.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowClearConfirm(true)}
                    className="h-7 gap-1.5 px-2.5 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear All
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 px-5 py-4">
              {isLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Loading history...</div>
              ) : history.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 py-10 text-center text-muted-foreground">
                  No history entries found
                </div>
              ) : (
                <div className="space-y-5 pb-2">
                  {Object.entries(groupedHistory).map(([label, entries]) =>
                    entries.length > 0 ? (
                      <div key={label}>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/90">
                          {formatHistoryDateLabel(label)}
                        </h3>
                        <div className="space-y-2.5">
                          {entries.map(({ entry, index }) => (
                            <HistoryEntry
                              key={entry.timestamp}
                              entry={entry}
                              onRestore={handleRestore}
                              onViewDiff={() => handleViewDiff(entry, index)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>

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

        <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear History?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all history entries for this configuration file. This action cannot be undone.
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

        <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
          <DialogContent className="h-[88vh] max-h-[920px] w-[96vw] max-w-[1300px] overflow-hidden p-0">
            <DialogHeader className="border-b border-border px-4 py-3">
              <DialogTitle className="flex items-center gap-2">
                <GitCompare className="h-4 w-4" />
                History Diff
              </DialogTitle>
              <p className="truncate text-xs text-muted-foreground">
                {diffEntry?.label ?? "Selected history entry"} • {diffEntry ? formatDistanceToNow(diffEntry.timestamp, { addSuffix: true }) : ""}
              </p>
            </DialogHeader>

            <div className="h-[calc(88vh-72px)]">
              <DiffEditor
                height="100%"
                language="jsonc"
                original={diffOriginalText}
                modified={diffModifiedText}
                beforeMount={(monaco) => {
                  registerSptDarkTheme(monaco);
                }}
                theme="spt-dark"
                options={{
                  readOnly: true,
                  originalEditable: false,
                  minimap: { enabled: false },
                  renderSideBySide: true,
                  automaticLayout: true,
                  wordWrap: "on",
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
);

ConfigHistory.displayName = "ConfigHistory";

type HistoryEntryProps = {
  entry: ConfigHistoryType;
  onRestore: (entry: ConfigHistoryType) => void;
  onViewDiff: () => void;
};

export const HistoryEntry = forwardRef<HTMLDivElement, HistoryEntryProps>(
  ({ entry, onRestore, onViewDiff }, ref) => (
    <div
      ref={ref}
      className="overflow-hidden rounded-xl border border-border/70 bg-card/60 px-3.5 py-3 shadow-sm transition-colors hover:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{entry.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDistanceToNow(entry.timestamp, { addSuffix: true })}</p>
        </div>

        <div className="flex items-center gap-1.5 self-center">
          <Button variant="outline" size="sm" onClick={onViewDiff} className="h-7 gap-1.5 rounded-full px-2.5 text-xs">
            <Eye className="h-3.5 w-3.5" />
            Diff
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onRestore(entry)} className="h-7 gap-1.5 rounded-full px-2.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            Restore
          </Button>
        </div>
      </div>
    </div>
  ),
);

HistoryEntry.displayName = "HistoryEntry";
