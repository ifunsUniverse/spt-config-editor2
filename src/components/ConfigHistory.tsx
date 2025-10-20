import { useState } from "react";
import { History, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ConfigHistory as ConfigHistoryType, getConfigHistory, clearConfigHistory } from "@/utils/configHistory";
import { formatDistanceToNow } from "date-fns";

interface ConfigHistoryProps {
  modId: string;
  modName: string;
  configFile: string;
  onRestore: (rawJson: any) => void;
}

export const ConfigHistory = ({ modId, modName, configFile, onRestore }: ConfigHistoryProps) => {
  const [history, setHistory] = useState<ConfigHistoryType[]>([]);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ConfigHistoryType | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleClearHistory = () => {
    setShowClearConfirm(true);
  };

  const confirmClearHistory = async () => {
    setIsLoading(true);
    await clearConfigHistory(modId, modName, configFile);
    await refreshHistory();
    setShowClearConfirm(false);
    setIsLoading(false);
  };

  const refreshHistory = async () => {
    setIsLoading(true);
    const historyData = await getConfigHistory(modId, modName, configFile);
    setHistory(historyData);
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
      if (age < oneDay) {
        groups.today.push(entry);
      } else if (age < 2 * oneDay) {
        groups.yesterday.push(entry);
      } else if (age < oneWeek) {
        groups.thisWeek.push(entry);
      } else {
        groups.older.push(entry);
      }
    });

    return groups;
  };

  const groups = groupHistoryByDate(history);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (open) refreshHistory();
      }}>
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
              Previous versions of {configFile}
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 flex justify-between items-center mb-4">
            <Badge variant="secondary">
              {history.length} {history.length === 1 ? 'entry' : 'entries'}
            </Badge>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
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
                {groups.today.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Today</h3>
                    <div className="space-y-2">
                      {groups.today.map((entry, idx) => (
                        <HistoryEntry key={idx} entry={entry} onRestore={handleRestore} />
                      ))}
                    </div>
                  </div>
                )}
                
                {groups.yesterday.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Yesterday</h3>
                    <div className="space-y-2">
                      {groups.yesterday.map((entry, idx) => (
                        <HistoryEntry key={idx} entry={entry} onRestore={handleRestore} />
                      ))}
                    </div>
                  </div>
                )}
                
                {groups.thisWeek.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-muted-foreground">This Week</h3>
                    <div className="space-y-2">
                      {groups.thisWeek.map((entry, idx) => (
                        <HistoryEntry key={idx} entry={entry} onRestore={handleRestore} />
                      ))}
                    </div>
                  </div>
                )}
                
                {groups.older.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Older</h3>
                    <div className="space-y-2">
                      {groups.older.map((entry, idx) => (
                        <HistoryEntry key={idx} entry={entry} onRestore={handleRestore} />
                      ))}
                    </div>
                  </div>
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
            <AlertDialogAction onClick={confirmClearHistory} className="bg-destructive hover:bg-destructive/90">
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const HistoryEntry = ({ 
  entry, 
  onRestore 
}: { 
  entry: ConfigHistoryType; 
  onRestore: (entry: ConfigHistoryType) => void;
}) => {
  return (
    <div className="flex items-start justify-between p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {entry.label}
        </p>
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
  );
};
