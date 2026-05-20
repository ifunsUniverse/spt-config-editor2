import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  KeyRound,
  Search,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstalledMods } from "@/components/InstalledMods";
import { toast } from "sonner";
import { DirectoryHandleLike, openExternal, selectFolder } from "@/utils/electronBridge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModVersion {
  version: string;
  releasedAt: string;
  downloadUrl?: string;
}

interface ModDependency {
  name: string;
  versionConstraint?: string;
}

interface BrowsableMod {
  id: string;
  name: string;
  author: string;
  description: string;
  thumbnail?: string;
  versions: ModVersion[];
  dependencies: ModDependency[];
  sptVersion?: string;
  totalDownloads?: number;
  category?: string;
}

interface ApiKeyPermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

interface ModBrowserProps {
  onBack: () => void;
  rootDirHandle?: DirectoryHandleLike | null;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const getNestedValue = (value: unknown, path: Array<string | number>): unknown => {
  let current: unknown = value;
  for (const segment of path) {
    if (!isRecord(current) && !Array.isArray(current)) return undefined;
    current = (current as UnknownRecord | unknown[])[segment as keyof UnknownRecord];
  }
  return current;
};

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  const message = getNestedValue(error, ["message"]);
  return typeof message === "string" && message.trim() ? message : fallback;
};

interface ForgeApiResponse {
  data?: unknown;
  meta?: unknown;
}

const FORGE_API_BASE = "https://forge.sp-tarkov.com/api/v0";
const MODS_PER_PAGE = 15;
const DEFAULT_PERMISSIONS: ApiKeyPermissions = {
  create: false,
  read: true,
  update: false,
  delete: false,
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return `Today at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (diffDays === 1) return `Yesterday at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function normalizeModLookup(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDependencyEntry(raw: unknown): ModDependency | null {
  if (!raw) return null;

  if (typeof raw === "string") {
    const name = toNonEmptyString(raw);
    return name ? { name } : null;
  }

  if (typeof raw !== "object") return null;

  const name = [
    getNestedValue(raw, ["name"]),
    getNestedValue(raw, ["mod_name"]),
    getNestedValue(raw, ["slug"]),
    getNestedValue(raw, ["package"]),
    getNestedValue(raw, ["mod", "name"]),
    getNestedValue(raw, ["mod", "slug"]),
    getNestedValue(raw, ["target", "name"]),
    getNestedValue(raw, ["target", "slug"]),
    getNestedValue(raw, ["related_mod", "name"]),
    getNestedValue(raw, ["dependency", "name"]),
    getNestedValue(raw, ["attributes", "name"]),
  ]
    .map((candidate) => toNonEmptyString(candidate))
    .find((candidate): candidate is string => Boolean(candidate));

  if (!name) return null;

  const versionConstraint = [
    getNestedValue(raw, ["version_constraint"]),
    getNestedValue(raw, ["constraint"]),
    getNestedValue(raw, ["required_version"]),
    getNestedValue(raw, ["semver"]),
    getNestedValue(raw, ["version"]),
    getNestedValue(raw, ["mod", "version_constraint"]),
    getNestedValue(raw, ["attributes", "version_constraint"]),
  ]
    .map((candidate) => toNonEmptyString(candidate))
    .find((candidate): candidate is string => Boolean(candidate));

  return { name, versionConstraint };
}

function extractModDependencies(mod: unknown): ModDependency[] {
  const result: ModDependency[] = [];
  const seen = new Set<string>();

  const pushDependency = (dep: ModDependency | null) => {
    if (!dep) return;
    const key = `${dep.name.toLowerCase()}::${dep.versionConstraint || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(dep);
  };

  const fromDependencies = isRecord(mod) && Array.isArray(mod.dependencies) ? mod.dependencies : [];
  for (const dep of fromDependencies) {
    pushDependency(parseDependencyEntry(dep));
  }

  const fromRelationships = isRecord(mod) && Array.isArray(mod.relationships) ? mod.relationships : [];
  for (const rel of fromRelationships) {
    if (!rel) continue;

    const relationTokens = [
      getNestedValue(rel, ["type"]),
      getNestedValue(rel, ["relationship_type"]),
      getNestedValue(rel, ["relationship"]),
      getNestedValue(rel, ["kind"]),
      getNestedValue(rel, ["attributes", "type"]),
      getNestedValue(rel, ["attributes", "relationship"]),
    ]
      .map((token) => toNonEmptyString(token)?.toLowerCase() || "")
      .filter(Boolean);

    const hasRelationHint = relationTokens.length > 0;
    const isDependencyRelation = relationTokens.some((token) => /depend|require/.test(token));
    if (hasRelationHint && !isDependencyRelation) {
      continue;
    }

    pushDependency(
      parseDependencyEntry(
        getNestedValue(rel, ["dependency"]) ||
          getNestedValue(rel, ["mod"]) ||
          getNestedValue(rel, ["target"]) ||
          getNestedValue(rel, ["related_mod"]) ||
          rel
      )
    );
  }

  return result;
}

function getVisiblePages(currentPage: number, totalPages: number, maxVisible = 7): number[] {
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  const pages: number[] = [];
  for (let i = start; i <= end; i += 1) {
    pages.push(i);
  }
  return pages;
}

function useMods(apiKey: string | null, page: number, searchQuery: string, sortBy: string, pageSize: number) {
  const [mods, setMods] = useState<BrowsableMod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const fetchMods = useCallback(async () => {
    if (!apiKey) {
      setMods([]);
      setTotalPages(1);
      setTotalResults(0);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(pageSize),
        include: "versions,category",
      });

      if (searchQuery.trim()) {
        params.set("query", searchQuery.trim());
      }

      switch (sortBy) {
        case "name":
          params.set("sort", "name");
          break;
        case "downloads":
        case "recent":
        default:
          params.set("sort", "-updated_at");
          break;
      }

      const response = await fetch(`${FORGE_API_BASE}/mods?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error("Invalid or expired API key. Please re-enter your key.");
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const json = (await response.json()) as ForgeApiResponse;
      const rawMods = Array.isArray(json.data) ? json.data : [];
      const meta = isRecord(json.meta) ? json.meta : {};

      const mapped: BrowsableMod[] = rawMods.map((mod) => {
        const modRecord = isRecord(mod) ? mod : {};
        const rawVersions = Array.isArray(modRecord.versions) ? modRecord.versions : [];

        const versions: ModVersion[] = rawVersions
          .map((versionEntry) => {
            const versionRecord = isRecord(versionEntry) ? versionEntry : {};
            return {
              version: toNonEmptyString(versionRecord.version) || "unknown",
              releasedAt:
                toNonEmptyString(versionRecord.published_at) ||
                toNonEmptyString(versionRecord.created_at) ||
                "",
              downloadUrl: toNonEmptyString(versionRecord.link) || "",
            };
          })
          .sort((a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime());

        const totalDownloads = Number(modRecord.downloads || 0);
        const firstRawVersion = rawVersions[0];
        const firstVersionRecord = isRecord(firstRawVersion) ? firstRawVersion : {};

        return {
          id: String(modRecord.id || ""),
          name: toNonEmptyString(modRecord.name) || "Unknown Mod",
          author: toNonEmptyString(getNestedValue(modRecord, ["owner", "name"])) || "Unknown",
          description: toNonEmptyString(modRecord.teaser) || toNonEmptyString(modRecord.description) || "",
          thumbnail: toNonEmptyString(modRecord.thumbnail) || undefined,
          versions,
          dependencies: extractModDependencies(modRecord),
          sptVersion: toNonEmptyString(firstVersionRecord.spt_version_constraint) || undefined,
          totalDownloads: Number.isFinite(totalDownloads) ? totalDownloads : 0,
          category: toNonEmptyString(getNestedValue(modRecord, ["category", "name"])) || undefined,
        };
      });

      const total = Number(meta.total ?? mapped.length ?? 0);
      const pages = Number(meta.last_page ?? Math.max(1, Math.ceil(total / pageSize)));

      setMods(mapped);
      setTotalResults(total);
      setTotalPages(Math.max(1, pages));
    } catch (err: unknown) {
      if (isAbortError(err)) {
        return;
      }
      setError(getErrorMessage(err, "Failed to fetch mods"));
      setMods([]);
      setTotalPages(1);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }

    return () => controller.abort();
  }, [apiKey, page, pageSize, searchQuery, sortBy]);

  useEffect(() => {
    void fetchMods();
  }, [fetchMods]);

  return { mods, isLoading, error, totalPages, totalResults };
}

function getInstalledVersion(_modName: string): string | null {
  return null;
}

export const ModBrowser = ({ onBack, rootDirHandle }: ModBrowserProps) => {
  const [activeTab, setActiveTab] = useState("browse");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState("1");

  const [pageSize, setPageSize] = useState<number>(() => {
    const raw = localStorage.getItem("spt-mod-browser-page-size");
    const parsed = raw ? Number(raw) : MODS_PER_PAGE;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : MODS_PER_PAGE;
  });

  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem("spt-mod-browser-api-key"));
  const [permissions, setPermissions] = useState<ApiKeyPermissions>(() => {
    try {
      const raw = localStorage.getItem("spt-mod-browser-api-permissions");
      return raw ? JSON.parse(raw) : DEFAULT_PERMISSIONS;
    } catch {
      return DEFAULT_PERMISSIONS;
    }
  });

  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showDependencyDialog, setShowDependencyDialog] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [permissionsInput, setPermissionsInput] = useState<ApiKeyPermissions>(permissions);
  const [pluginsPath, setPluginsPath] = useState<string | null>(() => localStorage.getItem("spt-plugins-folder-name"));
  const [pendingDependencyMod, setPendingDependencyMod] = useState<BrowsableMod | null>(null);
  const [isInstallingWithDependencies, setIsInstallingWithDependencies] = useState(false);

  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const listViewportRef = useRef<HTMLDivElement | null>(null);
  const downloadTimeoutsRef = useRef<number[]>([]);

  const { mods, isLoading, error, totalPages, totalResults } = useMods(
    apiKey,
    currentPage,
    debouncedSearch,
    sortBy,
    pageSize,
  );

  const visibleStart = totalResults === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const visibleEnd = Math.min(currentPage * pageSize, totalResults);

  const pages = useMemo(() => getVisiblePages(currentPage, totalPages), [currentPage, totalPages]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    localStorage.setItem("spt-mod-browser-page-size", String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    setJumpPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    listViewportRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage, debouncedSearch, sortBy, pageSize]);

  useEffect(() => {
    return () => {
      for (const timeoutId of downloadTimeoutsRef.current) {
        window.clearTimeout(timeoutId);
      }
      downloadTimeoutsRef.current = [];
    };
  }, []);

  const handleSaveApiKey = () => {
    const key = apiKeyInput.trim();
    if (!key) return;

    localStorage.setItem("spt-mod-browser-api-key", key);
    localStorage.setItem("spt-mod-browser-api-permissions", JSON.stringify(permissionsInput));

    setApiKey(key);
    setPermissions(permissionsInput);
    setShowApiKeyDialog(false);
    toast.success("API key saved");
  };

  const handleClearApiKey = () => {
    localStorage.removeItem("spt-mod-browser-api-key");
    localStorage.removeItem("spt-mod-browser-api-permissions");

    setApiKey(null);
    setApiKeyInput("");
    setPermissions(DEFAULT_PERMISSIONS);
    setPermissionsInput(DEFAULT_PERMISSIONS);
    setCurrentPage(1);

    toast.success("API key cleared");
  };

  const handleSelectPluginsFolder = async () => {
    try {
      const result = await selectFolder();
      if (result.canceled || !result.handle) return;

      localStorage.setItem("spt-plugins-folder-name", result.handle.name);
      setPluginsPath(result.handle.name);
      toast.success("Plugins folder set", { description: result.handle.name });
    } catch (err: unknown) {
      if (!isAbortError(err)) {
        toast.error("Failed to set folder");
      }
    }
  };

  const resolveLatestDownloadUrl = useCallback(
    async (mod: BrowsableMod): Promise<string> => {
      const downloadUrl = mod.versions[0]?.downloadUrl || "";
      if (downloadUrl) return downloadUrl;
      if (!apiKey) return "";

      const versionsRes = await fetch(
        `${FORGE_API_BASE}/mod/${mod.id}/versions?fields=id,version,link&per_page=1&sort=-published_at`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        },
      );

      if (!versionsRes.ok) return "";
      const versionsJson = await versionsRes.json();
      return versionsJson.data?.[0]?.link || "";
    },
    [apiKey],
  );

  const resolveDependencyDownloadUrl = useCallback(
    async (dependency: ModDependency): Promise<string> => {
      if (!apiKey) return "";

      const params = new URLSearchParams({
        query: dependency.name,
        per_page: "10",
        include: "versions",
      });

      const response = await fetch(`${FORGE_API_BASE}/mods?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) return "";

      const json = (await response.json()) as ForgeApiResponse;
      const candidates = Array.isArray(json.data) ? json.data : [];
      if (candidates.length === 0) return "";

      const depNorm = normalizeModLookup(dependency.name);
      const ranked = [...candidates].sort((a, b) => {
        const score = (candidate: unknown) => {
          const candidateRecord = isRecord(candidate) ? candidate : {};
          const name = String(candidateRecord.name || "");
          const norm = normalizeModLookup(name);
          let s = 0;
          if (norm === depNorm) s += 100;
          if (name.toLowerCase() === dependency.name.toLowerCase()) s += 80;
          if (norm.includes(depNorm) || depNorm.includes(norm)) s += 30;
          s += Math.min(Number(candidateRecord.downloads || 0), 1_000_000) / 1_000_000;
          return s;
        };

        return score(b) - score(a);
      });

      const best = isRecord(ranked[0]) ? ranked[0] : {};
      const bestVersions = Array.isArray(best.versions) ? best.versions : [];
      const firstBestVersion = isRecord(bestVersions[0]) ? bestVersions[0] : {};
      const inlineLink = toNonEmptyString(firstBestVersion.link);
      if (inlineLink) return inlineLink;

      if (!best.id) return "";
      const versionsRes = await fetch(
        `${FORGE_API_BASE}/mod/${best.id}/versions?fields=id,version,link&per_page=1&sort=-published_at`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
        },
      );

      if (!versionsRes.ok) return "";
      const versionsJson = await versionsRes.json();
      return versionsJson.data?.[0]?.link || "";
    },
    [apiKey],
  );

  const withDownloadState = async (modId: string, action: () => Promise<void>) => {
    setDownloadingIds((prev) => {
      const next = new Set(prev);
      next.add(modId);
      return next;
    });

    try {
      await action();
    } finally {
      const timeoutId = window.setTimeout(() => {
        setDownloadingIds((prev) => {
          const next = new Set(prev);
          next.delete(modId);
          return next;
        });
      }, 1200);

      downloadTimeoutsRef.current.push(timeoutId);
    }
  };

  const handleDownload = async (mod: BrowsableMod) => {
    await withDownloadState(mod.id, async () => {
      try {
        const downloadUrl = await resolveLatestDownloadUrl(mod);

        if (!downloadUrl) {
          toast.error("No download link available for this mod.");
          return;
        }

        void openExternal(downloadUrl);
        toast.success(`Downloading "${mod.name}"`);
      } catch (err: unknown) {
        toast.error("Download failed", { description: getErrorMessage(err, "Could not start download") });
      }
    });
  };

  const handleDownloadClick = (mod: BrowsableMod) => {
    if (mod.dependencies.length === 0) {
      void handleDownload(mod);
      return;
    }

    setPendingDependencyMod(mod);
    setShowDependencyDialog(true);
  };

  const handleInstallWithDependencies = async () => {
    const mod = pendingDependencyMod;
    if (!mod) return;

    setIsInstallingWithDependencies(true);

    await withDownloadState(mod.id, async () => {
      try {
        const dependencyUrls: string[] = [];
        const unresolvedDependencies: string[] = [];

        for (const dependency of mod.dependencies) {
          const dependencyUrl = await resolveDependencyDownloadUrl(dependency);
          if (dependencyUrl) {
            dependencyUrls.push(dependencyUrl);
          } else {
            unresolvedDependencies.push(
              dependency.versionConstraint ? `${dependency.name} ${dependency.versionConstraint}` : dependency.name,
            );
          }
        }

        const modUrl = await resolveLatestDownloadUrl(mod);

        if (!modUrl && dependencyUrls.length === 0) {
          toast.error("No download links were available for this selection.");
          return;
        }

        for (const url of dependencyUrls) {
          void openExternal(url);
        }
        if (modUrl) {
          void openExternal(modUrl);
        }

        if (unresolvedDependencies.length > 0) {
          toast.warning("Some dependencies could not be auto-resolved", {
            description: unresolvedDependencies.slice(0, 3).join(", "),
          });
        }

        const totalStarted = dependencyUrls.length + (modUrl ? 1 : 0);
        toast.success(`Started ${totalStarted} download${totalStarted === 1 ? "" : "s"}.`);

        setShowDependencyDialog(false);
        setPendingDependencyMod(null);
      } catch (err: unknown) {
        toast.error("Install with dependencies failed", {
          description: getErrorMessage(err, "Could not start downloads"),
        });
      } finally {
        setIsInstallingWithDependencies(false);
      }
    });
  };

  const handleJumpToPage = () => {
    const parsed = Number(jumpPageInput);
    if (!Number.isFinite(parsed)) return;

    const bounded = Math.min(Math.max(1, Math.floor(parsed)), totalPages);
    setCurrentPage(bounded);
  };

  const renderModCard = (mod: BrowsableMod) => {
    const latestVersion = mod.versions[0];
    const installedVersion = getInstalledVersion(mod.name);
    const needsUpdate = installedVersion && latestVersion && installedVersion !== latestVersion.version;
    const isDownloading = downloadingIds.has(mod.id);

    return (
      <div
        key={mod.id}
        className="group flex min-h-[152px] overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/30"
      >
        <div className="w-[110px] shrink-0 bg-muted/30 flex items-center justify-center overflow-hidden">
          {mod.thumbnail ? (
            <img src={mod.thumbnail} alt={mod.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-4xl font-bold text-muted-foreground/20 select-none">{mod.name.charAt(0)}</span>
          )}
        </div>

        <div className="flex-1 p-3 min-w-0 flex flex-col gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate">
              {mod.name} <span className="font-normal text-muted-foreground">{latestVersion?.version}</span>
            </h3>
            <p className="text-xs text-muted-foreground">by {mod.author}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {mod.sptVersion && (
              <Badge className="bg-emerald-700/80 text-emerald-100 hover:bg-emerald-700 border-0 text-[10px] px-1.5 py-0">
                SPT {mod.sptVersion}
              </Badge>
            )}
            {mod.category && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {mod.category}
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground line-clamp-2">{mod.description}</p>

          {mod.dependencies.length > 0 && (
            <div className="rounded-md border border-border/70 bg-muted/20 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dependencies</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {mod.dependencies.slice(0, 3).map((dep) => (
                  <Badge key={`${mod.id}-${dep.name}-${dep.versionConstraint || ""}`} variant="outline" className="text-[10px] h-5 px-1.5">
                    {dep.name}
                    {dep.versionConstraint ? ` ${dep.versionConstraint}` : ""}
                  </Badge>
                ))}
                {mod.dependencies.length > 3 && (
                  <span className="text-[10px] text-muted-foreground self-center">+{mod.dependencies.length - 3} more</span>
                )}
              </div>
            </div>
          )}

          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {latestVersion?.releasedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(latestVersion.releasedAt)}
                </span>
              )}
              {typeof mod.totalDownloads === "number" && (
                <span className="flex items-center gap-1">
                  {formatDownloads(mod.totalDownloads)}
                  <ArrowDownToLine className="w-3 h-3" />
                </span>
              )}
            </div>

            <Button
              size="sm"
              variant={needsUpdate ? "default" : "outline"}
              className="h-7 px-3 text-xs gap-1.5"
              disabled={isDownloading}
              onClick={() => handleDownloadClick(mod)}
            >
              <Download className="w-3 h-3" />
              {isDownloading ? "Downloading..." : needsUpdate ? "Update" : "Download"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full min-h-0 bg-background flex flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-3 py-2.5 sm:px-4 sm:py-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Mod Browser</h1>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettingsDialog(true)} className="gap-1.5 text-xs px-2 sm:px-3">
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setApiKeyInput(apiKey || "");
              setPermissionsInput(permissions);
              setShowApiKeyDialog(true);
            }}
            className="gap-1.5 text-xs px-2 sm:px-3"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{apiKey ? "API Key" : "Set API Key"}</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="shrink-0 px-3 pt-2 sm:px-4">
          <TabsList>
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="installed">Installed Mods</TabsTrigger>
          </TabsList>
        </div>

        {activeTab === "browse" && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-4 sm:py-2.5">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search mods..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>

              <Select value={sortBy} onValueChange={(value) => {
                setSortBy(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[140px] h-9 text-xs shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="downloads">Most Downloads</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                </SelectContent>
              </Select>

              <Select value={String(pageSize)} onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[110px] h-9 text-xs shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="15">15 / page</SelectItem>
                  <SelectItem value="30">30 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground sm:px-4">
              <span>
                {apiKey && !isLoading && !error
                  ? `Showing ${visibleStart}-${visibleEnd} of ${totalResults} mods`
                  : "Browsing mods from Forge"
                }
              </span>
              {apiKey && !isLoading && !error && totalPages > 1 && (
                <span>Page {currentPage} / {totalPages}</span>
              )}
            </div>

            <div ref={listViewportRef} className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
              {!apiKey ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 text-center">
                  <KeyRound className="w-12 h-12 text-muted-foreground/30" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">API Key Required</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      Create an API key on Forge and paste it here to browse mods.
                    </p>
                  </div>
                  <Button onClick={() => setShowApiKeyDialog(true)} className="gap-2">
                    <KeyRound className="w-4 h-4" />
                    Enter API Key
                  </Button>
                </div>
              ) : isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {Array.from({ length: pageSize }).slice(0, 8).map((_, i) => (
                    <div key={i} className="h-[170px] flex rounded-lg border border-border bg-card overflow-hidden">
                      <Skeleton className="w-[110px] h-full shrink-0 rounded-none" />
                      <div className="flex-1 p-3 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-7 w-24 mt-2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 text-center">
                  <p className="text-destructive font-medium">{error}</p>
                  <Button variant="outline" onClick={() => setShowApiKeyDialog(true)}>Re-enter API Key</Button>
                </div>
              ) : mods.length === 0 ? (
                <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                  No mods found matching "{search}"
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 pb-3 md:grid-cols-2 xl:grid-cols-3">
                  {mods.map(renderModCard)}
                </div>
              )}
            </div>

            {apiKey && !isLoading && !error && totalPages > 1 && (
              <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-border px-3 py-2.5 sm:px-4">
                <Button variant="ghost" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)} className="text-xs">
                  First
                </Button>
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className="gap-1 text-xs">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </Button>

                <div className="flex items-center gap-1">
                  {pages[0] > 1 && (
                    <>
                      <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-xs" onClick={() => setCurrentPage(1)}>
                        1
                      </Button>
                      {pages[0] > 2 && <span className="text-xs text-muted-foreground px-1">…</span>}
                    </>
                  )}

                  {pages.map((page) => (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "ghost"}
                      size="sm"
                      className="w-8 h-8 p-0 text-xs"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}

                  {pages[pages.length - 1] < totalPages && (
                    <>
                      {pages[pages.length - 1] < totalPages - 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                      <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-xs" onClick={() => setCurrentPage(totalPages)}>
                        {totalPages}
                      </Button>
                    </>
                  )}
                </div>

                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="gap-1 text-xs">
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} className="text-xs">
                  Last
                </Button>

                <div className="ml-2 flex items-center gap-1.5">
                  <Input
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleJumpToPage();
                      }
                    }}
                    className="h-8 w-16 text-xs"
                    inputMode="numeric"
                    aria-label="Jump to page"
                  />
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleJumpToPage}>
                    Go
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "installed" && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <InstalledMods rootDirHandle={rootDirHandle} />
          </div>
        )}
      </Tabs>

      <Dialog
        open={showDependencyDialog}
        onOpenChange={(open) => {
          if (!isInstallingWithDependencies) {
            setShowDependencyDialog(open);
            if (!open) {
              setPendingDependencyMod(null);
            }
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Required Dependencies Found</DialogTitle>
            <DialogDescription>
              {pendingDependencyMod?.name} has required dependencies. Install the mod together with its dependencies?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-muted/20 p-3 max-h-64 overflow-auto">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Dependencies</p>
              {pendingDependencyMod?.dependencies?.map((dependency) => (
                <div key={`${pendingDependencyMod.id}-${dependency.name}-${dependency.versionConstraint || ""}`} className="text-sm py-1 border-b last:border-b-0 border-border/50">
                  <span className="font-medium text-foreground">{dependency.name}</span>
                  {dependency.versionConstraint && (
                    <span className="text-muted-foreground"> {dependency.versionConstraint}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDependencyDialog(false);
                  setPendingDependencyMod(null);
                }}
                disabled={isInstallingWithDependencies}
              >
                Cancel
              </Button>
              <Button onClick={handleInstallWithDependencies} disabled={isInstallingWithDependencies}>
                {isInstallingWithDependencies ? "Installing..." : "Install Mod + Dependants"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              API Key
            </DialogTitle>
            <DialogDescription>
              Create your API key on the SPT Forge site and paste it here. Do not share your key.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Paste your API key..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveApiKey();
                }
              }}
            />

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">API Key Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["create", "read", "update", "delete"] as const).map((perm) => (
                  <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={permissionsInput[perm]}
                      onCheckedChange={(checked) =>
                        setPermissionsInput((prev) => ({ ...prev, [perm]: !!checked }))
                      }
                    />
                    <span className="capitalize">{perm}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Match these with the permission flags you enabled when creating your key.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()} className="flex-1">
                Save Key
              </Button>
              {apiKey && (
                <Button variant="destructive" onClick={handleClearApiKey}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Mod Browser Settings
            </DialogTitle>
            <DialogDescription>
              Configure your BepInEx plugins folder for browsing installed mods.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">BepInEx Plugins Folder</Label>
              <div className="flex gap-2">
                <Input readOnly value={pluginsPath || "Not set"} className="text-xs bg-muted/30" />
                <Button variant="outline" size="sm" onClick={handleSelectPluginsFolder} className="shrink-0">
                  Browse
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Usually: SPT/BepInEx/plugins</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
