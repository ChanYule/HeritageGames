import { t, useLanguage } from "./i18n";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { GameKey, HeritageGameKey } from "./types";
import { allGames as games, gameFromSearch, isHeritageGame, isArcadeGame } from "./gameCatalog";
import Home from "./components/Home";
import DisplaySettings from "./components/DisplaySettings";
import GameShell from "./components/GameShell";
import MarblesGame from "./games/MarblesGame";
import PickUpSticksGame from "./games/PickUpSticksGame";
import ArcadeTargetGame from "./games/ArcadeTargetGame";
import Competition from "./components/Competition";
const Sky1942Game = lazy(() => import("./games/Sky1942Game"));
const GalaxyDefendersGame = lazy(() => import("./games/GalaxyDefendersGame"));

function gameFromLocation(): GameKey | null {
  return gameFromSearch(window.location.search);
}

export default function App() {
  const language = useLanguage();
  const arcadeExitRef = useRef<(() => void) | null>(null);
  const registerArcadeExit = useCallback((request: (() => void) | null) => { arcadeExitRef.current = request; }, []);
  const [currentGame, setCurrentGame] = useState<GameKey | null>(() => gameFromLocation());
  const [competitionOpen, setCompetitionOpen] = useState(() => ["challenge", "competition"].includes(new URLSearchParams(window.location.search).get("mode") ?? ""));
  const [startInSetup, setStartInSetup] = useState(false);
  const [soloPlayerName, setSoloPlayerName] = useState<string | null>(() => new URLSearchParams(window.location.search).get("mode") === "solo" ? window.history.state?.soloPlayerName ?? t("Player 1") : null);

  useEffect(() => {
    const handleHistory = () => {
      setStartInSetup(Boolean(window.history.state?.setup));
      setCurrentGame(gameFromLocation());
      setCompetitionOpen(["challenge", "competition"].includes(new URLSearchParams(window.location.search).get("mode") ?? ""));
      setSoloPlayerName(new URLSearchParams(window.location.search).get("mode") === "solo" ? window.history.state?.soloPlayerName ?? t("Player 1") : null);
    };
    window.addEventListener("popstate", handleHistory);
    return () => window.removeEventListener("popstate", handleHistory);
  }, []);

  useEffect(() => {
    document.title = competitionOpen
      ? t("Heritage Games Challenge · Singapore Heritage Games")
      : currentGame
      ? t("{0} · Singapore Heritage Games", t(games.find((item) => item.key === currentGame)?.title ?? "Game"))
      : t("Singapore Heritage Games · Void Deck Edition");
  }, [competitionOpen, currentGame, language]);

  const game = useMemo(
    () => games.find((item) => item.key === currentGame) ?? null,
    [currentGame]
  );

  const openGame = (key: GameKey) => {
    if (isArcadeGame(key)) { const homeUrl = new URL(window.location.href); homeUrl.hash = "retro-arcade"; window.history.replaceState(window.history.state, "", homeUrl); }
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
      if (isArcadeGame(currentGame)) url.hash = "retro-arcade";
      window.history.replaceState({}, "", url);
      setCurrentGame(null);
      setSoloPlayerName(null);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const openCompetition = (selectedGame?: HeritageGameKey) => {
    setStartInSetup(Boolean(selectedGame));
    const url = new URL(window.location.href);
    url.searchParams.delete("game");
    if (selectedGame) url.searchParams.set("game", selectedGame);
    url.hash = "";
    url.searchParams.set("mode", "challenge");
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


  return (
    <>
    <DisplaySettings />
    <AnimatePresence mode="wait" initial={false}>
      {competitionOpen ? (
        <Competition key="competition" onExit={closeCompetition} initialGame={isHeritageGame(currentGame) ? currentGame : undefined} startInSetup={startInSetup} />
      ) : !currentGame || !game ? (
        <Home key="home" onPlay={openGame} onCompetition={openCompetition} />
      ) : (
        <GameShell key={`${currentGame}-${soloPlayerName ?? "group"}`} title={game.title} subtitle={soloPlayerName ? t("Solo practice for {0}", soloPlayerName) : game.subtitle} onBack={() => { if (isArcadeGame(currentGame) && arcadeExitRef.current) arcadeExitRef.current(); else closeGame(); }} backLabel={isArcadeGame(currentGame) ? t("Retro Arcade") : t("All games")}>
          {soloPlayerName && <p className="solo-practice-note">{t("Play both sides yourself. The colours help you see which side is active.")}</p>}
          {{
            marbles: <MarblesGame playerNames={soloPlayerName ? [t("{0} · Blue", soloPlayerName), t("{0} · Red", soloPlayerName)] : undefined} />,
            "pick-up-sticks": <PickUpSticksGame playerNames={soloPlayerName ? [t("{0} · Blue", soloPlayerName), t("{0} · Red", soloPlayerName)] : undefined} />,
            carom: <ArcadeTargetGame kind="carom" playerNames={soloPlayerName ? [t("{0} · Blue", soloPlayerName), t("{0} · Red", soloPlayerName)] : undefined} />,
            "sky-1942": <Suspense fallback={<p role="status">{t("Loading arcade game…")}</p>}><Sky1942Game onExit={closeGame} onRegisterExit={registerArcadeExit} /></Suspense>,
            "galaxy-defenders": <Suspense fallback={<p role="status">{t("Loading arcade game…")}</p>}><GalaxyDefendersGame onExit={closeGame} onRegisterExit={registerArcadeExit} /></Suspense>,
            "tin-can-knockdown": <ArcadeTargetGame kind="tin-can-knockdown" playerNames={soloPlayerName ? [t("{0} · Blue", soloPlayerName), t("{0} · Red", soloPlayerName)] : undefined} />,
          }[currentGame]}
        </GameShell>
      )}
    </AnimatePresence>
    </>
  );
}
