import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import JSON5 from "json5";

export interface ConfigValidationResult {
  modId: string;
  modName: string;
  configFile: string;
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

interface ConfigValidationSummaryProps {
  scannedMods: Array<{
    mod: { id: string; name: string };
    configs: Array<{ fileName: string; content: any }>;
  }>;
  onNavigateToConfig: (modId: string, configIndex: number) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ConfigValidationSummary = ({ 
  scannedMods, 
  onNavigateToConfig,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange 
}: ConfigValidationSummaryProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange !== undefined ? controlledOnOpenChange : setInternalOpen;

  useEffect(() => {
    if (isOpen) setIsValidating(true);
  }, [isOpen]);

  const validationResults = useMemo(() => {
    if (!isValidating) return [];
    
    const results: ConfigValidationResult[] = [];
    
    scannedMods.forEach((scannedMod) => {
      scannedMod.configs.forEach((config, index) => {
        try {
          JSON5.parse(JSON.stringify(config.content));
          results.push({
            modId: scannedMod.mod.id,
            modName: scannedMod.mod.name,
            configFile: config.fileName,
            isValid: true,
          });
        } catch (error: any) {
          results.push({
            modId: scannedMod.mod.id,
            modName: scannedMod.mod.name,
            configFile: config.fileName,
            isValid: false,
            error: error.message,
          });
        }
      });
    });
    
    return results;
  }, [scannedMods, isValidating]);

  const stats = useMemo(() => {
    const valid = validationResults.filter(r => r.isValid).length;
    const invalid = validationResults.filter(r => !r.isValid).length;
    return { valid, invalid, total: valid + invalid };
  }, [validationResults]);

  const validPercent = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-3xl max-h-[86vh] p-0 overflow-hidden border-border/70 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="px-5 pt-5 pb-3 border-b border-border/60 bg-gradient-to-r from-card via-card to-primary/10">
            <DialogTitle className="text-xl tracking-tight">Validation Command Center</DialogTitle>
            <DialogDescription>
              Review config health and jump directly to files that need attention.
            </DialogDescription>
          </div>
        </DialogHeader>

        {isValidating && (
          <div className="space-y-4 p-5 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="p-4 text-center border-green-500/35 bg-green-950/15">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-green-400" />
                <div className="text-2xl font-semibold">{stats.valid}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Valid</div>
              </Card>
              <Card className="p-4 text-center border-red-500/35 bg-red-950/15">
                <XCircle className="w-6 h-6 mx-auto mb-1 text-red-400" />
                <div className="text-2xl font-semibold">{stats.invalid}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Invalid</div>
              </Card>
              <Card className="p-4 text-center border-primary/35 bg-primary/10">
                <AlertCircle className="w-6 h-6 mx-auto mb-1 text-primary" />
                <div className="text-2xl font-semibold">{stats.total}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Total</div>
              </Card>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
              <p className="text-sm text-foreground">
                Health Score: <span className="font-semibold">{validPercent}%</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Click any row to open that config file in the editor.
              </p>
            </div>

            <ScrollArea className="h-[430px] rounded-lg border border-border/70 bg-background/30">
              <div className="space-y-2 pr-4">
                {validationResults.map((result, idx) => (
                  <Card
                    key={`${result.modId}-${idx}`}
                    className={`mx-3 my-2 p-3 cursor-pointer transition-all hover:scale-[1.005] hover:bg-accent/35 ${
                      !result.isValid ? "border-red-500/50 bg-red-950/10" : "border-green-500/40 bg-green-950/10"
                    }`}
                    onClick={() => {
                      const modIndex = scannedMods.findIndex(m => m.mod.id === result.modId);
                      if (modIndex !== -1) {
                        const configIndex = scannedMods[modIndex].configs.findIndex(
                          c => c.fileName === result.configFile
                        );
                        if (configIndex !== -1) {
                          onNavigateToConfig(result.modId, configIndex);
                          setIsOpen(false);
                        }
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {result.isValid ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                          )}
                          <span className="font-medium text-sm truncate">{result.modName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{result.configFile}</p>
                        {result.error && (
                          <p className="text-xs text-red-300 mt-1 line-clamp-2">{result.error}</p>
                        )}
                      </div>
                      <Badge variant={result.isValid ? "default" : "destructive"} className="rounded-md">
                        {result.isValid ? "Valid" : "Error"}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
