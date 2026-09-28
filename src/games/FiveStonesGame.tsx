import { t, useLanguage } from "../i18n";
import GamePlayArea from "../components/GamePlayArea";
import { useEffect, useRef, useState } from "react";

import InstructionSteps from "../components/InstructionSteps";
import DifficultyPicker from "../components/DifficultyPicker";
import { advanceFiveStones, FIVE_STONES_ATTEMPT_LIMIT, FIVE_STONES_LEVEL_MS, FIVE_STONES_PATTERNS, fiveStonesComplete, fiveStonesRequiredIds, fiveStonesSelectionCorrect, fiveStonesTarget, newFiveStonesRound } from "./fiveStonesRules";
import type { Difficulty } from "./mechanics";

type Props = {
  playerName?: string;
  competitionMode?: boolean;
  onComplete?: (score: number) => void;
};

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

export default function FiveStonesGame({ playerName, competitionMode = false, onComplete }: Props = {}) {
  useLanguage();
  const [round, setRound] = useState(() => newFiveStonesRound(competitionMode));
  const roundRef = useRef(round);
  const { stage, step, score, throws, successes, inAir, selected: selectedThisThrow } = round;
  const stones = baseStones.map((stone) => ({ ...stone, collected: round.collected.includes(stone.id) }));
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(() => () => t("Press Toss, collect the right number, then catch."));
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const level = competitionMode ? "medium" : difficulty;
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const clockRef = useRef({ elapsed: 0, started: 0, duration: 8000 });
  const timerRef = useRef<number | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  const [celebration, setCelebration] = useState<(() => string) | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const reportedRef = useRef(false);

  const sequence = FIVE_STONES_PATTERNS[stage - 1];
  const target = fiveStonesTarget(round);
  const requiredIds = fiveStonesRequiredIds(round);
  const pickupPlan = requiredIds.map((id) => id + 1).join(", ");
  const showPlan = level === "medium" || (level === "difficult" && !inAir);
  const complete = fiveStonesComplete(round);
  const exhausted = competitionMode && throws >= FIVE_STONES_ATTEMPT_LIMIT && !inAir;
  const finished = complete || exhausted;
  const actionPhase = finished
    ? "complete"
    : !inAir
      ? "toss"
      : selectedThisThrow.length < target
        ? "collect"
        : progress < 50
          ? "wait"
          : "catch";
  const catchReady = inAir && !paused && !confirmFinish && progress >= 50 && selectedThisThrow.length === target;

  const commit = (next: typeof round) => {
    roundRef.current = next;
    setRound(next);
  };

  useEffect(() => {
    if (!finished || reportedRef.current || !onComplete) return;
    reportedRef.current = true;
    onComplete(score);
  }, [finished, onComplete, score]);

  const clearTimer = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const reset = () => {
    clearTimer();
    if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = null;
    commit(newFiveStonesRound(competitionMode));
    pausedRef.current = false;
    setPaused(false);
    setProgress(0);
    setMessage(() => () => t("Press Toss, collect the right number, then catch."));
    setCelebration(null);
    setConfirmFinish(false);
    reportedRef.current = false;
  };

  const finishCompetitionAttempt = () => {
    if (!competitionMode || throws === 0 || reportedRef.current) return;
    clearTimer();
    commit({ ...roundRef.current, inAir: false, selected: [] });
    reportedRef.current = true;
    onComplete?.(score);
  };

  useEffect(() => () => {
    clearTimer();
    if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current);
  }, []);

  const celebrate = (text: () => string) => {
    if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current);
    setCelebration(() => text);
    celebrationTimerRef.current = window.setTimeout(() => setCelebration(null), 1800);
  };

  const toss = () => {
    if (pausedRef.current || reportedRef.current || confirmFinish) return;
    const next = advanceFiveStones(roundRef.current, { type: "toss", limit: competitionMode ? FIVE_STONES_ATTEMPT_LIMIT : undefined });
    if (next === roundRef.current) return;
    commit(next);
    setProgress(0);
    setMessage(() => () => t("Collect exactly {0} stone{1}, then catch.", target, target > 1 ? "s" : ""));
    clockRef.current = { elapsed: 0, started: performance.now(), duration: FIVE_STONES_LEVEL_MS[level] };
    startTimer();
  };

  const currentProgress = () => Math.min(100, (clockRef.current.elapsed + (pausedRef.current ? 0 : performance.now() - clockRef.current.started)) / clockRef.current.duration * 100);

  const miss = () => {
    clearTimer();
    commit(advanceFiveStones(roundRef.current, { type: "miss" }));
    setProgress(0);
    setMessage(() => () => t("Missed catch. Try the toss again."));
  };

  const startTimer = () => {
    clearTimer();
    timerRef.current = window.setInterval(() => {
      if (!roundRef.current.inAir || pausedRef.current) return;
      const p = currentProgress();
      setProgress(p);
      if (p >= 100) miss();
    }, 30);
  };

  const pause = () => {
    if (!roundRef.current.inAir || pausedRef.current) return;
    clockRef.current.elapsed += performance.now() - clockRef.current.started;
    pausedRef.current = true;
    setPaused(true);
    clearTimer();
    setProgress(currentProgress());
  };

  const resume = () => {
    if (!pausedRef.current || confirmFinish) return;
    clockRef.current.started = performance.now();
    pausedRef.current = false;
    setPaused(false);
    startTimer();
  };

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) pause(); };
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const collectStone = (id: number) => {
    if (pausedRef.current || confirmFinish || reportedRef.current) return;
    if (!roundRef.current.inAir) {
      setMessage(() => () => t("Toss the main stone first."));
      return;
    }
    if (currentProgress() >= 100) { miss(); return; }
    const next = advanceFiveStones(roundRef.current, { type: roundRef.current.selected.includes(id) ? "unselect" : "collect", id });
    if (next === roundRef.current) return;
    commit(next);
    const needed = fiveStonesTarget(next) - next.selected.length;
    setMessage(() => () => needed === 0
      ? fiveStonesSelectionCorrect(next, level) ? t("Ready! Catch on the way down.") : t("Check the pickup plan. Tap a selected stone to change it.")
      : t("Collect {0} more, then catch.", needed));
  };

  const catchStone = () => {
    if (pausedRef.current || confirmFinish || reportedRef.current) return;
    const current = roundRef.current;
    if (!current.inAir) {
      setMessage(() => () => t("Nothing is in the air yet."));
      return;
    }

    const exactProgress = currentProgress();
    if (exactProgress >= 100) { miss(); return; }
    if (exactProgress < 50) {
      setMessage(() => () => t("Wait until the stone starts falling to catch it."));
      return;
    }
    const needed = fiveStonesTarget(current) - current.selected.length;
    if (needed > 0) {
      setMessage(() => () => t("Collect {0} more, then catch.", needed));
      return;
    }
    if (!fiveStonesSelectionCorrect(current, level)) {
      setMessage(() => () => t("Check the pickup plan. Tap a selected stone to change it."));
      return;
    }
    clearTimer();
    const next = advanceFiveStones(current, { type: "catch", progress: exactProgress, level });
    commit(next);
    setProgress(0);
    if (fiveStonesComplete(next)) {
      setMessage(() => () => t("All four stages complete. Excellent timing."));
      celebrate(() => t("All stages mastered!"));
    } else if (next.stage !== current.stage) {
      const nextTarget = fiveStonesTarget(next);
      setMessage(() => () => t("Stage {0} complete. Stage {1}: collect {2} stone{3} on the first throw.", current.stage, next.stage, nextTarget, nextTarget > 1 ? "s" : ""));
      celebrate(() => t("Stage {0} complete!", current.stage));
    } else {
      const left = 4 - next.collected.length;
      setMessage(() => () => t("{0} ground stone{1} remain. Next throw: collect {2}.", left, left === 1 ? "" : "s", fiveStonesTarget(next)));
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest("input, select, textarea, [contenteditable=true]"))) return;
      if (["1", "2", "3", "4"].includes(event.key)) { event.preventDefault(); collectStone(Number(event.key) - 1); }
      if (event.code === "Space" && event.target instanceof HTMLElement && event.target.closest(".five-stones-board") && !(event.target instanceof HTMLButtonElement)) {
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
        {competitionMode && playerName ? <div className="competition-attempt-label"><span>{t("Scored attempt")}</span><strong>{playerName}</strong></div> : null}
        <InstructionSteps
          title={t("Toss, collect, then catch")}
          objective={t("Complete four stages. The current Stage {0} pattern is {1}.", stage, sequenceLabel)}
          steps={[
            t("Press Toss Stone to throw the main stone into the air."),
            level === "easy" ? t("While it is airborne, collect exactly {0} ground stone{1} for this throw.", complete ? 0 : target, !complete && target !== 1 ? "s" : "") : t("Study the numbered pickup plan, then collect those stones while the main stone is airborne."),
            t("Wait until the airborne stone starts falling, then tap it to catch."),
            t("A successful catch moves you to the next throw. Finish every pattern to clear all four stages."),
          ]}
          tip={level === "easy" ? t("Choose any stones. Each toss lasts 8 seconds.") : level === "medium" ? t("Follow the numbered pickup plan. It stays visible during the toss.") : t("Study the numbered pickup plan before tossing. Remember it while the stone is in the air.")}
        />

        <DifficultyPicker value={level} onChange={(next) => { setDifficulty(next); reset(); }} disabled={competitionMode}
          description={t("Easy: any stones. Medium: follow a visible plan. Difficult: remember the plan before you toss.")} />

        <div className="stat-grid">
          <div><span>{t("Score")}</span><strong key={score} className="stat-value-pop">{score}</strong></div>
          <div><span>{t("Stage")}</span><strong>{stage}/4</strong></div>
          <div><span>{t("Throws")}</span><strong>{throws}{competitionMode ? `/${FIVE_STONES_ATTEMPT_LIMIT}` : ""}</strong></div>
          <div><span>{t("Clean catches")}</span><strong key={successes} className="stat-value-pop">{successes}</strong></div>
        </div>

        <div className="panel-card compact" role="status" aria-live="polite">
          <span className="status-dot" />
          <p>{message()}</p>
        </div>

        {competitionMode ? <p className="competition-fairness-note">{t("Both players follow the same visible pickup plans with 12 tosses each.")}</p> : null}
        <p className="control-hint">{t("Score: 120 points per collected stone, plus up to 100 for catching promptly on the way down.")}</p>
        <button className="primary-button" onClick={toss} disabled={inAir || finished || confirmFinish}>
          {finished ? t("Sequence complete") : inAir ? t("Stone in air...") : t("Toss stone")}
        </button>

        {!competitionMode && <button className="secondary-button" onClick={reset}>{t("Restart")}</button>}

      </aside>

      <GamePlayArea className="five-stones-play-area">
        {!complete && <div className="five-pickup-plan" role="status">
          <strong>{level === "easy" ? t("Pick up any {0} stones", target) : showPlan ? t("Pick up stones: {0}", pickupPlan) : t("Remember your pickup plan")}</strong>
          <span>{level === "easy" ? t("Any stones will do") : level === "medium" ? t("Tap these numbered stones before catching") : inAir ? t("The plan is hidden until this toss ends") : t("Study the numbers, then press Toss stone")}</span>
        </div>}
        <div className="play-status-bar">
          <div><strong>{finished ? t("Attempt complete") : t("Stage {0} · Step {1}/{2}", stage, Math.min(step + 1, sequence.length), sequence.length)}</strong></div>
          <span>{complete ? t("All stages cleared") : exhausted ? t("12 tosses completed") : t("Collect {0} then catch", target)}</span>
        </div>
        <ol className="five-stones-phase-strip" aria-label={t("Current action: {0}", t(actionPhase))}>
          <li className={actionPhase === "toss" ? "is-current" : inAir || complete ? "is-done" : ""}><span>1</span> {t("Toss")}</li>
          <li className={actionPhase === "collect" || actionPhase === "wait" ? "is-current" : actionPhase === "catch" || complete ? "is-done" : ""}><span>2</span> {t("Collect")}</li>
          <li className={actionPhase === "catch" ? "is-current" : complete ? "is-done" : ""}><span>3</span> {t("Catch")}</li>
        </ol>
        <div className="round-cue">
          <strong>{paused ? t("Paused — your toss is safe") : complete ? t("All four stages mastered!") : exhausted ? t("12 tosses completed") : inAir ? t("{0} / {1} collected / {2}", selectedThisThrow.length, target, progress < 50 ? t("Rising") : selectedThisThrow.length === target ? t("Catch now") : t("Collect {0} more", target - selectedThisThrow.length)) : t("Stage {0} / Collect {1} per toss", stage, target)}</strong>
          <progress aria-label={t("Toss progress")} max={100} value={progress} />
        </div>
        <div className="five-stones-action-controls" aria-label={t("Five Stones controls")}>
          <button className="primary-button" onClick={toss} disabled={inAir || finished || confirmFinish}>
            {finished ? t("Complete") : inAir ? t("Stone in air") : t("Toss stone")}
          </button>
          <button className={`primary-button catch-control ${catchReady ? "is-ready" : ""}`} onClick={catchStone} disabled={!catchReady}>
            {!inAir ? t("Catch") : progress < 50 ? t("Wait to catch") : selectedThisThrow.length !== target ? t("Collect {0} more", target - selectedThisThrow.length) : t("Catch now")}
          </button>
          <button className="secondary-button" onClick={paused ? resume : pause} disabled={!inAir}>{paused ? t("Resume") : t("Pause")}</button>
          {!competitionMode && <button className="secondary-button" onClick={reset}>{t("Restart")}</button>}
        </div>
        {competitionMode ? (
          confirmFinish ? (
            <div className="competition-finish-confirm" role="alert">
              <strong>{t("Record {0} points?", score)}</strong>
              <span>{t("This ends {0}'s attempt.", playerName ?? t("this player"))}</span>
              <div><button className="primary-button" onClick={finishCompetitionAttempt}>{t("Yes, record score")}</button><button className="secondary-button" onClick={() => setConfirmFinish(false)}>{t("Keep playing")}</button></div>
            </div>
          ) : (
            <button className="secondary-button competition-finish-attempt" disabled={throws === 0 || inAir || finished} onClick={() => setConfirmFinish(true)}>{t("Finish attempt and record score")}</button>
          )
        ) : null}
        <div className={`five-stones-board active-play-frame ${inAir ? "is-tossing" : ""} ${catchReady ? "catch-window" : ""} ${complete ? "is-complete" : ""} ${paused ? "is-paused" : ""}`} tabIndex={0} aria-label={t("Five stones play area")}>
          <div className="floor-label">{t("FIVE STONES")}</div>
          <div className={`five-stones-catch-cue ${inAir ? "is-visible" : ""} ${catchReady ? "is-ready" : ""}`} aria-live="polite">
            <span>{paused ? t("Paused") : progress < 50 ? t("RISING") : catchReady ? t("CATCH NOW!") : t("Collect {0} more", target - selectedThisThrow.length)}</span>
            <i style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          {celebration ? <div className="five-stones-celebration" role="status">✦ {celebration()} ✦</div> : null}

          <button
            className={`air-stone ${inAir ? "active" : ""}`}
            style={{ top: `${tossY}%` }}
            onClick={catchStone}
            disabled={!catchReady}
            aria-label={t("Catch airborne stone")}
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
              disabled={stone.collected || !inAir || paused || (!selectedThisThrow.includes(stone.id) && selectedThisThrow.length >= target)}
              aria-label={selectedThisThrow.includes(stone.id) ? t("Undo ground stone {0}", index + 1) : t("Ground stone {0}", index + 1)}
              aria-pressed={selectedThisThrow.includes(stone.id) || stone.collected}
            >
              <span><b>{index + 1}</b></span>
            </button>
          ))}
          {paused && <div className="game-pause-overlay" role="status"><strong>{t("Paused — your toss is safe")}</strong><button className="primary-button" onClick={resume}>{t("Resume")}</button></div>}
        </div>

        <p className="control-hint"> {t("Keyboard: 1-4 to collect; Space to toss or catch when the board is focused. Toss, tap the required ground stones, then tap the airborne stone to catch it.")} </p>
      </GamePlayArea>
    </section>
  );
}
