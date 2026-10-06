import { useEffect, useState } from "react";
import { ArrowLeft, Download, ExternalLink, Loader2, Search, Heart, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openExternal, type DirectoryHandleLike } from "@/utils/electronBridge";
import { cn } from "@/lib/utils";

/** Public, read-only Forge API (no key required). */
const FORGE_API = "https://sp-mod.com/api/v0";
const PER_PAGE = 24;

interface ForgeVersion {
  id: number;
  version: string;
  link: string;
  spt_version_constraint?: string;
}
interface ForgeMod {
  id: number;
  name: string;
  teaser?: string;
  thumbnail?: string;
  downloads: number;
  favourites_count?: number;
  detail_url: string;
  fika_compatibility?: boolean;
  featured?: boolean;
  owner?: { name: string };
  versions?: ForgeVersion[];
  category?: { title: string };
}

interface ModBrowserProps {
  onBack: () => void;
  rootDirHandle?: DirectoryHandleLike | null;
}

const SORTS = [
  { value: "-updated_at", label: "Recently updated" },
  { value: "-downloads", label: "Most downloaded" },
  { value: "-created_at", label: "Newest" },
  { value: "name", label: "Name A–Z" },
];

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

export const ModBrowser = ({ onBack }: ModBrowserProps) => {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("-updated_at");
  const [page, setPage] = useState(1);
  const [mods, setMods] = useState<ForgeMod[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({ per_page: String(PER_PAGE), page: String(page), sort, include: "versions,category" });
    if (query) params.set("filter[name]", query);
    setLoading(true);
    setError(null);
    fetch(`${FORGE_API}/mods?${params}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Forge returned ${r.status}`);
        const json = await r.json();
        if (!json.success) throw new Error("Forge request failed");
        setMods(json.data ?? []);
        setLastPage(json.meta?.last_page ?? 1);
        setTotal(json.meta?.total ?? 0);
      })
      .catch((e) => { if (e.name !== "AbortError") { console.error("[ModBrowser]", e); setError(e.message || "Could not reach Forge"); } })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [query, sort, page]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border/40 bg-card/60 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8" title="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold leading-tight text-foreground">Mod Browser</h1>
            <p className="text-[10px] text-muted-foreground">{total.toLocaleString()} mods on The Forge</p>
          </div>
          <div className="relative ml-auto w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search mods..." className="h-9 rounded-lg border-border/50 bg-muted/20 pl-9" />
          </div>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="h-9 rounded-lg border border-border/50 bg-muted/20 px-2 text-xs"
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? (
          <div className="mx-auto mt-16 max-w-md rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-center">
            <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
            <p className="font-semibold text-foreground">Couldn't load mods</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button size="sm" className="mt-4" onClick={() => setPage((p) => p)}>Try again</Button>
          </div>
        ) : loading && mods.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading mods...</div>
        ) : mods.length === 0 ? (
          <p className="mt-16 text-center text-sm text-muted-foreground">No mods match "{query}".</p>
        ) : (
          <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 transition-opacity", loading && "opacity-50")}>
            {mods.map((m) => {
              const latest = m.versions?.[0];
              return (
                <article key={m.id} className="flex flex-col overflow-hidden rounded-xl border border-border/40 bg-card/50 transition-colors hover:border-primary/40">
                  <div className="aspect-[16/7] w-full overflow-hidden bg-muted/30">
                    {m.thumbnail && <img src={m.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <div className="flex items-start gap-2">
                      <h2 className="font-display line-clamp-1 flex-1 text-sm font-bold text-foreground" title={m.name}>{m.name}</h2>
                      {m.featured && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">Featured</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {m.owner?.name ?? "Unknown"}{m.category ? ` · ${m.category.title}` : ""}
                    </p>
                    {m.teaser && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{m.teaser}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                      {latest && <span className="rounded border border-border/50 bg-muted/20 px-1.5 py-0.5 font-mono">v{latest.version}</span>}
                      {latest?.spt_version_constraint?.trim() && (
                        <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-primary">SPT {latest.spt_version_constraint.trim()}</span>
                      )}
                      {m.fika_compatibility && <span className="rounded border border-success/30 bg-success/10 px-1.5 py-0.5 text-success">Fika</span>}
                    </div>
                    <div className="mt-auto flex items-center gap-3 pt-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Download className="h-3 w-3" />{fmt(m.downloads)}</span>
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{fmt(m.favourites_count ?? 0)}</span>
                      <div className="ml-auto flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openExternal(m.detail_url)} title="Open on The Forge">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        {latest?.link && (
                          <Button size="sm" className="h-7 gap-1 px-2.5 text-[11px]" onClick={() => openExternal(latest.link)}>
                            <Download className="h-3.5 w-3.5" /> Download
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <footer className="flex shrink-0 items-center justify-center gap-3 border-t border-border/40 bg-card/60 py-2 text-xs">
        <Button size="sm" variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="h-8 gap-1">
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <span className="text-muted-foreground">Page {page} of {lastPage}</span>
        <Button size="sm" variant="ghost" disabled={page >= lastPage || loading} onClick={() => setPage((p) => p + 1)} className="h-8 gap-1">
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </footer>
    </div>
  );
};
