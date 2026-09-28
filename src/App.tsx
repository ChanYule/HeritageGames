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
  const [startInSetup, setStartInSetup] = useState(false);
  const [soloPlayerName, setSoloPlayerName] = useState<string | null>(() => new URLSearchParams(window.location.search).get("mode") === "solo" ? window.history.state?.soloPlayerName ?? t("Player 1") : null);

  useEffect(() => {
    const handleHistory = () => {
      setStartInSetup(Boolean(window.history.state?.setup));
      setCurrentGame(gameFromLocation());
      setCompetitionOpen(new URLSearchParams(window.location.search).get("mode") === "competition");
      setSoloPlayerName(new URLSearchParams(window.location.search).get("mode") === "solo" ? window.history.state?.soloPlayerName ?? t("Player 1") : null);
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
    setSoloPlayerName(null);
    setCurrentGame(key);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const closeGame = () => {
    if (window.history.state?.heritageGame) {
      window.history.back();
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete("game");
      url.searchParams.delete("mode");
      window.history.replaceState({}, "", url);
      setCurrentGame(null);
      setSoloPlayerName(null);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const openCompetition = (selectedGame?: GameKey) => {
    setStartInSetup(Boolean(selectedGame));
    const url = new URL(window.location.href);
    url.searchParams.delete("game");
    if (selectedGame) url.searchParams.set("game", selectedGame);
    url.hash = "";
    url.searchParams.set("mode", "competition");
    window.history.pushState({ heritageCompetition: true, setup: Boolean(selectedGame) }, "", url);
    setCurrentGame(selectedGame ?? null);
    setSoloPlayerName(null);
    setCompetitionOpen(true);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const closeCompetition = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("mode");
    url.searchParams.delete("game");
    window.history.pushState({}, "", url);
    setCompetitionOpen(false);
    setCurrentGame(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const openSoloPractice = (key: GameKey, name: string) => {
    window.history.replaceState({ ...window.history.state, setup: true }, "", window.location.href);
    const url = new URL(window.location.href);
    url.searchParams.set("game", key);
    url.searchParams.set("mode", "solo");
    window.history.pushState({ heritageGame: key, soloPlayerName: name }, "", url);
    setCompetitionOpen(false);
    setCurrentGame(key);
    setSoloPlayerName(name);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  return (
    <>
    <DisplaySettings />
    <AnimatePresence mode="wait" initial={false}>
      {competitionOpen ? (
        <Competition key="competition" onExit={closeCompetition} onSoloPlay={openSoloPractice} initialGame={currentGame ?? undefined} startInSetup={startInSetup} />
      ) : !currentGame || !game ? (
        <Home key="home" onPlay={openGame} onCompetition={openCompetition} />
      ) : (
        <GameShell key={`${currentGame}-${soloPlayerName ?? "group"}`} title={game.title} subtitle={soloPlayerName ? t("Solo practice for {0}", soloPlayerName) : game.subtitle} onBack={closeGame}>
          {soloPlayerName && <p className="solo-practice-note">{currentGame === "five-stones" ? t("Take your time with the pickup plan and try to improve your score.") : t("Play both sides yourself. The colours help you see which side is active.")}</p>}
          {{
            marbles: <MarblesGame playerNames={soloPlayerName ? [t("{0} · Blue", soloPlayerName), t("{0} · Red", soloPlayerName)] : undefined} />,
            "pick-up-sticks": <PickUpSticksGame playerNames={soloPlayerName ? [t("{0} · Blue", soloPlayerName), t("{0} · Red", soloPlayerName)] : undefined} />,
            "five-stones": <FiveStonesGame playerName={soloPlayerName ?? undefined} />,
            chapteh: <ChaptehGame playerNames={soloPlayerName ? [t("{0} · Left", soloPlayerName), t("{0} · Right", soloPlayerName)] : undefined} />,
          }[currentGame]}
        </GameShell>
      )}
    </AnimatePresence>
    </>
  );
}
