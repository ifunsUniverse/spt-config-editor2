import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { PathSelector } from "@/components/PathSelector";
import { FeatureSelect } from "@/components/FeatureSelect";
import { ModBrowser } from "@/components/ModBrowser";
import { CommunityHub } from "@/components/CommunityHub";
import { ModList, Mod, ConfigFile } from "@/components/ModList";
import { ConfigEditor } from "@/components/ConfigEditor";
import { SPTControlPanel } from "@/components/SPTControlPanel";
import { ConfigValue } from "@/utils/configHelpers";
import { CategoryBrowser } from "@/components/CategoryBrowser";
import { ConfigValidationSummary } from "@/components/ConfigValidationSummary";
import { CategoryDialog } from "@/components/CategoryDialog";
import { scanSPTFolderElectron, ElectronScannedMod, saveConfigToFileElectron, saveScanCache, loadScanCache } from "@/utils/electronFolderScanner";
import { DirectoryHandleLike, loadLastSelectedFolder, rememberLastSelectedFolder } from "@/utils/electronBridge";
import { exportModsAsZip } from "@/utils/exportMods";
import { saveEditHistory, getEditHistory, getModEditTime } from "@/utils/editTracking";
import { 
  loadCategories, 
  assignModToCategory, 
  removeModFromCategory,
  getModCategory
} from "@/utils/categoryStorage";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/integrations/supabase/AuthProvider";
import { loadAppSettings, type AppSettings } from "@/utils/appSettings";
import { toast } from "sonner";
import { Package, Download, Upload, Trash2, FolderOpen, Menu, LogOut, Loader2, ArrowLeft, Crown, Sparkles, UserRoundPen } from "lucide-react";
import JSON5 from "json5";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const OWNER_EMAILS = new Set(
  String(import.meta.env.VITE_OWNER_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const OWNER_USERNAMES = new Set(
  String(import.meta.env.VITE_OWNER_USERNAMES ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

function resolveUsername(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): string {
  if (!user) return "Anonymous";

  const rawUsername = user.user_metadata?.username;
  if (typeof rawUsername === "string" && rawUsername.trim().length > 0) {
    return rawUsername.trim();
  }

  const rawDisplayName = user.user_metadata?.display_name;
  if (typeof rawDisplayName === "string" && rawDisplayName.trim().length > 0) {
    return rawDisplayName.trim();
  }

  const rawFullName = user.user_metadata?.full_name;
  if (typeof rawFullName === "string" && rawFullName.trim().length > 0) {
    return rawFullName.trim();
  }

  const email = typeof user.email === "string" ? user.email.trim() : "";
  if (!email.includes("@")) return "Anonymous";

  const candidate = email.split("@")[0]?.trim();
  return candidate ? candidate : "Anonymous";
}

function isOwnerAccount(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null, username: string): boolean {
  if (!user) return false;

  const role = user.user_metadata?.role;
  if (typeof role === "string" && role.trim().toLowerCase() === "owner") {
    return true;
  }

  const usernameKey = username.trim().toLowerCase();
  if (usernameKey && OWNER_USERNAMES.has(usernameKey)) {
    return true;
  }

  const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (email && OWNER_EMAILS.has(email)) {
    return true;
  }

  return false;
}

function getMetadataString(user: { user_metadata?: Record<string, unknown> } | null, key: string): string {
  if (!user) return "";
  const value = user.user_metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function getGravatarUrlSync(email: string | null | undefined): string {
  if (!email) return "";
  const trimmedEmail = String(email).trim().toLowerCase();
  
  // Simple MD5-like hash using character codes
  // This is not a true MD5 but works for generating consistent Gravatar URLs
  let hash = 0;
  for (let i = 0; i < trimmedEmail.length; i++) {
    const char = trimmedEmail.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const hashStr = Math.abs(hash).toString(16).padStart(32, '0');
  return `https://www.gravatar.com/avatar/${hashStr.substring(0, 32)}?d=identicon&s=32`;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;

const Index = () => {
  const [view, setView] = useState<"pathSelect" | "featureSelect" | "configEditor" | "modBrowser" | "community">("pathSelect");
  const [sptPath, setSptPath] = useState<string | null>(null);
  const [rootDirHandle, setRootDirHandle] = useState<DirectoryHandleLike | null>(null);
  const [selectedModId, setSelectedModId] = useState<string | null>(null);
  const [scannedMods, setScannedMods] = useState<ElectronScannedMod[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningSource, setScanningSource] = useState<"select" | "last" | undefined>(undefined);
  const [openConfigIndices, setOpenConfigIndices] = useState<number[]>([0]);
  const [activeConfigIndex, setActiveConfigIndex] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingModSwitch, setPendingModSwitch] = useState<{ modId: string; configIndex: number } | null>(null);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipCurrentFile, setZipCurrentFile] = useState<string | undefined>(undefined);
  const [zipStartTime, setZipStartTime] = useState<number | null>(null);
  const [showZipProgress, setShowZipProgress] = useState(false);
  const [editedModIds, setEditedModIds] = useState<Set<string>>(new Set());
  const [showZipDialog, setShowZipDialog] = useState(false);
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(loadAppSettings);

  const [favoritedModIds, setFavoritedModIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("spt-favorites");
      const arr = saved ? JSON.parse(saved) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      console.warn("Invalid favorites data in localStorage; resetting.", e);
      localStorage.removeItem("spt-favorites");
      return new Set();
    }
  });
  const [activeTab, setActiveTab] = useState<"mods" | "favorites" | "recent">("mods");
  const [modCategories, setModCategories] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryBrowser, setShowCategoryBrowser] = useState(false);
  const [showValidationSummary, setShowValidationSummary] = useState(false);
  const [categoryTargetModId, setCategoryTargetModId] = useState<string | null>(null);
  const [configErrorIndicesByMod, setConfigErrorIndicesByMod] = useState<Record<string, number[]>>({});
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const { user, loading: authLoading, signOut, updateProfile } = useAuth();
  const accountUsername = useMemo(() => resolveUsername(user), [user]);
  const isOwner = useMemo(() => isOwnerAccount(user, accountUsername), [user, accountUsername]);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const saveConfigRef = useRef<(() => void) | null>(null);
  const hasRestoredSessionRef = useRef(false);
  const hasAutoLoadedFolderRef = useRef(false);

  useEffect(() => {
    const handler = (event: Event) => {
      setAppSettings((event as CustomEvent<AppSettings>).detail);
    };
    window.addEventListener("app-settings-changed", handler);
    return () => window.removeEventListener("app-settings-changed", handler);
  }, []);

  useEffect(() => {
    if (hasRestoredSessionRef.current) return;

    const lastSession = localStorage.getItem("lastSession");

    if (appSettings.rememberLastSession && lastSession && sptPath) {
      try {
        const { modId, configFile } = JSON.parse(lastSession);
        const mod = scannedMods.find(m => m.mod.id === modId);
        if (mod) {
          const configIndex = mod.configs.findIndex(c => c.fileName === configFile);
          if (configIndex >= 0) {
            setSelectedModId(modId);
            setOpenConfigIndices([configIndex]);
            setActiveConfigIndex(configIndex);
            hasRestoredSessionRef.current = true;
          }
        }
      } catch (e) {
        console.error("Failed to restore last session:", e);
      }
    }
  }, [appSettings.rememberLastSession, sptPath, scannedMods]);

  useEffect(() => {
    if (hasAutoLoadedFolderRef.current) return;
    if (!appSettings.autoLoadLastFolderOnLaunch) return;
    if (view !== "pathSelect" || isScanning) return;

    hasAutoLoadedFolderRef.current = true;
    void handleLoadLastFolder();
  }, [appSettings.autoLoadLastFolderOnLaunch, view, isScanning]);

  useEffect(() => {
    let isMounted = true;

    loadCategories()
      .then((categories) => {
        if (isMounted) {
          setModCategories(categories);
        }
      })
      .catch((error) => {
        console.error("Failed to load categories:", error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("spt-favorites", JSON.stringify(Array.from(favoritedModIds)));
  }, [favoritedModIds]);

  useKeyboardShortcuts({
    onSave: () => {
      if (hasUnsavedChanges && saveConfigRef.current) {
        saveConfigRef.current();
        toast.success("Saved via keyboard shortcut");
      }
    },
    onSearch: () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    }
  });

  const mods = useMemo(() => {
    return scannedMods.map(sm => sm.mod);
  }, [scannedMods]);

  const editHistory = getEditHistory();
  const recentlyEditedModIds = [...new Set(editHistory.map(h => h.modId))];

  const filteredModsByCategory = useMemo(() => {
    let result = mods;
    if (selectedCategory) {
      result = result.filter(m => getModCategory(m.id, modCategories) === selectedCategory);
    }
    return result;
  }, [mods, selectedCategory, modCategories]);

  const recentlyEditedMods = mods
    .filter(m => recentlyEditedModIds.includes(m.id))
    .filter(m => !selectedCategory || getModCategory(m.id, modCategories) === selectedCategory)
    .sort((a, b) => {
      const aTime = getModEditTime(a.id) || 0;
      const bTime = getModEditTime(b.id) || 0;
      return bTime - aTime;
    });

  const handleFolderSelected = async (dirHandle: DirectoryHandleLike, opts?: { useCache?: boolean; source?: "select" | "last" }) => {
    setIsScanning(true);
    setScanningSource(opts?.source ?? "select");
    hasRestoredSessionRef.current = false;
    try {
      setConfigErrorIndicesByMod({});
      setRootDirHandle(dirHandle);
      const folderName = dirHandle.name;
      rememberLastSelectedFolder(dirHandle);

      let mods: ElectronScannedMod[];
      let fromCache = false;

      if (opts?.useCache) {
        const cached = await loadScanCache(dirHandle);
        if (cached) {
          mods = cached;
          fromCache = true;
        } else {
          mods = await scanSPTFolderElectron(dirHandle);
          saveScanCache(dirHandle, mods).catch(() => {});
        }
      } else {
        mods = await scanSPTFolderElectron(dirHandle);
        // Always update the cache after a fresh user-initiated scan.
        saveScanCache(dirHandle, mods).catch(() => {});
      }

      if (mods.length === 0) {
        toast.warning("No mods found", {
          description: "No compatible mod configs were found in the user/mods directory"
        });
        return;
      }

      setScannedMods(mods);
      setSptPath(folderName);
      setView("featureSelect");

      toast.success(`Found ${mods.length} mod(s)`, {
        description: `${mods.reduce((sum, m) => sum + m.configs.length, 0)} config files detected${
          fromCache ? " (loaded from cache)" : ""
        }`
      });
    } catch (error: any) {
      toast.error("Scan failed", {
        description: error.message || "Could not scan the folder structure"
      });
    } finally {
      setIsScanning(false);
      setScanningSource(undefined);
    }
  };

  const handleSelectMod = (modId: string, configIndex: number) => {
    const targetMod = scannedMods.find(m => m.mod.id === modId);
    if (!targetMod) return;
    if (!targetMod.configs || targetMod.configs.length === 0) return;

    const safeConfigIndex = Math.max(0, Math.min(configIndex, targetMod.configs.length - 1));
    const isSwitchingToDifferentMod = selectedModId !== modId;

    if (hasUnsavedChanges && isSwitchingToDifferentMod) {
      setPendingModSwitch({ modId, configIndex: safeConfigIndex });
      return;
    }

    setSelectedModId(modId);
    if (isSwitchingToDifferentMod) {
      setOpenConfigIndices([safeConfigIndex]);
      setActiveConfigIndex(safeConfigIndex);
      setHasUnsavedChanges(false);
    } else {
      setOpenConfigIndices(prev =>
        prev.includes(safeConfigIndex) ? prev : [...prev, safeConfigIndex]
      );
      setActiveConfigIndex(safeConfigIndex);
      // Keep unsaved change tracking when staying within the same mod.
    }

    if (isMobile) setIsSidebarOpen(false);
  };

  const handleCloseTab = (index: number) => {
    if (openConfigIndices.length <= 1) return;
    const newIndices = openConfigIndices.filter(i => i !== index);
    setOpenConfigIndices(newIndices);
    if (activeConfigIndex === index) {
      setActiveConfigIndex(newIndices[0]);
    }
  };

  const handleDiscardAndSwitch = () => {
    if (pendingModSwitch) {
      setSelectedModId(pendingModSwitch.modId);
      setOpenConfigIndices([pendingModSwitch.configIndex]);
      setActiveConfigIndex(pendingModSwitch.configIndex);
      setHasUnsavedChanges(false);
      setPendingModSwitch(null);
      if (isMobile) setIsSidebarOpen(false);
    }
  };

  const handleSaveAndSwitch = async () => {
    if (pendingModSwitch && saveConfigRef.current) {
      await saveConfigRef.current();
      setSelectedModId(pendingModSwitch.modId);
      setOpenConfigIndices([pendingModSwitch.configIndex]);
      setActiveConfigIndex(pendingModSwitch.configIndex);
      setHasUnsavedChanges(false);
      setPendingModSwitch(null);
      if (isMobile) setIsSidebarOpen(false);
    }
  };

  const handleSaveConfig = useCallback(async (values: ConfigValue[]) => {
    if (scannedMods.length === 0) {
      setHasUnsavedChanges(false);
      return;
    }

    const selectedMod = scannedMods.find(m => m.mod.id === selectedModId);
    if (!selectedMod) return;

    const config = selectedMod.configs[activeConfigIndex];
    if (!config) return;

    try {
      await saveConfigToFileElectron(config, values, config.rawJson);

      const rawValue = values.find((value) => value.key === "__RAW_JSON__")?.value;
      if (typeof rawValue === "string") {
        try {
          const parsed = JSON5.parse(rawValue);
          setScannedMods((prev) => prev.map((modEntry) => {
            if (modEntry.mod.id !== selectedModId) return modEntry;
            return {
              ...modEntry,
              configs: modEntry.configs.map((entry) =>
                entry.index === activeConfigIndex ? { ...entry, rawJson: parsed } : entry,
              ),
            };
          }));
        } catch {
          // Keep the previous parsed representation if JSON5 parsing unexpectedly fails.
        }
      }

      setHasUnsavedChanges(false);
      if (selectedModId) {
        setEditedModIds((prev) => {
          const next = new Set(prev);
          next.add(selectedModId);
          return next;
        });
        saveEditHistory(selectedModId, config.fileName);
      }

      toast.success("Config saved", {
        description: "Changes have been saved successfully"
      });
    } catch (error: any) {
      toast.error("Save failed", {
        description: error.message || "Could not save the config file"
      });
      throw error;
    }
  }, [scannedMods, selectedModId, activeConfigIndex]);

  const configFilesMap = useMemo(() => {
    const map: Record<string, ConfigFile[]> = {};
    for (const mod of scannedMods) {
      map[mod.mod.id] = mod.configs;
    }
    return map;
  }, [scannedMods]);

  const handleExportMods = () => {
    const modsToExport = scannedMods.filter((m) => editedModIds.has(m.mod.id));
    if (modsToExport.length === 0) {
      toast.info("No edited mods to export", {
        description: "Make some changes and save before exporting.",
      });
      return;
    }
    setShowZipDialog(true);
  };

  const handleExportVersion = async (isFourOhStyle: boolean) => {
    setShowZipProgress(true);
    setZipStartTime(Date.now());
    try {
      const modsToExport = scannedMods.filter((m) => editedModIds.has(m.mod.id));
      await exportModsAsZip(
        modsToExport,
        isFourOhStyle,
        (percent, currentFile) => {
          setZipProgress(percent);
          setZipCurrentFile(currentFile);
        }
      );
      toast.success("Export complete");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export ZIP");
    } finally {
      setShowZipProgress(false);
      setZipProgress(0);
      setZipCurrentFile(undefined);
    }
    setShowZipDialog(false);
  };

  const handleToggleFavorite = (modId: string) => {
    setFavoritedModIds(prev => {
      const newSet = new Set(prev);
      const modName = scannedMods.find(m => m.mod.id === modId)?.mod.name || modId;
      if (newSet.has(modId)) {
        newSet.delete(modId);
        toast.info("Removed from Favorites", { description: `${modName} removed from favorites` });
      } else {
        newSet.add(modId);
        toast.success("Added to Favorites", { description: `${modName} added to favorites` });
      }
      return newSet;
    });
  };

  const handleClearFavorites = () => {
    setFavoritedModIds(new Set());
    toast.success("All favorites cleared");
  };

  const handleHome = () => {
    if (hasUnsavedChanges) {
      setShowHomeConfirm(true);
    } else {
      setView("featureSelect");
    }
  };

  const handleGoHome = () => {
    setView("pathSelect");
    setSptPath(null);
    setRootDirHandle(null);
    setScannedMods([]);
    setSelectedModId(null);
    setOpenConfigIndices([0]);
    setActiveConfigIndex(0);
    setHasUnsavedChanges(false);
    setShowHomeConfirm(false);
    setEditedModIds(new Set());
    toast.info("Returned to home", { description: "Returning to folder selection" });
  };

  const handleExportFavorites = () => {
    const favoritesData = {
      version: "1.0",
      favorites: Array.from(favoritedModIds),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(favoritesData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `spt-favorites-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Favorites exported", { description: "Favorites list downloaded as JSON" });
  };

  const handleImportFavorites = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: any) => {
      try {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.favorites && Array.isArray(data.favorites)) {
          setFavoritedModIds(new Set(data.favorites));
          toast.success("Favorites imported", { description: `${data.favorites.length} favorites loaded` });
        } else {
          throw new Error("Invalid favorites file format");
        }
      } catch (error: any) {
        toast.error("Import failed", { description: error.message || "Could not read favorites file" });
      }
    };
    input.click();
  };

  const handleLoadLastFolder = async () => {
    setIsScanning(true);
    setScanningSource("last");
    try {
      const result = await loadLastSelectedFolder();
      if (result.canceled || !result.handle) return;
      await handleFolderSelected(result.handle, {
        useCache: appSettings.useCacheWhenLoadingLastFolder,
        source: "last"
      });
    } catch (error: any) {
      toast.error("Failed to load folder", {
        description: error.message || "Could not access the selected folder",
      });
    } finally {
      setIsScanning(false);
      setScanningSource(undefined);
    }
  };

  const handleCategoryChange = async (category: string | null) => {
    if (!selectedModId) return;
    if (category) {
      const updated = await assignModToCategory(selectedModId, category, modCategories);
      setModCategories(updated);
    } else {
      const updated = await removeModFromCategory(selectedModId, modCategories);
      setModCategories(updated);
    }
  };

  const handleChangesDetected = useCallback((has: boolean) => {
    setHasUnsavedChanges(has);
    if (has && selectedModId) {
      setEditedModIds((prev) => {
        const next = new Set(prev);
        next.add(selectedModId);
        return next;
      });
    }
  }, [selectedModId]);

  const handleJsonErrorChange = useCallback((modId: string, configIndex: number, hasError: boolean) => {
    setConfigErrorIndicesByMod((prev) => {
      const current = new Set(prev[modId] || []);
      if (hasError) {
        current.add(configIndex);
      } else {
        current.delete(configIndex);
      }

      const next = { ...prev };
      if (current.size === 0) {
        delete next[modId];
      } else {
        next[modId] = Array.from(current).sort((a, b) => a - b);
      }
      return next;
    });
  }, []);

  const handleEditorJsonErrorChange = useCallback((configIndex: number, hasError: boolean) => {
    if (!selectedModId) return;
    handleJsonErrorChange(selectedModId, configIndex, hasError);
  }, [selectedModId, handleJsonErrorChange]);

  const handleFeatureSelect = (feature: "configEditor" | "modBrowser" | "community") => {
    if (feature === "configEditor") {
      if (scannedMods.length > 0) {
        setSelectedModId(scannedMods[0].mod.id);
        setOpenConfigIndices([0]);
        setActiveConfigIndex(0);
      }
      setView("configEditor");
    } else if (feature === "modBrowser") {
      setView("modBrowser");
    } else {
      setView("community");
    }
  };

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const { error } = await signOut();
      if (error) {
        toast.error(`Sign out failed: ${error}`);
        return;
      }
      toast.success("Signed out.");
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut, signOut]);

  const openEditProfileDialog = useCallback(() => {
    if (!user) return;
    setProfileUsername(accountUsername);
    setProfileDisplayName(getMetadataString(user, "display_name"));
    setShowEditProfile(true);
  }, [accountUsername, user]);

  const handleSaveProfile = useCallback(async () => {
    const trimmedUsername = profileUsername.trim();
    const trimmedDisplayName = profileDisplayName.trim();

    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      toast.error("Username must be 3-24 characters and use only letters, numbers, or underscores.");
      return;
    }

    setIsSavingProfile(true);
    try {
      const { error } = await updateProfile({
        username: trimmedUsername,
        displayName: trimmedDisplayName || null,
      });

      if (error) {
        toast.error(`Profile update failed: ${error}`);
        return;
      }

      toast.success("Profile updated.");
      setShowEditProfile(false);
    } finally {
      setIsSavingProfile(false);
    }
  }, [profileDisplayName, profileUsername, updateProfile]);

  const accountControl = (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2 rounded-lg border border-border/70 bg-card/85 px-2.5 py-1.5 backdrop-blur-md">
      {isOwner && (
        <span
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-amber-300/70 bg-amber-400/10 px-2 text-[11px] font-semibold text-amber-700 shadow-[0_0_16px_rgba(251,191,36,0.35)] dark:border-amber-500/50 dark:text-amber-300"
          title="Application Owner"
        >
          <span className="relative inline-flex items-center justify-center">
            <Crown className="h-3.5 w-3.5" />
            <Sparkles className="absolute -right-1 -top-1 h-2.5 w-2.5 text-yellow-500" />
          </span>
          <span className="hidden sm:inline">Owner</span>
        </span>
      )}
      <span className="hidden sm:inline max-w-[180px] truncate text-xs text-muted-foreground" title={accountUsername}>
        {accountUsername}
      </span>
      <Button size="sm" variant="outline" onClick={openEditProfileDialog} className="h-7 gap-1.5 text-xs">
        <UserRoundPen className="h-3.5 w-3.5" />
        Edit Profile
      </Button>
      <Button size="sm" variant="outline" onClick={handleSignOut} disabled={isSigningOut} className="h-7 gap-1.5 text-xs">
        <LogOut className="h-3.5 w-3.5" />
        {isSigningOut ? "Signing Out..." : "Sign Out"}
      </Button>
    </div>
  );

  if (view === "pathSelect") {
    return (
      <PathSelector 
        onFolderSelected={(h) => handleFolderSelected(h, { source: "select" })}
        onLoadLastFolder={handleLoadLastFolder}
        isLoading={isScanning}
        loadingSource={scanningSource}
      />
    );
  }

  if (view === "featureSelect") {
    return (
      <FeatureSelect
        onSelectFeature={handleFeatureSelect}
        onBack={handleGoHome}
        modCount={scannedMods.length}
      />
    );
  }

  if (view === "modBrowser") {
    return (
      <ModBrowser onBack={() => setView("featureSelect")} rootDirHandle={rootDirHandle} />
    );
  }

  if (view === "community") {
    if (authLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Checking community access...
          </div>
        </div>
      );
    }

    if (!user) {
      return (
        <div className="relative">
          <div className="fixed left-3 top-3 z-50">
            <Button variant="outline" size="sm" onClick={() => setView("featureSelect")} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </div>
          <AuthScreen />
        </div>
      );
    }

    return (
      <>
        {accountControl}
        <CommunityHub onBack={() => setView("featureSelect")} isOwner={isOwner} />

        <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Update how your account appears in the community.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label htmlFor="profile-username">Username</Label>
                <Input
                  id="profile-username"
                  value={profileUsername}
                  onChange={(event) => setProfileUsername(event.target.value)}
                  placeholder="your_name"
                  autoComplete="username"
                  disabled={isSavingProfile}
                />
                <p className="text-[11px] text-muted-foreground">3-24 chars. Letters, numbers, and underscores only.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-display-name">Display Name</Label>
                <Input
                  id="profile-display-name"
                  value={profileDisplayName}
                  onChange={(event) => setProfileDisplayName(event.target.value)}
                  placeholder="Optional friendly name"
                  autoComplete="name"
                  disabled={isSavingProfile}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditProfile(false)} disabled={isSavingProfile}>
                Cancel
              </Button>
              <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="gap-2">
                {isSavingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const selectedScannedMod = scannedMods.find(m => m.mod.id === selectedModId);
  const selectedMod = selectedScannedMod ? selectedScannedMod.mod : null;

  let selectedConfig = null;
  const openConfigs = selectedScannedMod 
    ? openConfigIndices.map(idx => selectedScannedMod.configs[idx]).filter(Boolean)
    : [];

  if (selectedScannedMod && selectedScannedMod.configs && selectedScannedMod.configs.length > 0) {
    const safeIndex = Math.max(0, Math.min(activeConfigIndex, selectedScannedMod.configs.length - 1));
    selectedConfig = selectedScannedMod.configs[safeIndex];
  }

  const sidebarContent = (
    <div className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden">
      {sptPath && (
        <SPTControlPanel 
          sptPath={sptPath} 
        />
      )}

      <div className="shrink-0 border-b border-border px-3 py-2">
        <div className="mb-2 flex gap-1">
          <Button
            variant={activeTab === "mods" ? "default" : "ghost"}
            onClick={() => setActiveTab("mods")}
            className="h-8 flex-1 px-2 text-[10px] sm:text-xs"
          >
            Mods ({mods.filter(m => !favoritedModIds.has(m.id)).length})
          </Button>
          <Button
            variant={activeTab === "favorites" ? "default" : "ghost"}
            onClick={() => setActiveTab("favorites")}
            className="h-8 flex-1 px-2 text-[10px] sm:text-xs"
          >
            Favs ({favoritedModIds.size})
          </Button>
          <Button
            variant={activeTab === "recent" ? "default" : "ghost"}
            onClick={() => setActiveTab("recent")}
            className="h-8 flex-1 px-2 text-[10px] sm:text-xs"
            title="Recently Edited"
          >
            Recent
          </Button>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCategoryBrowser(true)}
          className="flex h-8 w-full items-center justify-start gap-2 px-2 text-xs"
        >
          <FolderOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Categories</span>
          <span className="sm:hidden">Cats</span>
          {selectedCategory && (
            <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[60px]">
              ({selectedCategory})
            </span>
          )}
        </Button>
        {activeTab === "favorites" && favoritedModIds.size > 0 && (
          <div className="mt-2 flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportFavorites}
              className="h-7 flex-1 px-2 text-[10px]"
              title="Export favorites list"
            >
              <Download className="w-3 h-3 mr-1" />
              Exp
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleImportFavorites}
              className="h-7 flex-1 px-2 text-[10px]"
              title="Import favorites list"
            >
              <Upload className="w-3 h-3 mr-1" />
              Imp
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFavorites}
              className="h-7 flex-1 px-2 text-[10px]"
              title="Clear all favorites"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clr
            </Button>
          </div>
        )}
      </div>
      
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
        <ModList
          mods={
            activeTab === "favorites"
              ? filteredModsByCategory.filter(m => favoritedModIds.has(m.id))
              : activeTab === "recent"
              ? recentlyEditedMods
              : selectedCategory
              ? filteredModsByCategory
              : filteredModsByCategory.filter(m => !favoritedModIds.has(m.id))
          }
          configFiles={configFilesMap}
          configErrorIndicesByMod={configErrorIndicesByMod}
          selectedModId={selectedModId}
          selectedConfigIndex={activeConfigIndex}
          onSelectMod={handleSelectMod}
          favoritedModIds={favoritedModIds}
          onToggleFavorite={handleToggleFavorite}
          editHistory={editHistory}
          searchInputRef={searchInputRef}
          modCategories={modCategories}
          onCategoryAssign={(modId) => setCategoryTargetModId(modId)} 
        /> 
      </div>
    </div>
  );

  return (
    <>
      <div className="flex w-full h-screen overflow-hidden relative bg-background">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="flex h-full min-h-0 w-60 shrink-0 flex-col overflow-hidden bg-card lg:w-64">
            {sidebarContent}
          </div>
        )}

        {/* Mobile Sidebar Trigger (Floating) */}
        {isMobile && (
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="fixed bottom-4 right-4 z-50 rounded-full h-12 w-12 shadow-lg bg-primary text-primary-foreground border-none"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[280px]">
              {sidebarContent}
            </SheetContent>
          </Sheet>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          {selectedMod && selectedModId && selectedConfig ? (
            <ConfigEditor
              modName={selectedMod.name}
              configFile={selectedConfig?.filePath || ""}
              activeConfigFileIndex={selectedConfig?.index ?? activeConfigIndex}
              activeConfigIndex={activeConfigIndex}
              openConfigIndices={openConfigIndices}
              allConfigs={selectedScannedMod!.configs}
              scannedMods={scannedMods}
              onSelectTab={(idx) => { setActiveConfigIndex(idx); }}
              onCloseTab={handleCloseTab}
              rawJson={selectedConfig?.rawJson}
              modId={selectedModId}
              onSave={handleSaveConfig}
              sptPath={sptPath}
              rootDirHandle={rootDirHandle}
              onChangesDetected={handleChangesDetected}
              onJsonErrorChange={handleEditorJsonErrorChange}
              onExportMods={scannedMods.length > 0 ? handleExportMods : undefined}
              onHome={handleHome}
              saveConfigRef={saveConfigRef}
              currentCategory={getModCategory(selectedModId, modCategories)}
              onCategoryChange={handleCategoryChange}
              onNavigateToConfig={handleSelectMod}
            />
          ) : selectedMod && selectedModId ? (
            <div className="flex flex-1 items-center justify-center p-3">
              <div className="text-center text-muted-foreground space-y-4 max-w-sm">
                <Package className="w-16 h-16 mx-auto opacity-20" />
                <h3 className="text-lg font-semibold">No configuration files found</h3>
                <p className="text-sm">This mod doesn't have any editable config files detected by the scanner.</p>
                {isMobile && (
                  <Button onClick={() => setIsSidebarOpen(true)} variant="outline" className="w-full">
                    Open Mod List
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-3">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">Select a mod from the list to begin editing</p>
                {isMobile && (
                  <Button onClick={() => setIsSidebarOpen(true)} className="w-full">
                    Browse Mods
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs and Overlays */}
      {categoryTargetModId && (
        <CategoryDialog
          modName={mods.find((m) => m.id === categoryTargetModId)?.name || ""}
          currentCategory={modCategories[categoryTargetModId] ?? null}
          open={true}
          onOpenChange={() => setCategoryTargetModId(null)}
          onCategoryAssigned={async (category) => {
            if (!categoryTargetModId) return;
            let updatedMap;
            if (category) {
              updatedMap = await assignModToCategory(categoryTargetModId, category, modCategories);
            } else {
              updatedMap = await removeModFromCategory(categoryTargetModId, modCategories);
            }
            setModCategories(updatedMap);
            setCategoryTargetModId(null);
          }}
        />
      )}

      <ConfigValidationSummary
        open={showValidationSummary}
        onOpenChange={setShowValidationSummary}
        scannedMods={scannedMods.map(sm => ({
          mod: sm.mod,
          configs: sm.configs.map(c => ({
            fileName: c.fileName,
            content: c.rawJson
          }))
        }))}
        onNavigateToConfig={(modId, configIndex) => {
          setSelectedModId(modId);
          setOpenConfigIndices([configIndex]);
          setActiveConfigIndex(configIndex);
          setShowValidationSummary(false);
        }}
      />

      <AlertDialog open={pendingModSwitch !== null} onOpenChange={(open) => !open && setPendingModSwitch(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Save and Change Mod?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in this mod. Save before switching, or switch without saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setPendingModSwitch(null)} className="mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardAndSwitch} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Switch Without Save
            </AlertDialogAction>
            <AlertDialogAction onClick={handleSaveAndSwitch}>
              Save and Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showHomeConfirm} onOpenChange={setShowHomeConfirm}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Config Editor?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to return to the home screen? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleGoHome} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard & Go Home
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showZipProgress} onOpenChange={(open) => !open && setShowZipProgress(false)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Creating ZIP...</AlertDialogTitle>
            <AlertDialogDescription className="truncate">
              {zipCurrentFile ? `Compressing: ${zipCurrentFile}` : "Preparing files..."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Progress value={zipProgress} />
            <p className="text-xs text-muted-foreground">
              {`${zipProgress.toFixed(0)}%`}
              {zipStartTime && zipProgress > 0
                ? ` • ~${Math.max(
                    1,
                    Math.round(((Date.now() - zipStartTime) / 1000) * (100 - zipProgress) / zipProgress),
                  )}s remaining`
                : ""}
            </p>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showZipDialog} onOpenChange={setShowZipDialog}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Package Edited Mods</AlertDialogTitle>
            <AlertDialogDescription>
              Choose the directory layout to use when packaging your mods:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Button
              onClick={() => handleExportVersion(false)}
              className="w-full text-base sm:text-lg bg-blue-600 hover:bg-blue-700 text-white flex flex-col py-2"
            >
              <span>Export for SPT 3.11.X</span>
              <span className="text-[10px] opacity-80">(user/mods)</span>
            </Button>
            <Button
              onClick={() => handleExportVersion(true)}
              className="w-full text-base sm:text-lg bg-purple-600 hover:bg-purple-700 text-white flex flex-col py-2"
            >
              <span>Export for SPT 4.0.X</span>
              <span className="text-[10px] opacity-80">(SPT/user/mods)</span>
            </Button>
            <AlertDialogCancel className="mt-2">Cancel</AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <CategoryBrowser
        open={showCategoryBrowser}
        onOpenChange={setShowCategoryBrowser}
        categories={modCategories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        mods={mods}
      />
    </>
  );
};

export default Index;
