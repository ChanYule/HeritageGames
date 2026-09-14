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
    players: "1 player",
    accent: "◎",
  },
  {
    key: "pick-up-sticks",
    title: "Pick-Up Sticks",
    subtitle: "Steady hands win.",
    description:
      "Remove sticks from a tangled pile without disturbing the others. Precision matters.",
    difficulty: "Medium",
    players: "1 player",
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
    players: "1 player",
    accent: "✦",
  },
];

function Home({ onPlay }: { onPlay: (key: GameKey) => void }) {
  return (
    <main className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Play Singapore's childhood favourites</p>
          <h1>Heritage games, rebuilt for the browser.</h1>
          <p className="hero-text">
            A digital collection inspired by familiar games played in void decks, corridors,
            schoolyards and neighbourhood spaces.
          </p>
          <a href="#games" className="primary-link">
            Explore the games
          </a>
        </div>
        <div className="hero-board" aria-hidden="true">
          <div className="tile tile-a">◎</div>
          <div className="tile tile-b">╱</div>
          <div className="tile tile-c">◆</div>
          <div className="tile tile-d">✦</div>
          <span>VOID DECK EDITION</span>
        </div>
      </section>

      <section className="heritage-note">
        <p>
          These browser versions focus on the feeling of physical play. Drag, flick, time and
          react instead of pressing simple answer buttons.
        </p>
      </section>

      <section id="games" className="games-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Choose a game</p>
            <h2>Four ways to play</h2>
          </div>
          <p>Works with mouse, keyboard and touch controls.</p>
        </div>

        <div className="game-grid">
          {games.map((game, index) => (
            <article className="game-card" key={game.key}>
              <div className={`game-art art-${index + 1}`}>
                <span>{game.accent}</span>
              </div>
              <div className="game-card-body">
                <div className="meta-row">
                  <span>{game.difficulty}</span>
                  <span>{game.players}</span>
                </div>
                <h3>{game.title}</h3>
                <p className="card-subtitle">{game.subtitle}</p>
                <p>{game.description}</p>
                <button className="primary-button" onClick={() => onPlay(game.key)}>
                  Play {game.title}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section">
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
            <p>The visuals reference neighbourhood play without turning the site into a tourism page.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [currentGame, setCurrentGame] = useState<GameKey | null>(null);

  const game = useMemo(
    () => games.find((item) => item.key === currentGame) ?? null,
    [currentGame]
  );

  if (!currentGame || !game) {
    return <Home onPlay={setCurrentGame} />;
  }

  const gameNode = {
    marbles: <MarblesGame />,
    "pick-up-sticks": <PickUpSticksGame />,
    "five-stones": <FiveStonesGame />,
    chapteh: <ChaptehGame />,
  }[currentGame];

  return (
    <GameShell title={game.title} subtitle={game.subtitle} onBack={() => setCurrentGame(null)}>
      {gameNode}
    </GameShell>
  );
}
