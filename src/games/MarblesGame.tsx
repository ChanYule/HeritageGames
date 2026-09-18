import { useEffect, useRef, useState } from "react";

import DifficultyPicker from "../components/DifficultyPicker";
import InstructionSteps from "../components/InstructionSteps";
import PlayerScoreboard from "../components/PlayerScoreboard";
import TurnTimerPanel from "../components/TurnTimerPanel";
import { difficultySettings, type Difficulty, randomMarblePositions, shotVelocity } from "./mechanics";

type Marble = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  target: boolean;
  captured: boolean;
  color: string;
};

type Player = 0 | 1;

const WIDTH = 900;
const HEIGHT = 560;
const RING = { x: WIDTH / 2, y: HEIGHT / 2, radius: 175 };
const PLAYER_COLORS = ["#2d6d79", "#a84f3e"] as const;
const TURN_SECONDS = 30;

function createMarbles(difficulty: Difficulty): Marble[] {
  const targets: Marble[] = [];
  const colors = ["#d96f46", "#2f7282", "#d6a23d", "#7c6355", "#67864a", "#bd5c72"];
  const positions = randomMarblePositions(Math.random, difficulty);

  for (let i = 0; i < positions.length; i++) {
    targets.push({
      id: i,
      x: RING.x + positions[i].x,
      y: RING.y + positions[i].y,
      vx: 0,
      vy: 0,
      radius: difficultySettings[difficulty].marbleRadius,
      target: true,
      captured: false,
      color: colors[i % colors.length],
    });
  }

  return [
    ...targets,
    {
      id: 100,
      x: RING.x,
      y: HEIGHT - 70,
      vx: 0,
      vy: 0,
      radius: 20,
      target: false,
      captured: false,
      color: PLAYER_COLORS[0],
    },
  ];
}

export default function MarblesGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const settings = difficultySettings[difficulty];

  return (
    <>
      <DifficultyPicker
        value={difficulty}
        onChange={setDifficulty}
        description={`${settings.marbles} targets. Player 1 and Player 2 alternate after every shot. Highest score wins when the ring is empty.`}
      />
      <MarblesRound key={difficulty} difficulty={difficulty} />
    </>
  );
}

function MarblesRound({ difficulty }: { difficulty: Difficulty }) {
  const targetCount = difficultySettings[difficulty].marbles;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const marblesRef = useRef<Marble[]>(createMarbles(difficulty));
  const draggingRef = useRef(false);
  const movingRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);
  const activePlayerRef = useRef<Player>(0);
  const scoresRef = useRef<[number, number]>([0, 0]);
  const capturesRef = useRef<[number, number]>([0, 0]);
  const shotsRef = useRef<[number, number]>([0, 0]);
  const totalCapturedRef = useRef(0);
  const gameOverRef = useRef(false);
  const pausedRef = useRef(false);

  const [activePlayer, setActivePlayer] = useState<Player>(0);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [captures, setCaptures] = useState<[number, number]>([0, 0]);
  const [shots, setShots] = useState<[number, number]>([0, 0]);
  const [aim, setAim] = useState(-90);
  const [power, setPower] = useState(65);
  const [message, setMessage] = useState("Player 1 starts. Drag the shooter backwards and release.");
  const [moving, setMoving] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [paused, setPaused] = useState(false);

  const syncPlayer = (player: Player) => {
    activePlayerRef.current = player;
    setActivePlayer(player);
    const shooter = marblesRef.current.find((marble) => !marble.target);
    if (shooter) shooter.color = PLAYER_COLORS[player];
  };

  const reset = () => {
    marblesRef.current = createMarbles(difficulty);
    draggingRef.current = false;
    movingRef.current = false;
    scoresRef.current = [0, 0];
    capturesRef.current = [0, 0];
    shotsRef.current = [0, 0];
    totalCapturedRef.current = 0;
    gameOverRef.current = false;
    pausedRef.current = false;
    setScores([0, 0]);
    setCaptures([0, 0]);
    setShots([0, 0]);
    setGameOver(false);
    setMoving(false);
    setPaused(false);
    setTimeLeft(TURN_SECONDS);
    syncPlayer(0);
    setMessage("Player 1 starts. Drag the shooter backwards and release.");
  };

  const switchTurnOnTimeout = () => {
    if (gameOverRef.current || movingRef.current || pausedRef.current) return;
    const current = activePlayerRef.current;
    const next = (current === 0 ? 1 : 0) as Player;
    draggingRef.current = false;
    syncPlayer(next);
    setTimeLeft(TURN_SECONDS);
    setMessage(`Player ${current + 1} ran out of time. Pass to Player ${next + 1}.`);
  };

  useEffect(() => {
    setTimeLeft(TURN_SECONDS);
  }, [activePlayer]);

  useEffect(() => {
    if (!timerEnabled || gameOver || moving || paused || timeLeft <= 0) return;
    const timer = window.setTimeout(() => setTimeLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [timerEnabled, gameOver, moving, paused, timeLeft]);

  useEffect(() => {
    if (timerEnabled && !gameOver && !moving && !paused && timeLeft === 0) switchTurnOnTimeout();
  }, [timerEnabled, gameOver, moving, paused, timeLeft]);

  const toggleTimer = (enabled: boolean) => {
    setTimerEnabled(enabled);
    setTimeLeft(TURN_SECONDS);
    if (!enabled) {
      pausedRef.current = false;
      setPaused(false);
    }
  };

  const togglePause = (nextPaused: boolean) => {
    if (!timerEnabled || gameOverRef.current) return;
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
    draggingRef.current = false;
    setMessage(
      nextPaused
        ? `Game paused. Player ${activePlayerRef.current + 1} keeps the turn with ${timeLeft} seconds remaining.`
        : `Player ${activePlayerRef.current + 1} resumes with ${timeLeft} seconds remaining.`,
    );
  };

  const getCanvasPoint = (event: PointerEvent | React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const floor = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      floor.addColorStop(0, "#d8d0bf");
      floor.addColorStop(1, "#c7bdab");
      ctx.fillStyle = floor;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.strokeStyle = "rgba(87, 72, 55, 0.14)";
      ctx.lineWidth = 1;
      for (let x = 0; x < WIDTH; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < HEIGHT; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(RING.x, RING.y, RING.radius, 0, Math.PI * 2);
      ctx.strokeStyle = "#7c5f46";
      ctx.lineWidth = 7;
      ctx.stroke();

      ctx.fillStyle = "rgba(255,250,240,0.88)";
      ctx.fillRect(18, 18, 208, 46);
      ctx.fillStyle = PLAYER_COLORS[activePlayerRef.current];
      ctx.font = "800 17px system-ui";
      ctx.fillText(gameOverRef.current ? "ROUND COMPLETE" : `PLAYER ${activePlayerRef.current + 1} TURN`, 32, 47);

      const marbles = marblesRef.current;

      if (draggingRef.current) {
        const shooter = marbles.find((marble) => !marble.target);
        if (shooter) {
          const pointer = pointerRef.current;
          const dx = shooter.x - pointer.x;
          const dy = shooter.y - pointer.y;
          const length = Math.min(Math.hypot(dx, dy), 170);
          const angle = Math.atan2(dy, dx);
          const endX = shooter.x + Math.cos(angle) * length;
          const endY = shooter.y + Math.sin(angle) * length;

          ctx.setLineDash([10, 8]);
          ctx.strokeStyle = PLAYER_COLORS[activePlayerRef.current];
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(shooter.x, shooter.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.strokeStyle = "rgba(94,70,56,0.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(shooter.x, shooter.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
        }
      }

      marbles.forEach((marble) => {
        if (marble.captured) return;
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 5;

        const gradient = ctx.createRadialGradient(
          marble.x - marble.radius / 2,
          marble.y - marble.radius / 2,
          3,
          marble.x,
          marble.y,
          marble.radius,
        );
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.18, marble.color);
        gradient.addColorStop(1, "#263d42");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(marble.x, marble.y, marble.radius, 0, Math.PI * 2);
        ctx.fill();

        if (!marble.target) {
          ctx.shadowColor = "transparent";
          ctx.strokeStyle = "#fffaf0";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(marble.x, marble.y, marble.radius + 5, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.shadowColor = "transparent";
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(marble.x - 5, marble.y - 5, marble.radius * 0.34, 0, Math.PI * 1.4);
        ctx.stroke();
        ctx.restore();
      });
    };

    const finishTurn = () => {
      movingRef.current = false;
      setMoving(false);
      const currentPlayer = activePlayerRef.current;
      let newlyCaptured = 0;

      marblesRef.current.forEach((marble) => {
        if (!marble.target || marble.captured) return;
        const distance = Math.hypot(marble.x - RING.x, marble.y - RING.y);
        if (distance - marble.radius > RING.radius) {
          marble.captured = true;
          newlyCaptured += 1;
        }
      });

      if (newlyCaptured > 0) {
        const bonus = newlyCaptured > 1 ? newlyCaptured * 50 : 0;
        const gained = newlyCaptured * 100 + bonus;
        const nextScores: [number, number] = [...scoresRef.current] as [number, number];
        const nextCaptures: [number, number] = [...capturesRef.current] as [number, number];
        nextScores[currentPlayer] += gained;
        nextCaptures[currentPlayer] += newlyCaptured;
        scoresRef.current = nextScores;
        capturesRef.current = nextCaptures;
        totalCapturedRef.current += newlyCaptured;
        setScores(nextScores);
        setCaptures(nextCaptures);
      }

      const shooter = marblesRef.current.find((marble) => !marble.target);
      if (shooter) {
        shooter.x = Math.min(Math.max(shooter.x, 60), WIDTH - 60);
        shooter.y = Math.min(Math.max(shooter.y, 60), HEIGHT - 60);
      }

      if (totalCapturedRef.current >= targetCount) {
        gameOverRef.current = true;
        setGameOver(true);
        const [p1, p2] = scoresRef.current;
        if (p1 === p2) setMessage(`Tie game. Both players finish on ${p1} points.`);
        else setMessage(`Player ${p1 > p2 ? 1 : 2} wins with ${Math.max(p1, p2)} points.`);
        return;
      }

      const nextPlayer = (currentPlayer === 0 ? 1 : 0) as Player;
      syncPlayer(nextPlayer);
      setMessage(
        newlyCaptured > 0
          ? `Player ${currentPlayer + 1} captured ${newlyCaptured}. Pass to Player ${nextPlayer + 1}.`
          : `No marble captured. Pass to Player ${nextPlayer + 1}.`,
      );
    };

    const update = (dt: number) => {
      if (pausedRef.current) return;
      const marbles = marblesRef.current;
      let anyMoving = false;

      marbles.forEach((marble) => {
        if (marble.captured) return;
        marble.x += marble.vx * dt;
        marble.y += marble.vy * dt;
        marble.vx *= Math.pow(0.985, dt);
        marble.vy *= Math.pow(0.985, dt);

        if (Math.abs(marble.vx) < 0.02) marble.vx = 0;
        if (Math.abs(marble.vy) < 0.02) marble.vy = 0;

        if (marble.x - marble.radius < 0) {
          marble.x = marble.radius;
          marble.vx *= -0.65;
        }
        if (marble.x + marble.radius > WIDTH) {
          marble.x = WIDTH - marble.radius;
          marble.vx *= -0.65;
        }
        if (marble.y - marble.radius < 0) {
          marble.y = marble.radius;
          marble.vy *= -0.65;
        }
        if (marble.y + marble.radius > HEIGHT) {
          marble.y = HEIGHT - marble.radius;
          marble.vy *= -0.65;
        }

        if (Math.hypot(marble.vx, marble.vy) > 0.03) anyMoving = true;
      });

      for (let i = 0; i < marbles.length; i++) {
        for (let j = i + 1; j < marbles.length; j++) {
          const a = marbles[i];
          const b = marbles[j];
          if (a.captured || b.captured) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy);
          const minDistance = a.radius + b.radius;

          if (distance > 0 && distance < minDistance) {
            const nx = dx / distance;
            const ny = dy / distance;
            const overlap = minDistance - distance;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;

            const relativeVx = b.vx - a.vx;
            const relativeVy = b.vy - a.vy;
            const speedAlongNormal = relativeVx * nx + relativeVy * ny;
            if (speedAlongNormal < 0) {
              const impulse = (-(1 + 0.88) * speedAlongNormal) / 2;
              const ix = impulse * nx;
              const iy = impulse * ny;
              a.vx -= ix;
              a.vy -= iy;
              b.vx += ix;
              b.vy += iy;
            }
          }
        }
      }

      if (!anyMoving && movingRef.current) finishTurn();
    };

    let previous = performance.now();
    let accumulator = 0;
    const frame = (time: number) => {
      accumulator += Math.min(time - previous, 50);
      previous = time;
      while (accumulator >= 1000 / 60) {
        update(1);
        accumulator -= 1000 / 60;
      }
      draw();
      animationRef.current = requestAnimationFrame(frame);
    };

    animationRef.current = requestAnimationFrame(frame);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [targetCount]);

  const takeShot = (vx: number, vy: number) => {
    if (movingRef.current || gameOverRef.current || pausedRef.current) return;
    const shooter = marblesRef.current.find((marble) => !marble.target);
    if (!shooter) return;

    shooter.vx = vx;
    shooter.vy = vy;
    const nextShots: [number, number] = [...shotsRef.current] as [number, number];
    nextShots[activePlayerRef.current] += 1;
    shotsRef.current = nextShots;
    setShots(nextShots);
    draggingRef.current = false;
    movingRef.current = true;
    setMoving(true);
    setMessage(`Player ${activePlayerRef.current + 1}'s shot is rolling...`);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (movingRef.current || gameOverRef.current || pausedRef.current || !event.isPrimary) return;
    const point = getCanvasPoint(event);
    const shooter = marblesRef.current.find((marble) => !marble.target);
    if (!shooter) return;

    if (Math.hypot(point.x - shooter.x, point.y - shooter.y) <= shooter.radius + 20) {
      draggingRef.current = true;
      pointerRef.current = point;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current || pausedRef.current) return;
    pointerRef.current = getCanvasPoint(event);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current || movingRef.current || pausedRef.current) return;
    draggingRef.current = false;
    const point = getCanvasPoint(event);
    const shooter = marblesRef.current.find((marble) => !marble.target);
    if (!shooter) return;

    const dx = shooter.x - point.x;
    const dy = shooter.y - point.y;
    const distance = Math.min(Math.hypot(dx, dy), 180);
    if (distance < 12) {
      setMessage("Pull farther back before releasing.");
      return;
    }

    const velocity = shotVelocity(dx, dy);
    takeShot(velocity.x, velocity.y);
  };

  const shootWithControls = () => {
    const radians = (aim * Math.PI) / 180;
    takeShot(Math.cos(radians) * (power / 100) * 16.2, Math.sin(radians) * (power / 100) * 16.2);
  };

  const totalCaptured = captures[0] + captures[1];
  const remaining = targetCount - totalCaptured;
  const shotDetails: [string, string] = [
    `${shots[0]} shots · ${captures[0]} captured`,
    `${shots[1]} shots · ${captures[1]} captured`,
  ];

  return (
    <section className="game-layout multiplayer-layout">
      <aside className="game-panel">
        <InstructionSteps
          title="Knock marbles out of the ring"
          objective="Take turns using one shooter marble. A target scores only after it fully crosses the ring line."
          steps={[
            "Player 1 takes the first shot. Press the coloured shooter marble.",
            "Drag backwards to set direction and power, then release. You may also use the aim and power controls.",
            "You have 30 seconds to take your shot when the timer is on. Press Pause at any time to freeze the turn and keep the remaining seconds.",
            "The countdown also holds automatically while marbles are rolling. Captured marbles add points to the player who took the shot.",
            "After the shot, or if time reaches 0, pass the device to the other player. Keep alternating until every target leaves the ring.",
          ]}
          tip="A short controlled shot often works better than maximum power. Multi-captures earn bonus points."
        />

        <PlayerScoreboard
          activePlayer={activePlayer}
          scores={scores}
          gameOver={gameOver}
          paused={paused}
          pausedBy={paused ? activePlayer : null}
          secondary={shotDetails}
        />

        <TurnTimerPanel
          enabled={timerEnabled}
          seconds={timeLeft}
          duration={TURN_SECONDS}
          paused={paused}
          autoPaused={moving && !paused}
          gameOver={gameOver}
          onToggle={toggleTimer}
          onPauseToggle={togglePause}
        />

        <div className="mini-stat-row">
          <div><span>Marbles left</span><strong>{remaining}</strong></div>
          <div><span>Total shots</span><strong>{shots[0] + shots[1]}</strong></div>
        </div>

        <div className="turn-message" role="status" aria-live="polite">
          <span className={`player-dot player-dot-${activePlayer + 1}`} />
          <div>
            <strong>{gameOver ? "Game finished" : `Player ${activePlayer + 1}`}</strong>
            <p>{message}</p>
          </div>
        </div>

        <button className="secondary-button" onClick={reset}>Start new match</button>
      </aside>

      <div className="play-column">
        <div className="play-status-bar">
          <div>
            <span className={`player-dot player-dot-${activePlayer + 1}`} />
            <strong>{gameOver ? "Match complete" : `Player ${activePlayer + 1}'s turn`}</strong>
          </div>
          <div className="status-bar-right">
            <span>{remaining} target{remaining === 1 ? "" : "s"} left</span>
            <span className={`timer-inline ${timerEnabled && timeLeft <= 10 && !moving && !paused && !gameOver ? "urgent" : ""}`}>
              {timerEnabled ? (paused ? `Paused · ${timeLeft}s` : moving ? "Shot rolling" : `${timeLeft}s`) : "Timer off"}
            </span>
          </div>
        </div>

        <div className={`canvas-frame active-play-frame pauseable-play-area ${paused ? "is-paused" : ""}`} style={{ borderColor: PLAYER_COLORS[activePlayer] }}>
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { draggingRef.current = false; }}
            aria-label="Marbles ring. Drag the coloured shooter backwards and release."
          />
          {paused ? <div className="game-paused-overlay" role="status"><strong>Paused</strong><span>Player {activePlayer + 1} keeps this turn</span></div> : null}
        </div>

        <div className="shot-controls control-deck">
          <label>
            <span>Aim</span>
            <strong>{aim}°</strong>
            <input aria-label="Aim" type="range" min="-180" max="180" value={aim} disabled={paused || gameOver} onChange={(event) => setAim(Number(event.target.value))} />
          </label>
          <label>
            <span>Power</span>
            <strong>{power}%</strong>
            <input aria-label="Power" type="range" min="15" max="100" value={power} disabled={paused || gameOver} onChange={(event) => setPower(Number(event.target.value))} />
          </label>
          <button className="primary-button" disabled={moving || gameOver || paused} onClick={shootWithControls}>
            {paused ? "Game paused" : moving ? "Marbles rolling..." : `Player ${activePlayer + 1}: Shoot`}
          </button>
        </div>

        <p className="control-hint">
          Direct control: drag backwards from the coloured shooter. Aim control: -90° points upward and 0° points right.
        </p>
      </div>
    </section>
  );
}
