import { useSyncExternalStore } from "react";
import { zh } from "./locales/zh";

export type Language = "en" | "zh";
export const languageStorageKey = "heritage-games-language";
const listeners = new Set<() => void>();
let language: Language = "en";
try {
  if (localStorage.getItem(languageStorageKey) === "zh") language = "zh";
} catch { /* Language selection still works when browser storage is disabled. */ }

export function translate(locale: Language, key: string, ...values: (string | number)[]): string {
  const phrase = locale === "zh" ? zh[key] ?? key : key;
  return phrase.replace(/\{(\d+)\}/g, (token, index: string) => String(values[Number(index)] ?? token));
}

// This stable function reads the current language even inside long-running canvas callbacks.
export function t(key: string, ...values: (string | number)[]) {
  return translate(language, key, ...values);
}

export function setLanguage(next: Language) {
  language = next;
  document.documentElement.lang = next === "zh" ? "zh-Hans" : "en";
  try { localStorage.setItem(languageStorageKey, next); } catch { /* Session-only preference. */ }
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function useLanguage() {
  return useSyncExternalStore(subscribe, () => language, () => "en" as Language);
}

if (typeof document !== "undefined") document.documentElement.lang = language === "zh" ? "zh-Hans" : "en";
