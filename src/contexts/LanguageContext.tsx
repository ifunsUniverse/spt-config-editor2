import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type SupportedLanguage = "en" | "es" | "fr" | "de" | "zh" | "ja" | "ru" | "ko" | "pt" | "it";

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LANGUAGE_OPTIONS: Record<SupportedLanguage, { label: string; flag: string }> = {
  en: { label: "English", flag: "🇬🇧" },
  es: { label: "Español", flag: "🇪🇸" },
  fr: { label: "Français", flag: "🇫🇷" },
  de: { label: "Deutsch", flag: "🇩🇪" },
  zh: { label: "中文", flag: "🇨🇳" },
  ja: { label: "日本語", flag: "🇯🇵" },
  ru: { label: "Русский", flag: "🇷🇺" },
  ko: { label: "한국어", flag: "🇰🇷" },
  pt: { label: "Português", flag: "🇵🇹" },
  it: { label: "Italiano", flag: "🇮🇹" },
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    // Try to get from localStorage
    const saved = localStorage.getItem("app-language");
    if (saved && saved in LANGUAGE_OPTIONS) {
      return saved as SupportedLanguage;
    }
    
    // Try to detect from browser
    const browserLang = navigator.language.split("-")[0];
    if (browserLang in LANGUAGE_OPTIONS) {
      return browserLang as SupportedLanguage;
    }
    
    return "en";
  });

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem("app-language", lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
