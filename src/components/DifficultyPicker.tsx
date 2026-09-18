import { motion } from "framer-motion";
import { Gauge, Sparkles } from "lucide-react";
import { difficultySettings, type Difficulty } from "../games/mechanics";

type Props = { value: Difficulty; onChange: (value: Difficulty) => void; description: string };

export default function DifficultyPicker({ value, onChange, description }: Props) {
  return (
    <fieldset className="difficulty-picker premium-difficulty-picker">
      <legend><Gauge size={16} /> Choose your level</legend>
      <div className="difficulty-options premium-difficulty-options">
        {(Object.keys(difficultySettings) as Difficulty[]).map((difficulty) => {
          const selected = value === difficulty;
          return (
            <label key={difficulty} className={selected ? "is-selected" : ""}>
              <input
                type="radio"
                name="difficulty"
                value={difficulty}
                checked={selected}
                onChange={() => onChange(difficulty)}
              />
              {selected && <motion.span className="difficulty-active-bg" layoutId="difficulty-active-bg" />}
              <span className="difficulty-label">{difficultySettings[difficulty].label}</span>
            </label>
          );
        })}
      </div>
      <p><Sparkles size={14} /> {description} Changing level starts a fresh random round.</p>
    </fieldset>
  );
}
