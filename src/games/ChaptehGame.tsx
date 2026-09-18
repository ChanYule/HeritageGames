import { useEffect, useRef, useState } from "react";

import InstructionSteps from "../components/InstructionSteps";
import PlayerScoreboard from "../components/PlayerScoreboard";
import { canKick } from "./mechanics";

type Chapteh = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
};

type Player = 0 | 1;

const WIDTH = 760;
const HEIGHT = 560;
const GROUND = HEIGHT - 58;
const TOTAL_ROUNDS = 3;

export default function ChaptehGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chaptehRef = useRef<Chapteh>({ x: WIDTH / 2, y: 160, vx: 1.2, vy: 0, radius: 22 });
  const runningRef = useRef(false);
  const rallyRef = useRef(0);
  const activePlayerRef = useRef<Player>(0);
  const roundRef = useRef(1);
  const totalsRef = useRef<[number, number]>([0, 0]);
  const bestRef = useRef<[number, number]>([0, 0]);
  const gameOverRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(performance.now());

  const [running, setRunning] = useState(false);
  const [activePlayer, setActivePlayer] = useState<Player>(0);
  const [round, setRound] = useState(1);
  const [rally, setRally] = useState(0);
  const [totals, setTotals] = useState<[number, number]>([0, 0]);
  const [best, setBest] = useState<[number, number]>([0, 0]);
  const [leftKicks, setLeftKicks] = useState(0);
  const [rightKicks, setRightKicks] = useState(0);
  const [message, setMessage] = useState("Player 1 starts Round 1. Press Start Turn when ready.");
  const [gameOver, setGameOver] = useState(false);

  const syncPlayer = (player: Player) => {
    activePlayerRef.current = player;
    setActivePlayer(player);
  };

  const resetBall = () => {
    chaptehRef.current = { x: WIDTH / 2, y: 150, vx: activePlayerRef.current === 0 ? 1 : -1, vy: 0, radius: 22 };
  };

  const resetMatch = () => {
    runningRef.current = false;
    gameOverRef.current = false;
    roundRef.current = 1;
    totalsRef.current = [0, 0];
    bestRef.current = [0, 0];
    setRunning(false);
    setGameOver(false);
    setRound(1);
    setRally(0);
    setTotals([0, 0]);
    setBest([0, 0]);
    setLeftKicks(0);
    setRightKicks(0);
    syncPlayer(0);
    resetBall();
    setMessage("Player 1 starts Round 1. Press Start Turn when ready.");
  };

  const startTurn = () => {
    if (gameOverRef.current) return;
    resetBall();
    rallyRef.current = 0;
    setRally(0);
    setLeftKicks(0);
    setRightKicks(0);
    runningRef.current = true;
    setRunning(true);
    setMessage(`Player ${activePlayerRef.current + 1}: wait for the chapteh to fall into the kick zone.`);
  };

  const endTurn = (finalRally: number) => {
    if (!runningRef.current) return;
    runningRef.current = false;
    setRunning(false);

    const current = activePlayerRef.current;
    const nextTotals: [number, number] = [...totalsRef.current] as [number, number];
    const nextBest: [number, number] = [...bestRef.current] as [number, number];
    nextTotals[current] += finalRally;
    nextBest[current] = Math.max(nextBest[current], finalRally);
    totalsRef.current = nextTotals;
    bestRef.current = nextBest;
    setTotals(nextTotals);
    setBest(nextBest);

    if (current === 0) {
      syncPlayer(1);
      setMessage(`Player 1 scored ${finalRally}. Pass the device to Player 2 for Round ${roundRef.current}.`);
      return;
    }

    if (roundRef.current < TOTAL_ROUNDS) {
      const nextRound = roundRef.current + 1;
      roundRef.current = nextRound;
      setRound(nextRound);
      syncPlayer(0);
      setMessage(`Round ${nextRound} starts. Pass the device to Player 1.`);
      return;
    }

    gameOverRef.current = true;
    setGameOver(true);
    if (nextTotals[0] === nextTotals[1]) {
      setMessage(`Match tied at ${nextTotals[0]} total kicks each.`);
    } else {
      setMessage(`Player ${nextTotals[0] > nextTotals[1] ? 1 : 2} wins with ${Math.max(...nextTotals)} total kicks.`);
    }
  };

  const kick = (side: "left" | "right") => {
    if (!runningRef.current || gameOverRef.current) return;
    const chapteh = chaptehRef.current;
    const inKickZone = canKick(chapteh.y, chapteh.vy, GROUND);
    const onCorrectHalf = side === "left"
      ? chapteh.x < WIDTH / 2 + 55
      : chapteh.x > WIDTH / 2 - 55;

    if (!inKickZone || !onCorrectHalf) {
      setMessage("Too early or too far from that foot. Wait until the chapteh drops into the shaded zone.");
      return;
    }

    const centerOffset = (chapteh.x - WIDTH / 2) / (WIDTH / 2);
    chapteh.vy = -11.1;
    chapteh.vx += (side === "left" ? 1.35 : -1.35) - centerOffset * 0.5;

    rallyRef.current += 1;
    setRally(rallyRef.current);
    if (side === "left") setLeftKicks((value) => value + 1);
    else setRightKicks((value) => value + 1);

    if (rallyRef.current % 10 === 0) {
      setMessage(`${rallyRef.current} kicks. Keep the rally going.`);
    } else {
      setMessage(side === "left" ? "Clean left-foot kick." : "Clean right-foot kick.");
    }
  };

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.repeat || (event.target instanceof HTMLElement && event.target.matches("input, textarea, select"))) return;
      if (["a", "d", "arrowleft", "arrowright"].includes(event.key.toLowerCase())) event.preventDefault();
      if (event.key.toLowerCase() === "a" || event.key === "ArrowLeft") kick("left");
      if (event.key.toLowerCase() === "d" || event.key === "ArrowRight") kick("right");
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const chapteh = chaptehRef.current;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      background.addColorStop(0, "#e7dfd1");
      background.addColorStop(1, "#c9bea9");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "#9d8f7c";
      ctx.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);

      ctx.strokeStyle = "rgba(89,75,58,0.16)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2, GROUND - 125);
      ctx.lineTo(WIDTH / 2, GROUND);
      ctx.stroke();

      ctx.fillStyle = "rgba(45,109,121,0.15)";
      ctx.fillRect(0, GROUND - 118, WIDTH / 2, 118);
      ctx.fillStyle = "rgba(168,79,62,0.14)";
      ctx.fillRect(WIDTH / 2, GROUND - 118, WIDTH / 2, 118);

      const ready = runningRef.current && canKick(chapteh.y, chapteh.vy, GROUND);
      ctx.fillStyle = ready ? "#315941" : "#625749";
      ctx.font = "800 22px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(
        gameOverRef.current
          ? "MATCH COMPLETE"
          : ready
            ? "KICK NOW"
            : runningRef.current
              ? "WAIT FOR THE DROP"
              : `PLAYER ${activePlayerRef.current + 1} READY`,
        WIDTH / 2,
        42,
      );

      ctx.textAlign = "left";
      ctx.font = "700 15px system-ui";
      ctx.fillStyle = "#2d6d79";
      ctx.fillText("LEFT FOOT", 26, GROUND - 24);
      ctx.fillStyle = "#a84f3e";
      ctx.fillText("RIGHT FOOT", WIDTH - 130, GROUND - 24);

      ctx.save();
      ctx.translate(chapteh.x, chapteh.y);
      ctx.strokeStyle = "#a94f41";
      ctx.lineWidth = 8;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 5, -4);
        ctx.quadraticCurveTo(i * 11, -40, i * 17, -70);
        ctx.stroke();
      }
      ctx.fillStyle = "#d6c493";
      ctx.beginPath();
      ctx.ellipse(0, 6, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#514839";
      ctx.beginPath();
      ctx.ellipse(0, 13, 13, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = "rgba(70,60,50,0.22)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(WIDTH / 2 - 92, GROUND + 12, 52, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(WIDTH / 2 + 92, GROUND + 12, 52, Math.PI, Math.PI * 2);
      ctx.stroke();
    };

    const frame = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 16.67, 2);
      lastTimeRef.current = time;

      if (runningRef.current) {
        const chapteh = chaptehRef.current;
        chapteh.vy += 0.34 * dt;
        chapteh.x += chapteh.vx * dt;
        chapteh.y += chapteh.vy * dt;
        chapteh.vx *= Math.pow(0.998, dt);

        if (chapteh.x < 28) {
          chapteh.x = 28;
          chapteh.vx = Math.abs(chapteh.vx) * 0.75;
        }
        if (chapteh.x > WIDTH - 28) {
          chapteh.x = WIDTH - 28;
          chapteh.vx = -Math.abs(chapteh.vx) * 0.75;
        }

        if (chapteh.y >= GROUND - 2) {
          chapteh.y = GROUND - 2;
          endTurn(rallyRef.current);
        }
      }

      draw();
      animationRef.current = requestAnimationFrame(frame);
    };

    animationRef.current = requestAnimationFrame(frame);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const handleCanvasTap = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    kick(x < rect.width / 2 ? "left" : "right");
  };

  const secondary: [string, string] = [`Best rally ${best[0]}`, `Best rally ${best[1]}`];

  return (
    <section className="game-layout multiplayer-layout">
      <aside className="game-panel">
        <InstructionSteps
          title="Build the longest rally"
          objective={`Each player gets one rally per round. There are ${TOTAL_ROUNDS} rounds. Total successful kicks decide the winner.`}
          steps={[
            "Player 1 starts. Press Start Turn and watch the chapteh fall.",
            "Kick only when it enters the shaded lower zone. Use the left foot when it is on the left and the right foot when it is on the right.",
            "Each successful kick adds 1 to the rally. If the chapteh touches the floor, that turn ends.",
            "Pass the device to the next player. After both players finish, the next round begins.",
            `After ${TOTAL_ROUNDS} rounds, compare total kicks. The higher total wins.`,
          ]}
          tip="Do not tap rapidly. Wait for the chapteh to fall into the kick zone before each kick."
        />

        <PlayerScoreboard
          activePlayer={activePlayer}
          scores={totals}
          gameOver={gameOver}
          secondary={secondary}
        />

        <div className="mini-stat-row">
          <div><span>Round</span><strong>{round}/{TOTAL_ROUNDS}</strong></div>
          <div><span>Current rally</span><strong>{rally}</strong></div>
        </div>

        <div className="turn-message" role="status" aria-live="polite">
          <span className={`player-dot player-dot-${activePlayer + 1}`} />
          <div>
            <strong>{gameOver ? "Match finished" : `Player ${activePlayer + 1}`}</strong>
            <p>{message}</p>
          </div>
        </div>

        <button className="primary-button" disabled={running || gameOver} onClick={startTurn}>
          {gameOver ? "Match complete" : running ? "Turn in progress" : `Start Player ${activePlayer + 1} turn`}
        </button>
        <button className="secondary-button" onClick={resetMatch}>Restart match</button>
      </aside>

      <div className="play-column">
        <div className="play-status-bar">
          <div>
            <span className={`player-dot player-dot-${activePlayer + 1}`} />
            <strong>{gameOver ? "Match complete" : `Round ${round} · Player ${activePlayer + 1}`}</strong>
          </div>
          <span>Rally: {rally}</span>
        </div>

        <div className={`canvas-frame chapteh-frame active-play-frame player-border-${activePlayer + 1}`}>
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            onPointerDown={handleCanvasTap}
            aria-label="Chapteh court. Kick as the falling chapteh enters the shaded zone."
          />
        </div>

        <div className="foot-controls control-deck">
          <button className="kick-button kick-left" disabled={!running} onClick={() => kick("left")}>
            <span>Left foot</span>
            <kbd>A / ←</kbd>
          </button>
          <button className="kick-button kick-right" disabled={!running} onClick={() => kick("right")}>
            <span>Right foot</span>
            <kbd>D / →</kbd>
          </button>
        </div>

        <div className="mini-stat-row play-mini-stats">
          <div><span>Left kicks</span><strong>{leftKicks}</strong></div>
          <div><span>Right kicks</span><strong>{rightKicks}</strong></div>
        </div>

        <p className="control-hint">Keyboard: A or Left Arrow for left foot, D or Right Arrow for right foot. Touch: tap the matching half of the court.</p>
      </div>
    </section>
  );
}
