import { useEffect, useMemo, useRef, useState } from "react";

import DifficultyPicker from "../components/DifficultyPicker";
import InstructionSteps from "../components/InstructionSteps";
import PlayerScoreboard from "../components/PlayerScoreboard";
import TurnTimerPanel from "../components/TurnTimerPanel";
import { difficultySettings, type Difficulty, segmentsOverlap } from "./mechanics";

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

export default function PickUpSticksGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const settings = difficultySettings[difficulty];

  return (
    <>
      <DifficultyPicker
        value={difficulty}
        onChange={setDifficulty}
        description={`${settings.sticks} sticks. A clean pickup lets the same player continue. Touching a blocked stick ends the turn.`}
      />
      <SticksRound key={difficulty} difficulty={difficulty} />
    </>
  );
}

function SticksRound({ difficulty }: { difficulty: Difficulty }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<[number, number]>([0, 0]);
  const mistakeRef = useRef<[number, number]>([0, 0]);
  const activePlayerRef = useRef<Player>(0);
  const pausedRef = useRef(false);

  const [hint, setHint] = useState<number | null>(null);
  const [sticks, setSticks] = useState<Stick[]>(() => createSticks(difficulty));
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [mistakes, setMistakes] = useState<[number, number]>([0, 0]);
  const [activePlayer, setActivePlayer] = useState<Player>(0);
  const [streak, setStreak] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [message, setMessage] = useState("Player 1 starts. Pick a stick that sits on top of the pile.");
  const [gameOver, setGameOver] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [paused, setPaused] = useState(false);

  const activeSticks = useMemo(() => sticks.filter((stick) => !stick.removed), [sticks]);

  const setPlayer = (player: Player) => {
    activePlayerRef.current = player;
    setActivePlayer(player);
  };

  const reset = () => {
    setSticks(createSticks(difficulty));
    setHint(null);
    scoreRef.current = [0, 0];
    mistakeRef.current = [0, 0];
    setScores([0, 0]);
    setMistakes([0, 0]);
    setPlayer(0);
    setStreak(0);
    setDragging(null);
    setOrigin(null);
    setGameOver(false);
    pausedRef.current = false;
    setPaused(false);
    setTimeLeft(TURN_SECONDS);
    setMessage("Player 1 starts. Pick a stick that sits on top of the pile.");
  };

  const resetDraggedStickVisual = () => {
    if (dragging === null) return;
    const stick = sticks.find((item) => item.id === dragging);
    const element = boardRef.current?.querySelector<HTMLElement>(`[data-stick-id="${dragging}"]`);
    if (stick && element) {
      element.style.transform = `translate(-50%, -50%) rotate(${stick.angle}deg)`;
    }
  };

  const switchTurnOnTimeout = () => {
    if (gameOver || pausedRef.current) return;
    const current = activePlayerRef.current;
    const next = (current === 0 ? 1 : 0) as Player;
    resetDraggedStickVisual();
    setDragging(null);
    setOrigin(null);
    setHint(null);
    setStreak(0);
    setPlayer(next);
    setTimeLeft(TURN_SECONDS);
    setMessage(`Player ${current + 1} ran out of time. Pass to Player ${next + 1}.`);
  };

  useEffect(() => {
    setTimeLeft(TURN_SECONDS);
  }, [activePlayer]);

  useEffect(() => {
    if (!timerEnabled || gameOver || paused || timeLeft <= 0) return;
    const timer = window.setTimeout(() => setTimeLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [timerEnabled, gameOver, paused, timeLeft]);

  useEffect(() => {
    if (timerEnabled && !gameOver && !paused && timeLeft === 0) switchTurnOnTimeout();
  }, [timerEnabled, gameOver, paused, timeLeft]);

  const toggleTimer = (enabled: boolean) => {
    setTimerEnabled(enabled);
    setTimeLeft(TURN_SECONDS);
    if (!enabled) {
      pausedRef.current = false;
      setPaused(false);
    }
  };

  const togglePause = (nextPaused: boolean) => {
    if (!timerEnabled || gameOver) return;

    if (nextPaused) {
      resetDraggedStickVisual();
      setDragging(null);
      setOrigin(null);
    }

    pausedRef.current = nextPaused;
    setPaused(nextPaused);
    setMessage(
      nextPaused
        ? `Game paused. Player ${activePlayerRef.current + 1} keeps the turn with ${timeLeft} seconds remaining.`
        : `Player ${activePlayerRef.current + 1} resumes with ${timeLeft} seconds remaining.`,
    );
  };

  const isBlocked = (stick: Stick) => {
    const board = boardRef.current;
    const rect = board ? { width: board.clientWidth, height: board.clientHeight } : null;
    if (!rect) return true;

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

    return sticks.some((other) => {
      if (other.removed || other.id <= stick.id) return false;
      const [a, b] = segment(stick);
      const [c, d] = segment(other);
      return segmentsOverlap(a, b, c, d);
    });
  };

  const finishGame = (finalScores: [number, number]) => {
    setGameOver(true);
    if (finalScores[0] === finalScores[1]) {
      setMessage(`Tie game. Both players scored ${finalScores[0]} points.`);
    } else {
      setMessage(`Player ${finalScores[0] > finalScores[1] ? 1 : 2} wins with ${Math.max(...finalScores)} points.`);
    }
  };

  const switchTurnAfterMistake = (reason: string) => {
    const current = activePlayerRef.current;
    const next = (current === 0 ? 1 : 0) as Player;
    const nextMistakes: [number, number] = [...mistakeRef.current] as [number, number];
    nextMistakes[current] += 1;
    mistakeRef.current = nextMistakes;
    setMistakes(nextMistakes);
    setStreak(0);
    setHint(null);
    setPlayer(next);
    setMessage(`${reason} Pass to Player ${next + 1}.`);
  };

  const collect = (stick: Stick) => {
    if (stick.removed || gameOver || pausedRef.current) return;
    if (isBlocked(stick)) {
      switchTurnAfterMistake("That stick is trapped underneath another.");
      return;
    }

    const current = activePlayerRef.current;
    const nextScores: [number, number] = [...scoreRef.current] as [number, number];
    nextScores[current] += stick.points;
    scoreRef.current = nextScores;
    setScores(nextScores);
    setHint(null);
    setStreak((value) => value + 1);
    setSticks((items) => items.map((item) => item.id === stick.id ? { ...item, removed: true } : item));

    if (activeSticks.length === 1) {
      finishGame(nextScores);
      return;
    }

    setMessage(
      stick.points === 50
        ? `Player ${current + 1}: purple stick, +50 points. You keep the turn.`
        : `Clean pickup, +${stick.points}. Player ${current + 1} keeps the turn.`,
    );
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>, stick: Stick) => {
    if (stick.removed || gameOver || pausedRef.current || !event.isPrimary || dragging !== null) return;
    if (isBlocked(stick)) {
      switchTurnAfterMistake("That stick is blocked.");
      return;
    }

    setDragging(stick.id);
    setOrigin({ x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    setMessage(`Player ${activePlayerRef.current + 1}: drag this stick completely away from the pile.`);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>, stick: Stick) => {
    if (pausedRef.current || dragging !== stick.id || !origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    event.currentTarget.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${stick.angle}deg)`;
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>, stick: Stick) => {
    if (pausedRef.current || dragging !== stick.id || !origin) return;

    const distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
    event.currentTarget.style.transform = `translate(-50%, -50%) rotate(${stick.angle}deg)`;

    if (distance > Math.min(90, (boardRef.current?.clientWidth ?? 600) * 0.15)) {
      collect(stick);
    } else {
      setMessage("Move the stick farther away. This does not count as a mistake.");
    }

    setDragging(null);
    setOrigin(null);
  };

  const findHint = () => {
    if (pausedRef.current || gameOver) return;
    const exposed = activeSticks.find((stick) => !isBlocked(stick));
    if (exposed) {
      setHint(exposed.id);
      setMessage(`Player ${activePlayer + 1}: the glowing stick is free. Drag it away.`);
    }
  };

  const scoreDetails: [string, string] = [
    `${mistakes[0]} mistake${mistakes[0] === 1 ? "" : "s"}`,
    `${mistakes[1]} mistake${mistakes[1] === 1 ? "" : "s"}`,
  ];

  return (
    <section className="game-layout multiplayer-layout">
      <aside className="game-panel">
        <InstructionSteps
          title="Lift the top sticks without a mistake"
          objective="Players share one pile. Score points by safely removing exposed sticks."
          steps={[
            "Player 1 starts. Look for a stick that is sitting above the others.",
            "Drag the chosen stick completely away from the pile. Each colour has a point value.",
            "When the timer is on, each player gets 30 seconds for the whole turn. Press Pause to freeze the timer and keep the same player active.",
            "Resume continues from the same number of seconds. A clean pickup scores points and lets the same player continue using the time they have left.",
            "Choosing a blocked stick counts as a mistake. The turn then passes to the other player.",
            "If time reaches 0, the turn passes automatically. When the pile is empty, the higher score wins.",
          ]}
          tip="Use Show a free stick if the pile is difficult to read. Purple sticks are worth 50 points."
        />

        <PlayerScoreboard
          activePlayer={activePlayer}
          scores={scores}
          gameOver={gameOver}
          paused={paused}
          pausedBy={paused ? activePlayer : null}
          secondary={scoreDetails}
        />

        <TurnTimerPanel
          enabled={timerEnabled}
          seconds={timeLeft}
          duration={TURN_SECONDS}
          paused={paused}
          gameOver={gameOver}
          onToggle={toggleTimer}
          onPauseToggle={togglePause}
        />

        <div className="mini-stat-row">
          <div><span>Sticks left</span><strong>{activeSticks.length}</strong></div>
          <div><span>Current streak</span><strong>{streak}</strong></div>
        </div>

        <div className="turn-message" role="status" aria-live="polite">
          <span className={`player-dot player-dot-${activePlayer + 1}`} />
          <div>
            <strong>{gameOver ? "Game finished" : `Player ${activePlayer + 1}`}</strong>
            <p>{message}</p>
          </div>
        </div>

        <div className="game-action-row">
          <button className="secondary-button" disabled={gameOver || paused} onClick={findHint}>Show a free stick</button>
          <button className="secondary-button" onClick={reset}>New match</button>
        </div>
      </aside>

      <div className="play-column">
        <div className="play-status-bar">
          <div>
            <span className={`player-dot player-dot-${activePlayer + 1}`} />
            <strong>{gameOver ? "Match complete" : `Player ${activePlayer + 1}'s turn`}</strong>
          </div>
          <div className="status-bar-right">
            <span>{activeSticks.length} sticks left</span>
            <span className={`timer-inline ${timerEnabled && timeLeft <= 10 && !paused && !gameOver ? "urgent" : ""}`}>
              {timerEnabled ? (paused ? `Paused · ${timeLeft}s` : `${timeLeft}s`) : "Timer off"}
            </span>
          </div>
        </div>

        <div className={`sticks-board active-play-frame pauseable-play-area player-border-${activePlayer + 1} ${paused ? "is-paused" : ""}`} ref={boardRef}>
          <div className="floor-label">PICK-UP STICKS</div>
          {paused ? <div className="game-paused-overlay" role="status"><strong>Paused</strong><span>Player {activePlayer + 1} keeps this turn</span></div> : null}
          {activeSticks.map((stick) => (
            <div
              key={stick.id}
              data-stick-id={stick.id}
              className={`stick ${hint === stick.id ? "hinted" : ""}`}
              style={{
                left: `${stick.x}%`,
                top: `${stick.y}%`,
                width: `${stick.length}%`,
                background: stick.color,
                transform: `translate(-50%, -50%) rotate(${stick.angle}deg)`,
                zIndex: stick.id + 1,
              }}
              onPointerDown={(event) => startDrag(event, stick)}
              onPointerMove={(event) => moveDrag(event, stick)}
              onPointerUp={(event) => finishDrag(event, stick)}
              onPointerCancel={(event) => {
                event.currentTarget.style.transform = `translate(-50%, -50%) rotate(${stick.angle}deg)`;
                setDragging(null);
                setOrigin(null);
              }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
                  event.preventDefault();
                  collect(stick);
                }
              }}
              role="button"
              tabIndex={paused ? -1 : 0}
              aria-disabled={paused}
              aria-label={`Stick worth ${stick.points} points`}
            />
          ))}
        </div>

        <div className="score-key-bar">
          {palette.map((item, index) => (
            <div key={`${item.color}-${index}`}>
              <span className="legend-line" style={{ background: item.color }} />
              <span>{item.points} pts</span>
            </div>
          ))}
        </div>

        <p className="control-hint">
          Mouse or touch: drag a top stick away. Keyboard: Tab to a stick, then Enter or Space to collect it.
        </p>
      </div>
    </section>
  );
}
