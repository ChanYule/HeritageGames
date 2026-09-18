import { useMemo, useState } from "react";
import type { GameDefinition, GameKey } from "./types";
import GameShell from "./components/GameShell";
import MarblesGame from "./games/MarblesGame";
import PickUpSticksGame from "./games/PickUpSticksGame";
import FiveStonesGame from "./games/FiveStonesGame";
import ChaptehGame from "./games/ChaptehGame";

const games: GameDefinition[] = [
  {
    key: "marbles",
    title: "Marbles",
    subtitle: "Aim, pull back and flick.",
    description:
      "Knock target marbles out of the ring with controlled shots, realistic momentum and friction.",
    difficulty: "Medium",
    players: "2 players · local",
    accent: "◎",
  },
  {
    key: "pick-up-sticks",
    title: "Pick-Up Sticks",
    subtitle: "Steady hands win.",
    description:
      "Remove sticks from a tangled pile without disturbing the others. Precision matters.",
    difficulty: "Medium",
    players: "2 players · local",
    accent: "╱",
  },
  {
    key: "five-stones",
    title: "Five Stones",
    subtitle: "Toss, collect and catch.",
    description:
      "Recreate the familiar hand-eye challenge by collecting the right stones before the toss falls.",
    difficulty: "Hard",
    players: "1 player",
    accent: "◆",
  },
  {
    key: "chapteh",
    title: "Chapteh",
    subtitle: "Keep the rally alive.",
    description:
      "Use alternating kicks to keep the chapteh airborne for as long as possible.",
    difficulty: "Easy to learn",
    players: "2 players · local",
    accent: "✦",
  },
];

function Home({ onPlay }: { onPlay: (key: GameKey) => void }) {
  return (
    <main className="home-page page-enter">
      <nav className="site-nav" aria-label="Main navigation">
        <a className="brand-mark" href="#top" aria-label="Singapore Heritage Games home">
          <span className="brand-symbol">SG</span>
          <span>
            <strong>Heritage Games</strong>
            <small>Void Deck Edition</small>
          </span>
        </a>
        <div className="nav-links">
          <a href="#games">Games</a>
          <a href="#how-it-works">How it works</a>
          <a href="#about">About</a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Play Singapore's childhood favourites</p>
          <h1>Heritage games, made for play today.</h1>
          <p className="hero-text">
            A hands-on digital collection inspired by games played in void decks, corridors,
            schoolyards and neighbourhood spaces. Play alone or pass the device to a friend.
          </p>
          <div className="hero-actions">
            <a href="#games" className="primary-link">
              Choose a game <span aria-hidden="true">↓</span>
            </a>
            <a href="#how-it-works" className="text-link">See how multiplayer works</a>
          </div>
          <div className="hero-stats" aria-label="Collection highlights">
            <div><strong>4</strong><span>Playable games</span></div>
            <div><strong>3</strong><span>Local multiplayer</span></div>
            <div><strong>0</strong><span>Accounts needed</span></div>
          </div>
        </div>

        <div className="hero-board" aria-hidden="true">
          <div className="hero-board-label">Neighbourhood play, on screen</div>
          <div className="tile tile-a"><span>◎</span><small>Marbles</small></div>
          <div className="tile tile-b"><span>╱</span><small>Sticks</small></div>
          <div className="tile tile-c"><span>◆</span><small>Five Stones</small></div>
          <div className="tile tile-d"><span>✦</span><small>Chapteh</small></div>
          <span className="edition-label">VOID DECK EDITION</span>
        </div>
      </section>

      <section className="heritage-note" aria-label="Collection principle">
        <span className="note-icon" aria-hidden="true">↗</span>
        <p>
          These browser versions focus on the feeling of physical play. Drag, flick, time and react
          instead of pressing simple answer buttons.
        </p>
      </section>

      <section id="games" className="games-section section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Choose your game</p>
            <h2>Start playing in seconds.</h2>
          </div>
          <p>Each game teaches the controls before play. Mouse, keyboard and touch are supported.</p>
        </div>

        <div className="game-grid">
          {games.map((game, index) => (
            <article className="game-card" key={game.key}>
              <div className={`game-art art-${index + 1}`}>
                <span className="game-number">0{index + 1}</span>
                <span className="game-art-symbol">{game.accent}</span>
                <span className="game-art-action">Play</span>
              </div>
              <div className="game-card-body">
                <div className="meta-row">
                  <span className="meta-chip">{game.difficulty}</span>
                  <span className={`meta-chip ${game.players.includes("2 players") ? "multiplayer-chip" : ""}`}>
                    {game.players}
                  </span>
                </div>
                <h3>{game.title}</h3>
                <p className="card-subtitle">{game.subtitle}</p>
                <p>{game.description}</p>
                <button className="primary-button card-play-button" onClick={() => onPlay(game.key)}>
                  <span>Play {game.title}</span>
                  <span className="button-arrow" aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="flow-section section-block">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Simple play flow</p>
            <h2>Know what to do next.</h2>
          </div>
          <p>The page keeps instructions, turn state and scoring visible while you play.</p>
        </div>
        <div className="flow-track">
          <article><span>01</span><strong>Choose</strong><p>Pick a game and difficulty.</p></article>
          <i aria-hidden="true">→</i>
          <article><span>02</span><strong>Learn</strong><p>Read the short numbered steps.</p></article>
          <i aria-hidden="true">→</i>
          <article><span>03</span><strong>Play</strong><p>Use direct touch, drag or keyboard controls.</p></article>
          <i aria-hidden="true">→</i>
          <article><span>04</span><strong>Pass</strong><p>For local multiplayer, hand over on turn change.</p></article>
        </div>
      </section>

      <section id="about" className="about-section section-block">
        <div>
          <p className="eyebrow">Design approach</p>
          <h2>Old-school play, modern interaction.</h2>
        </div>
        <div className="about-grid">
          <article>
            <span>01</span>
            <h3>Physical input</h3>
            <p>Drag, flick, tap and time your actions instead of using generic game buttons.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Immediate feedback</h3>
            <p>Scores, streaks and movement respond to what you do during each attempt.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Singapore context</h3>
            <p>The visuals reference neighbourhood play while keeping the games clear and usable.</p>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <div className="brand-mark footer-brand">
          <span className="brand-symbol">SG</span>
          <span><strong>Heritage Games</strong><small>Made for shared play</small></span>
        </div>
        <a href="#top" className="text-link">Back to top ↑</a>
      </footer>
    </main>
  );
}

export default function App() {
  const [currentGame, setCurrentGame] = useState<GameKey | null>(null);

  const game = useMemo(
    () => games.find((item) => item.key === currentGame) ?? null,
    [currentGame]
  );

  const openGame = (key: GameKey) => {
    setCurrentGame(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeGame = () => {
    setCurrentGame(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!currentGame || !game) {
    return <Home onPlay={openGame} />;
  }

  const gameNode = {
    marbles: <MarblesGame />,
    "pick-up-sticks": <PickUpSticksGame />,
    "five-stones": <FiveStonesGame />,
    chapteh: <ChaptehGame />,
  }[currentGame];

  return (
    <GameShell title={game.title} subtitle={game.subtitle} onBack={closeGame}>
      {gameNode}
    </GameShell>
  );
}
