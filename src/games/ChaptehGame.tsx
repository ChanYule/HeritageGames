import { t, useLanguage } from "../i18n";
import GamePlayArea from "../components/GamePlayArea";
import { useEffect, useRef, useState } from "react";

import InstructionSteps from "../components/InstructionSteps";
import PlayerScoreboard from "../components/PlayerScoreboard";
import DifficultyPicker from "../components/DifficultyPicker";
import type { Difficulty } from "./mechanics";
import { chaptehPaceLevel } from "./mechanics";
import { canSeniorKick, CHAPTEH_GRAVITY, CHAPTEH_ZONE_HEIGHT, chaptehReturnVelocity, chaptehTimeScale, type ChaptehAim } from "./chaptehRules";
import type { CompetitionGameProps } from "../types";

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
    return { tier: "legend", label: t("LEGEND COMBO"), helper: t("Maximum momentum unlocked"), nextMilestone: null, progress: 1 };
  }
  if (rally >= 12) {
    return {
      tier: "epic",
      label: t("EPIC COMBO"),
      helper: t("Push for the legend tier"),
      nextMilestone: 16,
      progress: Math.min(1, (rally - 12) / 4),
    };
  }
  if (rally >= 8) {
    return {
      tier: "great",
      label: t("GREAT COMBO"),
      helper: t("Four more kicks to reach epic"),
      nextMilestone: 12,
      progress: Math.min(1, (rally - 8) / 4),
    };
  }
  if (rally >= 4) {
    return {
      tier: "nice",
      label: t("NICE COMBO"),
      helper: t("Build toward the next level"),
      nextMilestone: 8,
      progress: Math.min(1, (rally - 4) / 4),
    };
  }
  return {
    tier: "base",
    label: t("COMBO BUILDING"),
    helper: t("Reach 4 kicks for the first combo"),
    nextMilestone: 4,
    progress: Math.min(1, rally / 4),
  };
}

export default function ChaptehGame({ playerNames, onComplete, competitionMode = false }: CompetitionGameProps = {}) {
  useLanguage();
  const playerLabel = (player: Player) => playerNames?.[player] ?? t("Player {0}", player + 1);
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
  const reportedRef = useRef(false);
  const pausedRef = useRef(false);
  const paceRef = useRef<"gentle" | "lively">("gentle");
  const levelRef = useRef<Difficulty>(competitionMode ? "medium" : "easy");
  const soundRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [expectedPlayer, setExpectedPlayer] = useState<Player>(0);
  const [server, setServer] = useState<Player>(0);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [kicks, setKicks] = useState<[number, number]>([0, 0]);
  const [rally, setRally] = useState(0);
  const [streakCelebration, setStreakCelebration] = useState("");
  const [longestRally, setLongestRally] = useState(0);
  const [message, setMessage] = useState(() => () => t("{0} serves first from the left. Start the rally when both players are ready.", playerLabel(0)));
  const [gameOver, setGameOver] = useState(false);
  const [paceLevel, setPaceLevel] = useState(0);
  const [kickWindowPlayer, setKickWindowPlayer] = useState<Player | null>(null);
  const [paused, setPaused] = useState(false);
  const [pace, setPace] = useState<"gentle" | "lively">("gentle");
  const [difficulty, setDifficulty] = useState<Difficulty>(competitionMode ? "medium" : "easy");
  const [sound, setSound] = useState(false);

  const combo = getComboData(rally);

  useEffect(() => {
    if (!gameOver || reportedRef.current || !onComplete) return;
    reportedRef.current = true;
    onComplete({ scores });
  }, [gameOver, onComplete, scores]);

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
    reportedRef.current = false;
    pausedRef.current = false;
    setPaused(false);
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
    setMessage(() => () => t("{0} serves first from the left. Start the rally when both players are ready.", playerLabel(0)));
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
    pausedRef.current = false;
    setPaused(false);
    lastTimeRef.current = performance.now();
    setRunning(true);
    setMessage(() => () => t("{0} serves. Let it drop into your shaded zone, then kick it across to {1}.", playerLabel(servingPlayer), playerLabel(servingPlayer === 0 ? 1 : 0)));
  };

  const finishPoint = (scorer: Player, reason: () => string) => {
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
      setMessage(() => () => t("{0} wins {1}–{2}. {3}", playerLabel(scorer), nextScores[0], nextScores[1], reason()));
      return;
    }

    setNextServer(scorer);
    resetBallForServer(scorer);
    setMessage(() => () => t("Point to {0}. {1} {2} serves the next rally.", playerLabel(scorer), reason(), playerLabel(scorer)));
  };

  const kick = (side: Side, aim: ChaptehAim = levelRef.current === "easy" ? "centre" : "near") => {
    if (!runningRef.current || pausedRef.current || gameOverRef.current) return;

    const player: Player = side === "left" ? 0 : 1;
    const chapteh = chaptehRef.current;
    const expected = expectedPlayerRef.current;

    if (player !== expected) {
      setMessage(() => () => t("{0} must make the next kick on the {1} side.", playerLabel(expected), expected === 0 ? t("left") : t("right")));
      return;
    }

    const onOwnSide = player === 0 ? chapteh.x < MID : chapteh.x >= MID;
    if (!onOwnSide) {
      setMessage(() => () => t("Wait for the chapteh to reach {0}'s {1} side.", playerLabel(player), player === 0 ? t("left") : t("right")));
      return;
    }

    if (!canSeniorKick(chapteh.y, chapteh.vy)) {
      setMessage(() => () => t("{0}: wait until the chapteh drops into your lower kick zone.", playerLabel(player)));
      return;
    }

    const direction = player === 0 ? 1 : -1;
    const nextRally = rallyRef.current + 1;
    const nextPace = chaptehPaceLevel(nextRally, scoresRef.current[0] + scoresRef.current[1]);
    paceLevelRef.current = nextPace;
    setPaceLevel(nextPace);
    Object.assign(chapteh, chaptehReturnVelocity(chapteh.x, chapteh.y, player, aim));

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
    if (soundRef.current) {
      // Audio availability must never interrupt scoring or handover.
      try { playComboCue(nextRally); } catch { /* Continue silently on unsupported devices. */ }
    }

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
      setMessage(() => () => t("{0}-kick rally. {1}, get ready on the {2}.", nextRally, playerLabel(nextPlayer), nextPlayer === 0 ? t("left") : t("right")));
    } else {
      setMessage(() => () => levelRef.current === "easy"
        ? t("Good kick. {0} is next.", playerLabel(nextPlayer))
        : t("{0} shot. {1}, watch where it lands.", aim === "far" ? t("Far") : t("Near"), playerLabel(nextPlayer)));
    }
  };

  const pauseRally = () => {
    if (!runningRef.current || pausedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    kickWindowPlayerRef.current = null;
    setKickWindowPlayer(null);
  };

  const resumeRally = () => {
    if (!runningRef.current || !pausedRef.current) return;
    lastTimeRef.current = performance.now();
    pausedRef.current = false;
    setPaused(false);
  };

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) pauseRally(); };
    window.addEventListener("blur", pauseRally);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", pauseRally);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]"))) return;
      const key = event.key.toLowerCase();
      if (["a", "d", "s", "f", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
      if (key === "a" || event.key === "ArrowLeft") kick("left");
      if (key === "d" || event.key === "ArrowRight") kick("right");
      if (key === "s" && levelRef.current !== "easy") kick("left", "far");
      if (key === "f" && levelRef.current !== "easy") kick("right", "far");
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
      ctx.fillText(title, x, 82, MID - 24);
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
      const ready = runningRef.current && !pausedRef.current && canSeniorKick(chapteh.y, chapteh.vy) && (expected === 0 ? chapteh.x < MID : chapteh.x >= MID);
      const readyPlayer = ready ? expected : null;
      if (kickWindowPlayerRef.current !== readyPlayer) {
        kickWindowPlayerRef.current = readyPlayer;
        setKickWindowPlayer(readyPlayer);
      }
      const expectedX = expected === 0 ? MID / 2 : MID + MID / 2;
      const zoneX = expected === 0 ? 0 : MID;

      if (runningRef.current) {
        ctx.fillStyle = expected === 0 ? "rgba(45,109,121,0.16)" : "rgba(168,79,62,0.15)";
        ctx.fillRect(zoneX, GROUND - CHAPTEH_ZONE_HEIGHT, MID, CHAPTEH_ZONE_HEIGHT);
        ctx.strokeStyle = PLAYER_COLORS[expected];
        ctx.lineWidth = 3;
        ctx.strokeRect(zoneX + 8, GROUND - CHAPTEH_ZONE_HEIGHT + 8, MID - 16, CHAPTEH_ZONE_HEIGHT - 16);
        if (levelRef.current !== "easy") {
          const nearX = WIDTH * (expected === 0 ? 0.38 : 0.62);
          const farX = WIDTH * (expected === 0 ? 0.16 : 0.84);
          for (const [x, label] of [[nearX, t("NEAR")], [farX, t("FAR")]] as const) {
            ctx.fillStyle = "rgba(255,255,255,.78)";
            ctx.fillRect(x - 48, GROUND - 72, 96, 42);
            ctx.fillStyle = PLAYER_COLORS[expected];
            ctx.font = "800 16px system-ui";
            ctx.textAlign = "center";
            ctx.fillText(label, x, GROUND - 46);
          }
        }
      }

      drawCourtLabel(0, t("{0} · LEFT", playerLabel(0).toUpperCase()), t("A / ←  ·  tap left"), MID / 2);
      drawCourtLabel(1, t("{0} · RIGHT", playerLabel(1).toUpperCase()), t("D / →  ·  tap right"), MID + MID / 2);

      ctx.textAlign = "center";
      ctx.font = "900 24px system-ui";
      ctx.fillStyle = gameOverRef.current ? "#2f2a24" : PLAYER_COLORS[expected];
      ctx.fillText(
        gameOverRef.current
          ? t("MATCH COMPLETE")
          : pausedRef.current
            ? t("Paused")
          : !runningRef.current
            ? t("{0} SERVES NEXT", playerLabel(serverRef.current).toUpperCase())
            : ready
              ? t("{0} · KICK NOW", playerLabel(expected).toUpperCase())
              : t("{0} · GET READY", playerLabel(expected).toUpperCase()),
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
        ctx.fillText(t("KICK"), expectedX, GROUND - 92);
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
      const ball = chaptehRef.current;
      const dt = Math.max(0, Math.min((time - lastTimeRef.current) / 16.67, 2)) * chaptehTimeScale(paceRef.current, paceLevelRef.current, canSeniorKick(ball.y, ball.vy));
      lastTimeRef.current = time;

      if (runningRef.current && !pausedRef.current) {
        const chapteh = chaptehRef.current;
        chapteh.x += chapteh.vx * dt;
        chapteh.y += chapteh.vy * dt + 0.5 * CHAPTEH_GRAVITY * dt * dt;
        chapteh.vy += CHAPTEH_GRAVITY * dt;

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
          finishPoint(1, () => t("The chapteh went out past {0}'s side.", playerLabel(0)));
        } else if (chapteh.x > WIDTH + 30) {
          finishPoint(0, () => t("The chapteh went out past {0}'s side.", playerLabel(1)));
        } else if (chapteh.y >= GROUND - 2) {
          chapteh.y = GROUND - 2;
          const landingPlayer: Player = chapteh.x < MID ? 0 : 1;
          const scorer = (landingPlayer === 0 ? 1 : 0) as Player;
          finishPoint(scorer, () => t("The chapteh landed on {0}'s side.", playerLabel(landingPlayer)));
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
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    kick(x < rect.width / 2 ? "left" : "right");
  };

  const secondary: [string, string] = [t("{0} kicks", kicks[0]), t("{0} kicks", kicks[1])];

  return (
    <section className="game-layout multiplayer-layout chapteh-versus-layout">
      <aside className="game-panel">
        <InstructionSteps
          title={t("Kick it across to each other")}
          objective={t("{0} owns the left side and {1} owns the right side. Keep sending the chapteh across. First to {2} points wins.", playerLabel(0), playerLabel(1), WIN_SCORE)}
          steps={[
            t("{0} controls the left half with A / Left Arrow. {1} controls the right half with D / Right Arrow.", playerLabel(0), playerLabel(1)),
            t("The server waits for the chapteh to drop into their shaded kick zone, then kicks it across the centre line."),
            difficulty === "easy" ? t("The other player becomes the next kicker. You cannot kick twice in a row. Keep alternating for as long as possible.") : t("Choose a near or far kick. The other player watches its path and returns it. Keep alternating."),
            t("If the chapteh touches the floor on your side, the other player scores 1 point. Sending it out past a player also gives the opponent a point."),
            t("The player who scores serves the next rally. First to {0} points wins the match.", WIN_SCORE),
          ]}
          tip={difficulty === "easy" ? t("Wait for Kick now, then tap your large kick button once. Pause whenever you need a break.") : t("Choose a near or far shot when Kick now appears. Watch its path so you can return it. Pause whenever you need a break.")}
        />
        <DifficultyPicker value={difficulty} disabled={competitionMode} onChange={(next) => {
          resetMatch();
          levelRef.current = next;
          setDifficulty(next);
          const nextPace = next === "difficult" ? "lively" : "gentle";
          paceRef.current = nextPace;
          setPace(nextPace);
        }} description={t("Easy: simple returns. Medium: choose near or far. Difficult: choose shots at a quicker pace.")} />

        <PlayerScoreboard
          activePlayer={expectedPlayer}
          scores={scores}
          labels={playerNames}
          gameOver={gameOver}
          secondary={secondary}
        />

        <div className="mini-stat-row">
          <div><span>{t("Rally streak")}</span><strong>{rally}</strong></div>
          <div><span>{t("Longest rally")}</span><strong>{longestRally}</strong></div>
        </div>

        <div className="turn-message" role="status" aria-live="polite">
          <span className={`player-dot player-dot-${expectedPlayer + 1}`} />
          <div>
            <strong>{gameOver ? t("Match finished") : paused ? t("Paused") : running ? t("{0} kicks next", playerLabel(expectedPlayer)) : t("{0} serves", playerLabel(server))}</strong>
            <p>{message()}</p>
          </div>
        </div>

        <button className="primary-button" disabled={running || gameOver} onClick={startRally}>
          {gameOver ? t("Match complete") : running ? t("Rally in progress") : t("Start rally · {0} serves", playerLabel(server))}
        </button>
        {!competitionMode && <button className="secondary-button" onClick={resetMatch}>{t("Restart match")}</button>}
        {competitionMode && <p className="competition-fairness-note">{t("Both players can choose near or far shots at the same gentle pace.")}</p>}
        <button className="secondary-button" aria-pressed={sound} onClick={() => { soundRef.current = !soundRef.current; setSound(soundRef.current); }}>{sound ? t("Sound on") : t("Sound off")}</button>
      </aside>

      <GamePlayArea className="chapteh-play-area">
        <div className="game-action-toolbar chapteh-action-controls">
          <button className="primary-button" onClick={startRally} disabled={running || gameOver}>
            {gameOver ? t("Match complete") : running ? t("Rally in progress") : t("Start rally · {0} serves", playerLabel(server))}
          </button>
          <button className="secondary-button" onClick={paused ? resumeRally : pauseRally} disabled={!running}>{paused ? t("Resume") : t("Pause")}</button>
          {!competitionMode && <button className="secondary-button" onClick={resetMatch}>{t("Restart match")}</button>}
        </div>
        <div className="chapteh-side-header" aria-label={t("Player sides")}>
          <div className={`chapteh-side-card player-one ${expectedPlayer === 0 && running ? "is-next" : ""}`}>
            <span>{playerLabel(0)}</span>
            <strong>{t("LEFT SIDE")} · {scores[0]}</strong>
            <small>A / ←</small>
          </div>
          <div className="chapteh-rally-center">
            <span>{t("STREAK")}</span>
            <strong key={rally} className="rally-pop">{rally}</strong>
          </div>
          <div className={`chapteh-side-card player-two ${expectedPlayer === 1 && running ? "is-next" : ""}`}>
            <span>{playerLabel(1)}</span>
            <strong>{t("RIGHT SIDE")} · {scores[1]}</strong>
            <small>D / →</small>
          </div>
        </div>

        <div
          className={`chapteh-streak-counter ${rally >= 12 ? "streak-epic" : rally >= 8 ? "streak-great" : rally >= 4 ? "streak-nice" : ""} ${rally === 0 ? "is-reset" : ""}`}
          aria-label={t("Current rally streak: {0} successful kicks", rally)}
        >
          <div className="chapteh-streak-label">
            <span>{t("RALLY STREAK")}</span>
            <small>{t("resets when either player misses")}</small>
          </div>
          <strong key={`streak-${rally}`} className="chapteh-streak-number">{rally}</strong>
          <div className="chapteh-streak-celebration">
            {t(streakCelebration) || (running ? t("Keep it going") : t("Start the next rally"))}
          </div>
        </div>

        <div
          className={`chapteh-combo-meter combo-${combo.tier} ${rally === 0 ? "combo-reset" : ""}`}
          aria-label={t("Combo meter: {0}. Current rally {1}.", combo.label, rally)}
        >
          <div className="chapteh-combo-head">
            <div className="chapteh-combo-title-group">
              <span className="chapteh-combo-eyebrow">{t("COMBO METER")}</span>
              <strong key={`combo-${combo.tier}-${rally}`} className="chapteh-combo-title">{combo.label}</strong>
            </div>
            <div className="chapteh-combo-badge" key={`badge-${rally}`}>{rally}x</div>
          </div>
          <div className="chapteh-combo-bar" aria-hidden="true">
            <span className="chapteh-combo-fill" style={{ width: `${Math.max(8, combo.progress * 100)}%` }} />
          </div>
          <div className="chapteh-combo-meta">
            <span>{combo.helper}</span>
            <strong>{combo.nextMilestone ? t("{0} to next tier", combo.nextMilestone - rally) : t("Top tier reached")}</strong>
          </div>
        </div>

        <div className={`canvas-frame chapteh-frame chapteh-versus-frame active-play-frame ${running && !paused ? "is-running" : "is-ready"} ${paused ? "is-paused" : ""}`}>
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            onPointerDown={handleCanvasTap}
            aria-label={t("Two-player chapteh court. {0} controls the left side and {1} controls the right side.", playerLabel(0), playerLabel(1))}
          />

          <div
            className={`chapteh-center-rally-indicator ${running && !paused ? "is-live" : "is-waiting"} ${
              expectedPlayer === 0 ? "to-left" : "to-right"
            }`}
            role="status"
            aria-live="polite"
            aria-label={
              gameOver ? t("Match finished") : paused ? t("Paused") : running
                ? t("{0} should kick next", playerLabel(expectedPlayer))
                : t("{0} serves next", playerLabel(server))
            }
          >
            <span className="center-rally-kicker">
              {gameOver ? t("Match finished") : paused ? t("Paused") : running ? t("{0} NEXT", playerLabel(expectedPlayer).toUpperCase()) : t("{0} SERVES", playerLabel(server).toUpperCase())}
            </span>
            <span className={`chapteh-pace-badge pace-${paceLevel}`}>{t("PACE ·")} {pace === "gentle" ? t("Gentle") : t(PACE_LABELS[paceLevel])}</span>
            <div className="center-rally-direction" aria-hidden="true">
              <span className="center-rally-side center-rally-side-left">{t("P1")}</span>
              <span className="center-rally-track">
                <span className="center-rally-line" />
                <span className="center-rally-moving-chapteh">✦</span>
                <span className="center-rally-arrow">
                  {running ? (expectedPlayer === 0 ? "←" : "→") : "•"}
                </span>
              </span>
              <span className="center-rally-side center-rally-side-right">{t("P2")}</span>
            </div>
            <small>
              {running
                ? t("{0} · {1} prepares to kick", expectedPlayer === 0 ? t("Move left") : t("Move right"), playerLabel(expectedPlayer))
                : t("Waiting for {0} to serve", playerLabel(server))}
            </small>
          </div>
          {paused && <div className="game-pause-overlay" role="status"><strong>{t("Paused — both players can take a break")}</strong><button className="primary-button" onClick={resumeRally}>{t("Resume")}</button></div>}
        </div>

        <div className={`foot-controls control-deck versus-foot-controls ${difficulty !== "easy" ? "has-aim-options" : ""}`}>
          <button
            className={`kick-button kick-left ${kickWindowPlayer === 0 ? "kick-ready" : "kick-waiting"}`}
            disabled={!running || paused || expectedPlayer !== 0}
            onClick={() => kick("left")}
          >
            <span>{playerLabel(0)} · {difficulty === "easy" ? kickWindowPlayer === 0 ? t("Kick now") : t("Wait") : t("Near kick")}</span>
            <kbd>A / ←</kbd>
          </button>
          {difficulty !== "easy" && <button className={`kick-button kick-left kick-far ${kickWindowPlayer === 0 ? "kick-ready" : "kick-waiting"}`} disabled={!running || paused || expectedPlayer !== 0} onClick={() => kick("left", "far")}>
            <span>{playerLabel(0)} · {t("Far kick")}</span><kbd>S</kbd>
          </button>}
          <button
            className={`kick-button kick-right ${kickWindowPlayer === 1 ? "kick-ready" : "kick-waiting"}`}
            disabled={!running || paused || expectedPlayer !== 1}
            onClick={() => kick("right")}
          >
            <span>{playerLabel(1)} · {difficulty === "easy" ? kickWindowPlayer === 1 ? t("Kick now") : t("Wait") : t("Near kick")}</span>
            <kbd>D / →</kbd>
          </button>
          {difficulty !== "easy" && <button className={`kick-button kick-right kick-far ${kickWindowPlayer === 1 ? "kick-ready" : "kick-waiting"}`} disabled={!running || paused || expectedPlayer !== 1} onClick={() => kick("right", "far")}>
            <span>{playerLabel(1)} · {t("Far kick")}</span><kbd>F</kbd>
          </button>}
        </div>

        <p className="control-hint"> {t("Both players play at the same time on one device.")} {playerLabel(0)} {t("stays on the left,")} {playerLabel(1)} {t("stays on the right, and each successful kick must send the chapteh to the other player.")} </p>
      </GamePlayArea>
    </section>
  );
}
