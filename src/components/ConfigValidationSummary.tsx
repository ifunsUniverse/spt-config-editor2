import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertCircle, Wrench } from "lucide-react";
import { toast } from "sonner";
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

  const handleValidateAll = () => {
    setIsValidating(true);
    setTimeout(() => {
      toast.success("Validation complete", {
        description: `${stats.valid} valid, ${stats.invalid} invalid configs`
      });
    }, 500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Config Validation Summary</DialogTitle>
          <DialogDescription>
            Overview of all configuration files and their validation status
          </DialogDescription>
        </DialogHeader>

        {isValidating && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 text-center">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-green-500" />
                <div className="text-2xl font-bold">{stats.valid}</div>
                <div className="text-xs text-muted-foreground">Valid</div>
              </Card>
              <Card className="p-3 text-center">
                <XCircle className="w-6 h-6 mx-auto mb-1 text-red-500" />
                <div className="text-2xl font-bold">{stats.invalid}</div>
                <div className="text-xs text-muted-foreground">Invalid</div>
              </Card>
              <Card className="p-3 text-center">
                <AlertCircle className="w-6 h-6 mx-auto mb-1 text-blue-500" />
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </Card>
            </div>

            {/* Results List */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {validationResults.map((result, idx) => (
                  <Card
                    key={`${result.modId}-${idx}`}
                    className={`p-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                      !result.isValid ? "border-red-500/50" : "border-green-500/50"
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
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                          )}
                          <span className="font-medium text-sm truncate">{result.modName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{result.configFile}</p>
                        {result.error && (
                          <p className="text-xs text-red-500 mt-1">{result.error}</p>
                        )}
                      </div>
                      <Badge variant={result.isValid ? "default" : "destructive"}>
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
