import React, { useState, useEffect, useMemo, useRef } from "react";
import { Database, Search, Copy, Check, X, Loader2, ListFilter } from "lucide-react";
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

const DISPLAY_LIMIT = 150;

interface TarkovItem {
  id: string;
  name: string;
  category: string;
  shortName?: string;
  iconLink?: string;
  iconLinkAlt?: string;
}

export const ItemDatabase = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [items, setItems] = useState<TarkovItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [imageFallbackStage, setImageFallbackStage] = useState<Record<string, number>>({});
  const copiedTimeoutRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);

  // Debounce search input — avoids filtering 90k items on every keystroke
  useEffect(() => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current !== null) window.clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || items.length > 0) return;

    let isMounted = true;
    const controller = new AbortController();

    const fetchItems = async () => {
      setIsLoading(true);
      setFetchError(false);
      try {
        const response = await fetch("https://api.tarkov.dev/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            query: `{
              items(lang: en) {
                id
                name
                shortName
                types
                iconLink
                image8xLink
              }
            }`
          }),
        });

        const result = await response.json();

        if (result.errors) throw new Error(result.errors[0]?.message || "GraphQL Error");

        if (result.data?.items && isMounted) {
          const priorityTypes = ['ammo', 'armor', 'backpack', 'container', 'glasses', 'grenade', 'helmet', 'keys', 'medical', 'mods', 'provisions', 'weapon'];
          const mappedItems: TarkovItem[] = result.data.items.map((item: any) => {
            const foundType = item.types.find((t: string) => priorityTypes.includes(t)) || item.types[0] || "Other";
            return {
              id: item.id,
              name: item.name,
              shortName: item.shortName,
              category: foundType.charAt(0).toUpperCase() + foundType.slice(1),
              iconLink: item.iconLink ?? undefined,
              iconLinkAlt: item.image8xLink ?? undefined,
            };
          });
          setItems(mappedItems);
          setImageFallbackStage({});
        }
      } catch (error: any) {
        if (error.name === "AbortError") return;
        console.error("Failed to fetch Tarkov items:", error);
        if (isMounted) setFetchError(true);
        toast.error("Database Error", {
          description: "Failed to connect to Tarkov-Dev API. Check your internet connection.",
        });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchItems();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isOpen, items.length]);

  const categories = useMemo(
    () => Array.from(new Set(items.map(i => i.category))).sort(),
    [items]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [items]);

  // Full filtered list (for count) — capped for rendering
  const filteredItems = useMemo(() => {
    const query = debouncedSearch.toLowerCase().trim();
    return items.filter(item => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        item.shortName?.toLowerCase().includes(query);
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [debouncedSearch, selectedCategory, items]);

  const visibleItems = useMemo(() => filteredItems.slice(0, DISPLAY_LIMIT), [filteredItems]);
  const hiddenCount = filteredItems.length - visibleItems.length;

  const handleCopy = (id: string, name: string) => {
    const textToCopy = `//${name}\n"${id}": 1`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(id);
    toast.success("Copied to clipboard", { description: `${name} ID formatted for config` });
    if (copiedTimeoutRef.current !== null) window.clearTimeout(copiedTimeoutRef.current);
    copiedTimeoutRef.current = window.setTimeout(() => {
      setCopiedId(null);
      copiedTimeoutRef.current = null;
    }, 2000);
  };

  const getItemImageSrc = (item: TarkovItem): string | null => {
    const stage = imageFallbackStage[item.id] || 0;
    if (stage === 0) return item.iconLink || item.iconLinkAlt || null;
    if (stage === 1) return item.iconLinkAlt || null;
    return null;
  };

  const handleImageError = (itemId: string) => {
    setImageFallbackStage((prev) => {
      const current = prev[itemId] || 0;
      if (current >= 2) return prev;
      return { ...prev, [itemId]: current + 1 };
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-primary/20 hover:bg-primary/10">
          <Database className="w-4 h-4 text-primary" />
          <span className="hidden sm:inline">Item DB</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[1200px] w-[96vw] h-[88vh] max-h-[900px] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Tarkov Item Database
              </DialogTitle>
              <DialogDescription>
                Live database from Tarkov-Dev. Copy IDs formatted for mod configs.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="secondary" className="h-5 px-2">{items.length} total</Badge>
              <Badge variant="outline" className="h-5 px-2">
                {filteredItems.length} match{filteredItems.length === 1 ? "" : "es"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 pt-3 pb-3 flex flex-col gap-2 shrink-0 border-b border-border bg-card/20">
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search items or IDs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/30 border-border text-foreground h-10"
            />
          </div>
        </div>

        {/* Main layout: category rail + item results */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="border-b md:border-b-0 md:border-r border-border bg-card/10 min-h-0 overflow-y-auto p-3">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <ListFilter className="w-3.5 h-3.5" />
              Categories
            </div>

            <div className="space-y-1.5">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                className="w-full justify-between h-8 text-xs"
                onClick={() => setSelectedCategory(null)}
              >
                <span>All Items</span>
                <span className="opacity-80">{items.length}</span>
              </Button>

              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "ghost"}
                  className="w-full justify-between h-8 text-xs"
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span className="truncate pr-2">{cat}</span>
                  <span className="opacity-70">{categoryCounts[cat] || 0}</span>
                </Button>
              ))}
            </div>
          </aside>

          <section className="min-h-0 flex flex-col">
            <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground shrink-0">
              {selectedCategory ? (
                <span>Showing category: <span className="text-foreground font-medium">{selectedCategory}</span></span>
              ) : (
                <span>Showing all categories</span>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">Syncing live database...</p>
                </div>
              ) : fetchError ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <X className="w-10 h-10 text-destructive/40" />
                  <p className="text-sm text-muted-foreground">Could not reach Tarkov-Dev API.</p>
                  <Button size="sm" variant="outline" onClick={() => setItems([])}>
                    Retry
                  </Button>
                </div>
              ) : visibleItems.length > 0 ? (
                <>
                  {visibleItems.map(item => (
                    <div
                      key={item.id}
                      className="group flex items-center justify-between gap-3 px-3 py-3 rounded-lg border border-border bg-card/40 hover:bg-accent/20 transition-all"
                    >
                      <div className="shrink-0 w-12 h-12 rounded-md bg-muted/20 flex items-center justify-center border border-border/40">
                        {getItemImageSrc(item) ? (
                          <img
                            src={getItemImageSrc(item) as string}
                            alt={item.shortName ?? item.name}
                            className="w-10 h-10 object-contain"
                            loading="lazy"
                            onError={() => handleImageError(item.id)}
                          />
                        ) : (
                          <Database className="w-4 h-4 text-muted-foreground/40" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate leading-tight text-foreground">{item.name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground truncate mt-1">{item.id}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className="text-[10px] h-5 px-2 uppercase font-black bg-muted text-muted-foreground">
                            {item.category}
                          </Badge>
                          {item.shortName && item.shortName !== item.name && (
                            <span className="text-[11px] text-muted-foreground italic truncate">{item.shortName}</span>
                          )}
                        </div>
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 h-9 w-9 hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => handleCopy(item.id, item.name)}
                      >
                        {copiedId === item.id
                          ? <Check className="w-4 h-4 text-green-500" />
                          : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  ))}

                  {hiddenCount > 0 && (
                    <p className="text-center text-xs text-muted-foreground py-3">
                      Showing {DISPLAY_LIMIT} of {filteredItems.length} results. Refine search for more precise matches.
                    </p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                  <X className="w-10 h-10 text-muted-foreground/20" />
                  <p className="text-muted-foreground text-sm">
                    {items.length === 0 ? "Waiting for data..." : "No items match your search"}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
