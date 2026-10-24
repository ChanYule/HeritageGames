import { useContext, useEffect, useRef, useState, type PointerEvent } from "react";
import GamePlayArea, { GameFullscreenContext } from "../components/GamePlayArea";
import PlayerScoreboard from "../components/PlayerScoreboard";
import { t, useLanguage } from "../i18n";
import type { CompetitionGameProps } from "../types";
import { createSlingWorld, launchSling, MAX_PULL, SLING, slingTrajectory, stepSling, TIN_LEVELS, type SlingWorld } from "./tinSlingPhysics";
import { playArcadeSound } from "./arcadeSound";
import { creditSlingScore } from "./tinSlingScoring";
import "./arcade.css";

export default function TinSlingGame({ playerNames, playerColours, competitionMode = false, individualAttempt, fixedDifficulty, onComplete }: CompetitionGameProps) {
  useLanguage();
  const labels: [string, string] = playerNames ?? [t("Player 1"), t("Player 2")];
  const initialLevel = competitionMode ? fixedDifficulty === "difficult" ? 4 : fixedDifficulty === "medium" ? 2 : 0 : 0;
  const [level, setLevel] = useState(initialLevel), [active, setActive] = useState<0 | 1>(0);
  const world = useRef<SlingWorld | null>(null); if (!world.current) world.current = createSlingWorld(initialLevel);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [ready, setReady] = useState(Boolean(individualAttempt)), [moving, setMoving] = useState(false), [finished, setFinished] = useState(false);
  const [version, refresh] = useState(0), [muted, setMuted] = useState(false), [angle, setAngle] = useState(32), [power, setPower] = useState(75);
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [result, setResult] = useState(false), [firstClear, setFirstClear] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null), gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const pull = useRef({ x: -.73, y: -.46 }), locked = useRef(false), reported = useRef(false), raf = useRef(0);
  const levelScores = useRef(new Map<string, number>());
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const updateRef = useRef<() => void>(() => {});
  const preview = useRef<{ x: number; y: number }[]>([]);
  const fullscreenState = useContext(GameFullscreenContext);
  const paused = fullscreenState?.paused ?? false;
  const pauseRef = useRef(paused); pauseRef.current = paused;
  const canPlay = !paused && ready && !moving && !result && !finished;
  const w = world.current, spec = TIN_LEVELS[level];
  const draw = () => {
    const element = canvas.current, ctx = element?.getContext("2d"); if (!element || !ctx) return;
    const rect = element.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (!rect.width || !rect.height) return;
    const width = Math.round(rect.width * ratio), height = Math.round(rect.height * ratio);
    if (element.width !== width || element.height !== height) { element.width = width; element.height = height; }
    ctx.setTransform(width / 1200, 0, 0, height / 620, 0, 0);
    const ground = (y: number) => 600 - y * 90;
    const sky = ctx.createLinearGradient(0, 0, 0, 620); sky.addColorStop(0, "#d9f0ef"); sky.addColorStop(1, "#fff4d9"); ctx.fillStyle = sky; ctx.fillRect(0, 0, 1200, 620);
    ctx.fillStyle = "#c69e70"; ctx.fillRect(0, 565, 1200, 55);
    ctx.strokeStyle = "#df9d75"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 70); ctx.quadraticCurveTo(600, 155, 1200, 70); ctx.stroke();
    for (let i = 0; i < 16; i++) { const x = i * 80; ctx.fillStyle = ["#b54e40", "#397b72", "#d7a83c"][i % 3]; ctx.beginPath(); ctx.moveTo(x, 75); ctx.lineTo(x + 34, 82); ctx.lineTo(x + 15, 113); ctx.fill(); }
    for (const o of world.current!.objects.filter(o => !o.broken)) {
      const p = o.body.position; ctx.save(); ctx.translate(p.x * 90, ground(p.y));
      ctx.rotate(-2 * Math.atan2(o.body.quaternion.z, o.body.quaternion.w));
      const ww = o.width * 90, hh = o.height * 90;
      const colours = { tin: "#d4dedb", wood: "#b17c46", stone: "#737f82", platform: "#78573d", ramp: "#8c6847" };
      const fill = ctx.createLinearGradient(-ww / 2, 0, ww / 2, 0); fill.addColorStop(0, colours[o.kind]); fill.addColorStop(.45, o.kind === "tin" ? "#fffdf0" : colours[o.kind]); fill.addColorStop(1, colours[o.kind]);
      ctx.fillStyle = fill; ctx.fillRect(-ww / 2, -hh / 2, ww, hh); ctx.strokeStyle = "#46544e"; ctx.lineWidth = 2; ctx.strokeRect(-ww / 2, -hh / 2, ww, hh);
      if (o.kind === "tin") { ctx.fillStyle = o.fallen ? "#64796d" : "#ae493c"; ctx.fillRect(-ww / 2 + 2, -hh * .23, ww - 4, hh * .46); ctx.strokeStyle = "#6c827e"; for (const y of [-.38, .38]) { ctx.beginPath(); ctx.moveTo(-ww / 2, hh * y); ctx.lineTo(ww / 2, hh * y); ctx.stroke(); } }
      if (o.kind === "wood") { ctx.strokeStyle = "#684827"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-ww / 2, -hh / 2); ctx.lineTo(ww / 2, hh / 2); ctx.moveTo(ww / 2, -hh / 2); ctx.lineTo(-ww / 2, hh / 2); ctx.stroke(); }
      ctx.restore();
    }
    const launcherX = SLING.x * 90, launcherY = ground(SLING.y);
    ctx.strokeStyle = "#765030"; ctx.lineWidth = 15; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(launcherX, ground(.4)); ctx.lineTo(launcherX, launcherY + 25); ctx.moveTo(launcherX - 20, launcherY - 15); ctx.lineTo(launcherX, launcherY + 25); ctx.lineTo(launcherX + 20, launcherY - 15); ctx.stroke();
    if (canPlay) {
      const bx = launcherX + (gesture.current ? pull.current.x * 90 : 0), by = launcherY - (gesture.current ? pull.current.y * 90 : 0);
      ctx.strokeStyle = "#603d32"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(launcherX - 20, launcherY - 15); ctx.lineTo(bx, by); ctx.lineTo(launcherX + 20, launcherY - 15); ctx.stroke();
      ctx.fillStyle = "#a64735"; ctx.beginPath(); ctx.arc(bx, by, 17, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = gesture.current ? "#fff" : "#73382d"; ctx.stroke();
      ctx.fillStyle = "#235b55"; for (const p of preview.current) { ctx.beginPath(); ctx.arc(p.x * 90, ground(p.y), 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) for (const effect of world.current!.effects) {
      ctx.save(); ctx.globalAlpha = 1 - effect.age / .4; ctx.fillStyle = effect.kind === "wood" ? "#a46b32" : "#fff6c4";
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * .4, spread = effect.age * 75; ctx.fillRect(effect.x * 90 + Math.cos(a) * spread, ground(effect.y) + Math.sin(a) * spread, 4, 4); }
      ctx.restore();
    }
    const ball = world.current!.ball;
    if (ball) { ctx.save(); ctx.translate(ball.position.x * 90, ground(ball.position.y)); ctx.rotate(-2 * Math.atan2(ball.quaternion.z, ball.quaternion.w)); ctx.fillStyle = "#a64735"; ctx.beginPath(); ctx.arc(0, 0, 16.2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#f5c194"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(12, 4); ctx.stroke(); ctx.restore(); }
  };
  updateRef.current = draw;
  useEffect(() => {
    if (!canPlay) { preview.current = []; draw(); return; }
    if (!gesture.current) { const radians = angle * Math.PI / 180; pull.current = { x: -Math.cos(radians) * MAX_PULL * power / 100, y: -Math.sin(radians) * MAX_PULL * power / 100 }; }
    const dots = fixedDifficulty === "difficult" || level === 4 ? 18 : fixedDifficulty === "medium" || level >= 2 ? 28 : 40;
    preview.current = slingTrajectory(world.current!, pull.current.x, pull.current.y).slice(0, dots); draw();
  }, [angle, power, ready, moving, result, finished, version, level, active, fixedDifficulty, paused]);
  useEffect(() => {
    const cancel = () => { gesture.current = null; updateRef.current(); };
    const observer = new ResizeObserver(cancel); if (canvas.current) observer.observe(canvas.current);
    window.addEventListener("blur", cancel); document.addEventListener("visibilitychange", cancel);
    return () => { observer.disconnect(); window.removeEventListener("blur", cancel); document.removeEventListener("visibilitychange", cancel); cancelAnimationFrame(raf.current); };
  }, []);
  useEffect(() => { if (finished && !reported.current) { reported.current = true; onComplete?.({ scores }); } }, [finished, scores, onComplete]);
  const shoot = () => {
    if (!canPlay || locked.current || document.hidden || !launchSling(world.current!, pull.current.x, pull.current.y)) return;
    const previousScore = world.current!.score; setLastPoints(null);
    gesture.current = null; locked.current = true; setMoving(true); playArcadeSound("throw", !mutedRef.current);
    let previous = 0, accumulator = 0, impacts = world.current!.impacts, breaks = world.current!.breaks;
    const frame = (time: number) => {
      if (document.hidden || pauseRef.current) { previous = time; raf.current = requestAnimationFrame(frame); return; }
      accumulator += previous ? Math.min(.05, (time - previous) / 1000) : 1 / 60; previous = time;
      while (accumulator >= 1 / 120) { stepSling(world.current!, 1 / 120); accumulator -= 1 / 120; }
      const current = world.current!;
      if (current.breaks > breaks) { breaks = current.breaks; playArcadeSound("wood", !mutedRef.current); }
      else if (current.impacts > impacts) { impacts = current.impacts; playArcadeSound("metal", !mutedRef.current); }
      updateRef.current();
      if (current.settled) {
        locked.current = false; setMoving(false); setLastPoints(current.score - previousScore); refresh(n => n + 1);
        const earned = creditSlingScore(levelScores.current, level, active, current.score);
        if (earned) setScores(s => { const next: [number, number] = [...s]; next[active] += earned; return next; });
        if (current.resolved) { setResult(true); if (current.breakdown.clear) playArcadeSound("score", !mutedRef.current); if (competitionMode && individualAttempt) setFinished(true); }
        return;
      }
      raf.current = requestAnimationFrame(frame);
    }; raf.current = requestAnimationFrame(frame);
  };
  const point = (event: PointerEvent<HTMLCanvasElement>) => { const r = event.currentTarget.getBoundingClientRect(); return { x: (event.clientX - r.left) / r.width * 1200 / 90, y: (600 - (event.clientY - r.top) / r.height * 620) / 90 }; };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current; if (!g || g.id !== event.pointerId) return;
    const p = point(event), dx = p.x - g.x, dy = p.y - g.y, scale = Math.min(1, MAX_PULL / (Math.hypot(dx, dy) || 1));
    pull.current = { x: dx * scale, y: dy * scale }; refresh(n => n + 1);
  };
  const newAttempt = (nextLevel: number, nextActive: 0 | 1) => { world.current = createSlingWorld(nextLevel); gesture.current = null; setLevel(nextLevel); setActive(nextActive); setResult(false); setLastPoints(null); setReady(Boolean(individualAttempt)); refresh(n => n + 1); };
  const proceed = () => {
    if (active === 0 && !individualAttempt) { setFirstClear(Boolean(w.breakdown.clear)); newAttempt(level, 1); }
    else if (competitionMode || level === 4) setFinished(true);
    else if ((w.breakdown.clear || firstClear)) newAttempt(level + 1, 0);
    else newAttempt(level, 0);
  };
  const restart = () => { cancelAnimationFrame(raf.current); locked.current = false; reported.current = false; levelScores.current.clear(); setScores([0, 0]); setMoving(false); setFinished(false); setFirstClear(false); newAttempt(initialLevel, 0); };
  useEffect(() => { if (paused) { gesture.current=null; preview.current=[]; updateRef.current(); } }, [paused]);
  return <div className="arcade-layout sling-layout">
    <div className="arcade-intro"><h2>{t("Tin-Can Knockdown")}</h2><p>{t("Drag the ball back and release to shoot.")}</p><details><summary>{t("How to play")}</summary><p>{t("Three balls each. Both players start with identical tins. Break wooden crates, lob over stone, or use ramps. Tins must topple or leave their place to score.")}</p><p>{t("Each tin: 100. Clear bonus: 200. Each unused ball: 50.")}</p><p>{t("Your best score on each level counts toward your run total.")}</p></details></div>
    <GamePlayArea className="arcade-play-area sling-play-area">
      <PlayerScoreboard individual={Boolean(individualAttempt)} colours={playerColours} labels={labels} scores={scores} activePlayer={active} gameOver={finished} />
      <div className="arcade-status" role="status" aria-live="polite"><strong>{t("Level {0} of {1}", level + 1, 5)} · {t(spec.name)}</strong><span>{t(spec.objective)}</span><span>{t("Balls left: {0} · Level score: {1}", w.balls, w.score)} · {labels[active]}</span><small>{t("Run score: {0}", scores[active])}</small>{lastPoints !== null && <small>{t("Last shot: +{0} points", lastPoints)}</small>}<small className="fullscreen-score-summary">{labels[0]}: {scores[0]} · {labels[1]}: {scores[1]}</small></div>
      <canvas ref={canvas} className="sling-scene" tabIndex={canPlay ? 0 : -1} aria-label={t("Tin-can slingshot. Drag back to shoot, or use angle, strength and Shoot ball controls.")}
        onPointerDown={e => { if (!canPlay || locked.current || gesture.current || !e.isPrimary || e.button !== 0) return; const p = point(e); if (Math.hypot(p.x - SLING.x, p.y - SLING.y) > Math.max(.65, 28 / e.currentTarget.getBoundingClientRect().width * 1200 / 90)) return; e.preventDefault(); gesture.current = { id: e.pointerId, ...p }; pull.current = { x: 0, y: 0 }; e.currentTarget.setPointerCapture(e.pointerId); refresh(n => n + 1); }}
        onPointerMove={move} onPointerUp={e => { if (gesture.current?.id !== e.pointerId) return; move(e); gesture.current = null; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); shoot(); refresh(n => n + 1); }}
        onPointerCancel={() => { gesture.current = null; refresh(n => n + 1); }} onLostPointerCapture={() => { gesture.current = null; }}
        onKeyDown={e => { if ([" ", "Enter"].includes(e.key)) { e.preventDefault(); if (!e.repeat) shoot(); } }} />
      <p className="sling-feedback" role="status">{finished ? t("Match complete") : result ? t(w.breakdown.clear ? "Level complete!" : "Level over") : moving ? t("Wait for everything to settle…") : !ready ? t("Pass the device to {0}", labels[active]) : t("Strength: {0}%", Math.round(Math.hypot(pull.current.x, pull.current.y) / MAX_PULL * 100))}</p>
      {result && <div className="sling-result" role="status"><strong>{t("Level score: {0}", w.score)}</strong><span>{t("Tins: {0} · Clear: {1} · Unused balls: {2}", w.breakdown.tins, w.breakdown.clear, w.breakdown.unused)}</span></div>}
      <div className="arcade-controls">
        {!ready && !finished && !result && <button className="primary-button" onClick={() => setReady(true)}>{t("{0} is ready", labels[active])}</button>}
        {result && !finished && !competitionMode && !w.breakdown.clear && (active === 0 || level === 4 || firstClear) && <button className="secondary-button" onClick={() => newAttempt(level, active)}>{t("Retry Level")}</button>}
        {result && !finished && <button className="primary-button" onClick={proceed}>{t(active === 0 && !individualAttempt ? "Next player" : competitionMode || level === 4 ? "Finish match" : (w.breakdown.clear || firstClear) ? "Next Level" : "Retry Level")}</button>}
        {!result && !finished && <><details className="shot-adjustments"><summary>{t("Adjust shot")}</summary><div className="shot-adjustment-fields"><label>{t("Launch angle")} {angle}°<input type="range" min="5" max="75" value={angle} disabled={!canPlay} onChange={e => setAngle(Number(e.target.value))} /></label><label>{t("Strength")} {power}%<input type="range" min="12" max="100" value={power} disabled={!canPlay} onChange={e => setPower(Number(e.target.value))} /></label></div></details><button className="primary-button" disabled={!canPlay} onClick={shoot}>{t("Shoot ball")}</button></>}
        <button className="arcade-mute" aria-pressed={muted} onClick={() => setMuted(v => !v)}>{t(muted ? "Sound off" : "Sound on")}</button>
        {!competitionMode && <button className="secondary-button" disabled={moving} onClick={restart}>{t("Start new match")}</button>}
      </div>
    </GamePlayArea>
  </div>;
}
