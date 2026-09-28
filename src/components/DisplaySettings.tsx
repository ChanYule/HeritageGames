import { useEffect, useState } from "react";
import { Check, Contrast, Type } from "lucide-react";
import { t, useLanguage } from "../i18n";

const preferenceKey = "heritage-games-display";
export default function DisplaySettings() {
  useLanguage();
  const [settings, setSettings] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? "{}"); return { large: saved?.large === true, contrast: saved?.contrast === true }; }
    catch { return { large: false, contrast: false }; }
  });
  useEffect(() => {
    document.documentElement.dataset.largeText = String(settings.large);
    document.documentElement.dataset.highContrast = String(settings.contrast);
    try { localStorage.setItem(preferenceKey, JSON.stringify(settings)); } catch { /* Preferences still work for this visit. */ }
  }, [settings]);
  return <div className="display-settings" role="group" aria-label={t("Reading preferences")}>
    <span>{t("Make yourself comfortable")}</span>
    <button type="button" aria-pressed={settings.large} onClick={()=>setSettings(value=>({...value, large: !value.large}))}><Type size={20}/>{t("Larger text")}{settings.large && <Check size={16}/>}</button>
    <button type="button" aria-pressed={settings.contrast} onClick={()=>setSettings(value=>({...value, contrast: !value.contrast}))}><Contrast size={19}/>{t("More contrast")}{settings.contrast && <Check size={16}/>}</button>
  </div>;
}
