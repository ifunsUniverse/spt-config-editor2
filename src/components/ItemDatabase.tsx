import React, { useState, useEffect, useMemo } from "react";
import { Database, Search, Copy, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TarkovItem {
  id: string;
  name: string;
  category: string;
  shortName?: string;
}

interface ItemRowProps {
  item: TarkovItem;
  onCopy: (id: string, name: string) => void;
  copiedId: string | null;
}

const ItemRow = ({ item, onCopy, copiedId }: ItemRowProps) => (
  <div className="px-1 pb-2">
    <div className="group p-3 rounded-lg border border-border bg-card/50 hover:bg-accent/20 transition-all">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate leading-tight text-foreground">{item.name}</p>
          <p className="text-[10px] font-mono text-muted-foreground truncate mt-1">{item.id}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 uppercase font-black bg-muted text-muted-foreground">
              {item.category}
            </Badge>
            {item.shortName && item.shortName !== item.name && (
              <span className="text-[10px] text-muted-foreground italic truncate">{item.shortName}</span>
            )}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 h-9 w-9 hover:bg-primary hover:text-primary-foreground transition-colors border border-border/50"
          onClick={() => onCopy(item.id, item.name)}
        >
          {copiedId === item.id ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  </div>
);

export const ItemDatabase = () => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [items, setItems] = useState<TarkovItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || items.length > 0) return;

    const fetchItems = async () => {
      setIsLoading(true);
      try {
        const result = await window.electronBridge.fetchTarkovItems();
        
        if (result.errors) {
          throw new Error(result.errors[0]?.message || "GraphQL Error");
        }

        if (result.data?.items) {
          const mappedItems: TarkovItem[] = result.data.items.map((item: any) => {
            const nameLower = item.name.toLowerCase();
            const shortLower = (item.shortName || "").toLowerCase();
            
            // Logic to identify "Dev" items (Locked crates, technical items, etc.)
            const isDevItem = 
              nameLower.includes("locked") || 
              nameLower.includes("crate") || 
              nameLower.includes("dev") ||
              shortLower.includes("dev") ||
              item.types.includes("un-researchable");

            const priorityTypes = ['ammo', 'armor', 'backpack', 'container', 'glasses', 'grenade', 'helmet', 'keys', 'medical', 'mods', 'provisions', 'weapon'];
            
            let category = "Other";
            if (isDevItem) {
              category = "Dev";
            } else {
              const foundType = item.types.find((t: string) => priorityTypes.includes(t)) || item.types[0];
              if (foundType) {
                category = foundType.charAt(0).toUpperCase() + foundType.slice(1);
              }
            }
            
            return {
              id: item.id,
              name: item.name,
              shortName: item.shortName,
              category
            };
          });
          
          setItems(mappedItems);
        }
      } catch (error: any) {
        console.error("Failed to fetch Tarkov items:", error);
        toast.error("Database Error", { 
          description: "Failed to connect to Tarkov-Dev API. Check your internet connection." 
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [isOpen, items.length]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(items.map(i => i.category))).sort((a, b) => {
      // Keep "Dev" at the end or specific order if preferred
      if (a === "Dev") return 1;
      if (b === "Dev") return -1;
      return a.localeCompare(b);
    });
    return cats;
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.toLowerCase().trim();
    return items.filter(item => {
      const matchesSearch = !query || 
                            item.name.toLowerCase().includes(query) || 
                            item.id.toLowerCase().includes(query) ||
                            item.shortName?.toLowerCase().includes(query);
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory, items]);

  const handleCopy = (id: string, name: string) => {
    const textToCopy = `//${name}\n"${id}": 1`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    toast.success("Copied to clipboard", {
      description: `${name} ID formatted for config`
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-primary/20 hover:bg-primary/10">
          <Database className="w-4 h-4 text-primary" />
          <span className="hidden sm:inline">Item DB</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Tarkov Item Database
          </DialogTitle>
          <DialogDescription>
            Live database sync from Tarkov-Dev. Copy IDs formatted for mod configurations.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4 flex-1 flex flex-col overflow-hidden">
          <div className="relative text-foreground shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search items or IDs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/30 border-border text-foreground"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-2 pb-2 shrink-0">
            <Badge 
              variant={selectedCategory === null ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors",
                selectedCategory === null ? "bg-primary text-primary-foreground" : "hover:bg-primary/20 text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setSelectedCategory(null)}
            >
              All {items.length > 0 && `(${items.length})`}
            </Badge>
            {categories.map(cat => (
              <Badge
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                className={cn(
                  "cursor-pointer transition-colors",
                  selectedCategory === cat ? (cat === "Dev" ? "bg-orange-600 text-white" : "bg-primary text-primary-foreground") : "hover:bg-primary/20 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>

          <div className="flex-1 min-h-0 bg-card/20 rounded-md border border-border/50 overflow-hidden">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Syncing live database...</p>
              </div>
            ) : filteredItems.length > 0 ? (
              <ScrollArea className="h-full">
                <div className="p-2">
                  {filteredItems.map((item) => (
                    <ItemRow 
                      key={item.id} 
                      item={item} 
                      onCopy={handleCopy} 
                      copiedId={copiedId} 
                    />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <X className="w-12 h-12 text-muted-foreground/20 mb-2" />
                <p className="text-muted-foreground text-sm">
                  {items.length === 0 ? "Waiting for data..." : "No items found matching your criteria"}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};