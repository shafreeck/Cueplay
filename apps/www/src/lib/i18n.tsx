"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const localeStorageKey = "cueplay.locale";
const supportedLocales = ["en", "zh"] as const;

type Locale = (typeof supportedLocales)[number];
type TranslationVars = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: TranslationVars) => string;
};

const translations = {
  en: {
    nav: {
      features: "Features",
      download: "Download",
      github: "GitHub",
      downloadBeta: "Download Beta",
      languageToggle: "中文",
    },
    hero: {
      betaAvailable: "v{version} Beta is now available",
      titleLine1: "Watch Together,",
      titleLine2: "Anywhere.",
      subtitle:
        "Experience perfectly synchronized playback with friends. High quality video, real-time chat, and a seamless interface designed for movie nights.",
      downloadFree: "Download for Free",
      viewFeatures: "View Features",
    },
    showcase: {
      preview: "App Interface Preview",
    },
    features: {
      headingLine1: "Everything you need",
      headingLine2: "for the perfect movie night",
      subtitle:
        "Cueplay is built for seamless synchronization and crystal clear communication.",
      syncTitle: "Perfect Sync",
      syncDesc:
        'Advanced synchronization engine ensures everyone sees the exact same frame at the same time. No more "3, 2, 1, press play".',
      chatTitle: "Real-time Chat",
      chatDesc:
        "Built-in text and voice chat lets you react in real-time without leaving the app. Share your thoughts as the action unfolds.",
      secureTitle: "Private & Secure",
      secureDesc:
        "Your rooms are private by default. Direct P2P connection options for maximum privacy and lower latency.",
    },
    download: {
      title: "Ready to start watching?",
      subtitle:
        "Join thousands of users who are already enjoying perfectly synchronized movie nights with Cueplay.",
      mac: "Download for Mac",
      windows: "Download for Windows",
      android: "Download for Android",
      requirements: "Requires macOS 11+, Windows 10/11 or Android 8.0+",
    },
    footer: {
      privacy: "Privacy",
      terms: "Terms",
      twitter: "Twitter",
      rights: "© 2026 Cueplay. All rights reserved.",
    },
  },
  zh: {
    nav: {
      features: "功能",
      download: "下载",
      github: "GitHub",
      downloadBeta: "下载测试版",
      languageToggle: "EN",
    },
    hero: {
      betaAvailable: "v{version} 测试版已上线",
      titleLine1: "一起观看，",
      titleLine2: "随时随地。",
      subtitle:
        "与好友享受完美同步的播放体验。高清画质、实时聊天，以及为观影之夜打造的顺滑界面。",
      downloadFree: "免费下载",
      viewFeatures: "查看功能",
    },
    showcase: {
      preview: "应用界面预览",
    },
    features: {
      headingLine1: "观影之夜所需",
      headingLine2: "一应俱全",
      subtitle: "Cueplay 为无缝同步与清晰沟通而生。",
      syncTitle: "完美同步",
      syncDesc:
        "先进的同步引擎确保所有人同时看到同一帧。不再需要“3、2、1、播放”。",
      chatTitle: "实时聊天",
      chatDesc:
        "内置文字与语音聊天，让你无需离开应用即可实时互动，分享每个精彩瞬间。",
      secureTitle: "私密安全",
      secureDesc: "默认私密房间，可选 P2P 直连以获得更高隐私与更低延迟。",
    },
    download: {
      title: "准备好开始观看了吗？",
      subtitle: "加入成千上万的用户，已经在 Cueplay 中享受完美同步的观影之夜。",
      mac: "下载 Mac 版",
      windows: "下载 Windows 版",
      android: "下载 Android 版",
      requirements: "需 macOS 11+、Windows 10/11 或 Android 8.0+",
    },
    footer: {
      privacy: "隐私",
      terms: "条款",
      twitter: "Twitter",
      rights: "© 2026 Cueplay 版权所有。",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const isSupportedLocale = (value: string | null | undefined): value is Locale =>
  !!value && supportedLocales.includes(value as Locale);

const resolveLocale = (locale: string | null | undefined): Locale | null => {
  if (!locale) {
    return null;
  }
  const normalized = locale.toLowerCase();
  if (normalized.startsWith("zh")) {
    return "zh";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }
  return null;
};

const detectLocale = (): Locale => {
  if (typeof window === "undefined") {
    return "en";
  }
  const storedValue = localStorage.getItem(localeStorageKey);
  if (isSupportedLocale(storedValue)) {
    return storedValue;
  }
  const browserLocale = resolveLocale(
    navigator.languages?.[0] ?? navigator.language,
  );
  return browserLocale ?? "en";
};

const formatMessage = (message: string, vars?: TranslationVars) => {
  if (!vars) {
    return message;
  }
  return message.replace(/\{(\w+)\}/g, (match, key) => {
    if (vars[key] === undefined) {
      return match;
    }
    return String(vars[key]);
  });
};

const getMessage = (locale: Locale, key: string) => {
  const parts = key.split(".");
  let current: unknown = translations[locale];
  for (const part of parts) {
    if (typeof current !== "object" || current === null) {
      return key;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : key;
};

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    if (typeof window !== "undefined") {
      localStorage.setItem(localeStorageKey, nextLocale);
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: TranslationVars) =>
      formatMessage(getMessage(locale, key), vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
