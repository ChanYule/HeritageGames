import { t, useLanguage } from "../i18n";
import GamePlayArea from "../components/GamePlayArea";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Timer, TimerOff, Volume2, VolumeX } from "lucide-react";

import DifficultyPicker from "../components/DifficultyPicker";
import InstructionSteps from "../components/InstructionSteps";
import PlayerScoreboard from "../components/PlayerScoreboard";
import TurnTimerPanel from "../components/TurnTimerPanel";
import { difficultySettings, type Difficulty } from "./mechanics";
import type { CompetitionGameProps } from "../types";

import { createSticks, palette, blocked, beginExtraction, moveExtraction, mapStickPoint, selectStick, pickupAward, stickTuning, createMission, advanceMission, type Stick, type Extraction, type ColourMission } from './stickPhysics';
import { playArcadeSound } from './arcadeSound';
type Player = 0 | 1;
const TURN_SECONDS = 30;
const COMPETITION_TURN_SECONDS = 45;

export default function PickUpSticksGame({ playerNames, competitionMode = false, onComplete, individualAttempt, fixedDifficulty, playerColours }: CompetitionGameProps = {}) {
  useLanguage();
  const [difficulty, setDifficulty] = useState<Difficulty>(fixedDifficulty ?? "easy");
  const [difficultyLocked, setDifficultyLocked] = useState(false);
  const settings = difficultySettings[difficulty];

  return (
    <>
      <DifficultyPicker
        value={difficulty}
        onChange={setDifficulty}
        disabled={Boolean(fixedDifficulty) || (competitionMode && difficultyLocked)}
        description={t("{0} sticks. A clean pickup lets you continue. Moving another stick ends your turn.", settings.sticks)}
      />
      <SticksRound individualAttempt={individualAttempt} playerColours={playerColours} difficulty={difficulty} playerNames={playerNames} competitionMode={competitionMode} onComplete={onComplete} onRoundStart={() => { if (competitionMode) setDifficultyLocked(true); }} onDifficultyChange={setDifficulty} canChangeDifficulty={!fixedDifficulty && !difficultyLocked} />
    </>
  );
}

function SticksRound({ difficulty, playerNames, competitionMode = false, onComplete, individualAttempt, playerColours, onRoundStart, onDifficultyChange, canChangeDifficulty }: { difficulty: Difficulty; onRoundStart: () => void; onDifficultyChange: (difficulty: Difficulty) => void; canChangeDifficulty: boolean } & CompetitionGameProps) {
  useLanguage();
  const turnSeconds = competitionMode ? COMPETITION_TURN_SECONDS : TURN_SECONDS;
  const playerLabel = (player: Player) => playerNames?.[player] ?? t("Player {0}", player + 1);
  const boardRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<[number, number]>([0, 0]);
  const mistakeRef = useRef<[number, number]>([0, 0]);
  const activePlayerRef = useRef<Player>(0);
  const pausedRef = useRef(false);
  const awaitingReadyRef = useRef(!individualAttempt);
  const gameOverRef = useRef(false);
  const dragSessionRef = useRef<{ id:number; clientX:number; clientY:number; pointerId:number; time:number } | null>(null);
  const extractionRef = useRef<Extraction | null>(null);
  const streakRef = useRef(0);
  const hintsRef = useRef(0);
  const missionRef = useRef<ColourMission | null>(null);
  const [missionsEnabled, setMissionsEnabled] = useState(false);
  const [mission, setMission] = useState<ColourMission | null>(null);
  const [muted, setMuted] = useState(true);
  const [disturbed, setDisturbed] = useState<number | null>(null);
  const pointPopupTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const reportedRef = useRef(false);
  const previousDifficultyRef = useRef(difficulty);

  const [hint, setHint] = useState<number | null>(null);
  const [sticks, setSticks] = useState<Stick[]>(() => createSticks(difficulty, individualAttempt?.seed));
  const sticksRef = useRef(sticks);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [mistakes, setMistakes] = useState<[number, number]>([0, 0]);
  const [activePlayer, setActivePlayer] = useState<Player>(0);
  const [streak, setStreak] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState(() => () => t("{0} starts. Pick a stick that sits on top of the pile.", playerLabel(0)));
  const [gameOver, setGameOver] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timeLeft, setTimeLeft] = useState(turnSeconds);
  const [paused, setPaused] = useState(false);
  const [awaitingReady, setAwaitingReady] = useState(!individualAttempt);
  const [pointPopup, setPointPopup] = useState<{ id: number; points: number; x: number; y: number } | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "mistake" | null>(null);

  const activeSticks = useMemo(() => sticks.filter((stick) => !stick.removed), [sticks]);
  const selectedStick = activeSticks.find((stick) => stick.id === selected);

  const waitForPlayer = () => {
    awaitingReadyRef.current = !individualAttempt;
    setAwaitingReady(!individualAttempt);
    setSelected(null);
  };

  const beginTurn = () => {
    onRoundStart();
    awaitingReadyRef.current = false;
    setAwaitingReady(false);
    setTimeLeft(turnSeconds);
    setMessage(() => () => t("Select a stick, then drag slowly or use the direction buttons."));
  };

  useEffect(() => {
    if (!gameOver || reportedRef.current || !onComplete) return;
    reportedRef.current = true;
    onComplete({ scores });
  }, [gameOver, onComplete, scores]);

  useEffect(() => () => {
    if (pointPopupTimerRef.current !== null) window.clearTimeout(pointPopupTimerRef.current);
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
  }, []);

  const showFeedback = (tone: "success" | "mistake") => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    setFeedbackTone(tone);
    feedbackTimerRef.current = window.setTimeout(() => setFeedbackTone(null), 900);
  };

  const setPlayer = (player: Player) => {
    activePlayerRef.current = player;
    setActivePlayer(player);
  };

  const reset = () => {
    if (pointPopupTimerRef.current !== null) window.clearTimeout(pointPopupTimerRef.current);
    pointPopupTimerRef.current = null;
    resetDraggedStickVisual();
    const freshSticks = createSticks(difficulty, individualAttempt?.seed);
    sticksRef.current = freshSticks;
    setSticks(freshSticks);
    setHint(null); setDisturbed(null);
    const nextMission = missionsEnabled ? createMission(freshSticks) : null;
    missionRef.current = nextMission; setMission(nextMission);
    scoreRef.current = [0, 0];
    mistakeRef.current = [0, 0];
    setScores([0, 0]);
    setMistakes([0, 0]);
    setPlayer(0);
    streakRef.current = 0; setStreak(0); hintsRef.current = 0;
    setSelected(null);
    waitForPlayer();
    setGameOver(false);
    gameOverRef.current = false;
    reportedRef.current = false;
    pausedRef.current = false;
    setPaused(false);
    setTimeLeft(turnSeconds);
    setMessage(() => () => t("{0} starts. Pick a stick that sits on top of the pile.", playerLabel(0)));
    setPointPopup(null);
    setFeedbackTone(null);
  };

  useEffect(() => {
    if (previousDifficultyRef.current === difficulty) return;
    previousDifficultyRef.current = difficulty;
    reset();
  }, [difficulty]);

  const resetDraggedStickVisual = () => {
    const drag = dragSessionRef.current;
    dragSessionRef.current = null;
    const attempt = extractionRef.current;
    extractionRef.current = null;
    if (attempt && !attempt.complete && attempt.disturbed === null) {
      sticksRef.current = attempt.baseline;
      setSticks(attempt.baseline);
    }
    if (drag && boardRef.current?.hasPointerCapture(drag.pointerId)) boardRef.current.releasePointerCapture(drag.pointerId);
  };

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden || gameOverRef.current || awaitingReadyRef.current) return;
      pausedRef.current = true;
      resetDraggedStickVisual();
      setPaused(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const switchTurnOnTimeout = () => {
    if (gameOverRef.current || pausedRef.current || awaitingReadyRef.current) return;
    if (individualAttempt) { resetDraggedStickVisual(); finishGame(scoreRef.current); return; }
    const current = activePlayerRef.current;
    const next = (current === 0 ? 1 : 0) as Player;
    resetDraggedStickVisual();
    setHint(null);
    streakRef.current = 0; setStreak(0); hintsRef.current = 0;
    setPlayer(next);
    waitForPlayer();
    setTimeLeft(turnSeconds);
    setMessage(() => () => t("{0} ran out of time. Pass to {1}.", playerLabel(current), playerLabel(next)));
  };

  useEffect(() => {
    setTimeLeft(turnSeconds);
  }, [activePlayer]);

  useEffect(() => {
    if (!timerEnabled || gameOver || paused || awaitingReady || timeLeft <= 0) return;
    const timer = window.setTimeout(() => setTimeLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [timerEnabled, gameOver, paused, awaitingReady, timeLeft]);

  useEffect(() => {
    if (timerEnabled && !gameOver && !paused && !awaitingReady && timeLeft === 0) switchTurnOnTimeout();
  }, [timerEnabled, gameOver, paused, awaitingReady, timeLeft]);

  const toggleTimer = (enabled: boolean) => {
    if (competitionMode) return;
    setTimerEnabled(enabled);
    setTimeLeft(turnSeconds);
    if (!enabled) {
      pausedRef.current = false;
      setPaused(false);
    }
  };

  const togglePause = (nextPaused: boolean) => {
    if (gameOverRef.current || awaitingReadyRef.current) return;

    if (nextPaused) {
      resetDraggedStickVisual();
    }

    pausedRef.current = nextPaused;
    setPaused(nextPaused);
    setMessage(() => () => nextPaused
        ? t("Game paused. {0} keeps the turn with {1} seconds remaining.", playerLabel(activePlayerRef.current), timeLeft)
        : t("{0} resumes with {1} seconds remaining.", playerLabel(activePlayerRef.current), timeLeft));
  };

  const isBlocked = (stick: Stick) => blocked(stick, sticksRef.current);

  const finishGame = (finalScores: [number, number]) => {
    gameOverRef.current = true;
    setGameOver(true);
    if (individualAttempt) { setMessage(() => () => t("Attempt complete. Score: {0}.", finalScores[0])); return; }
    if (finalScores[0] === finalScores[1]) {
      setMessage(() => () => t("Tie game. Both players scored {0} points.", finalScores[0]));
    } else {
      setMessage(() => () => t("{0} wins with {1} points.", playerLabel(finalScores[0] > finalScores[1] ? 0 : 1), Math.max(...finalScores)));
    }
  };

  const switchTurnAfterMistake = (reason: () => string) => {
    if (individualAttempt) { streakRef.current = 0; setStreak(0); resetDraggedStickVisual(); showFeedback("mistake"); finishGame(scoreRef.current); setMessage(() => reason); return; }
    const current = activePlayerRef.current;
    const next = (current === 0 ? 1 : 0) as Player;
    const nextMistakes: [number, number] = [...mistakeRef.current] as [number, number];
    nextMistakes[current] += 1;
    mistakeRef.current = nextMistakes;
    setMistakes(nextMistakes);
    streakRef.current = 0; setStreak(0); hintsRef.current = 0;
    setHint(null);
    setPlayer(next);
    resetDraggedStickVisual();
    waitForPlayer();
    setTimeLeft(turnSeconds);
    setMessage(() => () => t("{0} Pass to {1}.", reason(), playerLabel(next)));
    showFeedback("mistake");
  };

  const collect = (stick: Stick) => {
    if (sticksRef.current.find((item) => item.id === stick.id)?.removed || gameOverRef.current || pausedRef.current || awaitingReadyRef.current || document.hidden) return;
    if (!extractionRef.current?.complete || extractionRef.current.id !== stick.id) return;
    extractionRef.current = null;

    const current = activePlayerRef.current;
    const nextScores: [number, number] = [...scoreRef.current] as [number, number];
    const nextStreak = ++streakRef.current;
    const award = pickupAward(stick.points, nextStreak);
    const missionResult = advanceMission(missionRef.current, stick);
    missionRef.current = missionResult.mission; setMission(missionResult.mission);
    const points = award.total + missionResult.bonus;
    nextScores[current] += points;
    scoreRef.current = nextScores;
    setScores(nextScores);
    if (pointPopupTimerRef.current !== null) window.clearTimeout(pointPopupTimerRef.current);
    setPointPopup({ id: Date.now(), points, x: Math.min(85, Math.max(15, stick.x/9)), y: Math.min(85, Math.max(15, stick.y/5.6)) });
    pointPopupTimerRef.current = window.setTimeout(() => setPointPopup(null), 1100);
    showFeedback("success");
    setHint(null);
    setSelected(null);
    setStreak(nextStreak);
    playArcadeSound("pocket", !muted);
    const nextSticks = sticksRef.current.map((item) => item.id === stick.id ? { ...item, removed: true } : item);
    sticksRef.current = nextSticks;
    setSticks(nextSticks);

    if (nextSticks.every((item) => item.removed)) {
      finishGame(nextScores);
      return;
    }

    setMessage(() => () => t("Clean pickup! {0} stick +{1}. Streak {2}. Bonus +{3}. Mission +{4}.", t(stick.name), stick.points, nextStreak, award.bonus, missionResult.bonus));
  };

  const canLift = () => !gameOverRef.current && !pausedRef.current && !awaitingReadyRef.current && !document.hidden;
  const applyMovement = (id:number, dx:number, dy:number, elapsed=100) => {
    if (!canLift()) return;
    onRoundStart();
    if (!extractionRef.current || extractionRef.current.id !== id) extractionRef.current = beginExtraction(sticksRef.current, id);
    const next = moveExtraction(extractionRef.current, dx, dy, difficulty, elapsed);
    extractionRef.current = next;
    sticksRef.current = next.pile; setSticks(next.pile);
    if (next.disturbed !== null) {
      setDisturbed(next.disturbed);
      extractionRef.current = null;
      playArcadeSound("wood", !muted);
      switchTurnAfterMistake(() => t("Stick disturbed! Another stick moved. No points awarded."));
    } else if (next.complete) {
      const stick = next.pile.find(s => s.id === id)!;
      collect(stick);
      resetDraggedStickVisual();
    }
  };
  const startDrag = (event:React.PointerEvent<HTMLDivElement>) => {
    if (!canLift() || !event.isPrimary || event.button !== 0 || dragSessionRef.current) return;
    const rect=event.currentTarget.getBoundingClientRect();
    const point = mapStickPoint(event.clientX,event.clientY,rect);
    const hitRadius=Math.max(stickTuning[difficulty].hit,(event.pointerType === 'mouse' ? 12 : 24)*900/rect.width);
    const stick = selectStick(sticksRef.current, point, difficulty, hitRadius);
    if (!stick) return;
    event.preventDefault(); resetDraggedStickVisual(); setDisturbed(null); setSelected(stick.id);
    extractionRef.current = beginExtraction(sticksRef.current,stick.id);
    dragSessionRef.current = {id:stick.id,clientX:event.clientX,clientY:event.clientY,pointerId:event.pointerId,time:event.timeStamp};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event:React.PointerEvent<HTMLDivElement>) => {
    const drag=dragSessionRef.current;
    if (!drag || drag.pointerId!==event.pointerId) return;
    const rect=event.currentTarget.getBoundingClientRect();
    applyMovement(drag.id,(event.clientX-drag.clientX)*900/rect.width,(event.clientY-drag.clientY)*560/rect.height,event.timeStamp-drag.time);
    if (dragSessionRef.current) dragSessionRef.current={...drag,clientX:event.clientX,clientY:event.clientY,time:event.timeStamp};
  };
  const finishDrag = (event:React.PointerEvent<HTMLDivElement>) => {
    if (dragSessionRef.current?.pointerId!==event.pointerId) return;
    moveDrag(event);
    const drag=dragSessionRef.current; dragSessionRef.current=null;
    if(drag && event.currentTarget.hasPointerCapture(drag.pointerId)) event.currentTarget.releasePointerCapture(drag.pointerId);
    // Keep an unfinished lift selected so direction controls can continue it.
  };
  const nudge = (dx:number,dy:number) => { if(selected!==null) applyMovement(selected,dx,dy,120); };
  const findHint = () => {
    if (!canLift()) return;
    if(hintsRef.current>=stickTuning[difficulty].hints) { setMessage(() => () => t("No free hints left this turn.")); return; }
    const exposed=sticksRef.current.find(s=>!s.removed && !isBlocked(s));
    if(exposed) { resetDraggedStickVisual(); hintsRef.current++; setHint(exposed.id);setSelected(exposed.id);setMessage(() => () => t("The glowing stick is on top. Move it slowly away from the pile.")); }
  };

  const scoreDetails: [string, string] = [
    t("{0} mistake{1}", mistakes[0], mistakes[0] === 1 ? "" : "s"),
    t("{0} mistake{1}", mistakes[1], mistakes[1] === 1 ? "" : "s"),
  ];

  return (
    <section className="game-layout multiplayer-layout sticks-layout">
      <aside className="game-panel">
        <InstructionSteps
          title={t("Pick up a stick without moving the others")}
          objective={individualAttempt ? t("Lift carefully for 45 seconds. Disturbing another stick ends your attempt.") : t("Players share one pile. Score points by safely removing exposed sticks.")}
          steps={[
            t("Select a stick, then drag slowly or use the direction buttons."),
            t("A clean pickup scores points and you keep your turn. Each colour has a point value."),
            individualAttempt ? t("Moving another stick ends your attempt. Selecting is safe.") : t("Moving another stick passes the turn. Selecting is safe."),
            individualAttempt ? t("Your result is saved before the next player presses Ready.") : t("Pass the device when your turn ends. The next player presses I am ready to start."),
          ]}
          tip={t("Find a top stick. Move slowly. Three clean pickups earn +20; five earn +50.")}
        />



        <TurnTimerPanel
          enabled={timerEnabled}
          seconds={timeLeft}
          duration={turnSeconds}
          paused={paused}
          waiting={awaitingReady}
          locked={competitionMode}
          gameOver={gameOver}
          onToggle={toggleTimer}
          onPauseToggle={togglePause}
        />

        <div className="mini-stat-row">
          <div><span>{t("Sticks left")}</span><strong>{activeSticks.length}</strong></div>
          <div><span>{t("Current streak")}</span><strong>{streak}</strong></div>
        </div>

        <div className="turn-message" role="status" aria-live="polite">
          <span className={`player-dot player-dot-${activePlayer + 1}`} />
          <div>
            <strong>{gameOver ? t("Game finished") : playerLabel(activePlayer)}</strong>
            <p>{message()}</p>
          </div>
        </div>

        {!competitionMode && <label><input type="checkbox" checked={missionsEnabled} disabled={scores[0]+scores[1]>0 || Boolean(extractionRef.current)} onChange={e => { const enabled=e.target.checked;setMissionsEnabled(enabled); const m=enabled?createMission(sticksRef.current):null;missionRef.current=m;setMission(m); }} />{t("Colour mission")}</label>}
        <div className="game-action-row">
          <button className="secondary-button" disabled={gameOver || paused || awaitingReady} onClick={findHint}>{t("Show a free stick")}</button>
          {!competitionMode ? <button className="secondary-button" onClick={reset}>{t("New match")}</button> : null}
        </div>
        <details className="stick-value-guide"><summary>{t("Stick values")}</summary><div className="score-key-bar">{palette.map(item => <div key={item.name}><span className="legend-line" style={{background:item.color}} /><span>{t(item.name)}: {item.points}</span></div>)}</div><p>{t("Find a top stick. Move slowly. Three clean pickups earn +20; five earn +50.")}</p></details>
      </aside>

      <GamePlayArea className="sticks-play-area">
        <PlayerScoreboard individual={Boolean(individualAttempt)} colours={playerColours}
          activePlayer={activePlayer}
          scores={scores}
          labels={playerNames}
          gameOver={gameOver}
          paused={paused}
          pausedBy={paused ? activePlayer : null}
          secondary={scoreDetails}
        />
        <div className="fullscreen-only-controls">
          <button className="secondary-button" disabled={gameOver || paused || awaitingReady} onClick={findHint}>{t("Show a free stick")}</button>
          {!competitionMode ? <button className="secondary-button" onClick={reset}>{t("New match")}</button> : null}
        </div>
        <div className="play-status-bar">
          <div>
            <span className={`player-dot player-dot-${activePlayer + 1}`} />
            <strong>{gameOver ? t("Match complete") : t("{0}'s turn", playerLabel(activePlayer))}</strong>
          </div>
          <div className="status-bar-right">
            <span>{t("Sticks {0} · Streak {1}", activeSticks.length, streak)}</span>
            <span className={`timer-inline ${timerEnabled && timeLeft <= 10 && !paused && !awaitingReady && !gameOver ? "urgent" : ""}`}>
              {awaitingReady ? t("Ready when you are") : timerEnabled ? (paused ? t("Paused · {0}s", timeLeft) : t("{0}s", timeLeft)) : t("Timer off")}
            </span>
          </div>
          <span className="fullscreen-score-summary">{playerLabel(0)}: {scores[0]} · {playerLabel(1)}: {scores[1]}</span>
        </div>

        <div className="mobile-game-toolbar" aria-label={t("Mobile turn controls")}>
          <button
            type="button"
            className="mobile-game-control"
            disabled={awaitingReady || gameOver}
            onClick={() => togglePause(!paused)}
          >
            {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
            <span>{paused ? t("Resume") : t("Pause")}</span>
          </button>
          <button
            type="button"
            className="mobile-game-control secondary"
            disabled={gameOver || competitionMode}
            onClick={() => toggleTimer(!timerEnabled)}
          >
            {timerEnabled ? <Timer size={15} aria-hidden="true" /> : <TimerOff size={15} aria-hidden="true" />}
            <span>{t("Timer")} {t(timerEnabled ? "on" : "off")}</span>
          </button>
        </div>

        <div onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={resetDraggedStickVisual} onLostPointerCapture={() => { if (dragSessionRef.current) resetDraggedStickVisual(); }} className={`sticks-board active-play-frame pauseable-play-area player-border-${activePlayer + 1} ${paused ? "is-paused" : ""} ${feedbackTone ? `feedback-${feedbackTone}` : ""}`} ref={boardRef}>
          <div className="floor-label">{t("PICK-UP STICKS")}</div>
          {selectedStick && <div className="stick-selection-cue">{t("{0} stick: {1} points. Move slowly.", t(selectedStick.name), selectedStick.points)}</div>}
          {awaitingReady ? <div className="game-paused-overlay turn-ready-overlay">
            <strong>{t("{0}, ready?", playerLabel(activePlayer))}</strong>
            <span>{t("Take your time passing the device. Your timer starts only when you are ready.")}</span>
            {canChangeDifficulty && scores[0] + scores[1] + mistakes[0] + mistakes[1] === 0 && <div className="ready-level-picker" role="group" aria-label={t("Choose your level")}>
              {(Object.keys(difficultySettings) as Difficulty[]).map(level => <button key={level} type="button" className={difficulty === level ? "is-selected" : ""} aria-pressed={difficulty === level} onClick={() => onDifficultyChange(level)}>{t(difficultySettings[level].label)}</button>)}
            </div>}
            <button type="button" className="primary-button" onClick={beginTurn}>{t("I am ready")}</button>
          </div> : null}
          {paused ? <div className="game-paused-overlay"><strong>{t("Paused")}</strong><span>{t("{0} keeps this turn", playerLabel(activePlayer))}</span><button type="button" className="primary-button" onClick={() => togglePause(false)}>{t("Resume turn")}</button></div> : null}
          {sticks.map((stick) => {
            const selectable = !stick.removed && !isBlocked(stick);
            return <div
              key={stick.id}
              data-stick-id={stick.id}
              className={`stick ${stick.removed ? "removed" : ""} ${selectable ? "is-selectable" : "is-blocked"} ${hint === stick.id ? "hinted" : ""} ${selected === stick.id ? "is-selected" : ""} ${disturbed === stick.id ? "is-disturbed" : ""}`}
              style={{
                left: `${stick.x/9}%`,
                top: `${stick.y/5.6}%`,
                width: `${stick.length/9}%`,
                backgroundColor: stick.color,
                transform: `translate(-50%, -50%) rotate(${stick.angle}deg)`,
                zIndex: stick.id + 1,
                boxShadow: `0 ${1 + stick.id * 0.13}px ${3 + stick.id * 0.34}px rgba(35, 27, 20, ${0.16 + stick.id * 0.002})`,
              }}
              onClick={(event) => { if (event.detail === 0 && canLift()) { resetDraggedStickVisual(); setSelected(stick.id); } }}
              onKeyDown={(event) => {
                if (!canLift()) return;
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); resetDraggedStickVisual(); setSelected(stick.id); }
                const direction:Record<string,number[]> = {ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};
                if(direction[event.key]) { event.preventDefault(); setSelected(stick.id); applyMovement(stick.id,direction[event.key][0],direction[event.key][1]); }
                if(event.key==='Escape') resetDraggedStickVisual();
              }}
              role="button"
              tabIndex={paused || awaitingReady || gameOver || stick.removed ? -1 : 0}
              aria-disabled={paused || awaitingReady || gameOver || stick.removed}
              aria-pressed={selected === stick.id}
              aria-label={t("{0} stick worth {1} points", selectable ? t("Exposed") : t("Trapped"), stick.points)}
            />;
          })}
          {pointPopup ? (
            <span
              key={pointPopup.id}
              className="stick-point-popup"
              style={{ left: `${pointPopup.x}%`, top: `${pointPopup.y}%` }}
              role="status"
            >
              +{pointPopup.points} pts
            </span>
          ) : null}
        </div>

        <div className="stick-pick-controls">
          <p role="status">{message()}</p>
          <div className="stick-directions" role="group" aria-label={t("Controlled lift")}>
            {([["Left",-12,0],["Up",0,-12],["Down",0,12],["Right",12,0]] as const).map(([label,dx,dy]) => <button key={label} className="secondary-button" disabled={!selectedStick || paused || awaitingReady || gameOver} onClick={() => nudge(dx,dy)}>{t(label)}</button>)}
          </div>
          <button className="secondary-button" disabled={gameOver || paused || awaitingReady} onClick={findHint}>{t("Hint")}</button>
          <button className="secondary-button" disabled={!selectedStick || gameOver} onClick={() => { resetDraggedStickVisual(); setSelected(null); }}>{t("Cancel lift")}</button>
          <button className="secondary-button stick-sound-button" aria-label={t(muted ? "Sound off" : "Sound on")} title={t(muted ? "Sound off" : "Sound on")} aria-pressed={muted} onClick={() => setMuted(v=>!v)}>{muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}</button>
          {!competitionMode && <button className="secondary-button" onClick={reset}>{t("New match")}</button>}

          {mission && <span>{mission.remaining ? t("Collect {0}: +{1} mission points",t(mission.name),mission.bonus) : t("Mission complete")}</span>}
        </div>

        <p className="control-hint">{t("Drag slowly. Keyboard: Tab to a stick, Enter to select, Arrow keys to move. Escape cancels.")}</p>
      </GamePlayArea>
    </section>
  );
}
