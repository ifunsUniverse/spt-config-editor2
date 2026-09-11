import React, { useState, useEffect, useMemo, useRef } from "react";
import { Database, Search, Copy, Check, X, Loader2, ArrowLeft, Package } from "lucide-react";
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

const DISPLAY_LIMIT = 300;

const HANDBOOK_URLS = [
  "https://raw.githubusercontent.com/sp-tarkov/server/master/project/assets/database/templates/handbook.json",
  "https://cdn.jsdelivr.net/gh/sp-tarkov/server@master/project/assets/database/templates/handbook.json",
];
const LOCALE_URLS = [
  "https://raw.githubusercontent.com/sp-tarkov/server/master/project/assets/database/locales/global/en.json",
  "https://cdn.jsdelivr.net/gh/sp-tarkov/server@master/project/assets/database/locales/global/en.json",
];

interface TarkovItem {
  id: string;
  name: string;
  shortName?: string;
  category: string;
  categoryId: string;
  subCategory: string;
  price: number;
}

interface CategoryInfo {
  id: string;
  name: string;
  count: number;
  sampleIds: string[];
}

// Module-level cache so the data is only downloaded once per session
let cachedItems: TarkovItem[] | null = null;

const iconUrl = (id: string) => `https://assets.tarkov.dev/${id}-icon.webp`;

async function fetchJson(urls: string[], signal: AbortSignal): Promise<any> {
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal, cache: "force-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).hostname}`);
      return await res.json();
    } catch (error) {
      if ((error as any)?.name === "AbortError") throw error;
      console.warn(`Item DB source failed: ${url}`, error);
      lastError = error;
    }
  }
  throw lastError ?? new Error("All item data sources failed");
}

async function loadItems(signal: AbortSignal): Promise<TarkovItem[]> {
  if (cachedItems) return cachedItems;

  const [handbook, locale] = await Promise.all([
    fetchJson(HANDBOOK_URLS, signal),
    fetchJson(LOCALE_URLS, signal) as Promise<Record<string, string>>,
  ]);

  const categories: { Id: string; ParentId: string }[] = handbook.Categories ?? [];
  const parentMap = new Map(categories.map((c) => [c.Id, c.ParentId]));

  const rootOf = (catId: string): string => {
    let current = catId;
    const seen = new Set<string>();
    while (parentMap.has(current) && !seen.has(current)) {
      seen.add(current);
      const parent = parentMap.get(current) as string;
      if (!parentMap.has(parent)) break;
      current = parent;
    }
    return current;
  };

  const items: TarkovItem[] = (handbook.Items ?? [])
    .map((entry: { Id: string; ParentId: string; Price: number }) => {
      const name = locale[`${entry.Id} Name`];
      if (!name) return null;
      const rootId = rootOf(entry.ParentId);
      return {
        id: entry.Id,
        name,
        shortName: locale[`${entry.Id} ShortName`] || undefined,
        categoryId: rootId,
        category: locale[rootId] || "Other",
        subCategory: locale[entry.ParentId] || "",
        price: entry.Price ?? 0,
      } as TarkovItem;
    })
    .filter(Boolean) as TarkovItem[];

  cachedItems = items;
  return items;
}

export const ItemDatabase = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<TarkovItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [brokenIcons, setBrokenIcons] = useState<Record<string, boolean>>({});
  const copiedTimeoutRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);

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

    (async () => {
      setIsLoading(true);
      setFetchError(false);
      try {
        const loaded = await loadItems(controller.signal);
        if (isMounted) setItems(loaded);
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        console.error("Failed to load item database:", error);
        if (isMounted) setFetchError(true);
        toast.error("Database Error", {
          description: "Could not download the item list. Check your internet connection.",
        });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isOpen, items.length]);

  const categories: CategoryInfo[] = useMemo(() => {
    const map = new Map<string, CategoryInfo>();
    for (const item of items) {
      if (!item.category || item.category === "Other") continue;
      const existing = map.get(item.categoryId);
      if (existing) {
        existing.count += 1;
        if (existing.sampleIds.length < 4) existing.sampleIds.push(item.id);
      } else {
        map.set(item.categoryId, {
          id: item.categoryId,
          name: item.category,
          count: 1,
          sampleIds: [item.id],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = debouncedSearch.toLowerCase().trim();
    if (!activeCategory && !query) return [];
    return items.filter((item) => {
      const matchesCategory = !activeCategory || item.categoryId === activeCategory;
      if (!matchesCategory) return false;
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        item.shortName?.toLowerCase().includes(query)
      );
    });
  }, [items, activeCategory, debouncedSearch]);

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

  const activeCategoryName =
    categories.find((c) => c.id === activeCategory)?.name ?? "Search results";

  const showList = activeCategory !== null || debouncedSearch.trim().length > 0;

  const ItemIcon = ({ id, alt, size }: { id: string; alt: string; size: string }) =>
    brokenIcons[id] ? (
      <Package className="w-4 h-4 text-muted-foreground/40" />
    ) : (
      <img
        src={iconUrl(id)}
        alt={alt}
        loading="lazy"
        className={cn(size, "object-contain")}
        onError={() => setBrokenIcons((prev) => ({ ...prev, [id]: true }))}
      />
    );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-primary/20 hover:bg-primary/10">
          <Database className="w-4 h-4 text-primary" />
          <span className="hidden sm:inline">Item DB</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[1200px] w-[96vw] h-[88vh] max-h-[900px] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-3">
              {showList && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    setActiveCategory(null);
                    setSearch("");
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  {showList ? activeCategoryName : "Item Database"}
                </DialogTitle>
                <DialogDescription>
                  {showList
                    ? "Click the copy icon to grab an item ID formatted for configs."
                    : "Pick a category to browse items, or search across everything."}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="secondary" className="h-5 px-2">{items.length} items</Badge>
              {showList && (
                <Badge variant="outline" className="h-5 px-2">{filteredItems.length} shown</Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pt-3 pb-3 shrink-0 border-b border-border bg-card/20">
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={showList ? "Filter items..." : "Search all items or IDs..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted/30 border-border text-foreground h-10"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Loading item database...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <X className="w-10 h-10 text-destructive/40" />
              <p className="text-sm text-muted-foreground">Could not load the item list.</p>
              <Button size="sm" variant="outline" onClick={() => { cachedItems = null; setItems([]); }}>
                Retry
              </Button>
            </div>
          ) : !showList ? (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className="group text-left rounded-lg border border-border bg-card/40 hover:border-primary/50 hover:bg-accent/10 transition-all p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-semibold text-foreground truncate">{cat.name}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{cat.count}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {cat.sampleIds.map((id) => (
                      <div
                        key={id}
                        className="w-11 h-11 rounded-md bg-muted/20 border border-border/40 flex items-center justify-center overflow-hidden"
                      >
                        <ItemIcon id={id} alt={cat.name} size="w-9 h-9" />
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : visibleItems.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_110px_120px_44px] items-center gap-3 px-3 py-2 bg-muted/20 border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>Item</span>
                <span className="text-right">Handbook</span>
                <span className="text-right">Category</span>
                <span />
              </div>
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_110px_120px_44px] items-center gap-3 px-3 py-2 border-b border-border/60 last:border-b-0 hover:bg-accent/10 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 w-10 h-10 rounded-md bg-muted/20 border border-border/40 flex items-center justify-center overflow-hidden">
                      <ItemIcon id={item.id} alt={item.shortName ?? item.name} size="w-8 h-8" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">{item.name}</p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">{item.id}</p>
                    </div>
                  </div>
                  <span className="text-right text-sm text-foreground/80 tabular-nums">
                    {item.price ? `${item.price.toLocaleString()} ₽` : "—"}
                  </span>
                  <span className="text-right text-[11px] text-muted-foreground truncate">
                    {item.subCategory || item.category}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-primary hover:text-primary-foreground"
                    onClick={() => handleCopy(item.id, item.name)}
                  >
                    {copiedId === item.id ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
              {hiddenCount > 0 && (
                <p className="text-center text-xs text-muted-foreground py-3">
                  Showing {DISPLAY_LIMIT} of {filteredItems.length} results. Refine your search for more.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <X className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-muted-foreground text-sm">No items match your search</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
