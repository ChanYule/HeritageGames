import { useEffect, useRef, useState, type PointerEvent } from "react";
import GamePlayArea from "../components/GamePlayArea";
import { t, useLanguage } from "../i18n";
import { readArcadeMute, writeArcadeMute } from "./arcadePreferences";
import { SkyEngine } from "./sky1942/engine";
import { SkyInput } from "./sky1942/input";
import { SkyAudio } from "./sky1942/audio";
import { renderSky } from "./sky1942/rendering";
import { startLoop } from "./sky1942/runtime";
import { readBest, readScores, readLatest, saveBest, saveScore, qualifies, type ScoreEntry, type ScoreStore } from "./sky1942/scoring";
import { SkyArtwork } from "./sky1942/SkyArtwork";
import "./sky1942/sky1942.css";

type View = "main" | "help" | "scores" | "settings";
type Settings = { autoFire: boolean; muted: boolean; reduced: boolean; control: "joystick" | "drag" };
const memoryStore = (): ScoreStore => { const values = new Map<string, string>(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } }; };
function storage(): ScoreStore & { sessionOnly?: boolean } { try { return window.localStorage; } catch { return { ...memoryStore(), sessionOnly: true }; } }
function initialSettings(): Settings {
  const touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const defaults: Settings = { autoFire: touch, muted: readArcadeMute(), reduced: typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, control: "joystick" };
  try { const raw = JSON.parse(localStorage.getItem("sky1942_settings_v1") ?? "null"); if (raw && typeof raw === "object") return { autoFire: typeof raw.autoFire === "boolean" ? raw.autoFire : defaults.autoFire, muted: defaults.muted, reduced: defaults.reduced || raw.reduced === true, control: raw.control === "drag" ? "drag" : "joystick" }; } catch { /* Defaults are usable without storage. */ }
  return defaults;
}
export default function Sky1942Game({ onExit, onRegisterExit }: { onExit: () => void; onRegisterExit?: (request: (() => void) | null) => void }) {
  useLanguage();
  const [store] = useState(storage);
  const [settings, setSettings] = useState(initialSettings);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const [audio] = useState(() => new SkyAudio());
  const [engine] = useState(() => new SkyEngine(Math.random, name => audio.play(name)));
  const [input] = useState(() => new SkyInput());
  const [hud, setHud] = useState(() => ({ phase: engine.phase, score: 0, stage: 1, lives: 3, loops: 3, weapon: 1, kills: 0, boss: 0, notice: "" }));
  const [view, setView] = useState<View>("main");
  const viewRef = useRef(view); viewRef.current = view;
  const [confirm, setConfirm] = useState<"restart" | "exit" | null>(null);
  const confirmRef = useRef(confirm); confirmRef.current = confirm;
  const [entries, setEntries] = useState<ScoreEntry[]>(() => readScores(store));
  const [best, setBest] = useState(() => readBest(store));
  const [latest, setLatest] = useState(() => readLatest(store));
  const [newRecord, setNewRecord] = useState(false);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const submitted = useRef(false), recorded = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null), overlayRef = useRef<HTMLDivElement>(null);
  const joystickPointer = useRef<number | null>(null), firePointer = useRef<number | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; planeX: number; planeY: number } | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const [firing, setFiring] = useState(false);
  const syncHud = () => {
    setHud({ phase: engine.phase, score: engine.score, stage: engine.stage, lives: engine.player.lives, loops: engine.player.loops, weapon: engine.player.weapon, kills: engine.kills, boss: engine.boss ? engine.boss.hp / engine.boss.maxHp : 0, notice: engine.noticeTimer > 0 ? engine.notice : "" });
  };
  const clear = () => { input.clear(); joystickPointer.current = null; firePointer.current = null; drag.current = null; setStick({ x: 0, y: 0 }); setFiring(false); };
  const pause = () => { engine.pause(); clear(); audio.suspend(); syncHud(); };
  const resume = () => { clear(); void audio.unlock(); engine.resume(); setView("main"); setConfirm(null); syncHud(); };
  const start = () => { clear(); recorded.current = false; submitted.current = false; setSaved(false); setStorageError(false); setName(""); setNewRecord(false); engine.reset(); setView("main"); setConfirm(null); void audio.unlock(); syncHud(); canvasRef.current?.closest(".game-play-area")?.scrollIntoView({ block: "start" }); };
  useEffect(() => {
    onRegisterExit?.(() => {
      if (engine.phase === "menu" || engine.phase === "gameover") { onExit(); return; }
      pause(); setView("main"); setConfirm("exit");
    });
    return () => onRegisterExit?.(null);
    // The exit callback reads the stable engine and pauses before confirmation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterExit, onExit, engine]);
  useEffect(() => {
    audio.setMuted(settings.muted);
    writeArcadeMute(settings.muted);
    try { localStorage.setItem("sky1942_settings_v1", JSON.stringify(settings)); } catch { /* Session preferences remain active. */ }
  }, [settings, audio]);
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const unbind = input.bind(window,
      () => engine.phase === "playing" || engine.phase === "transition",
      () => { if (viewRef.current !== "main" || confirmRef.current) return; if (engine.phase === "paused") resume(); else pause(); },
      () => { if (confirmRef.current) setConfirm(null); else if (viewRef.current !== "main") setView("main"); else if (engine.phase === "playing" || engine.phase === "transition") pause(); }, pause);
    const hidden = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", hidden);
    const stop = startLoop(engine, input, () => settingsRef.current.autoFire, () => renderSky(ctx, engine, settingsRef.current.reduced), syncHud);
    return () => { stop(); unbind(); document.removeEventListener("visibilitychange", hidden); audio.dispose(); };
    // Engine, input and audio are stable for this mount; callbacks read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, input, audio]);
  useEffect(() => {
    if (hud.phase !== "gameover" || recorded.current) return;
    recorded.current = true;
    const previous = readBest(store); setNewRecord(engine.score > previous);
    setStorageError(!saveBest(store, engine.score, engine.stage) || Boolean(store.sessionOnly)); setBest(Math.max(previous, engine.score)); setLatest({ name: "AAA", score: engine.score, stage: engine.stage });
  }, [hud.phase, engine, store]);
  const overlay = hud.phase === "menu" || hud.phase === "paused" || hud.phase === "gameover";
  useEffect(() => {
    if (!overlay) return;
    overlayRef.current?.querySelector<HTMLElement>("button,input")?.focus({ preventScroll: true });
  }, [overlay, view, confirm, hud.phase]);
  const save = () => {
    if (submitted.current || !qualifies(engine.score, readScores(store))) return;
    if (saveScore(store, name.trim() || "AAA", engine.score, engine.stage)) { submitted.current = true; setSaved(true); setStorageError(Boolean(store.sessionOnly)); setEntries(readScores(store)); }
    else setStorageError(true);
  };
  const joystick = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== joystickPointer.current) return;
    const rect = event.currentTarget.getBoundingClientRect(), radius = rect.width * .32;
    let x = (event.clientX - rect.left - rect.width / 2) / radius, y = (event.clientY - rect.top - rect.height / 2) / radius;
    const size = Math.max(1, Math.hypot(x, y)); x /= size; y /= size;
    input.joystick = { x, y }; setStick({ x, y });
  };
  const releaseStick = (event: PointerEvent<HTMLDivElement>) => { if (event.pointerId === joystickPointer.current) { joystickPointer.current = null; input.joystick = { x: 0, y: 0 }; setStick({ x: 0, y: 0 }); } };
  const releaseFire = (event: PointerEvent<HTMLButtonElement>) => { if (event.pointerId === firePointer.current) { firePointer.current = null; input.pointerFire = false; setFiring(false); } };
  const pointerStart = (event: PointerEvent<HTMLCanvasElement>) => {
    if (settings.control !== "drag" || engine.phase !== "playing" || drag.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, planeX: engine.player.x, planeY: engine.player.y };
  };
  const pointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current; if (!d || d.id !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect(); input.value.target = { x: d.planeX + (event.clientX - d.x) * 480 / rect.width, y: d.planeY + (event.clientY - d.y) * 720 / rect.height };
  };
  const releaseDrag = (event: PointerEvent<HTMLCanvasElement>) => { if (drag.current?.id === event.pointerId) { drag.current = null; input.value.target = null; } };
  const scoreList = <><p>{t("Top Five Local Scores")}</p>{entries.length ? <ol className="sky-scores">{entries.map((entry, i) => <li key={i}><strong>{entry.name}</strong><span>{entry.score.toLocaleString()} · {t("Stage {0}", entry.stage)}</span></li>)}</ol> : <p>{t("No scores yet. Be the first ace!")}</p>}<p>{t("Personal Best")}: {best.toLocaleString()}</p>{latest && <p>{t("Latest Score")}: {latest.score.toLocaleString()} · {t("Stage {0}", latest.stage)}</p>}<small>{t("Scores are saved on this browser only.")}</small></>;
  return <GamePlayArea className="sky-play-area">
    <div className="sky-hud" aria-label={t("Game status")}>
      <div><span>{t("Score")}</span><strong>{hud.score.toLocaleString()}</strong></div><div><span>{t("Best Score")}</span><strong>{Math.max(best, hud.score).toLocaleString()}</strong></div><div><span>{t("Stage")}</span><strong>{hud.stage}</strong></div><div><span>{t("Lives")}</span><strong>{hud.lives}</strong></div><div><span>{t("LOOP")}</span><strong>{hud.loops}</strong></div>
    </div>
    <div className="sky-toolbar"><span>{t("Weapon {0}", hud.weapon)}</span><button onClick={() => hud.phase === "paused" ? resume() : pause()} disabled={hud.phase === "menu" || hud.phase === "gameover"}>{t(hud.phase === "paused" ? "Resume" : "Pause")}</button><button onClick={() => setSettings(s => ({ ...s, muted: !s.muted }))} aria-pressed={!settings.muted}>{t(settings.muted ? "Sound Off" : "Sound On")}</button><button onClick={() => { pause(); setView("settings"); }}>{t("Settings")}</button></div>
    <div className="sky-cabinet">
      <div className="sky-screen">
        <canvas ref={canvasRef} width="480" height="720" aria-label={t("SKY 1942 flight area. Use the controls below or your keyboard.")} onPointerDown={pointerStart} onPointerMove={pointerMove} onPointerUp={releaseDrag} onPointerCancel={releaseDrag} onLostPointerCapture={releaseDrag} className={settings.control === "drag" ? "sky-drag" : ""} />
        {hud.boss > 0 && <div className="sky-boss"><label htmlFor="sky-boss-health">{t("Boss health")}</label><progress id="sky-boss-health" value={hud.boss} max="1" /></div>}
        {hud.notice && <div className="sky-notice" role="status">{t(hud.notice, hud.stage)}</div>}
      </div>
      <div className="sky-controls">
        <div className="sky-movement">
          <div className={`sky-joystick${settings.control === "drag" ? " is-drag-mode" : ""}`} role="group" aria-label={t("Movement joystick")}
            onPointerDown={event => { if (joystickPointer.current !== null || overlay) return; joystickPointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); joystick(event); }}
            onPointerMove={joystick} onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}>
            <span aria-hidden="true" className="sky-stick" style={{ transform: `translate(${stick.x * 32}px, ${stick.y * 32}px)` }}>✥</span>
          </div><span>{t(settings.control === "drag" ? "Drag to move" : "Move")}</span>
        </div>
        <div className="sky-actions"><button className={`sky-fire${firing ? " is-held" : ""}`} disabled={overlay} aria-label={t("Hold to fire")}
          onPointerDown={event => { if (firePointer.current !== null) return; firePointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); input.pointerFire = true; setFiring(true); }}
          onPointerUp={releaseFire} onPointerCancel={releaseFire} onLostPointerCapture={releaseFire}
          onKeyDown={event => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); input.key("Space", true); } }}
          onKeyUp={event => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); input.key("Space", false); } }}>{t("FIRE")}</button>
          <button className="sky-roll" disabled={overlay || hud.loops === 0} onClick={() => { input.value.roll = true; }} onKeyDown={event => { if (event.repeat && (event.code === "Enter" || event.code === "Space")) event.preventDefault(); }} aria-label={t("Barrel roll. {0} charges left", hud.loops)}>{t("LOOP")}<small>× {hud.loops}</small></button>
        </div>
      </div>
      {overlay && <div className="sky-overlay" ref={overlayRef} role="dialog" aria-modal="true" aria-label={t(confirm ? "Confirm action" : view === "main" ? hud.phase === "paused" ? "PAUSED" : hud.phase === "gameover" ? "GAME OVER" : "SKY 1942" : view === "help" ? "How to Play" : view === "scores" ? "High Scores" : "Settings")}
        onKeyDown={event => { if (event.key !== "Tab") return; const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled),input,select")); const first = controls[0], last = controls[controls.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }}>
        <div className="sky-menu">
          {confirm ? <><h2>{t("Confirm action")}</h2><p>{t(confirm === "restart" ? "Restart this flight? Your current score will be lost." : "Leave this flight? Your current score will be lost.")}</p><button className="sky-primary" onClick={() => confirm === "restart" ? start() : onExit()}>{t(confirm === "restart" ? "Restart" : "Exit Game")}</button><button onClick={() => setConfirm(null)}>{t("Cancel")}</button></>
          : view === "settings" ? <><h2>{t("Settings")}</h2><label><input type="checkbox" checked={settings.autoFire} onChange={event => setSettings(s => ({ ...s, autoFire: event.target.checked }))} />{t("Auto Fire")}</label><p>{t("Auto Fire shoots only during active gameplay.")}</p><label><input type="checkbox" checked={settings.muted} onChange={event => setSettings(s => ({ ...s, muted: event.target.checked }))} />{t("Mute sound")}</label><label><input type="checkbox" checked={settings.reduced} onChange={event => setSettings(s => ({ ...s, reduced: event.target.checked }))} />{t("Reduced motion")}</label><label>{t("Touch movement")}<select value={settings.control} onChange={event => { clear(); setSettings(s => ({ ...s, control: event.target.value === "drag" ? "drag" : "joystick" })); }}><option value="joystick">{t("Joystick")}</option><option value="drag">{t("Drag to move")}</option></select></label><p>{t("Drag anywhere in the flight area. Your aircraft follows the movement without jumping to your finger.")}</p><button onClick={() => setView("main")}>{t("Back")}</button></>
          : view === "help" ? <><h2>{t("How to Play")}</h2><SkyArtwork /><p>{typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 ? t("Move with the joystick. Hold FIRE, or enable Auto Fire. Tap LOOP to avoid danger.") : t("Arrow keys / WASD: move. Hold Space: fire. L: barrel roll. P: pause.")}</p><p>{t("Dodge bullets and defeat the boss. The small white dot is your aircraft's hitbox.")}</p><div className="sky-pickup-guide">{(["gun", "shield", "life", "loop"] as const).map(kind => <div key={kind}><SkyArtwork pickup={kind} /><span>{t({ gun: "Weapon Upgrade", shield: "Shield", life: "Extra Life", loop: "Barrel Roll Recharge" }[kind])}</span></div>)}</div><p>{t("You begin with three lives and three LOOP charges. A roll protects you briefly; a shield lasts five seconds.")}</p><button className="sky-primary" onClick={() => hud.phase === "menu" ? start() : setView("main")}>{t(hud.phase === "menu" ? "Start Game" : "Back")}</button></>
          : view === "scores" ? <><h2>{t("High Scores")}</h2>{scoreList}<button onClick={() => setView("main")}>{t("Back")}</button></>
          : hud.phase === "menu" ? <><div className="sky-brand"><SkyArtwork /><h2>SKY 1942</h2><span>{t("ACE SQUADRON")}</span></div><p>{t("Pilot your aircraft. Shoot down enemy planes. Dodge attacks and defeat the boss.")}</p><button className="sky-primary" onClick={start}>{t("Start Game")}</button><div className="sky-menu-links"><button onClick={() => setView("help")}>{t("How to Play")}</button><button onClick={() => setView("scores")}>{t("High Scores")}</button><button onClick={() => setView("settings")}>{t("Settings")}</button></div></>
          : hud.phase === "paused" ? <><h2>{t("PAUSED")}</h2><p>{t("Score")}: {hud.score.toLocaleString()} · {t("Stage {0}", hud.stage)}</p><button className="sky-primary" onClick={resume}>{t("Resume")}</button><button onClick={() => setConfirm("restart")}>{t("Restart")}</button><button onClick={() => setSettings(s => ({ ...s, muted: !s.muted }))}>{t(settings.muted ? "Sound Off" : "Sound On")}</button><button onClick={() => setView("help")}>{t("How to Play")}</button><button onClick={() => setConfirm("exit")}>{t("Exit Game")}</button></>
          : <><h2>{t("GAME OVER")}</h2>{newRecord && <p className="sky-record">★ {t("New Personal Best!")} ★</p>}<dl className="sky-results"><div><dt>{t("Final Score")}</dt><dd>{hud.score.toLocaleString()}</dd></div><div><dt>{t("Stage Reached")}</dt><dd>{hud.stage}</dd></div><div><dt>{t("Enemies Defeated")}</dt><dd>{hud.kills}</dd></div><div><dt>{t("Best Score")}</dt><dd>{best.toLocaleString()}</dd></div></dl>{qualifies(hud.score, entries) && !saved && <form onSubmit={event => { event.preventDefault(); save(); }}><label htmlFor="sky-name">{t("Name for local scores")}</label><input id="sky-name" maxLength={12} value={name} onChange={event => setName(event.target.value)} placeholder="AAA" /><button type="submit">{t("Save Score")}</button></form>}{saved && <p role="status">{t("Score saved")}</p>}{storageError && <p role="status">{t("Browser storage is unavailable. This score may not be saved.")}</p>}<button className="sky-primary" onClick={start}>{t("Play Again")}</button><button onClick={() => setView("scores")}>{t("View High Scores")}</button><button onClick={onExit}>{t("Return to Retro Arcade")}</button></>}
        </div>
      </div>}
    </div>
    <p className="sky-key-legend">{t("Arrow keys / WASD: move. Hold Space: fire. L: barrel roll. P: pause.")}</p>
  </GamePlayArea>;
}
