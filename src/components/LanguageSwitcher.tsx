import { setLanguage, useLanguage } from "../i18n";

export default function LanguageSwitcher() {
  const language = useLanguage();
  return (
    <div className="language-switcher" role="group" aria-label="Language / 语言">
      <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</button>
      <button type="button" lang="zh-Hans" aria-pressed={language === "zh"} onClick={() => setLanguage("zh")}>中文</button>
    </div>
  );
}
