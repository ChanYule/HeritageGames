import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";
import { t, useLanguage } from "../i18n";
import GamePlayArea from "../components/GamePlayArea";
import PlayerScoreboard from "../components/PlayerScoreboard";
import type { CompetitionGameProps } from "../types";
import { caromSettled, createCaromWorld, legalStrikerX, shootCarom, stepCarom } from "./caromPhysics";
import { cansSettled, createCanWorld, stepCans, throwBall } from "./canPhysics";
import { drawCans, drawCarom } from "./arcadeRendering";
import { playArcadeSound, vibrateArcade } from "./arcadeSound";
import "./arcade.css";

type Props = CompetitionGameProps & { kind: "carom" | "tin-can-knockdown" };
type Aim = { x: number; y: number; power: number };

export default function ArcadeTargetGame({ kind, playerNames, competitionMode = false, onComplete }: Props) {
  useLanguage();
  const carom = kind === "carom";
  const labels: [string, string] = playerNames ?? [t("Player 1"), t("Player 2")];
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [shot, setShot] = useState(0);
  const [ready, setReady] = useState(false);
  const [moving, setMoving] = useState(false);
  const [message, setMessage] = useState(carom ? "Move the striker, then drag back to shoot." : "Drag the ball toward the cans and release.");
  const [messagePoints, setMessagePoints] = useState(0);
  const [muted, setMuted] = useState(false);
  const [strikerX, setStrikerX] = useState(300);
  const [angle, setAngle] = useState(-90);
  const [power, setPower] = useState(55);
  const [targetY, setTargetY] = useState(315);
  const [targetX, setTargetX] = useState(300);
  const [aim, setAim] = useState<Aim | null>(null);
  const aimRef = useRef<Aim | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const caromWorld = useRef(createCaromWorld());
  const canWorld = useRef(createCanWorld());
  const drag = useRef<{ id: number; x: number; y: number; mode: "place" | "aim" } | null>(null);
  const raf = useRef(0);
  const locked = useRef(false);
  const reported = useRef(false);
  const previousPocket = useRef(0);
  const previousImpact = useRef(0);
  const previousEdge = useRef(0);
  const previousFall = useRef(0);
  const active = (shot % 2) as 0 | 1;
  const finished = shot >= 12;
  const canPlay = ready && !moving && !finished;

  const render = useCallback((preview: Aim | null, showStriker = ready && !moving) => {
    const element = canvas.current, ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * pixelRatio), h = Math.round(rect.height * pixelRatio);
    if (element.width !== w || element.height !== h) { element.width = w; element.height = h; }
    ctx.setTransform(w / 600, 0, 0, h / (carom ? 600 : 500), 0, 0);
    if (carom) drawCarom(ctx, caromWorld.current, strikerX, preview, showStriker);
    else drawCans(ctx, canWorld.current, preview, showStriker);
  }, [carom, moving, ready, strikerX]);

  const renderRef = useRef(render);
  renderRef.current = render;
  useEffect(() => render(aim), [render, aim]);
  useEffect(() => {
    const observer = new ResizeObserver(() => renderRef.current(aimRef.current));
    if (canvas.current) observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => {
    if (finished && onComplete && !reported.current) { reported.current = true; onComplete({ scores }); }
  }, [finished, onComplete, scores]);

  const finishShot = (scored: number, foul: boolean) => {
    locked.current = false;
    setMoving(false); setReady(false); setAim(null); setShot(current => current + 1);
    if (scored || foul) setScores(current => current.map((value, index) => index === active ? Math.max(0, value + scored * 100 - (foul ? 100 : 0)) : value) as [number, number]);
    if (scored) playArcadeSound("score", !muted);
    setMessage(foul ? "Striker pocketed. Foul: 100 points deducted." : scored ? "Great shot! {0} scored." : "No score this turn.");
    setMessagePoints(scored * 100);
    if (carom) {
      caromWorld.current.discs.forEach(d => { d.vx = 0; d.vy = 0; });
      caromWorld.current.discs = caromWorld.current.discs.filter(d => d.id !== 0);
      if (caromWorld.current.discs.every(d => d.pocketed)) caromWorld.current = createCaromWorld();
      setStrikerX(x => legalStrikerX(caromWorld.current, x));
    } else {
      canWorld.current.cans.forEach(c => { c.vx = 0; c.vy = 0; c.spin = 0; });
      if (canWorld.current.cans.every(c => c.fallen)) canWorld.current = createCanWorld();
    }
    render(null, false);
  };

  const animate = () => {
    let last = 0;
    const frame = (timestamp: number) => {
      if (!locked.current) return;
      if (document.hidden) { last = timestamp; raf.current = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min((timestamp - last) / 1000, 1 / 30) : 1 / 60;
      last = timestamp;
      if (carom) {
        const world = caromWorld.current;
        stepCarom(world, dt);
        if (world.impacts > previousImpact.current) { playArcadeSound("wood", !muted); previousImpact.current = world.impacts; }
        if (world.edges > previousEdge.current) { playArcadeSound("wood", !muted); previousEdge.current = world.edges; }
        if (world.pocketed.length > previousPocket.current) { playArcadeSound("pocket", !muted); vibrateArcade(18); previousPocket.current = world.pocketed.length; }
        if (caromSettled(world)) { finishShot(world.pocketed.filter(id => id !== 0).length, world.pocketed.includes(0)); return; }
      } else {
        const world = canWorld.current;
        stepCans(world, dt);
        if (world.impacts > previousImpact.current) { playArcadeSound("metal", !muted); previousImpact.current = world.impacts; vibrateArcade(12); }
        if (world.falls > previousFall.current) { playArcadeSound("fall", !muted); previousFall.current = world.falls; }
        if (cansSettled(world)) { finishShot(world.falls, false); return; }
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
      if (!shootCarom(caromWorld.current, strikerX, direction.x * (150 + direction.power * 420), direction.y * (150 + direction.power * 420))) { setMessage("Move the striker to a clear place on the baseline."); return; }
      playArcadeSound("strike", !muted); vibrateArcade(12);
    } else {
      const direction = preview ?? { x: targetX, y: targetY, power: power / 100 };
      if (!throwBall(canWorld.current, direction.x, direction.y, direction.power)) return;
      playArcadeSound("throw", !muted);
    }
    locked.current = true;
    previousPocket.current = 0; previousImpact.current = 0; previousEdge.current = 0; previousFall.current = 0;
    setAim(null); setMoving(true); setMessage("Wait for everything to settle…");
    animate();
  };

  const coordinates = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 600, y: (event.clientY - rect.top) / rect.height * (carom ? 600 : 500) };
  };
  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!canPlay || locked.current) return;
    const point = coordinates(event);
    aimRef.current = null;
    if (carom && point.y > 440 && point.y < 520 && Math.abs(point.x - strikerX) > 32) {
      setStrikerX(legalStrikerX(caromWorld.current, point.x));
      drag.current = { id: event.pointerId, x: point.x, y: point.y, mode: "place" };
    } else if (carom ? Math.hypot(point.x - strikerX, point.y - 480) < 75 : Math.hypot(point.x - 300, point.y - 470) < 85) {
      drag.current = { id: event.pointerId, x: point.x, y: point.y, mode: "aim" };
    } else return;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (locked.current || !drag.current || drag.current.id !== event.pointerId) return;
    const point = coordinates(event);
    if (drag.current.mode === "place") { setStrikerX(legalStrikerX(caromWorld.current, point.x)); return; }
    if (carom) {
      const dx = drag.current.x - point.x, dy = drag.current.y - point.y, distance = Math.hypot(dx, dy);
      const next = { x: dx / (distance || 1), y: dy / (distance || 1), power: Math.min(1, distance / 145) };
      aimRef.current = next; setAim(next); setAngle(Math.round(Math.atan2(next.y, next.x) * 180 / Math.PI)); setPower(Math.round(next.power * 100));
    } else {
      const distance = Math.hypot(point.x - drag.current.x, point.y - drag.current.y);
      const next = { x: point.x, y: point.y, power: Math.min(1, distance / 280) };
      aimRef.current = next; setAim(next); setPower(Math.round(next.power * 100)); setTargetX(Math.round(point.x)); setTargetY(Math.round(Math.max(190, Math.min(385, point.y))));
    }
  };
  const pointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    const mode = drag.current.mode; drag.current = null;
    if (mode === "aim" && aimRef.current) shoot(aimRef.current); else setAim(null);
    aimRef.current = null;
  };
  const restart = () => {
    cancelAnimationFrame(raf.current); locked.current = false; reported.current = false;
    caromWorld.current = createCaromWorld(); canWorld.current = createCanWorld();
    setScores([0, 0]); setShot(0); setReady(false); setMoving(false); setAim(null); setStrikerX(300);
    setMessage(carom ? "Move the striker, then drag back to shoot." : "Drag the ball toward the cans and release.");
  };
  const winner = scores[0] === scores[1] ? t("It's a draw!") : t("{0} wins!", labels[scores[0] > scores[1] ? 0 : 1]);

  return <div className="arcade-layout">
    <div className="arcade-intro"><p className="eyebrow">{t(carom ? "CAROM" : "TIN CAN KNOCKDOWN")}</p><h2>{t(carom ? "Pocket the coins" : "Topple the cans")}</h2><p>{t(carom ? "Move the striker on the baseline. Drag back and release to shoot." : "Drag the ball toward the cans. Aim higher or lower on the stack.")}</p></div>
    <GamePlayArea className="arcade-play-area">
      <PlayerScoreboard activePlayer={active} scores={scores} labels={labels} gameOver={finished} />
      <div className="arcade-status" role="status" aria-live="polite"><strong>{finished ? winner : ready ? t("{0}'s shot {1} of 6", labels[active], Math.floor(shot / 2) + 1) : t("Pass the device to {0}", labels[active])}</strong><span>{finished ? t("All twelve shots are complete.") : moving ? t("Wait for everything to settle…") : t(message, messagePoints)}</span><small className="fullscreen-score-summary">{labels[0]}: {scores[0]} · {labels[1]}: {scores[1]}</small></div>
      {!finished && !ready && <button type="button" className="primary-button arcade-ready" onClick={() => setReady(true)}>{t("{0} is ready", labels[active])}</button>}
      <canvas ref={canvas} className={carom ? "carom-board" : "can-scene"} role="img" aria-label={t(carom ? "Carom board with coins and four corner pockets" : "Tin can stack and throwing ball")} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; aimRef.current = null; setAim(null); }} />
      <div className="arcade-controls">
        <label>{t(carom ? "Striker position" : "Aim height")}<input disabled={!canPlay} type="range" min={carom ? 115 : 190} max={carom ? 485 : 385} value={carom ? strikerX : targetY} onChange={event => carom ? setStrikerX(legalStrikerX(caromWorld.current, Number(event.target.value))) : setTargetY(Number(event.target.value))} /></label>
        {!carom && <label>{t("Aim left or right")}<input disabled={!canPlay} type="range" min="105" max="495" value={targetX} onChange={event => setTargetX(Number(event.target.value))} /></label>}
        {carom && <label>{t("Direction")}<input disabled={!canPlay} type="range" min="-160" max="-20" value={Math.max(-160, Math.min(-20, angle))} onChange={event => setAngle(Number(event.target.value))} /></label>}
        <label>{t("Strength")}: {power}%<input disabled={!canPlay} type="range" min="10" max="100" value={Math.max(10, power)} onChange={event => setPower(Number(event.target.value))} /></label>
        <button type="button" className="primary-button arcade-shoot" disabled={!canPlay} onClick={() => shoot()}>{t(carom ? "Shoot striker" : "Throw ball")}</button>
        <button type="button" className="arcade-mute" aria-pressed={muted} onClick={() => setMuted(value => !value)}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}{t(muted ? "Sound off" : "Sound on")}</button>
      </div>
      {finished && !competitionMode && <button type="button" className="primary-button arcade-ready" onClick={restart}><RotateCcw size={20} />{t("Play again")}</button>}
    </GamePlayArea>
  </div>;
}
