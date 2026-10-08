import { useEffect, useRef, useState, type PointerEvent } from "react";
import GamePlayArea from "../components/GamePlayArea";
import { t, useLanguage } from "../i18n";
import { readArcadeMute, writeArcadeMute } from "./arcadePreferences";
import { GalaxyEngine } from "./galaxyDefenders/engine";
import { GalaxyInput, type Action } from "./galaxyDefenders/input";
import { GalaxyAudio } from "./galaxyDefenders/audio";
import { renderGalaxy } from "./galaxyDefenders/rendering";
import { startGalaxyLoop } from "./galaxyDefenders/runtime";
import { MODES, modeLabel } from "./galaxyDefenders/config";
import { GalaxyArtwork, ShipIcon } from "./galaxyDefenders/GalaxyArtwork";
import { browserScores, readScores, readBest, readLatest, recordResult, qualifies, ScoreSubmission } from "./galaxyDefenders/scoring";
import type { Mode } from "./galaxyDefenders/types";
import "./galaxyDefenders/galaxyDefenders.css";

type View = "main" | "help" | "scores" | "difficulty" | "settings";
type Settings = { mode: Mode; autoFire: boolean; muted: boolean; reduced: boolean; control: "buttons" | "drag" };
function preferences(): Settings {
  const defaults: Settings = { mode: "beginner", autoFire: true, muted: readArcadeMute(), reduced: typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, control: "buttons" };
  try {
    const raw = JSON.parse(localStorage.getItem("galaxy_defenders_settings_v1") ?? "null");
    if (raw && typeof raw === "object") {
      const mode: Mode = raw.mode === "classic" ? "classic" : "beginner";
      return { ...defaults, mode, autoFire: typeof raw.autoFire === "boolean" ? raw.autoFire : MODES[mode].autoFire, reduced: defaults.reduced || raw.reduced === true, control: raw.control === "drag" ? "drag" : "buttons" };
    }
  } catch { /* Defaults work when storage is disabled. */ }
  return defaults;
}
export default function GalaxyDefendersGame({ onExit, onRegisterExit }: { onExit: () => void; onRegisterExit?: (request: (() => void) | null) => void }) {
  useLanguage();
  const [settings, setSettings] = useState(preferences);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const [store] = useState(browserScores), [submission] = useState(() => new ScoreSubmission());
  const [audio] = useState(() => new GalaxyAudio());
  const [engine] = useState(() => { const game = new GalaxyEngine(Math.random, sound => audio.effect(sound)); game.reset(settings.mode, "menu"); return game; });
  const [input] = useState(() => new GalaxyInput());
  const [hud, setHud] = useState(() => ({ phase: engine.phase, score: 0, wave: 1, lives: 3, destroyed: 0, mode: engine.mode, reason: engine.reason }));
  const [view, setView] = useState<View>("main"), [confirm, setConfirm] = useState<"restart" | "exit" | null>(null);
  const viewRef = useRef(view), confirmRef = useRef(confirm); viewRef.current = view; confirmRef.current = confirm;
  const [best, setBest] = useState(() => readBest(store, settings.mode));
  const [scoreMode, setScoreMode] = useState<Mode>(settings.mode);
  const [name, setName] = useState(""), [saved, setSaved] = useState(false), [storageError, setStorageError] = useState(false), [newRecord, setNewRecord] = useState(false);
  const recorded = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null), overlayRef = useRef<HTMLDivElement>(null);
  const [pressed, setPressed] = useState<Partial<Record<Action, boolean>>>({});
  const pointers = useRef(new Map<number, Action>());
  const syncHud = () => setHud({ phase: engine.phase, score: engine.score, wave: engine.wave, lives: engine.player.lives, destroyed: engine.destroyed, mode: engine.mode, reason: engine.reason });
  const clear = () => { input.clear(); pointers.current.clear(); setPressed({}); };
  const pause = () => { engine.pause(); clear(); audio.suspend(); syncHud(); };
  const resume = () => { clear(); setView("main"); setConfirm(null); void audio.unlock(); engine.resume(); syncHud(); };
  const start = () => {
    clear(); recorded.current = false; submission.reset(); setName(""); setSaved(false); setStorageError(false); setNewRecord(false); setConfirm(null); setView("main");
    engine.reset(settingsRef.current.mode); setBest(readBest(store, engine.mode)); setScoreMode(engine.mode); void audio.unlock(); syncHud();
    canvas.current?.closest(".game-play-area")?.scrollIntoView({ block: "start" });
  };
  const choose = (mode: Mode) => {
    if (engine.phase !== "menu") return;
    setSettings(s => ({ ...s, mode, autoFire: MODES[mode].autoFire })); engine.reset(mode, "menu"); setBest(readBest(store, mode)); setScoreMode(mode); syncHud();
  };
  useEffect(() => {
    audio.setMuted(settings.muted); writeArcadeMute(settings.muted);
    try { localStorage.setItem("galaxy_defenders_settings_v1", JSON.stringify(settings)); } catch { /* Session-only preferences. */ }
  }, [settings, audio]);
  useEffect(() => {
    const context = canvas.current?.getContext("2d"); if (!context) return;
    const unbind = input.bind(window, () => engine.phase === "playing",
      () => { if (viewRef.current !== "main" || confirmRef.current) return; if (engine.phase === "paused") resume(); else pause(); },
      () => { if (confirmRef.current) setConfirm(null); else if (viewRef.current !== "main") setView("main"); else pause(); }, pause);
    const hidden = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", hidden);
    const stop = startGalaxyLoop(engine, input, () => settingsRef.current.autoFire, () => renderGalaxy(context, engine, settingsRef.current.reduced), syncHud);
    return () => { stop(); unbind(); document.removeEventListener("visibilitychange", hidden); audio.dispose(); };
    // Stable engine/input/audio read current settings through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, input, audio]);
  useEffect(() => {
    onRegisterExit?.(() => { if (engine.phase === "menu" || engine.phase === "gameover") onExit(); else { pause(); setView("main"); setConfirm("exit"); } });
    return () => onRegisterExit?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterExit, onExit, engine]);
  useEffect(() => {
    if (hud.phase !== "gameover" || recorded.current) return;
    recorded.current = true; clear();
    const previous = readBest(store, engine.mode); setNewRecord(engine.score > previous); setBest(Math.max(previous, engine.score));
    setStorageError(!recordResult(store, { name: "AAA", score: engine.score, wave: engine.wave, mode: engine.mode }));
    if (engine.score > previous) audio.effect("record");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud.phase, engine, store, audio]);
  const overlay = hud.phase === "menu" || hud.phase === "paused" || hud.phase === "gameover";
  useEffect(() => { if (hud.phase === "transition") { input.clear(); pointers.current.clear(); setPressed({}); } }, [hud.phase, input]);
  useEffect(() => { if (overlay) overlayRef.current?.querySelector<HTMLElement>("button,input,select")?.focus({ preventScroll: true }); }, [overlay, view, confirm, hud.phase]);
  const held = () => setPressed(Object.fromEntries([...pointers.current.values()].map(action => [action, true])));
  const press = (event: PointerEvent<HTMLButtonElement>, action: Action) => {
    if (engine.phase !== "playing" || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, action); input.press(event.pointerId, action); held();
  };
  const release = (event: PointerEvent<HTMLButtonElement>) => { pointers.current.delete(event.pointerId); input.release(event.pointerId); held(); };
  const touchButton = (action: Action, label: string) => <button className={`galaxy-${action}${pressed[action] ? " is-held" : ""}`} disabled={hud.phase !== "playing"} aria-label={t(action === "fire" ? "Hold to fire" : action === "left" ? "Move left" : "Move right")}
    onPointerDown={event => press(event, action)} onPointerMove={() => input.sync()} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
    onKeyDown={event => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); input.key(action === "fire" ? "Space" : action === "left" ? "ArrowLeft" : "ArrowRight", true); } }}
    onKeyUp={event => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); input.key(action === "fire" ? "Space" : action === "left" ? "ArrowLeft" : "ArrowRight", false); } }}
    onBlur={() => { input.key(action === "fire" ? "Space" : action === "left" ? "ArrowLeft" : "ArrowRight", false); }}>{t(label)}</button>;
  const dragStart = (event: PointerEvent<HTMLCanvasElement>) => { if (settings.control === "drag" && engine.phase === "playing" && event.button === 0 && input.startDrag(event.pointerId, event.clientX, engine.player.x)) event.currentTarget.setPointerCapture(event.pointerId); };
  const dragMove = (event: PointerEvent<HTMLCanvasElement>) => { const width = event.currentTarget.getBoundingClientRect().width; if (width > 0) input.moveDrag(event.pointerId, event.clientX, 480 / width); };
  const save = () => {
    if (submission.save(store, { name: name.trim() || "AAA", score: hud.score, wave: hud.wave, mode: hud.mode })) { setSaved(true); setStorageError(Boolean(store.sessionOnly)); }
    else setStorageError(true);
  };
  const modePicker = <div className="galaxy-mode-picker">{(["beginner", "classic"] as const).map(mode => <button key={mode} aria-pressed={settings.mode === mode} onClick={() => choose(mode)}><strong>{t(modeLabel[mode])}</strong><small>{t(mode === "beginner" ? "Recommended · slower attacks and Auto Fire" : "Faster attacks · manual fire by default")}</small></button>)}</div>;
  const leaderboard = () => {
    const entries = readScores(store, scoreMode), latest = readLatest(store, scoreMode);
    return <><h2>{t("Galaxy Defenders High Scores")}</h2><div className="galaxy-mode-tabs">{(["beginner", "classic"] as const).map(mode => <button key={mode} aria-pressed={scoreMode === mode} onClick={() => setScoreMode(mode)}>{t(modeLabel[mode])}</button>)}</div><p>{t("Top Five Local Scores")}</p>{entries.length ? <ol className="galaxy-scores">{entries.map((entry, i) => <li key={i}><strong>{entry.name}</strong><span>{entry.score.toLocaleString()} · {t("Wave {0}", entry.wave)}</span></li>)}</ol> : <p>{t("No scores yet. Be the first ace!")}</p>}<p>{t("Personal Best")}: {readBest(store, scoreMode).toLocaleString()}</p>{latest && <p>{t("Latest Score")}: {latest.score.toLocaleString()} · {t("Wave {0}", latest.wave)}</p>}<small>{t("Scores are saved on this browser only.")}</small><button onClick={() => setView("main")}>{t("Back")}</button></>;
  };
  return <GamePlayArea className="galaxy-play-area">
    <div className="galaxy-hud" aria-label={t("Game status")}><div><span>{t("SCORE")}</span><strong>{hud.score.toLocaleString()}</strong></div><div><span>{t("WAVE")}</span><strong>{hud.wave}</strong></div><div><span>{t("HI")}</span><strong>{Math.max(best, hud.score).toLocaleString()}</strong></div></div>
    <div className="galaxy-status"><span className="galaxy-lives" aria-label={t("{0} lives remaining", hud.lives)}>{Array.from({ length: hud.lives }, (_, i) => <ShipIcon key={i} />)}<span>{t("Lives")}: {hud.lives}</span></span><span>{t(modeLabel[hud.mode])}</span></div>
    <div className="galaxy-toolbar"><button onClick={() => hud.phase === "paused" ? resume() : pause()} disabled={hud.phase === "menu" || hud.phase === "gameover"}>{t(hud.phase === "paused" ? "Resume" : "Pause")}</button><button aria-pressed={settings.autoFire} onClick={() => setSettings(s => ({ ...s, autoFire: !s.autoFire }))}>{t(settings.autoFire ? "Auto Fire On" : "Auto Fire Off")}</button><button onClick={() => { pause(); setView("settings"); }}>{t("Settings")}</button></div>
    <div className="galaxy-cabinet">
      <div className="galaxy-screen"><canvas ref={canvas} width="480" height="720" className={settings.control === "drag" ? "galaxy-drag" : ""} aria-label={t("Galaxy Defenders playfield. Move with Left/Right or A/D and hold Space to fire.")} onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={event => input.release(event.pointerId)} onPointerCancel={event => input.release(event.pointerId)} onLostPointerCapture={event => input.release(event.pointerId)} />{hud.phase === "transition" && <div className="galaxy-wave-notice" role="status">{t("WAVE COMPLETE +100")}</div>}</div>
      <div className="galaxy-controls"><div className="galaxy-directions">{touchButton("left", "LEFT")}{touchButton("right", "RIGHT")}</div>{touchButton("fire", "FIRE")}</div>
      {overlay && <div className="galaxy-overlay" ref={overlayRef} role="dialog" aria-modal="true" aria-label={t(confirm ? "Confirm action" : view === "help" ? "How to Play" : view === "scores" ? "High Scores" : view === "settings" ? "Settings" : view === "difficulty" ? "Choose Difficulty" : hud.phase === "paused" ? "PAUSED" : hud.phase === "gameover" ? "GAME OVER" : "Galaxy Defenders")}
        onKeyDown={event => { if (event.key !== "Tab") return; const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled),input,select")), first = buttons[0], last = buttons[buttons.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }}>
        <div className="galaxy-menu">
          {confirm ? <><h2>{t("Confirm action")}</h2><p>{t(confirm === "restart" ? "Restart the defence? Your current score will be lost." : "Leave the defence? Your current score will be lost.")}</p><button className="galaxy-primary" onClick={() => confirm === "restart" ? start() : onExit()}>{t(confirm === "restart" ? "Restart" : "Exit Game")}</button><button onClick={() => setConfirm(null)}>{t("Cancel")}</button></>
          : view === "help" ? <><h2>{t("How to Play")}</h2><div className="galaxy-instructions"><p><strong>{t("MOVE")}</strong>{t("Move left and right to avoid enemy attacks.")}</p><p><strong>{t("SHOOT")}</strong>{t("Fire your lasers to destroy aliens.")}</p><p><strong>{t("SURVIVE")}</strong>{t("Stop the aliens before they reach the dashed defence line. Reaching the line ends the game.")}</p><p><strong>{t("SCORE")}</strong>{t("Red: 30 · Green: 20 · Purple: 10 · Clear a wave: +100")}</p></div><p>{typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches ? t("Hold LEFT or RIGHT while holding FIRE. Auto Fire can shoot for you.") : t("Left/Right or A/D: move. Hold Space: fire. P: pause.")}</p><p>{t("You have three lives. After a hit, the cyan outline protects you briefly.")}</p><button className="galaxy-primary" onClick={() => hud.phase === "menu" ? start() : setView("main")}>{t(hud.phase === "menu" ? "Start Game" : "Back")}</button></>
          : view === "scores" ? leaderboard()
          : view === "difficulty" ? <><h2>{t("Choose Difficulty")}</h2>{modePicker}<p>{t("Beginner and Classic scores are ranked separately.")}</p><button className="galaxy-primary" onClick={start}>{t("Start Game")}</button><button onClick={() => setView("main")}>{t("Back")}</button></>
          : view === "settings" ? <><h2>{t("Settings")}</h2><label><input type="checkbox" checked={settings.autoFire} onChange={event => setSettings(s => ({ ...s, autoFire: event.target.checked }))} />{t("Auto Fire")}</label><label><input type="checkbox" checked={settings.muted} onChange={event => setSettings(s => ({ ...s, muted: event.target.checked }))} />{t("Mute sound")}</label><label><input type="checkbox" checked={settings.reduced} onChange={event => setSettings(s => ({ ...s, reduced: event.target.checked }))} />{t("Reduced motion")}</label><label>{t("Touch movement")}<select value={settings.control} onChange={event => { clear(); setSettings(s => ({ ...s, control: event.target.value === "drag" ? "drag" : "buttons" })); }}><option value="buttons">{t("Left / Right buttons")}</option><option value="drag">{t("Drag to move")}</option></select></label><p>{t("Drag horizontally anywhere in the playfield. The ship follows without jumping to your finger.")}</p><button onClick={() => setView("main")}>{t("Back")}</button></>
          : hud.phase === "menu" ? <><GalaxyArtwork /><h2>{t("Galaxy Defenders")}</h2><p>{t("Protect Earth from the alien invasion.")}</p><span>{t(modeLabel[settings.mode])} · {t(settings.autoFire ? "Auto Fire On" : "Auto Fire Off")}</span><button className="galaxy-primary" onClick={start}>{t("Start Game")}</button><button onClick={() => setView("difficulty")}>{t("Choose Difficulty")}</button><div className="galaxy-menu-links"><button onClick={() => setView("help")}>{t("How to Play")}</button><button onClick={() => setView("scores")}>{t("High Scores")}</button><button onClick={() => setView("settings")}>{t("Settings")}</button></div></>
          : hud.phase === "paused" ? <><h2>{t("PAUSED")}</h2><p>{t("Score")}: {hud.score.toLocaleString()} · {t("Wave {0}", hud.wave)}</p><button className="galaxy-primary" onClick={resume}>{t("Resume")}</button><button onClick={() => setConfirm("restart")}>{t("Restart")}</button><button onClick={() => setSettings(s => ({ ...s, muted: !s.muted }))}>{t(settings.muted ? "Sound Off" : "Sound On")}</button><button onClick={() => setView("help")}>{t("How to Play")}</button><button onClick={() => setConfirm("exit")}>{t("Exit Game")}</button></>
          : <><h2>{t("GAME OVER")}</h2><p>{t(hud.reason === "invasion" ? "The aliens reached the defence line." : "Your last ship was lost.")}</p><p>{t(modeLabel[hud.mode])}</p>{newRecord && <strong className="galaxy-record">★ {t("NEW HIGH SCORE")} ★</strong>}<dl className="galaxy-results"><div><dt>{t("Final Score")}</dt><dd>{hud.score.toLocaleString()}</dd></div><div><dt>{t("Wave Reached")}</dt><dd>{hud.wave}</dd></div><div><dt>{t("Aliens Destroyed")}</dt><dd>{hud.destroyed}</dd></div><div><dt>{t("Best Score")}</dt><dd>{best.toLocaleString()}</dd></div></dl>{!saved && qualifies(hud.score, readScores(store, hud.mode)) && <form onSubmit={event => { event.preventDefault(); save(); }}><label htmlFor="galaxy-name">{t("Name for local scores")}</label><input id="galaxy-name" value={name} maxLength={12} onChange={event => setName(event.target.value)} placeholder="AAA" /><button type="submit">{t("Save Score")}</button></form>}{saved && <p role="status">{t("Score saved")}</p>}{storageError && <p role="status">{t("Browser storage is unavailable. This score may not be saved.")}</p>}<button className="galaxy-primary" onClick={start}>{t("Play Again")}</button><button onClick={() => { setScoreMode(hud.mode); setView("scores"); }}>{t("View Leaderboard")}</button><button onClick={() => { engine.reset(settings.mode, "menu"); setView("difficulty"); syncHud(); }}>{t("Choose Difficulty")}</button><button onClick={onExit}>{t("Return to Retro Arcade")}</button></>}
        </div>
      </div>}
    </div>
    <p className="galaxy-key-legend">{t("Left/Right or A/D: move. Hold Space: fire. P: pause.")}</p>
  </GamePlayArea>;
}
