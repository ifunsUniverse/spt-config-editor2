import React, { useState, useEffect, useMemo } from "react";
import { Database, Search, Copy, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TarkovItem {
  id: string;
  name: string;
  category: string;
  shortName?: string;
}

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
        // Use the Electron bridge to fetch items via the main process
        // This bypasses CORS restrictions in the renderer process
        const result = await window.electronBridge.fetchTarkovItems();
        
        if (result.errors) {
          throw new Error(result.errors[0]?.message || "GraphQL Error");
        }

        if (result.data?.items) {
          const mappedItems: TarkovItem[] = result.data.items.map((item: any) => {
            const priorityTypes = ['ammo', 'armor', 'backpack', 'container', 'glasses', 'grenade', 'helmet', 'keys', 'medical', 'mods', 'provisions', 'weapon'];
            const foundType = item.types.find((t: string) => priorityTypes.includes(t)) || item.types[0] || "Other";
            
            return {
              id: item.id,
              name: item.name,
              shortName: item.shortName,
              category: foundType.charAt(0).toUpperCase() + foundType.slice(1)
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
    const cats = Array.from(new Set(items.map(i => i.category))).sort();
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
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-primary/20 hover:bg-primary/10">
          <Database className="w-4 h-4 text-primary" />
          <span className="hidden sm:inline">Item DB</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[450px] p-0 flex flex-col">
        <SheetHeader className="p-6 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Tarkov Item Database
          </SheetTitle>
          <SheetDescription>
            Live database sync from Tarkov-Dev. Copy IDs formatted for mod configurations.
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 space-y-4 flex-1 flex flex-col min-h-0">
          <div className="relative text-foreground">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search items or IDs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/30 border-border text-foreground"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-2 pb-2">
            <Badge 
              variant={selectedCategory === null ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors",
                selectedCategory === null ? "bg-primary text-primary-foreground" : "hover:bg-primary/20"
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
                  selectedCategory === cat ? "bg-primary text-primary-foreground" : "hover:bg-primary/20"
                )}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-2 pb-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Syncing live database...</p>
                </div>
              ) : filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <div 
                    key={item.id}
                    className="group p-3 rounded-lg border border-border bg-card/50 hover:bg-accent/20 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate leading-tight text-foreground">{item.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate mt-1">{item.id}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 uppercase font-black bg-muted text-muted-foreground">
                            {item.category}
                          </Badge>
                          {item.shortName && item.shortName !== item.name && (
                            <span className="text-[10px] text-muted-foreground italic">{item.shortName}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 h-8 w-8 hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => handleCopy(item.id, item.name)}
                      >
                        {copiedId === item.id ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <X className="w-12 h-12 text-muted-foreground/20 mb-2" />
                  <p className="text-muted-foreground text-sm">
                    {items.length === 0 ? "Waiting for data..." : "No items found matching your criteria"}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};