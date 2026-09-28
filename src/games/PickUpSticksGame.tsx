import { t, useLanguage } from "../i18n";
import GamePlayArea from "../components/GamePlayArea";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Timer, TimerOff } from "lucide-react";

import DifficultyPicker from "../components/DifficultyPicker";
import InstructionSteps from "../components/InstructionSteps";
import PlayerScoreboard from "../components/PlayerScoreboard";
import TurnTimerPanel from "../components/TurnTimerPanel";
import { difficultySettings, type Difficulty, segmentsOverlap } from "./mechanics";
import type { CompetitionGameProps } from "../types";

type Stick = {
  id: number;
  x: number;
  y: number;
  length: number;
  angle: number;
  color: string;
  points: number;
  removed: boolean;
};

type Player = 0 | 1;

const TURN_SECONDS = 30;
const COMPETITION_TURN_SECONDS = 45;

const palette = [
  { color: "#d55f4b", points: 10 },
  { color: "#2d7181", points: 10 },
  { color: "#d7a63d", points: 20 },
  { color: "#5d7f57", points: 20 },
  { color: "#7b5e8b", points: 50 },
];

function createSticks(difficulty: Difficulty): Stick[] {
  const settings = difficultySettings[difficulty];
  const tones = Array.from({ length: settings.sticks }, (_, i) => palette[i % palette.length]);
  for (let i = tones.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tones[i], tones[j]] = [tones[j], tones[i]];
  }

  return tones.map((tone, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * settings.stickSpread,
    y: 40 + Math.random() * 20,
    length: settings.stickLength + Math.random() * 9,
    angle: Math.random() * 180,
    color: tone.color,
    points: tone.points,
    removed: false,
  }));
}

export default function PickUpSticksGame({ playerNames, competitionMode = false, onComplete }: CompetitionGameProps = {}) {
  useLanguage();
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const settings = difficultySettings[difficulty];

  return (
    <>
      <DifficultyPicker
        value={difficulty}
        onChange={setDifficulty}
        disabled={competitionMode}
        description={t("{0} sticks. A clean pickup lets you continue. Lifting a blocked stick ends your turn.", settings.sticks)}
      />
      <SticksRound key={difficulty} difficulty={difficulty} playerNames={playerNames} competitionMode={competitionMode} onComplete={onComplete} />
    </>
  );
}

function SticksRound({ difficulty, playerNames, competitionMode = false, onComplete }: { difficulty: Difficulty } & CompetitionGameProps) {
  useLanguage();
  const turnSeconds = competitionMode ? COMPETITION_TURN_SECONDS : TURN_SECONDS;
  const playerLabel = (player: Player) => playerNames?.[player] ?? t("Player {0}", player + 1);
  const boardRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<[number, number]>([0, 0]);
  const mistakeRef = useRef<[number, number]>([0, 0]);
  const activePlayerRef = useRef<Player>(0);
  const pausedRef = useRef(false);
  const awaitingReadyRef = useRef(true);
  const gameOverRef = useRef(false);
  const dragSessionRef = useRef<{ id: number; x: number; y: number; pointerId: number } | null>(null);
  const pointPopupTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const reportedRef = useRef(false);

  const [hint, setHint] = useState<number | null>(null);
  const [sticks, setSticks] = useState<Stick[]>(() => createSticks(difficulty));
  const sticksRef = useRef(sticks);
  const [boardSize, setBoardSize] = useState({ width: 900, height: 520 });
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
  const [awaitingReady, setAwaitingReady] = useState(true);
  const [pointPopup, setPointPopup] = useState<{ id: number; points: number; x: number; y: number } | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "mistake" | null>(null);

  const activeSticks = useMemo(() => sticks.filter((stick) => !stick.removed), [sticks]);
  const selectedStick = activeSticks.find((stick) => stick.id === selected);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const measure = () => setBoardSize({ width: board.clientWidth, height: board.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  const waitForPlayer = () => {
    awaitingReadyRef.current = true;
    setAwaitingReady(true);
    setSelected(null);
  };

  const beginTurn = () => {
    awaitingReadyRef.current = false;
    setAwaitingReady(false);
    setTimeLeft(turnSeconds);
    setMessage(() => () => t("{0}: tap a top stick, then press Lift selected stick.", playerLabel(activePlayerRef.current)));
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
    const freshSticks = createSticks(difficulty);
    sticksRef.current = freshSticks;
    setSticks(freshSticks);
    setHint(null);
    scoreRef.current = [0, 0];
    mistakeRef.current = [0, 0];
    setScores([0, 0]);
    setMistakes([0, 0]);
    setPlayer(0);
    setStreak(0);
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

  const resetDraggedStickVisual = () => {
    const drag = dragSessionRef.current;
    if (!drag) return;
    dragSessionRef.current = null;
    const stick = sticksRef.current.find((item) => item.id === drag.id);
    const element = boardRef.current?.querySelector<HTMLElement>(`[data-stick-id="${drag.id}"]`);
    if (stick && element) {
      element.style.transform = `translate(-50%, -50%) rotate(${stick.angle}deg)`;
      if (element.hasPointerCapture(drag.pointerId)) element.releasePointerCapture(drag.pointerId);
    }
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
    const current = activePlayerRef.current;
    const next = (current === 0 ? 1 : 0) as Player;
    resetDraggedStickVisual();
    setHint(null);
    setStreak(0);
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

  const isBlocked = (stick: Stick) => {
    const rect = boardSize;

    const segment = (item: Stick) => {
      const angle = (item.angle * Math.PI) / 180;
      const half = (item.length / 100) * rect.width / 2;
      const x = (item.x / 100) * rect.width;
      const y = (item.y / 100) * rect.height;
      return [
        { x: x - Math.cos(angle) * half, y: y - Math.sin(angle) * half },
        { x: x + Math.cos(angle) * half, y: y + Math.sin(angle) * half },
      ] as const;
    };

    return sticksRef.current.some((other) => {
      if (other.removed || other.id <= stick.id) return false;
      const [a, b] = segment(stick);
      const [c, d] = segment(other);
      return segmentsOverlap(a, b, c, d);
    });
  };

  const finishGame = (finalScores: [number, number]) => {
    gameOverRef.current = true;
    setGameOver(true);
    if (finalScores[0] === finalScores[1]) {
      setMessage(() => () => t("Tie game. Both players scored {0} points.", finalScores[0]));
    } else {
      setMessage(() => () => t("{0} wins with {1} points.", playerLabel(finalScores[0] > finalScores[1] ? 0 : 1), Math.max(...finalScores)));
    }
  };

  const switchTurnAfterMistake = (reason: () => string) => {
    const current = activePlayerRef.current;
    const next = (current === 0 ? 1 : 0) as Player;
    const nextMistakes: [number, number] = [...mistakeRef.current] as [number, number];
    nextMistakes[current] += 1;
    mistakeRef.current = nextMistakes;
    setMistakes(nextMistakes);
    setStreak(0);
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
    if (isBlocked(stick)) {
      switchTurnAfterMistake(() => t("That stick is trapped underneath another."));
      return;
    }

    const current = activePlayerRef.current;
    const nextScores: [number, number] = [...scoreRef.current] as [number, number];
    nextScores[current] += stick.points;
    scoreRef.current = nextScores;
    setScores(nextScores);
    if (pointPopupTimerRef.current !== null) window.clearTimeout(pointPopupTimerRef.current);
    setPointPopup({ id: Date.now(), points: stick.points, x: stick.x, y: stick.y });
    pointPopupTimerRef.current = window.setTimeout(() => setPointPopup(null), 1100);
    showFeedback("success");
    setHint(null);
    setSelected(null);
    setStreak((value) => value + 1);
    const nextSticks = sticksRef.current.map((item) => item.id === stick.id ? { ...item, removed: true } : item);
    sticksRef.current = nextSticks;
    setSticks(nextSticks);

    if (nextSticks.every((item) => item.removed)) {
      finishGame(nextScores);
      return;
    }

    setMessage(() => () => stick.points === 50
        ? t("{0}: purple stick, +50 points. You keep the turn.", playerLabel(current))
        : t("Clean pickup, +{0}. {1} keeps the turn.", stick.points, playerLabel(current)));
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>, stick: Stick) => {
    if (stick.removed || gameOverRef.current || pausedRef.current || awaitingReadyRef.current || document.hidden || !event.isPrimary || event.button !== 0 || dragSessionRef.current) return;
    event.preventDefault();
    setSelected(stick.id);
    dragSessionRef.current = { id: stick.id, x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    setMessage(() => () => t("Stick selected: {0} points. Press Lift selected stick, or drag it away.", stick.points));
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>, stick: Stick) => {
    const drag = dragSessionRef.current;
    if (pausedRef.current || awaitingReadyRef.current || drag?.id !== stick.id || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    event.currentTarget.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${stick.angle}deg)`;
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>, stick: Stick) => {
    const drag = dragSessionRef.current;
    if (pausedRef.current || awaitingReadyRef.current || drag?.id !== stick.id || drag.pointerId !== event.pointerId) return;

    const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
    resetDraggedStickVisual();

    const board = boardRef.current;
    const boardSize = Math.min(board?.clientWidth ?? 600, board?.clientHeight ?? 420);
    const threshold = event.pointerType === "touch"
      ? Math.max(44, Math.min(72, boardSize * 0.12))
      : Math.max(36, Math.min(64, boardSize * 0.1));

    if (distance > threshold) {
      collect(stick);
    }
  };

  const findHint = () => {
    if (pausedRef.current || gameOverRef.current || awaitingReadyRef.current) return;
    const exposed = activeSticks.find((stick) => !isBlocked(stick));
    if (exposed) {
      setHint(exposed.id);
      setSelected(exposed.id);
      setMessage(() => () => t("The glowing stick is free. Press Lift selected stick."));
    }
  };

  const scoreDetails: [string, string] = [
    t("{0} mistake{1}", mistakes[0], mistakes[0] === 1 ? "" : "s"),
    t("{0} mistake{1}", mistakes[1], mistakes[1] === 1 ? "" : "s"),
  ];

  return (
    <section className="game-layout multiplayer-layout sticks-layout">
      <aside className="game-panel">
        <InstructionSteps
          title={t("Lift the top sticks without a mistake")}
          objective={t("Players share one pile. Score points by safely removing exposed sticks.")}
          steps={[
            t("Tap a stick on top of the pile, then press Lift selected stick. You can also drag it away."),
            t("A clean pickup scores points and you keep your turn. Each colour has a point value."),
            t("Lifting a blocked stick passes the turn. Tapping to select a stick is safe."),
            t("Pass the device when your turn ends. The next player presses I am ready to start."),
          ]}
          tip={t("Use Show a free stick if the pile is difficult to read. Purple sticks are worth 50 points.")}
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

        <div className="game-action-row">
          <button className="secondary-button" disabled={gameOver || paused || awaitingReady} onClick={findHint}>{t("Show a free stick")}</button>
          {!competitionMode ? <button className="secondary-button" onClick={reset}>{t("New match")}</button> : null}
        </div>
      </aside>

      <GamePlayArea className="sticks-play-area">
        <PlayerScoreboard
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
            <span>{activeSticks.length} {t("sticks left")}</span>
            <span className={`timer-inline ${timerEnabled && timeLeft <= 10 && !paused && !awaitingReady && !gameOver ? "urgent" : ""}`}>
              {awaitingReady ? t("Ready when you are") : timerEnabled ? (paused ? t("Paused · {0}s", timeLeft) : t("{0}s", timeLeft)) : t("Timer off")}
            </span>
          </div>
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

        <div className={`sticks-board active-play-frame pauseable-play-area player-border-${activePlayer + 1} ${paused ? "is-paused" : ""} ${feedbackTone ? `feedback-${feedbackTone}` : ""}`} ref={boardRef}>
          <div className="floor-label">{t("PICK-UP STICKS")}</div>
          {awaitingReady ? <div className="game-paused-overlay turn-ready-overlay">
            <strong>{t("{0}, ready?", playerLabel(activePlayer))}</strong>
            <span>{t("Take your time passing the device. Your timer starts only when you are ready.")}</span>
            <button type="button" className="primary-button" onClick={beginTurn}>{t("I am ready")}</button>
          </div> : null}
          {paused ? <div className="game-paused-overlay"><strong>{t("Paused")}</strong><span>{t("{0} keeps this turn", playerLabel(activePlayer))}</span><button type="button" className="primary-button" onClick={() => togglePause(false)}>{t("Resume turn")}</button></div> : null}
          {sticks.map((stick) => {
            const selectable = !stick.removed && !isBlocked(stick);
            return <div
              key={stick.id}
              data-stick-id={stick.id}
              className={`stick ${stick.removed ? "removed" : ""} ${selectable ? "is-selectable" : "is-blocked"} ${hint === stick.id ? "hinted" : ""} ${selected === stick.id ? "is-selected" : ""}`}
              style={{
                left: `${stick.x}%`,
                top: `${stick.y}%`,
                width: `${stick.length}%`,
                backgroundColor: stick.color,
                transform: `translate(-50%, -50%) rotate(${stick.angle}deg)`,
                zIndex: stick.id + 1,
                boxShadow: `0 ${1 + stick.id * 0.13}px ${3 + stick.id * 0.34}px rgba(35, 27, 20, ${0.16 + stick.id * 0.002})`,
              }}
              onPointerDown={(event) => startDrag(event, stick)}
              onPointerMove={(event) => moveDrag(event, stick)}
              onPointerUp={(event) => finishDrag(event, stick)}
              onPointerCancel={resetDraggedStickVisual}
              onLostPointerCapture={resetDraggedStickVisual}
              onClick={(event) => { if (event.detail === 0) collect(stick); }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
                  event.preventDefault();
                  collect(stick);
                }
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
          <p role="status">{selectedStick ? t("Selected stick: {0} points", selectedStick.points) : t("Tap a stick to select it.")}</p>
          <button type="button" className="primary-button" disabled={!selectedStick || paused || awaitingReady || gameOver} onClick={() => { if (selectedStick) collect(selectedStick); }}>{t("Lift selected stick")}</button>
          <button type="button" className="secondary-button" disabled={gameOver || paused || awaitingReady} onClick={findHint}>{t("Show a free stick")}</button>
        </div>

        <div className="score-key-bar">
          {palette.map((item, index) => (
            <div key={`${item.color}-${index}`}>
              <span className="legend-line" style={{ background: item.color }} />
              <span>{item.points} pts</span>
            </div>
          ))}
        </div>

        <p className="control-hint">{t("Tap and lift, or drag a top stick away. Keyboard: Tab to a stick, then Enter or Space to lift it.")}</p>
      </GamePlayArea>
    </section>
  );
}
