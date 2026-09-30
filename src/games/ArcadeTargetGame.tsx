import { useEffect, useRef, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import { t, useLanguage } from "../i18n";
import GamePlayArea from "../components/GamePlayArea";
import PlayerScoreboard from "../components/PlayerScoreboard";
import type { CompetitionGameProps } from "../types";
import { CANS, CAROM_COINS, POCKETS, canThrow, caromShot, type ArcadeKind, type Pocket, type Power } from "./arcadeRules";
import "./arcade.css";

type Props = CompetitionGameProps & { kind: ArcadeKind };
type Notice = { key: string; count?: number; next?: 0 | 1 };
const ALL_CANS = CANS.map(can => can.id);
const ALL_COINS = CAROM_COINS.map(coin => coin.id);
const POCKET_LABELS: Record<Pocket, string> = { "top-left": "Top left", "top-right": "Top right", "bottom-left": "Bottom left", "bottom-right": "Bottom right" };

export default function ArcadeTargetGame({ kind, playerNames, competitionMode = false, onComplete }: Props) {
  useLanguage();
  const carom = kind === "carom";
  const labels = playerNames ?? [t("Player 1"), t("Player 2")];
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [shot, setShot] = useState(0);
  const [ready, setReady] = useState(false);
  const [standing, setStanding] = useState<number[]>(carom ? ALL_COINS : ALL_CANS);
  const [coin, setCoin] = useState<number | null>(null);
  const [pocket, setPocket] = useState<Pocket | null>(null);
  const [lane, setLane] = useState<number | null>(null);
  const [power, setPower] = useState<Power>("steady");
  const [message, setMessage] = useState<Notice>(() => ({ key: carom ? "Choose a coin, a pocket and your strength." : "Choose an aiming lane and your strength." }));
  const [moving, setMoving] = useState(false);
  const [lastHit, setLastHit] = useState<number[]>([]);
  const timer = useRef<number | null>(null);
  const resolvingRef = useRef(false);
  const reported = useRef(false);
  const active = (shot % 2) as 0 | 1;
  const finished = shot >= 12;
  const canPlay = ready && !moving && !finished;
  const choiceReady = carom ? coin !== null && pocket !== null : lane !== null;

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!finished || !onComplete || reported.current) return;
    reported.current = true;
    onComplete({ scores });
  }, [finished, onComplete, scores]);

  const restart = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    resolvingRef.current = false;
    reported.current = false;
    setScores([0, 0]); setShot(0); setReady(false); setStanding(carom ? ALL_COINS : ALL_CANS);
    setCoin(null); setPocket(null); setLane(null); setPower("steady"); setMoving(false); setLastHit([]);
    setMessage({ key: carom ? "Choose a coin, a pocket and your strength." : "Choose an aiming lane and your strength." });
  };

  const play = () => {
    if (!canPlay || !choiceReady || resolvingRef.current) return;
    resolvingRef.current = true;
    const hit = carom ? (coin !== null && pocket && caromShot(coin, pocket, power) ? [coin] : []) : canThrow(standing, lane!, power);
    setMoving(true);
    setLastHit(hit);
    timer.current = window.setTimeout(() => {
      const nextStanding = standing.filter(id => !hit.includes(id));
      setStanding(nextStanding.length ? nextStanding : carom ? ALL_COINS : ALL_CANS);
      setScores(current => current.map((value, index) => index === active ? value + hit.length * 100 : value) as [number, number]);
      setMessage(hit.length
        ? { key: carom ? "Great shot! Coin pocketed. Pass to {0}." : "Great shot! {0} cans down. Pass to {1}.", count: carom ? undefined : hit.length, next: (1 - active) as 0 | 1 }
        : { key: carom ? "Try a nearer pocket and matching strength next time. Pass to {0}." : "Try another aiming lane next time. Pass to {0}.", next: (1 - active) as 0 | 1 });
      setShot(current => current + 1);
      resolvingRef.current = false;
      setReady(false); setMoving(false); setCoin(null); setPocket(null); setLane(null); setLastHit([]);
    }, 850);
  };

  const winner = scores[0] === scores[1] ? t("It's a draw!") : t("{0} wins!", labels[scores[0] > scores[1] ? 0 : 1]);
  const notice = message.next === undefined ? t(message.key) : message.count === undefined
    ? t(message.key, labels[message.next]) : t(message.key, message.count, labels[message.next]);
  return <div className="arcade-layout">
    <div className="arcade-intro">
      <p className="eyebrow">{t(carom ? "CAROM" : "TIN CAN KNOCKDOWN")}</p>
      <h2>{t(carom ? "Pocket the coins" : "Topple the cans")}</h2>
      <p>{t(carom ? "Tap a coin, choose a nearby corner pocket and match strength to distance." : "Choose one of five aiming lanes, then set the strength. Strong throws reach more cans.")}</p>
      <p className="arcade-rules">{t("Each player gets six shots. Every coin or can scores 100 points. Take turns on one device.")}</p>
    </div>
    <GamePlayArea className="arcade-play-area">
      <PlayerScoreboard activePlayer={active} scores={scores} labels={labels} gameOver={finished} />
      <div className="arcade-status" role="status" aria-live="polite">
        <strong>{finished ? winner : ready ? t("{0}'s shot {1} of 6", labels[active], Math.floor(shot / 2) + 1) : t("Pass the device to {0}", labels[active])}</strong>
        <span>{finished ? t("All twelve shots are complete.") : ready || shot > 0 ? notice : t("Take your time. Press Ready when you have the device.")}</span>
        <small className="fullscreen-score-summary">{labels[0]}: {scores[0]} · {labels[1]}: {scores[1]}</small>
      </div>
      {!finished && !ready ? <button type="button" className="primary-button arcade-ready" onClick={() => { setReady(true); setMessage({ key: carom ? "Choose a coin and a corner pocket." : "Choose one of the five aiming lanes." }); }}>{t("{0} is ready", labels[active])}</button> : null}
      {carom ? <div className="carom-board" role="group" aria-label={t("Carom board with coins and four corner pockets")}>
        <div className="carom-inner" aria-hidden="true" />
        {coin !== null && pocket && <svg className="carom-aim-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1={CAROM_COINS.find(item => item.id === coin)?.x} y1={CAROM_COINS.find(item => item.id === coin)?.y} x2={POCKETS[pocket].x} y2={POCKETS[pocket].y} /></svg>}
        {CAROM_COINS.filter(item => standing.includes(item.id)).map(item => <button key={item.id} type="button" disabled={!canPlay} aria-pressed={coin === item.id} aria-label={t("Coin {0}", item.id)} className={`carom-coin ${coin === item.id ? "selected" : ""} ${lastHit.includes(item.id) ? "is-hit" : ""}`} style={{ left: `${lastHit.includes(item.id) && pocket ? POCKETS[pocket].x : item.x}%`, top: `${lastHit.includes(item.id) && pocket ? POCKETS[pocket].y : item.y}%` }} onClick={() => setCoin(item.id)}>{item.id}</button>)}
        {(Object.keys(POCKETS) as Pocket[]).map(key => <button key={key} type="button" disabled={!canPlay} aria-pressed={pocket === key} aria-label={t("{0} pocket", t(POCKET_LABELS[key]))} className={`carom-pocket ${key} ${pocket === key ? "selected" : ""}`} onClick={() => setPocket(key)}><span className="sr-only">{t(POCKET_LABELS[key])}</span></button>)}
        <div className={`carom-striker ${moving ? "is-moving" : ""}`} style={moving && coin !== null ? { left: `${CAROM_COINS.find(item => item.id === coin)?.x ?? 50}%`, top: `${CAROM_COINS.find(item => item.id === coin)?.y ?? 50}%` } : undefined} aria-hidden="true" />
      </div> : <div className="can-scene" role="group" aria-label={t("Tin can stack and five aiming lanes")}>
        {moving && lane !== null && <div className="can-throw-ball" style={{ left: `${(lane + 0.5) * 20}%` }} aria-hidden="true" />}
        <div className="can-shelf">
          {[...CANS].reverse().filter(item => standing.includes(item.id)).map(item => <div key={item.id} role="img" className={`tin-can can-${item.id} ${lastHit.includes(item.id) ? "is-hit" : ""}`} aria-label={t("Can {0}", item.id)}><span aria-hidden="true">{item.id}</span></div>)}
        </div>
        <div className="can-throw-lanes" role="group" aria-label={t("Choose aiming lane")}>{[0, 1, 2, 3, 4].map(index => <button type="button" key={index} disabled={!canPlay} aria-pressed={lane === index} className={lane === index ? "selected" : ""} onClick={() => setLane(index)}>{index + 1}</button>)}</div>
      </div>}
      {!finished && ready ? <div className="arcade-controls">
        {carom && <p>{coin ? t("Coin {0} selected", coin) : t("Tap a coin on the board.")} {pocket ? t("{0} pocket selected", t(POCKET_LABELS[pocket])) : t("Then choose a corner pocket.")}</p>}
        <fieldset disabled={moving}><legend>{t("Strength")}</legend><div className="arcade-power">{(["gentle", "steady", "strong"] as Power[]).map(value => <button key={value} type="button" className={power === value ? "selected" : ""} aria-pressed={power === value} onClick={() => setPower(value)}>{t(value === "gentle" ? "Gentle" : value === "steady" ? "Steady" : "Strong")}</button>)}</div></fieldset>
        <button type="button" className="primary-button arcade-shoot" disabled={!canPlay || !choiceReady} onClick={play}>{moving ? t("Taking shot…") : t(carom ? "Strike coin" : "Throw ball")}</button>
      </div> : null}
      {finished && !competitionMode && <button type="button" className="primary-button arcade-ready" onClick={restart}><RotateCcw size={20} />{t("Play again")}</button>}
      <p className="arcade-help"><Sparkles size={17} /> {t(carom ? "Keyboard: Tab to a coin and pocket, then press Enter. Choose strength and strike." : "Keyboard: Tab to an aiming lane, then press Enter. Choose strength and throw.")}</p>
    </GamePlayArea>
  </div>;
}
