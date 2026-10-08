import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { RotateCcw, Volume2, VolumeX } from "lucide-react";
import { t, useLanguage } from "../i18n";
import GamePlayArea from "../components/GamePlayArea";
import PlayerScoreboard from "../components/PlayerScoreboard";
import type { CompetitionGameProps } from "../types";
import { createTinWorld, stepTinWorld, throwTinBall, tinWorldSettled } from "./tinCan3DPhysics";
import type { TinAim, TinScene } from "./tinCan3DScene";
import { playArcadeSound, vibrateArcade } from "./arcadeSound";
import "./arcade.css";

export default function TinCan3DGame({ playerNames, playerColours, individualAttempt, competitionMode, onComplete, fallback }: CompetitionGameProps & { fallback: (progress: { scores: [number, number]; shot: number; fallenIds: number[] }) => ReactNode }) {
  useLanguage();
  const labels: [string, string] = playerNames ?? [t("Player 1"), t("Player 2")];
  const [initialWorld] = useState(createTinWorld), world = useRef(initialWorld);
  const canvas = useRef<HTMLCanvasElement>(null), scene = useRef<TinScene | null>(null);
  const raf = useRef(0), busy = useRef(false), drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [failed, setFailed] = useState(false), [loaded, setLoaded] = useState(false);
  const [scores, setScores] = useState<[number, number]>([0, 0]), [shot, setShot] = useState(0);
  const [ready, setReady] = useState(Boolean(individualAttempt)), [moving, setMoving] = useState(false);
  const [muted, setMuted] = useState(false), mutedRef = useRef(false); mutedRef.current = muted;
  const [aim, setAim] = useState<TinAim>({ x: 0, y: 1.9, power: .55 }), aimRef = useRef(aim); aimRef.current = aim;
  const completedFallen = useRef<number[]>([]);
  const [message, setMessage] = useState("Drag the ball toward the cans and release.");
  const [points, setPoints] = useState(0), reported = useRef(false);
  const active = (individualAttempt ? 0 : shot % 2) as 0 | 1;
  const finished = shot >= (individualAttempt?.shots ?? 12);
  const canPlay = loaded && ready && !moving && !finished;
  const redraw = () => scene.current?.render(world.current, aimRef.current, ready && !busy.current && !finished);
  const redrawRef = useRef(redraw); redrawRef.current = redraw;
  useEffect(() => {
    if (failed || !canvas.current) return;
    let disposed = false;
    const element = canvas.current;
    const contextLost = (event: Event) => { event.preventDefault(); setFailed(true); };
    element.addEventListener("webglcontextlost", contextLost);
    const observer = new ResizeObserver(() => { drag.current = null; redrawRef.current(); }); observer.observe(element);
    import("./tinCan3DScene").then(module => {
      if (disposed) return;
      try { scene.current = module.createTinScene(element); setLoaded(true); redrawRef.current(); }
      catch { setFailed(true); }
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; cancelAnimationFrame(raf.current); observer.disconnect(); element.removeEventListener("webglcontextlost", contextLost); scene.current?.dispose(); scene.current = null; };
  }, [failed]);
  useEffect(redraw, [aim, ready, loaded, finished, moving]);
  useEffect(() => {
    if (finished && !reported.current) { reported.current = true; onComplete?.({ scores }); }
  }, [finished, scores, onComplete]);
  useEffect(() => {
    const cancel = () => { drag.current = null; };
    window.addEventListener("resize", cancel); document.addEventListener("visibilitychange", cancel);
    return () => { window.removeEventListener("resize", cancel); document.removeEventListener("visibilitychange", cancel); };
  }, []);
  const shoot = (target = aimRef.current) => {
    if (!canPlay || busy.current || !throwTinBall(world.current, target.x, target.y, target.power)) return;
    busy.current = true; setMoving(true); playArcadeSound("throw", !mutedRef.current);
    let last = 0, accumulator = 0, impacts = 0, falls = 0;
    const frame = (time: number) => {
      if (!busy.current) return;
      if (document.hidden) { last = time; raf.current = requestAnimationFrame(frame); return; }
      accumulator += last ? Math.min(.05, (time - last) / 1000) : 1 / 60; last = time;
      while (accumulator >= 1 / 120) { stepTinWorld(world.current, 1 / 120); accumulator -= 1 / 120; }
      if (world.current.impacts > impacts) { impacts = world.current.impacts; playArcadeSound("metal", !mutedRef.current); vibrateArcade(12); }
      if (world.current.falls > falls) { falls = world.current.falls; playArcadeSound("fall", !mutedRef.current); }
      scene.current?.render(world.current, null, false);
      if (tinWorldSettled(world.current)) {
        busy.current = false; setMoving(false); setReady(Boolean(individualAttempt)); setShot(n => n + 1);
        const earned = world.current.falls * 100; setPoints(earned);
        setScores(current => current.map((value, index) => value + (index === active ? earned : 0)) as [number, number]);
        setMessage(earned ? "Great shot! {0} scored." : "No score this turn.");
        if (earned) playArcadeSound("score", !mutedRef.current);
        if (world.current.cans.every(can => can.fallen)) world.current = createTinWorld();
        completedFallen.current = world.current.cans.filter(can => can.fallen).map(can => can.id);
        return;
      }
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  };
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * 600, y: (event.clientY - rect.top) / rect.height * 620 };
  };
  const pointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!canPlay || busy.current || drag.current || !event.isPrimary || event.button !== 0) return;
    const p = point(event), launch = scene.current?.launchOnScreen();
    if (!launch || Math.hypot(p.x - launch.x, p.y - launch.y) > 85) return;
    event.preventDefault(); drag.current = { id: event.pointerId, ...p }; event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const gesture = drag.current; if (!gesture || gesture.id !== event.pointerId || busy.current) return;
    const p = point(event), distance = Math.hypot(p.x - gesture.x, p.y - gesture.y);
    if (p.y > gesture.y - 10) return;
    const target = scene.current?.aimFromScreen(p.x, p.y); if (!target) return;
    const next = { ...target, power: Math.max(.1, Math.min(1, distance / 300)) };
    aimRef.current = next; setAim(next);
  };
  const cancelDrag = () => { drag.current = null; };
  const pointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    const gesture = drag.current; pointerMove(event); const p = point(event); drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (p.y < gesture.y - 15) shoot(aimRef.current);
  };
  const restart = () => {
    busy.current = false; cancelAnimationFrame(raf.current); drag.current = null; world.current = createTinWorld(); reported.current = false;
    completedFallen.current = []; setScores([0, 0]); setShot(0); setReady(Boolean(individualAttempt)); setMoving(false); setMessage("Drag the ball toward the cans and release."); redrawRef.current();
  };
  if (failed) return <><p className="arcade-help" role="status">{t("3D is unavailable on this device. Playing the classic version.")}</p>{fallback({ scores, shot, fallenIds: completedFallen.current })}</>;
  return <div className="arcade-layout">
    <div className="arcade-intro"><p className="eyebrow">{t("TIN CAN KNOCKDOWN")}</p><h2>{t("Topple the cans")}</h2><p>{t("3D throwing: drag the ball toward a can and release. A longer drag gives more power.")}</p></div>
    <GamePlayArea className="arcade-play-area">
      <PlayerScoreboard individual={Boolean(individualAttempt)} colours={playerColours} activePlayer={active} scores={scores} labels={labels} gameOver={finished} />
      <div className="arcade-status" role="status" aria-live="polite"><strong>{finished ? scores[0] === scores[1] ? t("It's a draw!") : t("{0} wins!", labels[scores[0] > scores[1] ? 0 : 1]) : ready ? t("{0}'s shot {1} of {2}", labels[active], individualAttempt ? shot + 1 : Math.floor(shot / 2) + 1, individualAttempt?.shots ?? 6) : t("Pass the device to {0}", labels[active])}</strong><span>{!loaded ? t("Loading 3D scene…") : moving ? t("Wait for everything to settle…") : finished ? t("Round complete.") : t(message, points)}</span><small className="fullscreen-score-summary">{labels[0]}: {scores[0]} · {labels[1]}: {scores[1]}</small></div>
      <canvas ref={canvas} className="can-scene tin-3d-scene" tabIndex={0} aria-label={t("3D tin can stack and throwing ball")} onKeyDown={event => { if ([" ", "Enter"].includes(event.key)) { event.preventDefault(); if (!event.repeat) shoot(); } }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag} />
      <div className="arcade-controls">
        <details className="shot-adjustments"><summary>{t("Adjust shot")}</summary><div className="shot-adjustment-fields">
          <label>{t("Aim left or right")}<input disabled={!canPlay} type="range" min="-2" max="2" step=".05" value={aim.x} onChange={e => setAim(a => ({ ...a, x: Number(e.target.value) }))} /></label>
          <label>{t("Aim height")}<input disabled={!canPlay} type="range" min=".7" max="3.3" step=".05" value={aim.y} onChange={e => setAim(a => ({ ...a, y: Number(e.target.value) }))} /></label>
          <label>{t("Strength")}: {Math.round(aim.power * 100)}%<input disabled={!canPlay} type="range" min="10" max="100" value={Math.round(aim.power * 100)} onChange={e => setAim(a => ({ ...a, power: Number(e.target.value) / 100 }))} /></label>
          {!competitionMode && <button type="button" className="secondary-button" onClick={restart}><RotateCcw size={20} />{t("Start new match")}</button>}
        </div></details>
        <button type="button" className="primary-button arcade-shoot" disabled={!loaded || moving || finished} onClick={() => ready ? shoot() : setReady(true)}>{ready ? t("Throw ball") : t("{0} is ready", labels[active])}</button>
        <button type="button" className="arcade-mute" aria-pressed={muted} onClick={() => setMuted(value => !value)}>{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}{t(muted ? "Sound off" : "Sound on")}</button>
      </div>
    </GamePlayArea>
  </div>;
}
