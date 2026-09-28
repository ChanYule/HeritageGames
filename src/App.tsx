import { t, useLanguage } from "./i18n";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { GameKey } from "./types";
import { games } from "./gameCatalog";
import Home from "./components/Home";
import DisplaySettings from "./components/DisplaySettings";
import GameShell from "./components/GameShell";
import MarblesGame from "./games/MarblesGame";
import PickUpSticksGame from "./games/PickUpSticksGame";
import FiveStonesGame from "./games/FiveStonesGame";
import ChaptehGame from "./games/ChaptehGame";
import Competition from "./components/Competition";

function gameFromLocation(): GameKey | null {
  const key = new URLSearchParams(window.location.search).get("game");
  return games.some(game => game.key === key) ? key as GameKey : null;
}

export default function App() {
  const language = useLanguage();
  const [currentGame, setCurrentGame] = useState<GameKey | null>(() => gameFromLocation());
  const [competitionOpen, setCompetitionOpen] = useState(() => new URLSearchParams(window.location.search).get("mode") === "competition");

  useEffect(() => {
    const handleHistory = () => {
      setCurrentGame(gameFromLocation());
      setCompetitionOpen(new URLSearchParams(window.location.search).get("mode") === "competition");
    };
    window.addEventListener("popstate", handleHistory);
    return () => window.removeEventListener("popstate", handleHistory);
  }, []);

  useEffect(() => {
    document.title = competitionOpen
      ? t("Heritage Games Competition · Singapore Heritage Games")
      : currentGame
      ? t("{0} · Singapore Heritage Games", t(games.find((item) => item.key === currentGame)?.title ?? "Game"))
      : t("Singapore Heritage Games · Void Deck Edition");
  }, [competitionOpen, currentGame, language]);

  const game = useMemo(
    () => games.find((item) => item.key === currentGame) ?? null,
    [currentGame]
  );

  const openGame = (key: GameKey) => {
    const url = new URL(window.location.href);
    url.hash = "";
    url.searchParams.set("game", key);
    url.searchParams.delete("mode");
    window.history.pushState({ heritageGame: key }, "", url);
    setCompetitionOpen(false);
    setCurrentGame(key);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const closeGame = () => {
    if (window.history.state?.heritageGame) {
      window.history.back();
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete("game");
      window.history.replaceState({}, "", url);
      setCurrentGame(null);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const openCompetition = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("game");
    url.hash = "";
    url.searchParams.set("mode", "competition");
    window.history.pushState({ heritageCompetition: true }, "", url);
    setCurrentGame(null);
    setCompetitionOpen(true);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const closeCompetition = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("mode");
    window.history.pushState({}, "", url);
    setCompetitionOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  return (
    <>
    <DisplaySettings />
    <AnimatePresence mode="wait" initial={false}>
      {competitionOpen ? (
        <Competition key="competition" onExit={closeCompetition} />
      ) : !currentGame || !game ? (
        <Home key="home" onPlay={openGame} onCompetition={openCompetition} />
      ) : (
        <GameShell key={currentGame} title={game.title} subtitle={game.subtitle} onBack={closeGame}>
          {{
            marbles: <MarblesGame />,
            "pick-up-sticks": <PickUpSticksGame />,
            "five-stones": <FiveStonesGame />,
            chapteh: <ChaptehGame />,
          }[currentGame]}
        </GameShell>
      )}
    </AnimatePresence>
    </>
  );
}
