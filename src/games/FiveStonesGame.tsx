import GamePlayArea from "../components/GamePlayArea";
import { useEffect, useMemo, useRef, useState } from "react";

import InstructionSteps from "../components/InstructionSteps";

type Stone = {
  id: number;
  x: number;
  y: number;
  collected: boolean;
};

const baseStones: Stone[] = [
  { id: 0, x: 24, y: 66, collected: false },
  { id: 1, x: 43, y: 74, collected: false },
  { id: 2, x: 59, y: 64, collected: false },
  { id: 3, x: 73, y: 76, collected: false },
];

const stageSequences: number[][] = [
  [1, 1, 1, 1],
  [2, 2],
  [3, 1],
  [4],
];

export default function FiveStonesGame() {
  const [stones, setStones] = useState<Stone[]>(baseStones);
  const [stage, setStage] = useState(1);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [throws, setThrows] = useState(0);
  const [successes, setSuccesses] = useState(0);
  const [inAir, setInAir] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Press Toss, collect the right number, then catch.");
  const [selectedThisThrow, setSelectedThisThrow] = useState<number[]>([]);
  const [pace, setPace] = useState("practice");
  const timerRef = useRef<number | null>(null);

  const sequence = stageSequences[stage - 1];
  const target = sequence[step];
  const remaining = useMemo(() => stones.filter((s) => !s.collected).length, [stones]);
  const complete = stage === 4 && step >= sequence.length;

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const reset = () => {
    clearTimer();
    setStones(baseStones.map((s) => ({ ...s, collected: false })));
    setStage(1);
    setStep(0);
    setScore(0);
    setThrows(0);
    setSuccesses(0);
    setInAir(false);
    setProgress(0);
    setSelectedThisThrow([]);
    setMessage("Press Toss, collect the right number, then catch.");
  };

  useEffect(() => () => clearTimer(), []);

  const toss = () => {
    if (inAir || complete) return;

    setSelectedThisThrow([]);
    setThrows((value) => value + 1);
    setInAir(true);
    setProgress(0);
    setMessage(`Collect exactly ${target} stone${target > 1 ? "s" : ""}, then catch.`);

    const started = performance.now();
    const duration = pace === "practice" ? 3200 : 2100;
    clearTimer();
    timerRef.current = window.setInterval(() => {
      const p = Math.min(100, (performance.now() - started) / duration * 100);
      setProgress(p);
      if (p >= 100) {
        clearTimer();
        setInAir(false);
        setSelectedThisThrow([]);
        setMessage("Missed catch. Try the toss again.");
      }
    }, 35);
  };

  const collectStone = (id: number) => {
    if (!inAir) {
      setMessage("Toss the main stone first.");
      return;
    }
    if (stones.find((stone) => stone.id === id)?.collected || selectedThisThrow.includes(id)) return;
    if (selectedThisThrow.length >= target) {
      setMessage(`This throw needs exactly ${target} stone${target > 1 ? "s" : ""}.`);
      return;
    }

    setSelectedThisThrow((current) => [...current, id]);
    setMessage(selectedThisThrow.length + 1 === target ? "Ready! Catch on the way down." : `Collect ${target - selectedThisThrow.length - 1} more, then catch.`);
  };

  const catchStone = () => {
    if (!inAir) {
      setMessage("Nothing is in the air yet.");
      return;
    }

    if (progress < 50) {
      setMessage("Wait until the stone starts falling to catch it.");
      return;
    }
    clearTimer();

    if (selectedThisThrow.length !== target) {
      setInAir(false);
      setProgress(0);
      setSelectedThisThrow([]);
      setMessage(`You needed ${target} stone${target > 1 ? "s" : ""} before the catch.`);
      return;
    }

    const selected = [...selectedThisThrow];

    setStones((current) =>
      current.map((stone) =>
        selected.includes(stone.id) ? { ...stone, collected: true } : stone
      )
    );

    setScore((value) => value + target * 120 + Math.max(0, Math.round((100 - progress) * 2)));
    setSuccesses((value) => value + 1);
    setInAir(false);
    setProgress(0);
    setSelectedThisThrow([]);

    const nextStep = step + 1;
    const nextRemaining = remaining - target;

    if (nextStep >= sequence.length) {
      if (stage < 4) {
        const nextStage = stage + 1;
        setStage(nextStage);
        setStep(0);
        setStones(baseStones.map((s) => ({ ...s, collected: false })));
        const nextTarget = stageSequences[nextStage - 1][0];
        setMessage(
          `Stage ${stage} complete. Stage ${nextStage}: collect ${nextTarget} stone${nextTarget > 1 ? "s" : ""} on the first throw.`
        );
      } else {
        setStep(nextStep);
        setMessage("All four stages complete. Excellent timing.");
      }
    } else {
      setStep(nextStep);
      const nextTarget = sequence[nextStep];
      setMessage(
        `${nextRemaining} ground stone${nextRemaining === 1 ? "" : "s"} remain. Next throw: collect ${nextTarget}.`
      );
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || (event.target instanceof HTMLElement && event.target.matches("input, select, textarea"))) return;
      if (["1", "2", "3", "4"].includes(event.key)) { event.preventDefault(); collectStone(Number(event.key) - 1); }
      if (event.code === "Space" && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        if (inAir) catchStone(); else toss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tossY = inAir
    ? 72 - Math.sin((Math.min(progress, 100) / 100) * Math.PI) * 58
    : 72;

  const sequenceLabel = sequence.join(" + ");

  return (
    <section className="game-layout five-stones-layout">
      <aside className="game-panel">
        <InstructionSteps
          title="Toss, collect, then catch"
          objective={`Complete four stages. The current Stage ${stage} pattern is ${sequenceLabel}.`}
          steps={[
            "Press Toss Stone to throw the main stone into the air.",
            `While it is airborne, collect exactly ${complete ? 0 : target} ground stone${!complete && target !== 1 ? "s" : ""} for this throw.`,
            "Wait until the airborne stone starts falling, then tap it to catch.",
            "A successful catch moves you to the next throw. Finish every pattern to clear all four stages.",
          ]}
          tip="Practice mode gives you more time. The progress bar changes from Rising to Catch now when it is time to catch."
        />

        <div className="stat-grid">
          <div><span>Score</span><strong key={score} className="stat-value-pop">{score}</strong></div>
          <div><span>Stage</span><strong>{stage}/4</strong></div>
          <div><span>Throws</span><strong>{throws}</strong></div>
          <div><span>Clean catches</span><strong key={successes} className="stat-value-pop">{successes}</strong></div>
        </div>

        <div className="panel-card compact" role="status" aria-live="polite">
          <span className="status-dot" />
          <p>{message}</p>
        </div>

        <label className="pace-control">Pace
          <select value={pace} disabled={inAir} onChange={(event) => setPace(event.target.value)}>
            <option value="practice">Practice - generous timing</option>
            <option value="challenge">Challenge - faster toss</option>
          </select>
        </label>
        <button className="primary-button" onClick={toss} disabled={inAir || complete}>
          {complete ? "Sequence complete" : inAir ? "Stone in air..." : "Toss stone"}
        </button>

        <button className="secondary-button" onClick={reset}>Restart</button>
      </aside>

      <GamePlayArea>
        <div className="play-status-bar">
          <div><strong>{complete ? "Sequence complete" : `Stage ${stage} · Step ${Math.min(step + 1, sequence.length)}/${sequence.length}`}</strong></div>
          <span>{complete ? "All stages cleared" : `Collect ${target} then catch`}</span>
        </div>
        <div className="round-cue">
          <strong>{complete ? "All four stages mastered!" : inAir ? `${selectedThisThrow.length} / ${target} collected / ${progress < 50 ? "Rising" : "Catch now"}` : `Stage ${stage} / Collect ${target} per toss`}</strong>
          <progress aria-label="Toss progress" max={100} value={progress} />
        </div>
        <div className="mobile-game-toolbar mobile-five-stones-toolbar" aria-label="Mobile Five Stones controls">
          <button className="mobile-game-control" onClick={toss} disabled={inAir || complete}>
            {complete ? "Complete" : inAir ? "Stone in air" : "Toss stone"}
          </button>
          <button className="mobile-game-control secondary" onClick={reset}>Restart</button>
        </div>
        <div className={`five-stones-board active-play-frame ${inAir ? "is-tossing" : ""} ${inAir && progress >= 50 ? "catch-window" : ""} ${complete ? "is-complete" : ""}`} tabIndex={0} aria-label="Five stones play area">
          <div className="floor-label">FIVE STONES</div>

          <button
            className={`air-stone ${inAir ? "active" : ""}`}
            style={{ top: `${tossY}%` }}
            onClick={catchStone}
            disabled={!inAir}
            aria-label="Catch airborne stone"
          >
            <span />
          </button>

          {stones.map((stone, index) => (
            <button
              key={stone.id}
              className={`beanbag ${stone.collected ? "collected" : ""} ${
                selectedThisThrow.includes(stone.id) ? "selected" : ""
              } bag-${index + 1}`}
              style={{ left: `${stone.x}%`, top: `${stone.y}%` }}
              onClick={() => collectStone(stone.id)}
              disabled={stone.collected}
              aria-label={`Ground stone ${index + 1}`}
            >
              <span><b>{index + 1}</b></span>
            </button>
          ))}
        </div>

        <p className="control-hint">
          Keyboard: 1-4 to collect; Space to toss or catch when the board is focused. Toss, tap the required ground stones, then tap the airborne stone to catch it.
        </p>
      </GamePlayArea>
    </section>
  );
}
