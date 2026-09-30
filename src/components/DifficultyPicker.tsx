import { t, useLanguage } from "../i18n";
import { motion } from "framer-motion";
import { Gauge, Sparkles } from "lucide-react";
import { difficultySettings, type Difficulty } from "../games/mechanics";

type Props = { value: Difficulty; onChange: (value: Difficulty) => void; description: string; disabled?: boolean };

export default function DifficultyPicker({ value, onChange, description, disabled = false }: Props) {
  useLanguage();
  return (
    <fieldset className="difficulty-picker premium-difficulty-picker" disabled={disabled}>
      <legend><Gauge size={16} /> {t("Choose your level")}</legend>
      <div className="difficulty-options premium-difficulty-options">
        {(Object.keys(difficultySettings) as Difficulty[]).map((difficulty) => {
          const selected = value === difficulty;
          return (
            <button key={difficulty} type="button" className={`difficulty-choice ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={() => onChange(difficulty)}>
              {selected && <motion.span className="difficulty-active-bg" layoutId="difficulty-active-bg" />}
              <span className="difficulty-label">{t(difficultySettings[difficulty].label)}</span>
            </button>
          );
        })}
      </div>
      <p><Sparkles size={14} /> {description} {disabled ? t("The same level is used for both players.") : t("Changing level starts a fresh round.")}</p>
    </fieldset>
  );
}
