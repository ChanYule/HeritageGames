import GamePlayArea from "../components/GamePlayArea";
import { useEffect, useRef, useState } from "react";

import InstructionSteps from "../components/InstructionSteps";
import PlayerScoreboard from "../components/PlayerScoreboard";
import { canKick, chaptehFlightTuning, chaptehPaceLevel } from "./mechanics";

type Chapteh = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
};

type Player = 0 | 1;
type Side = "left" | "right";
type KickParticle = { x: number; y: number; vx: number; vy: number; life: number; side: Side };

type ComboTier = "base" | "nice" | "great" | "epic" | "legend";

type ComboData = {
  tier: ComboTier;
  label: string;
  helper: string;
  nextMilestone: number | null;
  progress: number;
};

const WIDTH = 760;
const HEIGHT = 560;
const GROUND = HEIGHT - 58;
const MID = WIDTH / 2;
const WIN_SCORE = 7;
const PLAYER_COLORS = ["#2d6d79", "#a84f3e"] as const;
const PACE_LABELS = ["Warm-up", "Steady", "Quick", "Fast", "Expert", "Legend"] as const;

function getComboData(rally: number): ComboData {
  if (rally >= 16) {
    return { tier: "legend", label: "LEGEND COMBO", helper: "Maximum momentum unlocked", nextMilestone: null, progress: 1 };
  }
  if (rally >= 12) {
    return {
      tier: "epic",
      label: "EPIC COMBO",
      helper: "Push for the legend tier",
      nextMilestone: 16,
      progress: Math.min(1, (rally - 12) / 4),
    };
  }
  if (rally >= 8) {
    return {
      tier: "great",
      label: "GREAT COMBO",
      helper: "Four more kicks to reach epic",
      nextMilestone: 12,
      progress: Math.min(1, (rally - 8) / 4),
    };
  }
  if (rally >= 4) {
    return {
      tier: "nice",
      label: "NICE COMBO",
      helper: "Build toward the next level",
      nextMilestone: 8,
      progress: Math.min(1, (rally - 4) / 4),
    };
  }
  return {
    tier: "base",
    label: "COMBO BUILDING",
    helper: "Reach 4 kicks for the first combo",
    nextMilestone: 4,
    progress: Math.min(1, rally / 4),
  };
}

export default function ChaptehGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chaptehRef = useRef<Chapteh>({ x: WIDTH * 0.27, y: 150, vx: 0, vy: 0, radius: 22 });
  const runningRef = useRef(false);
  const rallyRef = useRef(0);
  const expectedPlayerRef = useRef<Player>(0);
  const serverRef = useRef<Player>(0);
  const scoresRef = useRef<[number, number]>([0, 0]);
  const kicksRef = useRef<[number, number]>([0, 0]);
  const longestRallyRef = useRef(0);
  const gameOverRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<KickParticle[]>([]);
  const lastTimeRef = useRef(performance.now());
  const audioContextRef = useRef<AudioContext | null>(null);
  const paceLevelRef = useRef(0);
  const kickWindowPlayerRef = useRef<Player | null>(null);

  const [running, setRunning] = useState(false);
  const [expectedPlayer, setExpectedPlayer] = useState<Player>(0);
  const [server, setServer] = useState<Player>(0);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [kicks, setKicks] = useState<[number, number]>([0, 0]);
  const [rally, setRally] = useState(0);
  const [streakCelebration, setStreakCelebration] = useState("");
  const [longestRally, setLongestRally] = useState(0);
  const [message, setMessage] = useState("Player 1 serves first from the left. Start the rally when both players are ready.");
  const [gameOver, setGameOver] = useState(false);
  const [paceLevel, setPaceLevel] = useState(0);
  const [kickWindowPlayer, setKickWindowPlayer] = useState<Player | null>(null);

  const combo = getComboData(rally);

  const setExpected = (player: Player) => {
    expectedPlayerRef.current = player;
    setExpectedPlayer(player);
  };

  const setNextServer = (player: Player) => {
    serverRef.current = player;
    setServer(player);
    setExpected(player);
  };

  const getAudioContext = () => {
    if (typeof window === "undefined") return null;
    if (audioContextRef.current) return audioContextRef.current;
    const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    const context = new AudioCtor();
    audioContextRef.current = context;
    return context;
  };

  const playComboCue = (nextRally: number) => {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }

    const scheduleTone = (start: number, frequency: number, duration: number, volume: number, type: OscillatorType) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    };

    const now = context.currentTime + 0.01;
    const tier = getComboData(nextRally).tier;
    const baseFrequency = 360 + Math.min(nextRally, 16) * 18;
    scheduleTone(now, baseFrequency, 0.09, 0.04, "triangle");

    if (nextRally >= 4) scheduleTone(now + 0.08, baseFrequency * 1.25, 0.08, 0.035, "sine");
    if (nextRally >= 8) scheduleTone(now + 0.16, baseFrequency * 1.5, 0.09, 0.04, "triangle");
    if (nextRally >= 12) scheduleTone(now + 0.26, baseFrequency * 1.75, 0.11, 0.05, "sawtooth");
    if (tier === "legend") scheduleTone(now + 0.40, baseFrequency * 2, 0.13, 0.055, "square");
  };

  const resetBallForServer = (player: Player) => {
    chaptehRef.current = {
      x: player === 0 ? WIDTH * 0.27 : WIDTH * 0.73,
      y: 150,
      vx: 0,
      vy: 0,
      radius: 22,
    };
    particlesRef.current = [];
  };

  const resetMatch = () => {
    runningRef.current = false;
    gameOverRef.current = false;
    rallyRef.current = 0;
    scoresRef.current = [0, 0];
    kicksRef.current = [0, 0];
    longestRallyRef.current = 0;
    setRunning(false);
    setGameOver(false);
    setScores([0, 0]);
    setKicks([0, 0]);
    setRally(0);
    setStreakCelebration("");
    setLongestRally(0);
    paceLevelRef.current = 0;
    setPaceLevel(0);
    kickWindowPlayerRef.current = null;
    setKickWindowPlayer(null);
    setNextServer(0);
    resetBallForServer(0);
    setMessage("Player 1 serves first from the left. Start the rally when both players are ready.");
  };

  const startRally = () => {
    if (gameOverRef.current || runningRef.current) return;
    const servingPlayer = serverRef.current;
    resetBallForServer(servingPlayer);
    rallyRef.current = 0;
    setRally(0);
    setStreakCelebration("");
    setExpected(servingPlayer);
    kickWindowPlayerRef.current = null;
    setKickWindowPlayer(null);
    const nextPace = chaptehPaceLevel(0, scoresRef.current[0] + scoresRef.current[1]);
    paceLevelRef.current = nextPace;
    setPaceLevel(nextPace);
    runningRef.current = true;
    setRunning(true);
    setMessage(
      `Player ${servingPlayer + 1} serves. Let it drop into your shaded zone, then kick it across to Player ${servingPlayer === 0 ? 2 : 1}.`,
    );
  };

  const finishPoint = (scorer: Player, reason: string) => {
    if (!runningRef.current) return;
    runningRef.current = false;
    setRunning(false);
    particlesRef.current = [];
    kickWindowPlayerRef.current = null;
    setKickWindowPlayer(null);

    const nextScores: [number, number] = [...scoresRef.current] as [number, number];
    nextScores[scorer] += 1;
    scoresRef.current = nextScores;
    setScores(nextScores);
    const nextPace = chaptehPaceLevel(0, nextScores[0] + nextScores[1]);
    paceLevelRef.current = nextPace;
    setPaceLevel(nextPace);

    const finalRally = rallyRef.current;
    if (finalRally > longestRallyRef.current) {
      longestRallyRef.current = finalRally;
      setLongestRally(finalRally);
    }

    rallyRef.current = 0;
    setRally(0);
    setStreakCelebration("");

    if (nextScores[scorer] >= WIN_SCORE) {
      gameOverRef.current = true;
      setGameOver(true);
      setExpected(scorer);
      setMessage(`Player ${scorer + 1} wins ${nextScores[0]}–${nextScores[1]}. ${reason}`);
      return;
    }

    setNextServer(scorer);
    resetBallForServer(scorer);
    setMessage(`Point to Player ${scorer + 1}. ${reason} Player ${scorer + 1} serves the next rally.`);
  };

  const kick = (side: Side) => {
    if (!runningRef.current || gameOverRef.current) return;

    const player: Player = side === "left" ? 0 : 1;
    const chapteh = chaptehRef.current;
    const expected = expectedPlayerRef.current;

    if (player !== expected) {
      setMessage(`Player ${expected + 1} must make the next kick on the ${expected === 0 ? "left" : "right"} side.`);
      return;
    }

    const onOwnSide = player === 0 ? chapteh.x < MID : chapteh.x >= MID;
    if (!onOwnSide) {
      setMessage(`Wait for the chapteh to reach Player ${player + 1}'s ${player === 0 ? "left" : "right"} side.`);
      return;
    }

    if (!canKick(chapteh.y, chapteh.vy, GROUND)) {
      setMessage(`Player ${player + 1}: wait until the chapteh drops into your lower kick zone.`);
      return;
    }

    const direction = player === 0 ? 1 : -1;
    const nextRally = rallyRef.current + 1;
    const nextPace = chaptehPaceLevel(nextRally, scoresRef.current[0] + scoresRef.current[1]);
    const { horizontalSpeed } = chaptehFlightTuning(nextPace);
    paceLevelRef.current = nextPace;
    setPaceLevel(nextPace);
    chapteh.vy = -10.9;
    chapteh.vx = direction * horizontalSpeed;

    for (let index = 0; index < 10; index++) {
      const spread = (index - 4.5) * 0.3;
      particlesRef.current.push({
        x: chapteh.x,
        y: chapteh.y + 12,
        vx: spread + direction * 0.9,
        vy: -1.5 - (index % 3) * 0.4,
        life: 1,
        side,
      });
    }

    const nextKicks: [number, number] = [...kicksRef.current] as [number, number];
    nextKicks[player] += 1;
    kicksRef.current = nextKicks;
    setKicks(nextKicks);

    rallyRef.current = nextRally;
    setRally(nextRally);
    playComboCue(nextRally);

    if (nextRally >= 12) {
      setStreakCelebration("EPIC RALLY");
    } else if (nextRally >= 8) {
      setStreakCelebration("GREAT RALLY");
    } else if (nextRally >= 4) {
      setStreakCelebration("NICE RALLY");
    } else {
      setStreakCelebration("");
    }

    const nextPlayer = (player === 0 ? 1 : 0) as Player;
    setExpected(nextPlayer);

    if (nextRally > 0 && nextRally % 6 === 0) {
      setMessage(`${nextRally}-kick rally. Player ${nextPlayer + 1}, get ready on the ${nextPlayer === 0 ? "left" : "right"}.`);
    } else {
      setMessage(`Good kick. Player ${nextPlayer + 1} is next.`);
    }
  };

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.repeat || (event.target instanceof HTMLElement && event.target.matches("input, textarea, select"))) return;
      const key = event.key.toLowerCase();
      if (["a", "d", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
      if (key === "a" || event.key === "ArrowLeft") kick("left");
      if (key === "d" || event.key === "ArrowRight") kick("right");
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, []);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawCourtLabel = (player: Player, title: string, controls: string, x: number) => {
      const color = PLAYER_COLORS[player];
      ctx.textAlign = "center";
      ctx.fillStyle = color;
      ctx.font = "900 19px system-ui";
      ctx.fillText(title, x, 82);
      ctx.font = "700 12px system-ui";
      ctx.fillStyle = "rgba(47,42,36,0.7)";
      ctx.fillText(controls, x, 103);
    };

    const draw = () => {
      const chapteh = chaptehRef.current;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      background.addColorStop(0, "#eee7d9");
      background.addColorStop(1, "#c9bea9");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "rgba(45,109,121,0.11)";
      ctx.fillRect(0, 0, MID, GROUND);
      ctx.fillStyle = "rgba(168,79,62,0.10)";
      ctx.fillRect(MID, 0, MID, GROUND);

      ctx.fillStyle = "#9d8f7c";
      ctx.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);

      ctx.strokeStyle = "rgba(89,75,58,0.32)";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(MID, 0);
      ctx.lineTo(MID, GROUND);
      ctx.stroke();
      ctx.setLineDash([]);

      const expected = expectedPlayerRef.current;
      const ready = runningRef.current && canKick(chapteh.y, chapteh.vy, GROUND) && (expected === 0 ? chapteh.x < MID : chapteh.x >= MID);
      const readyPlayer = ready ? expected : null;
      if (kickWindowPlayerRef.current !== readyPlayer) {
        kickWindowPlayerRef.current = readyPlayer;
        setKickWindowPlayer(readyPlayer);
      }
      const expectedX = expected === 0 ? MID / 2 : MID + MID / 2;
      const zoneX = expected === 0 ? 0 : MID;

      if (runningRef.current) {
        ctx.fillStyle = expected === 0 ? "rgba(45,109,121,0.16)" : "rgba(168,79,62,0.15)";
        ctx.fillRect(zoneX, GROUND - 125, MID, 125);
        ctx.strokeStyle = PLAYER_COLORS[expected];
        ctx.lineWidth = 3;
        ctx.strokeRect(zoneX + 8, GROUND - 117, MID - 16, 109);
      }

      drawCourtLabel(0, "PLAYER 1 · LEFT", "A / ←  ·  tap left", MID / 2);
      drawCourtLabel(1, "PLAYER 2 · RIGHT", "D / →  ·  tap right", MID + MID / 2);

      ctx.textAlign = "center";
      ctx.font = "900 24px system-ui";
      ctx.fillStyle = gameOverRef.current ? "#2f2a24" : PLAYER_COLORS[expected];
      ctx.fillText(
        gameOverRef.current
          ? "MATCH COMPLETE"
          : !runningRef.current
            ? `PLAYER ${serverRef.current + 1} SERVES NEXT`
            : ready
              ? `PLAYER ${expected + 1} · KICK NOW`
              : `PLAYER ${expected + 1} · GET READY`,
        WIDTH / 2,
        40,
      );

      if (runningRef.current && ready) {
        ctx.strokeStyle = PLAYER_COLORS[expected];
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(chapteh.x, chapteh.y, 34, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = PLAYER_COLORS[expected];
        ctx.font = "800 13px system-ui";
        ctx.fillText("KICK", expectedX, GROUND - 92);
      }

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

      particlesRef.current.forEach((particle) => {
        ctx.globalAlpha = Math.max(0, particle.life);
        ctx.fillStyle = particle.side === "left" ? PLAYER_COLORS[0] : PLAYER_COLORS[1];
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 3.5 * particle.life, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.textAlign = "left";
    };

    const frame = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 16.67, 2);
      lastTimeRef.current = time;

      if (runningRef.current) {
        const chapteh = chaptehRef.current;
        const { gravity } = chaptehFlightTuning(paceLevelRef.current);
        chapteh.vy += gravity * dt;
        chapteh.x += chapteh.vx * dt;
        chapteh.y += chapteh.vy * dt;
        chapteh.vx *= Math.pow(0.999, dt);

        particlesRef.current = particlesRef.current
          .map((particle) => ({
            ...particle,
            x: particle.x + particle.vx * dt,
            y: particle.y + particle.vy * dt,
            vy: particle.vy + 0.08 * dt,
            life: particle.life - 0.035 * dt,
          }))
          .filter((particle) => particle.life > 0);

        if (chapteh.x < -30) {
          finishPoint(1, "The chapteh went out past Player 1's side.");
        } else if (chapteh.x > WIDTH + 30) {
          finishPoint(0, "The chapteh went out past Player 2's side.");
        } else if (chapteh.y >= GROUND - 2) {
          chapteh.y = GROUND - 2;
          const landingPlayer: Player = chapteh.x < MID ? 0 : 1;
          const scorer = (landingPlayer === 0 ? 1 : 0) as Player;
          finishPoint(scorer, `The chapteh landed on Player ${landingPlayer + 1}'s side.`);
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

  const secondary: [string, string] = [`${kicks[0]} kicks`, `${kicks[1]} kicks`];

  return (
    <section className="game-layout multiplayer-layout chapteh-versus-layout">
      <aside className="game-panel">
        <InstructionSteps
          title="Kick it across to each other"
          objective={`Player 1 owns the left side and Player 2 owns the right side. Keep sending the chapteh across. First to ${WIN_SCORE} points wins.`}
          steps={[
            "Player 1 controls the left half with A / Left Arrow. Player 2 controls the right half with D / Right Arrow.",
            "The server waits for the chapteh to drop into their shaded kick zone, then kicks it across the centre line.",
            "The other player becomes the next kicker. You cannot kick twice in a row. Keep alternating for as long as possible.",
            "If the chapteh touches the floor on your side, the other player scores 1 point. Sending it out past a player also gives the opponent a point.",
            `The player who scores serves the next rally. First to ${WIN_SCORE} points wins the match.`,
          ]}
          tip="Watch the center-line rally indicator for the next player. The combo meter and streak rise after every clean kick and reset immediately when someone misses."
        />

        <PlayerScoreboard
          activePlayer={expectedPlayer}
          scores={scores}
          gameOver={gameOver}
          secondary={secondary}
        />

        <div className="mini-stat-row">
          <div><span>Rally streak</span><strong>{rally}</strong></div>
          <div><span>Longest rally</span><strong>{longestRally}</strong></div>
        </div>

        <div className="turn-message" role="status" aria-live="polite">
          <span className={`player-dot player-dot-${expectedPlayer + 1}`} />
          <div>
            <strong>{gameOver ? "Match finished" : running ? `Player ${expectedPlayer + 1} kicks next` : `Player ${server + 1} serves`}</strong>
            <p>{message}</p>
          </div>
        </div>

        <button className="primary-button" disabled={running || gameOver} onClick={startRally}>
          {gameOver ? "Match complete" : running ? "Rally in progress" : `Start rally · Player ${server + 1} serve`}
        </button>
        <button className="secondary-button" onClick={resetMatch}>Restart match</button>
      </aside>

      <GamePlayArea className="chapteh-play-area">
        <div className="fullscreen-only-controls">
          <button className="primary-button" onClick={startRally} disabled={running || gameOver}>
            {gameOver ? "Match complete" : running ? "Rally in progress" : `Start rally · Player ${server + 1} serve`}
          </button>
          <button className="secondary-button" onClick={resetMatch}>Restart match</button>
        </div>
        <div className="chapteh-side-header" aria-label="Player sides">
          <div className={`chapteh-side-card player-one ${expectedPlayer === 0 && running ? "is-next" : ""}`}>
            <span>Player 1</span>
            <strong>LEFT SIDE</strong>
            <small>A / ←</small>
          </div>
          <div className="chapteh-rally-center">
            <span>STREAK</span>
            <strong key={rally} className="rally-pop">{rally}</strong>
          </div>
          <div className={`chapteh-side-card player-two ${expectedPlayer === 1 && running ? "is-next" : ""}`}>
            <span>Player 2</span>
            <strong>RIGHT SIDE</strong>
            <small>D / →</small>
          </div>
        </div>

        <div
          className={`chapteh-streak-counter ${rally >= 12 ? "streak-epic" : rally >= 8 ? "streak-great" : rally >= 4 ? "streak-nice" : ""} ${rally === 0 ? "is-reset" : ""}`}
          role="status"
          aria-live="polite"
          aria-label={`Current rally streak: ${rally} successful kicks`}
        >
          <div className="chapteh-streak-label">
            <span>RALLY STREAK</span>
            <small>resets when either player misses</small>
          </div>
          <strong key={`streak-${rally}`} className="chapteh-streak-number">{rally}</strong>
          <div className="chapteh-streak-celebration">
            {streakCelebration || (running ? "Keep it going" : "Start the next rally")}
          </div>
        </div>

        <div
          className={`chapteh-combo-meter combo-${combo.tier} ${rally === 0 ? "combo-reset" : ""}`}
          role="status"
          aria-live="polite"
          aria-label={`Combo meter: ${combo.label}. Current rally ${rally}.`}
        >
          <div className="chapteh-combo-head">
            <div className="chapteh-combo-title-group">
              <span className="chapteh-combo-eyebrow">COMBO METER</span>
              <strong key={`combo-${combo.tier}-${rally}`} className="chapteh-combo-title">{combo.label}</strong>
            </div>
            <div className="chapteh-combo-badge" key={`badge-${rally}`}>{rally}x</div>
          </div>
          <div className="chapteh-combo-bar" aria-hidden="true">
            <span className="chapteh-combo-fill" style={{ width: `${Math.max(8, combo.progress * 100)}%` }} />
          </div>
          <div className="chapteh-combo-meta">
            <span>{combo.helper}</span>
            <strong>{combo.nextMilestone ? `${combo.nextMilestone - rally} to next tier` : "Top tier reached"}</strong>
          </div>
        </div>

        <div className={`canvas-frame chapteh-frame chapteh-versus-frame active-play-frame ${running ? "is-running" : "is-ready"}`}>
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            onPointerDown={handleCanvasTap}
            aria-label="Two-player chapteh court. Player 1 controls the left side and Player 2 controls the right side."
          />

          <div
            className={`chapteh-center-rally-indicator ${running ? "is-live" : "is-waiting"} ${
              expectedPlayer === 0 ? "to-left" : "to-right"
            }`}
            role="status"
            aria-live="polite"
            aria-label={
              running
                ? `Player ${expectedPlayer + 1} should kick next`
                : `Player ${server + 1} serves next`
            }
          >
            <span className="center-rally-kicker">
              {running ? `PLAYER ${expectedPlayer + 1} NEXT` : `PLAYER ${server + 1} SERVE`}
            </span>
            <span className={`chapteh-pace-badge pace-${paceLevel}`}>PACE · {PACE_LABELS[paceLevel]}</span>
            <div className="center-rally-direction" aria-hidden="true">
              <span className="center-rally-side center-rally-side-left">P1</span>
              <span className="center-rally-track">
                <span className="center-rally-line" />
                <span className="center-rally-moving-chapteh">✦</span>
                <span className="center-rally-arrow">
                  {running ? (expectedPlayer === 0 ? "←" : "→") : "•"}
                </span>
              </span>
              <span className="center-rally-side center-rally-side-right">P2</span>
            </div>
            <small>
              {running
                ? `${expectedPlayer === 0 ? "Move left" : "Move right"} · ${expectedPlayer === 0 ? "Player 1" : "Player 2"} prepares to kick`
                : `Waiting for Player ${server + 1} to serve`}
            </small>
          </div>
        </div>

        <div className="foot-controls control-deck versus-foot-controls">
          <button
            className={`kick-button kick-left ${kickWindowPlayer === 0 ? "kick-ready" : "kick-waiting"}`}
            disabled={!running || expectedPlayer !== 0}
            onClick={() => kick("left")}
          >
            <span>Player 1 · {kickWindowPlayer === 0 ? "Kick now" : "Wait"}</span>
            <kbd>A / ←</kbd>
          </button>
          <button
            className={`kick-button kick-right ${kickWindowPlayer === 1 ? "kick-ready" : "kick-waiting"}`}
            disabled={!running || expectedPlayer !== 1}
            onClick={() => kick("right")}
          >
            <span>Player 2 · {kickWindowPlayer === 1 ? "Kick now" : "Wait"}</span>
            <kbd>D / →</kbd>
          </button>
        </div>

        <p className="control-hint">
          Both players play at the same time on one device. Player 1 stays on the left, Player 2 stays on the right, and each successful kick must send the chapteh to the other player.
        </p>
      </GamePlayArea>
    </section>
  );
}
