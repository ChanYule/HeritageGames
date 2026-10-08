import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";
import { t, useLanguage } from "../i18n";
import GamePlayArea from "../components/GamePlayArea";
import PlayerScoreboard from "../components/PlayerScoreboard";
import type { CompetitionGameProps } from "../types";
import { caromSettled, createCaromWorld, legalStrikerX, shootCarom, stepCarom, createCaromMatch, resolveCaromTurn, coinColour, strikerBaseline } from "./caromPhysics";
import { cansSettled, createCanWorld, stepCans, throwBall } from "./canPhysics";
import { drawCans, drawCarom } from "./arcadeRendering";
import { playArcadeSound, vibrateArcade } from "./arcadeSound";
import "./arcade.css";
import TinCan3DGame from "./TinCan3DGame";

type TinProgress = { scores: [number, number]; shot: number; fallenIds: number[] };
type Props = CompetitionGameProps & { kind: "carom" | "tin-can-knockdown"; initialProgress?: TinProgress };
type Aim = { x: number; y: number; power: number };

export default function ArcadeTargetGame(props: Props) {
  return props.kind === "tin-can-knockdown" ? <TinCan3DGame {...props} fallback={progress => <ArcadeTarget2D {...props} initialProgress={progress} />} /> : <ArcadeTarget2D {...props} />;
}

function ArcadeTarget2D({ kind, playerNames, competitionMode = false, onComplete, individualAttempt, playerColours, carromChallenge, initialProgress }: Props) {
  useLanguage();
  const carom = kind === "carom";
  const labels: [string, string] = playerNames ?? [t("Player 1"), t("Player 2")];
  const [scores, setScores] = useState<[number, number]>(initialProgress?.scores ?? [0, 0]);
  const [shot, setShot] = useState(initialProgress?.shot ?? 0);
  const [casualActive, setCasualActive] = useState<0 | 1>(0);
  const [casualWinner, setCasualWinner] = useState<0 | 1 | null>(null);
  const match = useRef(createCaromMatch());
  const [ready, setReady] = useState(Boolean(individualAttempt || carromChallenge));
  const [moving, setMoving] = useState(false);
  const [message, setMessage] = useState(carom ? "Move the striker, then drag back to shoot." : "Drag the ball toward the cans and release.");
  const [messagePoints, setMessagePoints] = useState(0);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const [strikerX, setStrikerX] = useState(300);
  const [angle, setAngle] = useState(-90);
  const [power, setPower] = useState(55);
  const [targetY, setTargetY] = useState(315);
  const [targetX, setTargetX] = useState(300);
  const [aim, setAim] = useState<Aim | null>(null);
  const aimRef = useRef<Aim | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const caromWorld = useRef(createCaromWorld());
  const [initialCanWorld] = useState(() => {
    const world = createCanWorld();
    if (initialProgress) world.cans = world.cans.filter(can => !initialProgress.fallenIds.includes(can.id));
    return world;
  });
  const canWorld = useRef(initialCanWorld);
  const drag = useRef<{ id: number; x: number; y: number; mode: "place" | "aim"; lastX: number; lastY: number; time: number; speed: number } | null>(null);
  const raf = useRef(0);
  const previewFrame = useRef(0);
  const locked = useRef(false);
  const reported = useRef(false);
  const previousPocket = useRef(0);
  const previousImpact = useRef(0);
  const previousEdge = useRef(0);
  const previousFall = useRef(0);
  const casual = carom;
  const active = casual ? casualActive : individualAttempt ? 0 : (shot % 2) as 0 | 1;
  const baseline = strikerBaseline(active);
  const finished = casual ? casualWinner !== null : shot >= (individualAttempt?.shots ?? 12);
  const canPlay = ready && !moving && !finished;

  const render = useCallback((preview: Aim | null, showStriker = ready && !moving) => {
    const element = canvas.current, ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * pixelRatio), h = Math.round(rect.height * pixelRatio);
    if (element.width !== w || element.height !== h) { element.width = w; element.height = h; }
    ctx.setTransform(w / 600, 0, 0, h / (carom ? 600 : 620), 0, 0);
    if (carom) drawCarom(ctx, caromWorld.current, strikerX, preview, showStriker, active);
    else drawCans(ctx, canWorld.current, preview, showStriker);
  }, [carom, moving, ready, strikerX, active]);

  const renderRef = useRef(render);
  renderRef.current = render;
  useEffect(() => {
    const radians = angle * Math.PI / 180;
    const preview = aimRef.current ?? (canPlay ? carom ? { x: Math.cos(radians), y: Math.sin(radians), power: power / 100 } : { x: targetX, y: targetY, power: power / 100 } : null);
    render(preview);
  }, [render, aim, angle, power, targetX, targetY, canPlay, carom]);
  useEffect(() => {
    const observer = new ResizeObserver(() => renderRef.current(aimRef.current));
    if (canvas.current) observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => { cancelAnimationFrame(raf.current); cancelAnimationFrame(previewFrame.current); }, []);
  const schedulePreview = () => {
    if (previewFrame.current) return;
    previewFrame.current = requestAnimationFrame(() => { previewFrame.current = 0; if (!locked.current) renderRef.current(aimRef.current); });
  };
  useEffect(() => {
    if (finished && onComplete && !reported.current) { reported.current = true; onComplete({ scores, ...(casual ? { winner: casualWinner } : {}) }); }
  }, [finished, onComplete, scores]);

  const finishShot = (scored: number, foul: boolean) => {
    locked.current = false;
    setMoving(false); setReady(Boolean(individualAttempt)); setAim(null); setShot(current => current + 1);
    if (casual) {
      const result = resolveCaromTurn(caromWorld.current, match.current);
      scored = result.own;
      setCasualActive(match.current.active); setCasualWinner(match.current.winner);
      setScores([...match.current.points]);
      setAngle(match.current.active === 0 ? -90 : 90);
      setReady(match.current.active === active && match.current.winner === null);
      setMessage(result.message);
    }
    if (!casual && (scored || foul)) setScores(current => current.map((value, index) => index === active ? Math.max(0, value + scored * 100 - (foul ? 100 : 0)) : value) as [number, number]);
    if (scored) playArcadeSound("score", !mutedRef.current);
    if (!casual) setMessage(foul ? "Striker pocketed. Foul: 100 points deducted." : scored ? "Great shot! {0} scored." : "No score this turn.");
    setMessagePoints(scored * 100);
    if (carom) {
      caromWorld.current.discs.forEach(d => { d.vx = 0; d.vy = 0; });
      caromWorld.current.discs = caromWorld.current.discs.filter(d => d.id !== 0);
      setStrikerX(x => legalStrikerX(caromWorld.current, x, match.current.active));
    } else {
      canWorld.current.cans.forEach(c => { c.vx = 0; c.vy = 0; c.spin = 0; });
      if (canWorld.current.cans.every(c => c.fallen)) canWorld.current = createCanWorld();
    }
    render(null, false);
  };

  const animate = () => {
    let last = 0, accumulator = 0;
    const frame = (timestamp: number) => {
      if (!locked.current) return;
      if (document.hidden) { last = timestamp; raf.current = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min((timestamp - last) / 1000, 1 / 30) : 1 / 60;
      last = timestamp;
      accumulator += dt;
      while (accumulator >= 1 / 120) {
        accumulator -= 1 / 120;
        if (carom) {
          const world = caromWorld.current;
          stepCarom(world, 1 / 120);
          if (world.impacts > previousImpact.current) { playArcadeSound("wood", !mutedRef.current); previousImpact.current = world.impacts; }
          if (world.edges > previousEdge.current) { playArcadeSound("wood", !mutedRef.current); previousEdge.current = world.edges; }
          if (world.pocketed.length > previousPocket.current) { playArcadeSound("pocket", !mutedRef.current); vibrateArcade(18); previousPocket.current = world.pocketed.length; }
          if (caromSettled(world)) { finishShot(world.pocketed.filter(id => id !== 0).length, world.pocketed.includes(0)); return; }
        } else {
          const world = canWorld.current;
          stepCans(world, 1 / 120);
          if (world.impacts > previousImpact.current) { playArcadeSound("metal", !mutedRef.current); previousImpact.current = world.impacts; vibrateArcade(12); }
          if (world.falls > previousFall.current) { playArcadeSound("fall", !mutedRef.current); previousFall.current = world.falls; }
          if (cansSettled(world)) { finishShot(world.falls, false); return; }
        }
      }
      render(null, false);
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  };

  const shoot = (preview?: Aim) => {
    if (!canPlay || locked.current) return;
    if (preview && preview.power < .08) { setAim(null); return; }
    if (carom) {
      const radians = angle * Math.PI / 180;
      const direction = preview ?? { x: Math.cos(radians), y: Math.sin(radians), power: power / 100 };
      if (!shootCarom(caromWorld.current, strikerX, direction.x * (150 + direction.power * 420), direction.y * (150 + direction.power * 420), active)) { setMessage("Move the striker to a clear place on the baseline."); return; }
      playArcadeSound("strike", !mutedRef.current); vibrateArcade(12);
    } else {
      const direction = preview ?? { x: targetX, y: targetY, power: power / 100 };
      if (!throwBall(canWorld.current, direction.x, direction.y, direction.power)) return;
      playArcadeSound("throw", !mutedRef.current);
    }
    locked.current = true;
    previousPocket.current = 0; previousImpact.current = 0; previousEdge.current = 0; previousFall.current = 0;
    setAim(null); setMoving(true); setMessage("Wait for everything to settle…");
    animate();
  };

  const coordinates = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 600, y: (event.clientY - rect.top) / rect.height * (carom ? 600 : 620) };
  };
  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!canPlay || locked.current || drag.current || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    const point = coordinates(event);
    aimRef.current = null;
    if (carom && Math.abs(point.y - baseline) < 40 && Math.abs(point.x - strikerX) > 55) {
      setStrikerX(legalStrikerX(caromWorld.current, point.x, active));
      drag.current = { id: event.pointerId, x: point.x, y: point.y, mode: "place", lastX: point.x, lastY: point.y, time: event.timeStamp, speed: 0 };
    } else if (carom ? Math.hypot(point.x - strikerX, point.y - baseline) < 75 : Math.hypot(point.x - 300, point.y - 535) < 85) {
      drag.current = { id: event.pointerId, x: point.x, y: point.y, mode: "aim", lastX: point.x, lastY: point.y, time: event.timeStamp, speed: 0 };
    } else return;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (locked.current || !drag.current || drag.current.id !== event.pointerId) return;
    const point = coordinates(event);
    if (drag.current.mode === "place") { setStrikerX(legalStrikerX(caromWorld.current, point.x, active)); return; }
    if (carom) {
      const dx = drag.current.x - point.x, dy = drag.current.y - point.y, distance = Math.hypot(dx, dy);
      const next = { x: dx / (distance || 1), y: dy / (distance || 1), power: Math.min(1, distance / 85) };
      aimRef.current = next; schedulePreview();
    } else {
      const distance = Math.hypot(point.x - drag.current.x, point.y - drag.current.y);
      const gesture = drag.current;
      const elapsed = Math.max(8, event.timeStamp - gesture.time);
      const movement = Math.hypot(point.x - gesture.lastX, point.y - gesture.lastY);
      gesture.speed = movement > .5 ? .4 * gesture.speed + .6 * movement / elapsed : gesture.speed * Math.exp(-elapsed / 90);
      gesture.lastX = point.x; gesture.lastY = point.y; gesture.time = event.timeStamp;
      const dx = point.x - gesture.x, dy = point.y - gesture.y;
      if (dy >= -8) { aimRef.current = null; schedulePreview(); return; }
      const travel = Math.min(330, Math.max(170, distance));
      const next = { x: Math.max(-50, Math.min(650, 300 + dx / distance * travel)), y: Math.max(190, Math.min(385, 535 + dy / distance * travel)), power: Math.min(1, distance / 300 + gesture.speed * .12) };
      aimRef.current = next; schedulePreview();
    }
  };
  const pointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    pointerMove(event);
    const mode = drag.current.mode, preview = aimRef.current; drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (mode === "aim" && preview) shoot(preview); else setAim(null);
    aimRef.current = null;
  };
  const cancelDrag = (event: PointerEvent<HTMLCanvasElement>) => { if (drag.current && event.pointerId !== drag.current.id) return; drag.current = null; aimRef.current = null; setAim(null); renderRef.current(null); };
  useEffect(() => {
    const cancel = () => { drag.current = null; aimRef.current = null; renderRef.current(null); };
    window.addEventListener("resize", cancel); document.addEventListener("visibilitychange", cancel);
    return () => { window.removeEventListener("resize", cancel); document.removeEventListener("visibilitychange", cancel); };
  }, []);
  const restart = () => {
    cancelAnimationFrame(raf.current); cancelAnimationFrame(previewFrame.current); previewFrame.current = 0; locked.current = false; reported.current = false;
    caromWorld.current = createCaromWorld(); canWorld.current = createCanWorld();
    match.current = createCaromMatch(); setCasualActive(0); setCasualWinner(null); drag.current = null; aimRef.current = null;
    setScores([0, 0]); setShot(0); setReady(false); setMoving(false); setAim(null); setStrikerX(300); setAngle(-90);
    setMessage(carom ? "Move the striker, then drag back to shoot." : "Drag the ball toward the cans and release.");
  };
  const winner = casualWinner !== null ? t("{0} wins!", labels[casualWinner]) : scores[0] === scores[1] ? t("It's a draw!") : t("{0} wins!", labels[scores[0] > scores[1] ? 0 : 1]);

  return <div className="arcade-layout">
    <div className="arcade-intro"><p className="eyebrow">{t(carom ? "CAROM" : "TIN CAN KNOCKDOWN")}</p><h2>{t(carom ? "Pocket the coins" : "Topple the cans")}</h2><p>{t(carom ? "Move the striker on the baseline. Drag back and release to shoot." : "Drag the ball toward the cans. Aim higher or lower on the stack.")}</p></div>
    {carom && <details className="carrom-rules"><summary>{t("How to play Carrom")}</summary><ol>
      <li>{t("Single board: Player 1 breaks with white; Player 2 plays black from the opposite side.")}</li>
      <li>{t("Tap your highlighted baseline to place the striker. Pull back and release, or use Adjust shot and Shoot striker.")}</li>
      <li>{t("Pocket an own coin to play again. A miss passes the turn; opponent coins stay pocketed.")}</li>
      <li>{t("Pocket an own coin before the queen. Cover the queen with an own coin in the same or next shot. Queen plus your first coin needs another cover shot.")}</li>
      <li>{t("Striker alone: one own coin due and lose the turn. Striker plus own coins: return those coins plus one due and play again. Unpaid dues carry forward.")}</li>
      <li>{t("Finish your nine coins after the queen is covered. Your last coin before the queen, or your opponent's last coin, can lose the board.")}</li>
      <li>{t("Winner earns one point per opponent coin remaining, plus three for their covered queen. This is one board, without a tournament timer.")}</li>
    </ol></details>}
    <GamePlayArea className="arcade-play-area">
      <PlayerScoreboard secondary={carom ? ([0, 1] as const).map(side => t("{0}: {1} coins left; {2} due", t(side === 0 ? "White" : "Black"), caromWorld.current.discs.filter(d => !d.pocketed && d.id !== 0 && coinColour(d.id) === (side === 0 ? "light" : "dark")).length, match.current.dues[side])) as [string, string] : undefined} individual={Boolean(individualAttempt)} colours={playerColours} activePlayer={active} scores={scores} labels={labels} gameOver={finished} />
      <div className="arcade-status" role="status" aria-live="polite"><strong>{finished ? winner : ready ? casual ? t("{0}: {1} coins", labels[active], t(active === 0 ? "White" : "Black")) : t("{0}'s shot {1} of {2}", labels[active], individualAttempt ? shot + 1 : Math.floor(shot / 2) + 1, individualAttempt?.shots ?? 6) : t("Pass the device to {0}", labels[active])}</strong><span>{finished ? casual ? `${t(message)} ${t("Board complete. Winner earns {0} board points.", scores[casualWinner ?? 0])}` : t(individualAttempt ? "Round complete." : "All twelve shots are complete.") : moving ? t("Wait for everything to settle…") : t(message, messagePoints)}</span><small className="fullscreen-score-summary">{labels[0]}: {scores[0]} · {labels[1]}: {scores[1]}</small></div>
      <canvas ref={canvas} className={carom ? "carom-board" : "can-scene"} tabIndex={0} onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); if (!event.repeat) shoot(); } }} aria-label={t(carom ? "Carom board with coins and four corner pockets" : "Tin can stack and throwing ball")} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag} />
      {casual && <p className="arcade-rule-hint">{match.current.queenPending !== null ? t("Cover the queen with your own coin this shot.") : match.current.queenCovered !== null ? t("Queen covered by {0}.", labels[match.current.queenCovered]) : t("Queen available after your first own coin. Cover it before your last coin.")}</p>}
      <div className="arcade-controls">
        <details className="shot-adjustments"><summary>{t("Adjust shot")}</summary><div className="shot-adjustment-fields">
        <label>{t(carom ? "Striker position" : "Aim height")}<input disabled={!canPlay} type="range" min={carom ? 115 : 190} max={carom ? 485 : 385} value={carom ? strikerX : targetY} onChange={event => carom ? setStrikerX(legalStrikerX(caromWorld.current, Number(event.target.value), active)) : setTargetY(Number(event.target.value))} /></label>
        {!carom && <label>{t("Aim left or right")}<input disabled={!canPlay} type="range" min="105" max="495" value={targetX} onChange={event => setTargetX(Number(event.target.value))} /></label>}
        {carom && <label>{t("Direction")}<input disabled={!canPlay} type="range" min={active === 0 ? -160 : 20} max={active === 0 ? -20 : 160} value={angle} onChange={event => setAngle(Number(event.target.value))} /></label>}
        <label>{t("Strength")}: {power}%<input disabled={!canPlay} type="range" min="10" max="100" value={Math.max(10, power)} onChange={event => setPower(Number(event.target.value))} /></label>
        {!competitionMode && <button type="button" className="secondary-button" onClick={restart}><RotateCcw size={20} />{t("Start new match")}</button>}
        </div></details>
        <button type="button" className="primary-button arcade-shoot" disabled={moving || finished} onClick={() => ready ? shoot() : setReady(true)}>{!ready && !finished ? t("{0} is ready", labels[active]) : t(carom ? "Shoot striker" : "Throw ball")}</button>
        <button type="button" className="arcade-mute" aria-label={t(muted ? "Sound off" : "Sound on")} aria-pressed={muted} onClick={() => setMuted(value => !value)}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}{t(muted ? "Sound off" : "Sound on")}</button>
      </div>
    </GamePlayArea>
  </div>;
}
