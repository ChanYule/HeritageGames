import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Check, Heart, Trophy, Users2 } from "lucide-react";
import { games } from "../gameCatalog";
import { t, useLanguage } from "../i18n";
import type { GameKey } from "../types";
import LanguageSwitcher from "./LanguageSwitcher";
import { competitionStorageKey, restoreCompetition } from "../competition";

function GameArtwork({ game }: { game: GameKey }) {
  return <svg viewBox="0 0 360 200" aria-hidden="true" focusable="false">
    {game === "marbles" && <>
      <ellipse cx="181" cy="103" rx="107" ry="70" fill="#e9dcc3" stroke="#a27f52" strokeWidth="3" strokeDasharray="5 6" />
      {[[144,76,20,"#497d81"],[207,82,18,"#bd624b"],[179,122,21,"#d3aa4e"],[126,143,15,"#709067"],[257,154,25,"#3f718b"]].map(([x,y,r,color],i)=><g key={i}><circle cx={x} cy={Number(y)+4} r={r} fill="#69573c" opacity=".12"/><circle cx={x} cy={y} r={r} fill={String(color)}/><path d={`M ${Number(x)-Number(r)*.5} ${Number(y)+Number(r)*.5} Q ${Number(x)+Number(r)*.6} ${Number(y)} ${Number(x)-Number(r)*.1} ${Number(y)-Number(r)*.7}`} stroke="#fff7d8" strokeWidth="5" fill="none" opacity=".7"/><circle cx={Number(x)-Number(r)*.3} cy={Number(y)-Number(r)*.4} r="4" fill="white" opacity=".65"/></g>)}
    </>}
    {game === "pick-up-sticks" && <g strokeLinecap="round">
      {[[83,47,267,152,"#4e7c73"],[90,148,261,60,"#b85442"],[152,32,196,166,"#c49937"],[109,51,242,164,"#455f89"],[91,106,282,92,"#996143"],[232,32,146,174,"#b85442"]].map(([x1,y1,x2,y2,color],i)=><g key={i}><line x1={x1} y1={Number(y1)+3} x2={x2} y2={Number(y2)+3} stroke="#423626" strokeWidth="9" opacity=".12"/><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={String(color)} strokeWidth="7"/><line x1={Number(x1)*.85+Number(x2)*.15} y1={Number(y1)*.85+Number(y2)*.15} x2={Number(x1)*.15+Number(x2)*.85} y2={Number(y1)*.15+Number(y2)*.85} stroke="#f7e6c2" strokeWidth="7"/></g>)}
    </g>}
    {game === "carom" && <><rect x="77" y="20" width="206" height="164" rx="16" fill="#9a6136"/><rect x="93" y="35" width="174" height="134" rx="7" fill="#e9ca8e"/>{[[103,44],[257,44],[103,160],[257,160]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="12" fill="#26352f"/>)}{[[145,82],[180,77],[215,82],[160,116],[200,116],[180,145]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="11" fill={i%2 ? "#ba5b43" : "#faf0d4"} stroke="#754d37" strokeWidth="2"/>)}</>}
    {game === "tin-can-knockdown" && <><path d="M65 171h230" stroke="#855b3c" strokeWidth="14" strokeLinecap="round"/>{[[130,112],[180,112],[230,112],[155,62],[205,62],[180,12]].map(([x,y],i)=><g key={i}><rect x={x} y={y} width="45" height="55" rx="8" fill="#77a8ae" stroke="#3b6a73" strokeWidth="3"/><ellipse cx={Number(x)+22} cy={y} rx="21" ry="5" fill="#dce7dc"/><circle cx={Number(x)+22} cy={Number(y)+29} r="10" fill="#f7e8b4"/></g>)}</>}
  </svg>;
}

export default function Home({ onPlay, onCompetition }: { onPlay: (key: GameKey) => void; onCompetition: (game?: GameKey) => void }) {
  useLanguage();
  const heading = useRef<HTMLHeadingElement>(null);
  const [savedCompetition] = useState(() => {
    try { return restoreCompetition(JSON.parse(localStorage.getItem(competitionStorageKey) ?? "null")); }
    catch { return null; }
  });
  const competitionLabel = savedCompetition ? savedCompetition.status === "complete" ? t("View competition results") : t("Continue competition") : t("Choose 1–4 players");
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  return <main className="heritage-home" id="main-content">
    <a className="skip-link" href="#games">{t("Skip to games")}</a>
    <header className="heritage-nav">
      <a className="heritage-brand" href="#main-content"><span aria-hidden="true">HG</span><strong>{t("Heritage Games")}<small>{t("Made for good company")}</small></strong></a>
      <LanguageSwitcher />
    </header>
    <section className="welcome-hero" aria-labelledby="welcome-title">
      <div className="welcome-copy">
        <p className="welcome-eyebrow"><Heart size={17} aria-hidden="true" />{t("A little play. A lot of memories.")}</p>
        <h1 id="welcome-title" tabIndex={-1} ref={heading}>{t("Good old games.")}<br/><em>{t("Good times together.")}</em></h1>
        <p>{t("Remember playing downstairs with friends? Pull up a chair and enjoy four childhood favourites, together on one screen.")}</p>
        <div className="welcome-actions"><button className="heritage-primary" onClick={() => onCompetition()}><Trophy size={23}/>{competitionLabel}<ArrowRight size={22}/></button><a className="heritage-secondary" href="#games">{t("Practise a game")}<ArrowDown size={20}/></a></div>
        {savedCompetition && <p className="saved-competition-note">{t("{0} · {1} of {2} matches complete", savedCompetition.name, savedCompetition.matches.filter(match=>match.status === "complete").length, savedCompetition.matches.length)}</p>}
        <div className="welcome-reassurance"><Check size={18}/>{t("No sign-up. Just choose a game and play.")}</div>
      </div>
      <aside className="together-card" aria-label={t("A friendly competition")}>
        <div className="together-art"><GameArtwork game="tin-can-knockdown"/><span className="together-seal"><Users2 size={22}/>{t("1–4 players")}</span></div>
        <div className="together-copy"><span className="welcome-eyebrow">{t("ONE DEVICE. EVERYONE INCLUDED.")}</span><h2>{t("A friendly little competition")}</h2><p>{t("Add your names. Take turns. Cheer each other on. We keep the scores for you.")}</p><span className="together-note"><Check size={18}/>{t("Time to get ready before every turn")}</span></div>
      </aside>
    </section>
    <section className="play-together-guide" aria-labelledby="together-title"><div><p className="welcome-eyebrow">{t("LET'S PLAY TOGETHER")}</p><h2 id="together-title">{t("Three small steps. Plenty of fun.")}</h2></div><ol>
      <li><span>1</span><div><h3>{t("Add your names")}</h3><p>{t("Choose 1 to 4 players. Names are optional — you can start straight away.")}</p></div></li>
      <li><span>2</span><div><h3>{t("Get comfortable")}</h3><p>{t("Read the instructions and press Ready when you are settled.")}</p></div></li>
      <li><span>3</span><div><h3>{t("Play and cheer")}</h3><p>{t("Follow the player names on screen. Scores are saved after each match.")}</p></div></li>
    </ol><button className="heritage-primary" onClick={() => onCompetition()}><Trophy size={21}/>{savedCompetition ? competitionLabel : t("Choose 1–4 players")}<ArrowRight size={20}/></button></section>
    <section id="games" className="practice-section" aria-labelledby="practice-title">
      <div className="practice-heading"><div><p className="welcome-eyebrow">{t("YOUR CHILDHOOD FAVOURITES")}</p><h2 id="practice-title">{t("Which shall we play?")}</h2></div><p>{t("Choose a game, then choose 1 to 4 players.")}</p></div>
      <div className="heritage-game-grid">{games.map((game, index)=><article key={game.key} className={`heritage-game-card heritage-art-${game.key}`}>
        <div className="heritage-card-art"><GameArtwork game={game.key}/><span className="heritage-card-number">0{index+1}</span></div>
        <div className="heritage-card-content"><p className="heritage-card-players"><Users2 size={17}/>{t("1–4 players")}</p><h3>{t(game.title)}</h3><p>{t(game.description)}</p><div className="heritage-card-footer"><span>{t(game.control)}</span><button onClick={()=>onCompetition(game.key)} aria-label={t("Choose players for {0}", t(game.title))}>{t("Choose players")}<ArrowRight size={20}/></button></div><button className="four-practice-link" onClick={() => onPlay(game.key)} aria-label={t("Practise {0}", t(game.title))}>{t("Practise first")} · {t(game.players)}</button></div>
      </article>)}</div>
    </section>
    <footer className="heritage-footer"><strong>{t("Heritage Games")}</strong><span>{t("Made for memories. Played together.")}</span><a href="#main-content">{t("Back to top ↑")}</a></footer>
  </main>;
}
