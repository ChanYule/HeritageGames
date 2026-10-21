import { t, useLanguage } from "../i18n";
import GamePlayArea from "../components/GamePlayArea";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Timer, TimerOff } from "lucide-react";

import DifficultyPicker from "../components/DifficultyPicker";
import InstructionSteps from "../components/InstructionSteps";
import PlayerScoreboard from "../components/PlayerScoreboard";
import TurnTimerPanel from "../components/TurnTimerPanel";
import { difficultySettings, type Difficulty, randomMarblePositions, seededRandom, shotVelocity } from "./mechanics";
import type { CompetitionGameProps } from "../types";
import { MARBLE_COLOURS, MARBLE_STYLE, createMarbleShot, resolveMarbleTurn, placeMarbleShooter, type MarbleColour, advanceMarbles, returnShooterToStart, type Marble, MARBLES_LAUNCH, MARBLES_MAX_PULL, MARBLES_WIDTH as WIDTH, MARBLES_HEIGHT as HEIGHT, MARBLES_RING as RING } from "./marblesPhysics";

type Player = 0 | 1;

const PLAYER_COLORS = ["#2d6d79", "#a84f3e"] as const;
const PLAYER_DETAILS = [
  { base: "#2d6d79", glow: "#d5f0ec", accent: "#9ee3d3" },
  { base: "#a84f3e", glow: "#ffe4d6", accent: "#efb08f" },
] as const;
const TURN_SECONDS = 30;
const COMPETITION_TURN_SECONDS = 45;

export function createMarbles(difficulty: Difficulty, seed?: number, colour?: string): Marble[] {
  const targets: Marble[] = [];

  const positions = randomMarblePositions(seed === undefined ? Math.random : seededRandom(seed), difficulty);

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
      color: MARBLE_STYLE[MARBLE_COLOURS[i % 4]].color,
      group: MARBLE_COLOURS[i % 4],
    });
  }

  return [
    ...targets,
    {
      id: 100,
      x: RING.x,
      y: MARBLES_LAUNCH.y,
      vx: 0,
      vy: 0,
      radius: 20,
      target: false,
      captured: false,
      color: colour ?? PLAYER_COLORS[0],
    },
  ];
}

export default function MarblesGame({ playerNames, competitionMode = false, onComplete, individualAttempt, fixedDifficulty, playerColours }: CompetitionGameProps = {}) {
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
        description={individualAttempt ? t("{0} shots. Knock marbles out of the ring.", individualAttempt.shots) : t("{0} targets. {1} and {2} alternate after every shot. Highest score wins when the ring is empty.", settings.marbles, playerNames?.[0] ?? t("Player 1"), playerNames?.[1] ?? t("Player 2"))}
      />
      <MarblesRound individualAttempt={individualAttempt} playerColours={playerColours} difficulty={difficulty} playerNames={playerNames} competitionMode={competitionMode} onComplete={onComplete} onRoundStart={() => { if (competitionMode) setDifficultyLocked(true); }} onDifficultyChange={setDifficulty} canChangeDifficulty={!fixedDifficulty && !difficultyLocked} />
    </>
  );
}

function MarblesRound({ difficulty, playerNames, competitionMode = false, onComplete, individualAttempt, playerColours, onRoundStart, onDifficultyChange, canChangeDifficulty }: { difficulty: Difficulty; onRoundStart: () => void; onDifficultyChange: (difficulty: Difficulty) => void; canChangeDifficulty: boolean } & CompetitionGameProps) {
  useLanguage();
  const PLAYER_COLORS = playerColours ?? ["#2d6d79", "#a84f3e"];
  const targetCount = difficultySettings[difficulty].marbles;
  const turnSeconds = competitionMode ? COMPETITION_TURN_SECONDS : TURN_SECONDS;
  const playerLabel = (player: Player) => playerNames?.[player] ?? t("Player {0}", player + 1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const marblesRef = useRef<Marble[]>(createMarbles(difficulty, individualAttempt?.seed, playerColours?.[0]));
  const shotRef = useRef(createMarbleShot());
  const targetRef = useRef<MarbleColour | undefined>("Red");
  const [target, setTarget] = useState<MarbleColour | undefined>("Red");
  const draggingRef = useRef(false);
  const movingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const pointerRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);
  const activePlayerRef = useRef<Player>(0);
  const scoresRef = useRef<[number, number]>([0, 0]);
  const capturesRef = useRef<[number, number]>([0, 0]);
  const shotsRef = useRef<[number, number]>([0, 0]);
  const totalCapturedRef = useRef(0);
  const gameOverRef = useRef(false);
  const pausedRef = useRef(false);
  const awaitingReadyRef = useRef(!individualAttempt);
  const dragPointerRef = useRef<number | null>(null);
  const aimRef = useRef(-90);
  const captureFeedbackTimerRef = useRef<number | null>(null);
  const reportedRef = useRef(false);
  const previousDifficultyRef = useRef(difficulty);

  const [activePlayer, setActivePlayer] = useState<Player>(0);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [captures, setCaptures] = useState<[number, number]>([0, 0]);
  const [shots, setShots] = useState<[number, number]>([0, 0]);
  const [message, setMessage] = useState(() => () => t("{0} starts. Drag the shooter backwards and release.", playerLabel(0)));
  const [moving, setMoving] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timeLeft, setTimeLeft] = useState(turnSeconds);
  const [paused, setPaused] = useState(false);
  const [awaitingReady, setAwaitingReady] = useState(!individualAttempt);
  const [captureFeedback, setCaptureFeedback] = useState<{ id: number; text: () => string; player: Player } | null>(null);
  const [positioning, setPositioning] = useState(false);
  const positioningRef = useRef(false);
  const [keyboardAim, setKeyboardAim] = useState(-90);
  const [keyboardPower, setKeyboardPower] = useState(75);
  const powerRef = useRef(keyboardPower); powerRef.current = keyboardPower;
  const guideCache = useRef({ key: "", points: [] as { x: number; y: number }[] });
  aimRef.current = keyboardAim;

  const waitForPlayer = () => {
    positioningRef.current = false; setPositioning(false);
    awaitingReadyRef.current = !individualAttempt;
    setAwaitingReady(!individualAttempt);
    draggingRef.current = false;
    dragPointerRef.current = null;
  };

  const beginTurn = () => {
    onRoundStart();
    awaitingReadyRef.current = false;
    setAwaitingReady(false);
    setTimeLeft(turnSeconds);
    setMessage(() => () => t("{0}: drag back and release to shoot.", playerLabel(activePlayerRef.current)));
  };

  useEffect(() => {
    const cancelDrag = () => { draggingRef.current = false; dragPointerRef.current = null; };
    window.addEventListener("resize", cancelDrag);
    const onVisibilityChange = () => {
      if (!document.hidden || gameOverRef.current || awaitingReadyRef.current) return;
      pausedRef.current = true;
      draggingRef.current = false;
      dragPointerRef.current = null;
      setPaused(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { document.removeEventListener("visibilitychange", onVisibilityChange); window.removeEventListener("resize", cancelDrag); };
  }, []);

  useEffect(() => {
    if (!gameOver || reportedRef.current || !onComplete) return;
    reportedRef.current = true;
    onComplete({ scores });
  }, [gameOver, onComplete, scores]);

  const syncPlayer = (player: Player) => {
    activePlayerRef.current = player;
    setActivePlayer(player);
    const shooter = marblesRef.current.find((marble) => !marble.target);
    if (shooter) shooter.color = PLAYER_COLORS[player];
  };

  const reset = () => {
    if (captureFeedbackTimerRef.current !== null) window.clearTimeout(captureFeedbackTimerRef.current);
    captureFeedbackTimerRef.current = null;
    marblesRef.current = createMarbles(difficulty, individualAttempt?.seed, playerColours?.[0]);
    draggingRef.current = false;
    movingRef.current = false;
    scoresRef.current = [0, 0];
    capturesRef.current = [0, 0];
    shotsRef.current = [0, 0];
    totalCapturedRef.current = 0;
    gameOverRef.current = false;
    reportedRef.current = false;
    pausedRef.current = false;
    shotRef.current = createMarbleShot(); targetRef.current = "Red"; setTarget("Red");
    waitForPlayer();
    setScores([0, 0]);
    setCaptures([0, 0]);
    setShots([0, 0]);
    setGameOver(false);
    setMoving(false);
    setPaused(false);
    setTimeLeft(turnSeconds);
    setCaptureFeedback(null);
    setKeyboardAim(-90);
    setKeyboardPower(75);
    syncPlayer(0);
    setMessage(() => () => t("{0} starts. Drag the shooter backwards and release.", playerLabel(0)));
  };

  useEffect(() => {
    if (previousDifficultyRef.current === difficulty) return;
    previousDifficultyRef.current = difficulty;
    reset();
  }, [difficulty]);

  const switchTurnOnTimeout = () => {
    if (gameOverRef.current || movingRef.current || pausedRef.current || awaitingReadyRef.current) return;
    if (individualAttempt) { gameOverRef.current = true; setGameOver(true); return; }
    const current = activePlayerRef.current;
    const next = (current === 0 ? 1 : 0) as Player;
    draggingRef.current = false;
    syncPlayer(next);
    returnShooterToStart(marblesRef.current);
    setKeyboardAim(-90);
    waitForPlayer();
    setTimeLeft(turnSeconds);
    setMessage(() => () => t("{0} ran out of time. Pass to {1}.", playerLabel(current), playerLabel(next)));
  };

  useEffect(() => {
    setTimeLeft(turnSeconds);
  }, [activePlayer]);

  useEffect(() => {
    if (!timerEnabled || gameOver || moving || paused || awaitingReady || timeLeft <= 0) return;
    const timer = window.setTimeout(() => setTimeLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [timerEnabled, gameOver, moving, paused, awaitingReady, timeLeft]);

  useEffect(() => {
    if (timerEnabled && !gameOver && !moving && !paused && !awaitingReady && timeLeft === 0) switchTurnOnTimeout();
  }, [timerEnabled, gameOver, moving, paused, awaitingReady, timeLeft]);

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
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
    draggingRef.current = false;
    setMessage(() => () => nextPaused
        ? t("Game paused. {0} keeps the turn with {1} seconds remaining.", playerLabel(activePlayerRef.current), timeLeft)
        : t("{0} resumes with {1} seconds remaining.", playerLabel(activePlayerRef.current), timeLeft));
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
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(WIDTH * pixelRatio);
    canvas.height = Math.round(HEIGHT * pixelRatio);
    canvas.style.aspectRatio = `${WIDTH} / ${HEIGHT}`;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const drawShooterDetails = (marble: Marble) => {
      const detail = { ...PLAYER_DETAILS[activePlayerRef.current], base: PLAYER_COLORS[activePlayerRef.current] };
      ctx.shadowColor = "transparent";
      ctx.lineWidth = 4;
      ctx.strokeStyle = detail.glow;
      ctx.beginPath();
      ctx.arc(marble.x, marble.y, marble.radius + 5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.strokeStyle = detail.accent;
      if (activePlayerRef.current === 0) {
        ctx.beginPath();
        ctx.arc(marble.x, marble.y, marble.radius * 0.58, Math.PI * 0.2, Math.PI * 1.75);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(marble.x - marble.radius * 0.48, marble.y - marble.radius * 0.48);
        ctx.lineTo(marble.x + marble.radius * 0.48, marble.y + marble.radius * 0.48);
        ctx.moveTo(marble.x + marble.radius * 0.48, marble.y - marble.radius * 0.48);
        ctx.lineTo(marble.x - marble.radius * 0.48, marble.y + marble.radius * 0.48);
        ctx.stroke();
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const floor = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      floor.addColorStop(0, "#d8d0bf");
      floor.addColorStop(1, "#c7bdab");
      ctx.fillStyle = floor;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Deterministic speckles give the court a concrete grit without visual noise moving per frame.
      ctx.fillStyle = "rgba(72, 59, 45, 0.09)";
      for (let index = 0; index < 150; index++) {
        const x = (index * 83 + 29) % WIDTH;
        const y = (index * 47 + 61) % HEIGHT;
        const radius = 0.45 + (index % 3) * 0.28;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

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

      ctx.fillStyle = "rgba(255,255,255,.24)";
      ctx.fillRect(0, 510, WIDTH, HEIGHT - 510);
      if (!movingRef.current && !gameOverRef.current) {
        ctx.strokeStyle = "#567263"; ctx.lineWidth = 2; ctx.setLineDash([7, 7]);
        const launch = marblesRef.current.find(m => !m.target) ?? MARBLES_LAUNCH;
        ctx.beginPath(); ctx.arc(launch.x, launch.y, MARBLES_MAX_PULL, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(launch.x, launch.y, 26, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = "#294c40"; ctx.font = "bold 16px system-ui"; ctx.textAlign = "center";
      ctx.fillText(t(positioningRef.current ? "Move the shooter outside the ring." : "Drag back and release to shoot."), WIDTH / 2, HEIGHT - 14); ctx.textAlign = "start";
      ctx.beginPath();
      ctx.arc(RING.x, RING.y, RING.radius, 0, Math.PI * 2);
      ctx.strokeStyle = "#7c5f46";
      ctx.lineWidth = 7;
      ctx.stroke();

      // Chalk boundary ticks make the scoring edge readable at a glance.
      ctx.strokeStyle = "rgba(88, 65, 45, 0.72)";
      ctx.lineWidth = 3;
      for (let index = 0; index < 12; index++) {
        const angle = (index / 12) * Math.PI * 2;
        const inner = RING.radius - 8;
        const outer = RING.radius + 8;
        ctx.beginPath();
        ctx.moveTo(RING.x + Math.cos(angle) * inner, RING.y + Math.sin(angle) * inner);
        ctx.lineTo(RING.x + Math.cos(angle) * outer, RING.y + Math.sin(angle) * outer);
        ctx.stroke();
      }

      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
      ctx.shadowColor = "rgba(30, 27, 24, 0.1)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(16, 16, 210, 42, 10);
      } else {
        ctx.rect(16, 16, 210, 42);
      }
      ctx.fill();
      ctx.shadowColor = "transparent";

      ctx.fillStyle = PLAYER_COLORS[activePlayerRef.current];
      ctx.beginPath();
      ctx.arc(32, 37, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "800 13px 'Plus Jakarta Sans', system-ui, sans-serif";
      ctx.fillText(gameOverRef.current ? t("ROUND COMPLETE") : playerLabel(activePlayerRef.current), 46, 42);
      ctx.restore();

      const marbles = marblesRef.current;
      if (positioningRef.current) {
        ctx.save(); ctx.strokeStyle = "#185b84"; ctx.lineWidth = 3; ctx.setLineDash([9, 7]);
        ctx.strokeRect(130, 130, WIDTH - 260, HEIGHT - 260);
        ctx.beginPath(); ctx.arc(RING.x, RING.y, RING.radius + 28, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }

      if (!positioningRef.current && !movingRef.current && !gameOverRef.current) {
        const shooter = marbles.find(m => !m.target);
        if (shooter) {
          const pull = pointerRef.current;
          const velocity = draggingRef.current ? shotVelocity((shooter.x - pull.x) * 180 / MARBLES_MAX_PULL, (shooter.y - pull.y) * 180 / MARBLES_MAX_PULL) : { x: Math.cos(aimRef.current * Math.PI / 180) * 16.2 * powerRef.current / 100, y: Math.sin(aimRef.current * Math.PI / 180) * 16.2 * powerRef.current / 100 };
          const key = `${shooter.x}:${shooter.y}:${velocity.x}:${velocity.y}:${shotsRef.current.join()}:${totalCapturedRef.current}`;
          if (guideCache.current.key !== key) {
            const clone = marbles.map(m => ({ ...m })), shot = createMarbleShot();
            const ball = clone.find(m => !m.target)!; ball.vx = velocity.x; ball.vy = velocity.y;
            const points = [];
            const length = difficulty === "easy" ? 80 : difficulty === "medium" ? 50 : 35;
            for (let i = 0; i < length; i++) { advanceMarbles(clone, 1, shot); if (i % 3 === 0) points.push({ x: ball.x, y: ball.y }); if (shot.first || shot.complete) break; }
            guideCache.current = { key, points };
          }
          ctx.fillStyle = "#23594e";
          for (const point of guideCache.current.points) { ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, Math.PI * 2); ctx.fill(); }
        }
      }

      if (draggingRef.current && !positioningRef.current) {
        const shooter = marbles.find((marble) => !marble.target);
        if (shooter) {
          const pointer = pointerRef.current;
          const dx = shooter.x - pointer.x;
          const dy = shooter.y - pointer.y;
          const length = Math.min(Math.hypot(dx, dy), MARBLES_MAX_PULL);
          const angle = Math.atan2(dy, dx);
          const endX = shooter.x + Math.cos(angle) * length;
          const endY = shooter.y + Math.sin(angle) * length;

          ctx.save();
          ctx.setLineDash([8, 6]);
          ctx.strokeStyle = PLAYER_COLORS[activePlayerRef.current];
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(shooter.x, shooter.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Arrow head pointing to endX, endY
          const headLen = 12;
          ctx.fillStyle = PLAYER_COLORS[activePlayerRef.current];
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - headLen * Math.cos(angle - Math.PI / 6),
            endY - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            endX - headLen * Math.cos(angle + Math.PI / 6),
            endY - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = "rgba(255,255,255,.9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(endX, endY, 11, 0, Math.PI * 2);
          ctx.moveTo(endX - 16, endY);
          ctx.lineTo(endX + 16, endY);
          ctx.moveTo(endX, endY - 16);
          ctx.lineTo(endX, endY + 16);
          ctx.stroke();

          ctx.strokeStyle = "rgba(94,70,56,0.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(shooter.x, shooter.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();

          // Power readout chip
          const powerPercent = Math.round((length / MARBLES_MAX_PULL) * 100);
          ctx.fillStyle = "rgba(25, 22, 19, 0.88)";
          const pillX = shooter.x + 24;
          const pillY = shooter.y - 14;
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(pillX, pillY, 78, 24, 6);
          } else {
            ctx.rect(pillX, pillY, 78, 24);
          }
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "800 11px 'Plus Jakarta Sans', system-ui, sans-serif";
          ctx.fillText(t("POWER {0}%", powerPercent), pillX + 8, pillY + 16);
          ctx.restore();
        }
      }

      marbles.forEach((marble) => {
        if (marble.captured) return;
        if (marble.target) {
          ctx.save();
          ctx.strokeStyle = "rgba(30, 55, 49, 0.65)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(marble.x, marble.y, marble.radius + 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        const speed = Math.hypot(marble.vx, marble.vy);
        if (speed > 0.8) {
          ctx.save();
          ctx.globalAlpha = Math.min(0.28, speed / 45);
          ctx.strokeStyle = marble.target ? marble.color : PLAYER_COLORS[activePlayerRef.current];
          ctx.lineWidth = Math.max(3, marble.radius * 0.55);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(marble.x - marble.vx * 2.4, marble.y - marble.vy * 2.4);
          ctx.lineTo(marble.x, marble.y);
          ctx.stroke();
          ctx.restore();
        }
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
          drawShooterDetails(marble);
        } else if (marble.group) {
          ctx.shadowColor = "transparent";
          ctx.fillStyle = "#fff"; ctx.font = "bold 16px system-ui"; ctx.textAlign = "center";
          ctx.fillText(MARBLE_STYLE[marble.group].symbol, marble.x, marble.y + 6); ctx.textAlign = "start";
          if (marble.group === targetRef.current) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(marble.x, marble.y, marble.radius + 4, 0, Math.PI * 2); ctx.stroke(); }
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

      const shot = shotRef.current;
      const player = activePlayerRef.current;
      const result = resolveMarbleTurn(shot, targetRef.current, marblesRef.current, player, Boolean(individualAttempt), shotsRef.current[0], individualAttempt?.shots);
      if (!result) return;
      totalCapturedRef.current += shot.captured.length;
      capturesRef.current[player] += shot.captured.length;
      scoresRef.current[player] += result.points;
      setCaptures([...capturesRef.current]); setScores([...scoresRef.current]);
      const shotTarget = targetRef.current;
      const firstColour = shot.first?.colour;
      setMessage(() => () => t("{0}. First: {1}. Target: {2}. +{3} points", t(result.reason), firstColour ? t(firstColour) : t("None"), shotTarget ? t(shotTarget) : t("None"), result.points));
      setCaptureFeedback({ id: Date.now(), player, text: () => t("{0} · +{1} points", t(result.reason), result.points) });
      if (captureFeedbackTimerRef.current !== null) window.clearTimeout(captureFeedbackTimerRef.current);
      captureFeedbackTimerRef.current = window.setTimeout(() => setCaptureFeedback(null), 1800);
      targetRef.current = result.nextTarget;
      setTarget(targetRef.current);

      if (result.finished) {
        gameOverRef.current = true;
        setGameOver(true);
        const [firstScore, secondScore] = scoresRef.current;
        if (individualAttempt) {
          setMessage(() => () => t("Attempt complete. {0} points.", firstScore));
        } else if (firstScore === secondScore) {
          setMessage(() => () => t("All marbles are out. It's a draw at {0} points each.", firstScore));
        } else {
          const winner: Player = firstScore > secondScore ? 0 : 1;
          setMessage(() => () => t("All marbles are out. {0} wins the match.", playerLabel(winner)));
        }
        return;
      }

      const next = result.nextPlayer;
      syncPlayer(next);
      returnShooterToStart(marblesRef.current);
      setKeyboardAim(-90);
      waitForPlayer();
      setTimeLeft(turnSeconds);
    };

    const update = (dt: number) => {
      if (pausedRef.current || awaitingReadyRef.current || !movingRef.current || document.hidden) return;
      const result = advanceMarbles(marblesRef.current, dt, shotRef.current);
      if (!result.moving) finishTurn();
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
      if (captureFeedbackTimerRef.current !== null) window.clearTimeout(captureFeedbackTimerRef.current);
    };
  }, [targetCount]);

  const takeShot = (vx: number, vy: number) => {
    if (movingRef.current || gameOverRef.current || pausedRef.current || awaitingReadyRef.current || document.hidden || positioningRef.current || !Number.isFinite(vx + vy) || Math.hypot(vx, vy) < .1) return;
    const shooter = marblesRef.current.find((marble) => !marble.target);
    if (!shooter) return;

    shotRef.current = createMarbleShot();
    shooter.vx = vx;
    shooter.vy = vy;
    const nextShots: [number, number] = [...shotsRef.current] as [number, number];
    nextShots[activePlayerRef.current] += 1;
    shotsRef.current = nextShots;
    setShots(nextShots);
    draggingRef.current = false;
    dragPointerRef.current = null;
    movingRef.current = true;
    setMoving(true);
    setMessage(() => () => t("{0}'s shot is rolling...", playerLabel(activePlayerRef.current)));
  };

  const togglePositioning = () => {
    draggingRef.current = false; dragPointerRef.current = null;
    positioningRef.current = !positioningRef.current;
    setPositioning(positioningRef.current);
    const placing = positioningRef.current;
    setMessage(() => () => t(placing ? "Move the shooter outside the ring, then press Done positioning." : "Drag back and release to shoot."));
  };

  const placeShooter = (x: number, y: number) => {
    if (movingRef.current || gameOverRef.current || pausedRef.current || awaitingReadyRef.current || document.hidden) return;
    if (!placeMarbleShooter(marblesRef.current, x, y)) {
      setMessage(() => () => t("Choose a clear spot outside the ring and inside the dashed border."));
      return;
    }
    setKeyboardAim(Math.round(Math.atan2(RING.y - y, RING.x - x) * 180 / Math.PI / 5) * 5);
    setMessage(() => () => t("Starting position set. Press Done positioning to aim."));
  };

  const nudgeShooter = (dx: number, dy: number) => {
    const shooter = marblesRef.current.find(m => !m.target);
    if (shooter) placeShooter(shooter.x + dx, shooter.y + dy);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragPointerRef.current !== null || movingRef.current || gameOverRef.current || pausedRef.current || awaitingReadyRef.current || document.hidden || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    const point = getCanvasPoint(event);
    const shooter = marblesRef.current.find((marble) => !marble.target);
    if (!shooter) return;

    if (positioningRef.current) {
      placeShooter(point.x, point.y);
      draggingRef.current = true; dragPointerRef.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const touchPadding = event.pointerType === "touch" ? 58 : 20;
    if (Math.hypot(point.x - shooter.x, point.y - shooter.y) <= shooter.radius + touchPadding) {
      draggingRef.current = true;
      dragPointerRef.current = event.pointerId;
      dragStartRef.current = point;
      pointerRef.current = { x: shooter.x, y: shooter.y };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
      setKeyboardAim(Math.round(Math.atan2(point.y - shooter.y, point.x - shooter.x) * 180 / Math.PI / 5) * 5);
      setMessage(() => () => t("Aim set. Press Shoot marble when you are ready."));
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current || pausedRef.current || dragPointerRef.current !== event.pointerId) return;
    const point = getCanvasPoint(event);
    if (positioningRef.current) { placeShooter(point.x, point.y); return; }
    const dx = point.x - dragStartRef.current.x, dy = point.y - dragStartRef.current.y;
    const scale = Math.min(1, MARBLES_MAX_PULL / (Math.hypot(dx, dy) || 1));
    const shooter = marblesRef.current.find(m => !m.target);
    if (shooter) pointerRef.current = { x: shooter.x + dx * scale, y: shooter.y + dy * scale };
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current || movingRef.current || pausedRef.current || dragPointerRef.current !== event.pointerId) return;
    draggingRef.current = false;
    dragPointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    const shooter = marblesRef.current.find((marble) => !marble.target);
    if (!shooter) return;

    if (positioningRef.current) { placeShooter(point.x, point.y); return; }
    const dx = dragStartRef.current.x - point.x;
    const dy = dragStartRef.current.y - point.y;
    const distance = Math.min(Math.hypot(dx, dy), 180);
    if (distance < 12) {
      setMessage(() => () => t("Pull farther back before releasing."));
      return;
    }

    const velocity = shotVelocity(dx * 180 / MARBLES_MAX_PULL, dy * 180 / MARBLES_MAX_PULL);
    takeShot(velocity.x, velocity.y);
  };

  const shootWithControls = () => {
    const radians = keyboardAim * Math.PI / 180;
    const speed = 16.2 * keyboardPower / 100;
    takeShot(Math.cos(radians) * speed, Math.sin(radians) * speed);
  };

  const onCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault();
    if (movingRef.current || pausedRef.current || gameOverRef.current || awaitingReadyRef.current) return;
    if (positioningRef.current) {
      if (event.key === "ArrowLeft") nudgeShooter(-10, 0);
      if (event.key === "ArrowRight") nudgeShooter(10, 0);
      if (event.key === "ArrowUp") nudgeShooter(0, -10);
      if (event.key === "ArrowDown") nudgeShooter(0, 10);
      if (event.key === "Enter" || event.key === "Escape") { event.preventDefault(); togglePositioning(); }
      return;
    }
    if (event.key === "ArrowLeft") setKeyboardAim((value) => Math.max(-180, value - 5));
    if (event.key === "ArrowRight") setKeyboardAim((value) => Math.min(180, value + 5));
    if (event.key === "ArrowUp") setKeyboardPower((value) => Math.min(100, value + 5));
    if (event.key === "ArrowDown") setKeyboardPower((value) => Math.max(20, value - 5));
    if (event.key === " " && !event.repeat) shootWithControls();
  };

  const totalCaptured = captures[0] + captures[1];
  const remaining = targetCount - totalCaptured;
  const shotDetails: [string, string] = [
    t("{0} shots · {1} captured", shots[0], captures[0]),
    t("{0} shots · {1} captured", shots[1], captures[1]),
  ];

  return (
    <section className="game-layout multiplayer-layout marbles-layout">
      <aside className="game-panel">
        <InstructionSteps
          title={t("Knock marbles out of the ring")}
          objective={individualAttempt ? t("Six shots to knock marbles out. The same layout and level for everyone.") : t("Hit the target colour first, then knock it outside the ring.")}
          steps={[
            individualAttempt ? t("Drag back and release to shoot.") : t("Press I am ready. Drag back and release to shoot."),
            t("Use Move shooter to choose a starting spot. Then drag back, or tap to aim and press Shoot marble."),
            t("Hit the target colour first, then knock it outside the ring. Matching captures score 100 each; two or more earn 50 extra each."),
            individualAttempt ? t("45 seconds per shot. Running out of time ends your attempt.") : t("Take one shot each, then pass the device. The next player starts the timer when ready."),
          ]}
          tip={individualAttempt ? t("Controlled shots are often easier than full power") : t("Blue swirl marble = {0}. Red cross marble = {1}. Controlled shots often work better than maximum power.", playerLabel(0), playerLabel(1))}
        />



        <TurnTimerPanel
          enabled={timerEnabled}
          seconds={timeLeft}
          duration={turnSeconds}
          paused={paused}
          autoPaused={moving && !paused}
          waiting={awaitingReady}
          locked={competitionMode}
          gameOver={gameOver}
          onToggle={toggleTimer}
          onPauseToggle={togglePause}
        />

        <div className="mini-stat-row">
          <div><span>{t("Marbles left")}</span><strong>{remaining}</strong></div>
          <div><span>{t("Total shots")}</span><strong>{shots[0] + shots[1]}</strong></div>
        </div>

        <div className="turn-message" role="status" aria-live="polite">
          <span className={`player-dot player-dot-${activePlayer + 1}`} />
          <div>
            <strong>{gameOver ? t("Game finished") : playerLabel(activePlayer)}</strong>
            <p>{message()}</p>
          </div>
        </div>

        {!competitionMode ? <button className="secondary-button" onClick={reset}>{t("Start new match")}</button> : null}
      </aside>

      <GamePlayArea className="marbles-play-area">
        <PlayerScoreboard individual={Boolean(individualAttempt)} colours={playerColours}
          activePlayer={activePlayer}
          scores={scores}
          labels={playerNames}
          gameOver={gameOver}
          paused={paused}
          pausedBy={paused ? activePlayer : null}
          secondary={shotDetails}
        />
        {!competitionMode ? <div className="fullscreen-only-controls">
          <button className="secondary-button" onClick={reset}>{t("New match")}</button>
        </div> : null}
        <div className="marble-target" role="status" aria-live="polite">
          <span className="target-marble" style={{ background: target ? MARBLE_STYLE[target].color : "#555" }}>{target ? MARBLE_STYLE[target].symbol : "?"}</span>
          <div><strong>{t("Target: {0}", target ? t(target) : t("Complete"))}</strong><p>{t("Hit the target colour first, then knock it outside the ring.")}</p></div>
        </div>
        <div className="play-status-bar">
          <div>
            <span className={`player-dot player-dot-${activePlayer + 1}`} />
            <strong>{gameOver ? t("Match complete") : t("{0}'s turn", playerLabel(activePlayer))}</strong>
          </div>
          <div className="status-bar-right">
            <span>{t("{0} target{1} left", remaining, remaining === 1 ? "" : "s")}</span>
            <span className={`timer-inline ${timerEnabled && timeLeft <= 10 && !moving && !paused && !awaitingReady && !gameOver ? "urgent" : ""}`}>
              {awaitingReady ? t("Ready when you are") : timerEnabled ? (paused ? t("Paused · {0}s", timeLeft) : moving ? t("Shot rolling") : t("{0}s", timeLeft)) : t("Timer off")}
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
          {!competitionMode && <button type="button" className="mobile-game-control secondary" onClick={reset}>{t("New match")}</button>}
        </div>

        <div className={`canvas-frame active-play-frame pauseable-play-area ${paused ? "is-paused" : ""}`} style={{ borderColor: PLAYER_COLORS[activePlayer] }}>
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={(event) => { if (dragPointerRef.current === event.pointerId) { draggingRef.current = false; dragPointerRef.current = null; } }}
            onLostPointerCapture={(event) => { if (dragPointerRef.current === event.pointerId) { draggingRef.current = false; dragPointerRef.current = null; } }}
            onKeyDown={onCanvasKeyDown}
            tabIndex={awaitingReady || paused || gameOver ? -1 : 0}
            aria-label={positioning ? t("Marbles positioning. Arrow keys move the shooter; Enter finishes positioning.") : t("Marbles ring. Tap to aim, then use Shoot marble. Keyboard: arrows to aim and set power, Space to shoot.")}
          />
          {captureFeedback ? (
            <div key={captureFeedback.id} className={`marble-capture-feedback player-${captureFeedback.player + 1}`} role="status">
              {captureFeedback.text()}
            </div>
          ) : null}
          {awaitingReady ? <div className="game-paused-overlay turn-ready-overlay">
            <strong>{t("{0}, ready?", playerLabel(activePlayer))}</strong>
            <span>{t("Take your time passing the device. Your timer starts only when you are ready.")}</span>
            {canChangeDifficulty && shots[0] + shots[1] === 0 && <div className="ready-level-picker" role="group" aria-label={t("Choose your level")}>
              {(Object.keys(difficultySettings) as Difficulty[]).map(level => <button key={level} type="button" className={difficulty === level ? "is-selected" : ""} aria-pressed={difficulty === level} onClick={() => onDifficultyChange(level)}>{t(difficultySettings[level].label)}</button>)}
            </div>}
            <button type="button" className="primary-button" onClick={beginTurn}>{t("I am ready")}</button>
          </div> : null}
          {paused ? <div className="game-paused-overlay"><strong>{t("Paused")}</strong><span>{t("{0} keeps this turn", playerLabel(activePlayer))}</span><button type="button" className="primary-button" onClick={() => togglePause(false)}>{t("Resume turn")}</button></div> : null}
        </div>

        <fieldset className="marble-shot-controls" disabled={moving || paused || gameOver || awaitingReady}>
          <legend>{t("Aim, then shoot")}</legend>
          <button type="button" className="secondary-button marble-position-toggle" aria-pressed={positioning} onClick={togglePositioning}>{t(positioning ? "Done positioning" : "Move shooter")}</button>
          {positioning && <div className="marble-placement-controls">
            <p>{t("Tap a clear spot outside the ring, or drag the shooter. Arrow keys also move it.")}</p>
            <div role="group" aria-label={t("Move shooter")}>
              <button type="button" className="secondary-button" onClick={() => nudgeShooter(-10, 0)}>{t("Left")}</button>
              <button type="button" className="secondary-button" onClick={() => nudgeShooter(10, 0)}>{t("Right")}</button>
              <button type="button" className="secondary-button" onClick={() => nudgeShooter(0, -10)}>{t("Up")}</button>
              <button type="button" className="secondary-button" onClick={() => nudgeShooter(0, 10)}>{t("Down")}</button>
            </div>
          </div>}
          {!positioning && <>

          <details className="shot-adjustments"><summary>{t("Adjust shot")}</summary><div className="shot-adjustment-fields">
          <label>
            <span>{t("Shot direction")} <strong>{keyboardAim}°</strong></span>
            <input type="range" min={-180} max={180} step={5} value={keyboardAim} onChange={(event) => setKeyboardAim(Number(event.target.value))} />
          </label>
          <label>
            <span>{t("Power")} <strong>{keyboardPower}%</strong></span>
            <input type="range" min={20} max={100} step={5} value={keyboardPower} onChange={(event) => setKeyboardPower(Number(event.target.value))} />
          </label>
          </div></details>
          <button type="button" className="primary-button" onClick={shootWithControls}>{moving ? t("Shot rolling") : t("Shoot marble")}</button>
          </>}
        </fieldset>

        <p className="control-hint">{individualAttempt ? t("Drag back and release to shoot.") : <>{t("Drag backwards and release, or focus the board and use Arrow keys plus Space. Blue swirl marble is")} {playerLabel(0)} {t("and red cross marble is")} {playerLabel(1)}.</>}</p>
      </GamePlayArea>
    </section>
  );
}
