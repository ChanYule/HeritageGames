import { difficultySettings, type Difficulty } from "../games/mechanics";

type Props = { value: Difficulty; onChange: (value: Difficulty) => void; description: string };

export default function DifficultyPicker({ value, onChange, description }: Props) {
  return (
    <fieldset className="difficulty-picker">
      <legend>Choose your level</legend>
      <div className="difficulty-options">
        {(Object.keys(difficultySettings) as Difficulty[]).map((difficulty) => (
          <label key={difficulty}>
            <input type="radio" name="difficulty" value={difficulty} checked={value === difficulty}
              onChange={() => onChange(difficulty)} />
            <span>{difficultySettings[difficulty].label}</span>
          </label>
        ))}
      </div>
      <p>{description} Changing level starts a fresh random round.</p>
    </fieldset>
  );
}
