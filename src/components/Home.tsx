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
    {game === "five-stones" && <>
      {[[118,132,-16,"#b85a49"],[185,143,14,"#d0a341"],[247,125,-8,"#68856d"],[205,85,28,"#547b8d"],[153,47,-24,"#ad6b4f"]].map(([x,y,angle,color],i)=><g key={i} transform={`translate(${x} ${y}) rotate(${angle})`}><path d="M-25 16L-12-24Q0-31 15-18L31 17Q7 35-25 16Z" fill="#56412b" opacity=".12" transform="translate(0 5)"/><path d="M-25 16L-12-24Q0-31 15-18L31 17Q7 35-25 16Z" fill={String(color)}/><path d="M-20 14L-10-19M-7-23L24 15M-20 18Q5 30 27 18" fill="none" stroke="#fff1d8" strokeWidth="1.5" strokeDasharray="3 3" opacity=".8"/></g>)}
    </>}
    {game === "chapteh" && <g transform="translate(55 -16) rotate(15 130 115)">
      <ellipse cx="136" cy="191" rx="49" ry="8" fill="#243f37" opacity=".15" />
      <path d="M137 164C100 138 66 80 73 46C111 49 133 114 137 164Z" fill="#c57954" />
      <path d="M137 164C110 98 111 40 132 23C157 54 155 122 137 164Z" fill="#faf0cc" stroke="#ddcca2" />
      <path d="M137 164C150 101 181 51 211 50C216 95 175 147 137 164Z" fill="#d6ad4d" />
      <path d="M137 164L79 57M137 164L133 35M137 164L203 58" stroke="#5c7558" strokeWidth="2" opacity=".6" />
      <rect x="119" y="153" width="36" height="19" rx="5" fill="#a94f3c" />
      <ellipse cx="137" cy="176" rx="27" ry="12" fill="#b65d41" />
      <ellipse cx="137" cy="170" rx="27" ry="10" fill="#e9b368" />
    </g>}
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
        <div className="together-art"><GameArtwork game="chapteh"/><span className="together-seal"><Users2 size={22}/>{t("1–4 players")}</span></div>
        <div className="together-copy"><span className="welcome-eyebrow">{t("ONE DEVICE. EVERYONE INCLUDED.")}</span><h2>{t("A friendly little competition")}</h2><p>{t("Add your names. Take turns. Cheer each other on. We keep the scores for you.")}</p><span className="together-note"><Check size={18}/>{t("Time to get ready before every turn")}</span></div>
      </aside>
    </section>
    <section id="games" className="practice-section" aria-labelledby="practice-title">
      <div className="practice-heading"><div><p className="welcome-eyebrow">{t("YOUR CHILDHOOD FAVOURITES")}</p><h2 id="practice-title">{t("Which shall we play?")}</h2></div><p>{t("Choose a game, then choose 1 to 4 players.")}</p></div>
      <div className="heritage-game-grid">{games.map((game, index)=><article key={game.key} className={`heritage-game-card heritage-art-${game.key}`}>
        <div className="heritage-card-art"><GameArtwork game={game.key}/><span className="heritage-card-number">0{index+1}</span></div>
        <div className="heritage-card-content"><p className="heritage-card-players"><Users2 size={17}/>{t("1–4 players")}</p><h3>{t(game.title)}</h3><p>{t(game.description)}</p><div className="heritage-card-footer"><span>{t(game.control)}</span><button onClick={()=>onCompetition(game.key)} aria-label={t("Choose players for {0}", t(game.title))}>{t("Choose players")}<ArrowRight size={20}/></button></div><button className="four-practice-link" onClick={() => onPlay(game.key)} aria-label={t("Practise {0}", t(game.title))}>{t("Practise first")} · {t(game.players)}</button></div>
      </article>)}</div>
    </section>
    <section className="play-together-guide" aria-labelledby="together-title"><div><p className="welcome-eyebrow">{t("LET'S PLAY TOGETHER")}</p><h2 id="together-title">{t("Three small steps. Plenty of fun.")}</h2></div><ol>
      <li><span>1</span><div><h3>{t("Add your names")}</h3><p>{t("Choose 1 to 4 players. Names are optional — you can start straight away.")}</p></div></li>
      <li><span>2</span><div><h3>{t("Get comfortable")}</h3><p>{t("Read the instructions and press Ready when you are settled.")}</p></div></li>
      <li><span>3</span><div><h3>{t("Play and cheer")}</h3><p>{t("Follow the player names on screen. Scores are saved after each match.")}</p></div></li>
    </ol><button className="heritage-primary" onClick={() => onCompetition()}><Trophy size={21}/>{savedCompetition ? competitionLabel : t("Choose 1–4 players")}<ArrowRight size={20}/></button></section>
    <footer className="heritage-footer"><strong>{t("Heritage Games")}</strong><span>{t("Made for memories. Played together.")}</span><a href="#main-content">{t("Back to top ↑")}</a></footer>
  </main>;
}
