const APP_SETTINGS_KEY = "spt-app-settings";

export interface AppSettings {
  rememberLastSession: boolean;
  autoLoadLastFolderOnLaunch: boolean;
  useCacheWhenLoadingLastFolder: boolean;
  showStartupTips: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  rememberLastSession: false,
  autoLoadLastFolderOnLaunch: false,
  useCacheWhenLoadingLastFolder: true,
  showStartupTips: true,
};

export const loadAppSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    // Migrate legacy standalone key.
    const legacyRemember = localStorage.getItem("rememberLastSession");
    const rememberLastSession =
      typeof parsed.rememberLastSession === "boolean"
        ? parsed.rememberLastSession
        : legacyRemember
        ? JSON.parse(legacyRemember)
        : DEFAULT_APP_SETTINGS.rememberLastSession;

    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      rememberLastSession,
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
};

export const saveAppSettings = (settings: AppSettings): void => {
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
  // Keep legacy key in sync for any remaining older code paths.
  localStorage.setItem("rememberLastSession", JSON.stringify(settings.rememberLastSession));
};

export const updateAppSettings = <K extends keyof AppSettings>(
  settings: AppSettings,
  key: K,
  value: AppSettings[K]
): AppSettings => {
  const updated = { ...settings, [key]: value };
  saveAppSettings(updated);
  window.dispatchEvent(new CustomEvent("app-settings-changed", { detail: updated }));
  return updated;
};
