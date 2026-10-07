import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Circle,
  CircleDot,
  Trophy,
  Users,
  Gem,
  Layers,
  Target,
} from "lucide-react";
import { t, useLanguage } from "../i18n";
import GameShell from "./GameShell";
import { ChallengeFullscreenContext } from "./GamePlayArea";
import LanguageSwitcher from "./LanguageSwitcher";
import MarblesGame from "../games/MarblesGame";
import PickUpSticksGame from "../games/PickUpSticksGame";
import ArcadeTargetGame from "../games/ArcadeTargetGame";
import {
  advanceChallenge,
  challengeDuration,
  challengeGames,
  championTieRule,
  challengeSeed,
  challengeStorageKey,
  createChallenge,
  currentTurn,
  gameTitle,
  legacyCompetitionStorageKey,
  overallScores,
  pauseChallenge,
  playerColours,
  readyChallenge,
  recordChallengeResult,
  restartChallenge,
  restoreChallenge,
  startChallenge,
  validPlayerNames,
  type Challenge,
  type ChallengePlayer,
  type ChallengeType,
} from "../competition";
import type { GameKey, GameResult } from "../types";
import "../challenge.css";

function loadChallenge() {
  try {
    const stored = localStorage.getItem(challengeStorageKey);
    if (!stored)
      return {
        session: null,
        unavailable: false,
        invalid: false,
        legacy: Boolean(localStorage.getItem(legacyCompetitionStorageKey)),
      };
    try {
      const session = restoreChallenge(JSON.parse(stored));
      return { session, unavailable: false, invalid: !session, legacy: false };
    } catch {
      return {
        session: null,
        unavailable: false,
        invalid: true,
        legacy: false,
      };
    }
  } catch {
    return { session: null, unavailable: true, invalid: false, legacy: false };
  }
}
const GameIcon = ({ game }: { game: GameKey }) =>
  game === "marbles" ? (
    <Gem aria-hidden="true" />
  ) : game === "pick-up-sticks" ? (
    <Layers aria-hidden="true" />
  ) : game === "carom" ? (
    <CircleDot aria-hidden="true" />
  ) : (
    <Target aria-hidden="true" />
  );
function Identity({ player }: { player: ChallengePlayer }) {
  return (
    <span
      className="challenge-identity"
      style={{ "--identity-colour": player.colour } as CSSProperties}
    >
      <span aria-hidden="true" />
      {player.name}
    </span>
  );
}
function Progress({ session }: { session: Challenge }) {
  return (
    <nav className="challenge-progress" aria-label={t("Challenge Progress")}>
      <strong>
        {t(
          "Game {0} of {1}",
          session.currentGameIndex + 1,
          session.games.length,
        )}
      </strong>
      <ol>
        {session.games.map((game, i) => (
          <li
            key={game}
            className={
              session.rounds[i].placements.length
                ? "is-complete"
                : i === session.currentGameIndex
                  ? "is-current"
                  : ""
            }
            aria-current={i === session.currentGameIndex ? "step" : undefined}
          >
            {session.rounds[i].placements.length ? (
              <Check aria-label={t("Completed")} />
            ) : i === session.currentGameIndex ? (
              <CircleDot aria-label={t("Current")} />
            ) : (
              <Circle aria-label={t("Upcoming")} />
            )}
            <span>{t(gameTitle(game))}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
function Overall({ session }: { session: Challenge }) {
  return (
    <ol className="challenge-score-list">
      {overallScores(session).map((row) => (
        <li key={row.id}>
          <b>{row.rank}</b>
          <Identity player={row} />
          <strong>{t("{0} pts", row.points)}</strong>
        </li>
      ))}
    </ol>
  );
}
const attemptHint = (game: GameKey) =>
  ({
    marbles:
      "Six shots to knock marbles out. The same layout and level for everyone.",
    "pick-up-sticks":
      "Lift top sticks for 45 seconds. A blocked lift ends your attempt.",
    carom:
      "Pocket your own coins to play again. Cover the queen. Striker pocketed: foul.",
    "tin-can-knockdown":
      "Six throws to topple the stack. Wait for the tins to settle after each throw.",
  })[game];

export default function Competition({
  onExit,
  initialGame,
  startInSetup = false,
}: {
  onExit: () => void;
  initialGame?: GameKey;
  startInSetup?: boolean;
}) {
  useLanguage();
  const [loaded] = useState(loadChallenge);
  const [session, setSession] = useState<Challenge | null>(loaded.session);
  const [screen, setScreen] = useState<
    "resume" | "choose" | "players" | "event"
  >(loaded.session && !startInSetup ? "resume" : "choose");
  const [type, setType] = useState<ChallengeType>("quick");
  const [selectedGames, setGames] = useState<GameKey[]>(
    initialGame
      ? [initialGame, challengeGames.find((g) => g !== initialGame)!]
      : ["marbles", "tin-can-knockdown"],
  );
  const [names, setNames] = useState(["", ""]);
  const [difficulty, setDifficulty] = useState<Challenge["difficulty"]>("easy");
  const [unavailable, setUnavailable] = useState(loaded.unavailable);
  const [editing, setEditing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const cleanNames = names.map(
    (name, i) => name.trim() || t("Player {0}", i + 1),
  );
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [
    screen,
    session?.status,
    session?.currentGameIndex,
    session?.rounds[session.currentGameIndex]?.attempts.length,
  ]);
  useEffect(() => {
    if (!session || editing) return;
    try {
      localStorage.setItem(challengeStorageKey, JSON.stringify(session));
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    }
  }, [session, editing]);
  const notice = unavailable ? (
    <p role="status" className="challenge-notice">
      {t("Saving is unavailable. Keep this page open to keep your Challenge.")}
    </p>
  ) : null;
  const newChallenge = () => {
    setSession(null);
    setScreen("choose");
    setEditing(false);
    setNames(["", ""]);
    setType("quick");
    setGames(["marbles", "tin-can-knockdown"]);
    setDifficulty("easy");
    try {
      localStorage.removeItem(challengeStorageKey);
    } catch {
      setUnavailable(true);
    }
  };
  const review = () => {
    if (!validPlayerNames(cleanNames)) return;
    setSession(
      createChallenge(
        type,
        cleanNames,
        type === "full" ? challengeGames : selectedGames,
        difficulty,
      ),
    );
    setEditing(false);
    setScreen("event");
  };
  const edit = (next: "choose" | "players") => {
    if (!session) return;
    setType(session.type);
    setGames([...session.games]);
    setNames(session.players.map((p) => p.name));
    setDifficulty(session.difficulty);
    setEditing(true);
    setScreen(next);
  };
  const title = (
    <header className="challenge-header">
      <button className="back-button" onClick={onExit}>
        <ChevronLeft aria-hidden="true" />
        {t("Home")}
      </button>
      <h1 ref={heading} tabIndex={-1}>
        {t("Heritage Games Challenge")}
      </h1>
      <LanguageSwitcher />
    </header>
  );
  if (screen === "resume" && session)
    return (
      <main className="challenge-page">
        {title}
        {notice}
        <section className="challenge-card challenge-centred">
          <Trophy size={42} aria-hidden="true" />
          <h2>
            {t(
              session.status === "final_results"
                ? "Challenge Complete"
                : "Your Challenge is saved",
            )}
          </h2>
          <p>
            {t(
              "{0} players · {1} games",
              session.players.length,
              session.games.length,
            )}
          </p>
          <Progress session={session} />
          <p>
            {t(
              "Completed scores are kept. An unfinished attempt restarts only after Ready.",
            )}
          </p>
          <button className="primary-button" onClick={() => setScreen("event")}>
            {t(
              session.status === "final_results"
                ? "View Challenge Results"
                : "Continue Challenge",
            )}
          </button>
          <button className="secondary-button" onClick={newChallenge}>
            {t("Start New Challenge")}
          </button>
        </section>
      </main>
    );
  if (screen === "choose")
    return (
      <main className="challenge-page">
        {title}
        {notice}
        {loaded.invalid && (
          <p className="challenge-notice">
            {t("The saved Challenge could not be opened. Start a new one.")}
          </p>
        )}
        {loaded.legacy && (
          <p className="challenge-notice">
            {t(
              "The previous league save is kept separately. Start a new Challenge with the new rules.",
            )}
          </p>
        )}
        <section className="challenge-card">
          <p className="eyebrow">{t("Step {0} of 3", 1)}</p>
          <h2>{t("Choose Your Challenge")}</h2>
          <div className="challenge-mode-cards">
            {(["quick", "full"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                className={type === mode ? "is-selected" : ""}
                aria-pressed={type === mode}
                onClick={() => {
                  setType(mode);
                  if (mode === "quick" && selectedGames.length !== 2)
                    setGames(["marbles", "tin-can-knockdown"]);
                }}
              >
                <Trophy aria-hidden="true" />
                <strong>
                  {t(mode === "quick" ? "Quick Challenge" : "Full Challenge")}
                </strong>
                <b>{t(mode === "quick" ? "2 Games" : "All 4 Games")}</b>
                <span>{t(challengeDuration(mode))}</span>
                <p>
                  {t(
                    mode === "quick"
                      ? "Recommended for a short, friendly session."
                      : "Enjoy every Heritage Game together.",
                  )}
                </p>
              </button>
            ))}
          </div>
          {type === "quick" && (
            <fieldset className="challenge-game-picker">
              <legend>{t("Choose exactly 2 games")}</legend>
              {challengeGames.map((game) => (
                <button
                  type="button"
                  key={game}
                  aria-pressed={selectedGames.includes(game)}
                  className={selectedGames.includes(game) ? "is-selected" : ""}
                  onClick={() =>
                    setGames((current) =>
                      current.includes(game)
                        ? current.filter((g) => g !== game)
                        : current.length < 2
                          ? [...current, game]
                          : current,
                    )
                  }
                >
                  <GameIcon game={game} />
                  {t(gameTitle(game))}
                  {selectedGames.includes(game) && <Check aria-hidden="true" />}
                </button>
              ))}
              <p role="status">
                {t("{0} of 2 selected", selectedGames.length)}
              </p>
            </fieldset>
          )}
          <button
            className="primary-button"
            disabled={type === "quick" && selectedGames.length !== 2}
            onClick={() => setScreen("players")}
          >
            {t("Next: Add Players")}
            <ArrowRight aria-hidden="true" />
          </button>
        </section>
      </main>
    );
  if (screen === "players")
    return (
      <main className="challenge-page">
        {title}
        {notice}
        <form
          className="challenge-card"
          onSubmit={(event) => {
            event.preventDefault();
            review();
          }}
        >
          <p className="eyebrow">{t("Step {0} of 3", 2)}</p>
          <h2>{t("Who's Playing?")}</h2>
          <fieldset className="challenge-player-count">
            <legend>{t("Number of players")}</legend>
            {[2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={names.length === count}
                className={names.length === count ? "is-selected" : ""}
                onClick={() =>
                  setNames((current) =>
                    Array.from({ length: count }, (_, i) => current[i] ?? ""),
                  )
                }
              >
                <Users aria-hidden="true" />
                {t("{0} players", count)}
              </button>
            ))}
          </fieldset>
          <div className="challenge-player-grid">
            {names.map((name, i) => (
              <label
                className="challenge-name-card"
                key={i}
                style={
                  { "--identity-colour": playerColours[i] } as CSSProperties
                }
              >
                <span>{t("Player {0}", i + 1)}</span>
                <input
                  value={name}
                  maxLength={24}
                  autoComplete="off"
                  placeholder={t("Player {0}", i + 1)}
                  onChange={(event) =>
                    setNames((current) =>
                      current.map((n, j) => (j === i ? event.target.value : n)),
                    )
                  }
                />
              </label>
            ))}
          </div>
          {!validPlayerNames(cleanNames) && (
            <p role="alert">
              {t(
                "Use different names or add initials so everyone knows whose turn it is.",
              )}
            </p>
          )}
          <fieldset className="challenge-player-count">
            <legend>{t("Marbles and Sticks level · same for everyone")}</legend>
            {(["easy", "medium", "difficult"] as const).map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={difficulty === level}
                className={difficulty === level ? "is-selected" : ""}
                onClick={() => setDifficulty(level)}
              >
                {t(
                  level === "easy"
                    ? "Easy"
                    : level === "medium"
                      ? "Medium"
                      : "Difficult",
                )}
              </button>
            ))}
          </fieldset>
          <div className="challenge-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={!validPlayerNames(cleanNames)}
            >
              {t("Review Challenge Lobby")}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setScreen("choose")}
            >
              {t("Edit Games")}
            </button>
          </div>
        </form>
      </main>
    );
  if (!session) return null;
  const round = session.rounds[session.currentGameIndex],
    turn = currentTurn(session),
    ranking = overallScores(session),
    champions = ranking.filter((row) => row.rank === 1);
  const overall = (
    <details className="challenge-overall">
      <summary>{t("Overall Scores")}</summary>
      <Overall session={session} />
    </details>
  );
  const progress = <Progress session={session} />;
  const finish = (result: GameResult) => {
    if (!turn) return;
    const id = turn.id;
    setSession((current) =>
      current ? recordChallengeResult(current, result, id) : current,
    );
  };
  if (session.status === "playing" && turn) {
    const first = session.players[turn.players[0]],
      second = session.players[turn.players[1] ?? turn.players[0]];
    const labels: [string, string] = [first.name, second.name],
      colours: [string, string] = [first.colour, second.colour];
    const individual =
      turn.players.length === 1
        ? { seed: challengeSeed(session), shots: 6 }
        : undefined;
    const props = {
      playerNames: labels,
      playerColours: colours,
      competitionMode: true,
      onComplete: finish,
      individualAttempt: individual,
      fixedDifficulty: session.difficulty,
    };
    const fullProgress = (
      <details className="challenge-fullscreen-progress">
        <summary>
          {t(
            "Game {0} of {1}",
            session.currentGameIndex + 1,
            session.games.length,
          )}
        </summary>
        <div>
          <strong>{t("Heritage Games Challenge")}</strong>
          {progress}
          <Identity player={first} />
          {turn.players.length === 2 && <Identity player={second} />}
          <Overall session={session} />
        </div>
      </details>
    );
    return (
      <ChallengeFullscreenContext.Provider value={fullProgress}>
        <div
          className={`challenge-game ${individual ? "challenge-individual" : ""}`}
          style={
            {
              "--challenge-first": first.colour,
              "--challenge-second": second.colour,
            } as CSSProperties
          }
        >
          <GameShell
            title={t(gameTitle(round.game))}
            subtitle={
              individual
                ? t("{0}'s Turn", first.name)
                : t("{0} vs {1}", first.name, second.name)
            }
            onBack={() =>
              setSession((current) =>
                current ? pauseChallenge(current) : current,
              )
            }
            backLabel={t("Challenge Lobby")}
          >
            {notice}
            {progress}
            {overall}
            {round.game === "marbles" ? (
              <MarblesGame {...props} />
            ) : round.game === "pick-up-sticks" ? (
              <PickUpSticksGame {...props} />
            ) : (
              <ArcadeTargetGame
                {...props}
                kind={round.game}
                carromChallenge={round.game === "carom"}
              />
            )}
          </GameShell>
        </div>
      </ChallengeFullscreenContext.Provider>
    );
  }
  if (session.status === "lobby")
    return (
      <main className="challenge-page">
        {title}
        {notice}
        <section className="challenge-card">
          <p className="eyebrow">{t("Step {0} of 3", 3)}</p>
          <h2>{t("Challenge Lobby")}</h2>
          <p>
            {t(session.type === "quick" ? "Quick Challenge" : "Full Challenge")}{" "}
            ·{" "}
            {t(
              "{0} players · {1} games",
              session.players.length,
              session.games.length,
            )}
          </p>
          <p>{t(challengeDuration(session.type))}</p>
          <div className="challenge-player-grid">
            {session.players.map((player) => (
              <div className="challenge-person-card" key={player.id}>
                <Identity player={player} />
              </div>
            ))}
          </div>
          <h3>{t("Game order")}</h3>
          <ol className="challenge-game-order">
            {session.games.map((game) => (
              <li key={game}>
                <GameIcon game={game} />
                {t(gameTitle(game))}
              </li>
            ))}
          </ol>
          <p>
            {t(
              "Scores become placement points after each game. Different game scores are never added together.",
            )}
          </p>
          <button
            className="primary-button"
            onClick={() => setSession(startChallenge(session))}
          >
            {t("Start Challenge")}
          </button>
          <div className="challenge-actions">
            <button
              className="secondary-button"
              onClick={() => edit("players")}
            >
              {t("Edit Players")}
            </button>
            <button className="secondary-button" onClick={() => edit("choose")}>
              {t("Edit Games")}
            </button>
          </div>
        </section>
      </main>
    );
  if (session.status === "player_handover" && turn) {
    const previous = round.attempts[round.attempts.length - 1];
    return (
      <main className="challenge-page">
        {title}
        {notice}
        {progress}
        <section className="challenge-card challenge-centred">
          {previous && turn.players.length === 1 && (
            <>
              <h2>
                {t(
                  "Great job, {0}!",
                  session.players[previous.players[0]].name,
                )}
              </h2>
              <p>{t("Raw Score")}</p>
              <strong className="challenge-big-score">
                {previous.scores[0]}
              </strong>
            </>
          )}
          <p className="eyebrow">
            {t(gameTitle(round.game))} ·{" "}
            {t(turn.label, round.attempts.length + 1)}
          </p>
          <h2>
            {turn.players.length === 1
              ? t("{0}'s Turn", session.players[turn.players[0]].name)
              : t(
                  "{0} vs {1}",
                  ...turn.players.map((p) => session.players[p].name),
                )}
          </h2>
          {turn.players.length === 1 && (
            <p>
              {t(
                "Player {0} of {1}",
                round.attempts.length + 1,
                session.players.length,
              )}
            </p>
          )}
          <div className="challenge-player-grid">
            {turn.players.map((p) => (
              <div className="challenge-person-card" key={p}>
                <Identity player={session.players[p]} />
              </div>
            ))}
          </div>
          <p>{t(attemptHint(round.game))}</p>
          {round.replays > 0 && round.attempts.length < 2 && (
            <p>{t("Drawn semi-final: play again to decide who advances.")}</p>
          )}
          <p>
            {turn.players.length === 1
              ? t(
                  "Pass the device to {0}.",
                  session.players[turn.players[0]].name,
                )
              : t("Both players: get comfortable before starting.")}
          </p>
          <button
            className="primary-button"
            onClick={() => setSession(readyChallenge(session))}
          >
            {t("Ready")}
            <ArrowRight aria-hidden="true" />
          </button>
        </section>
        {overall}
      </main>
    );
  }
  if (session.status === "round_results")
    return (
      <main className="challenge-page">
        {title}
        {notice}
        {progress}
        <section className="challenge-card">
          <p className="eyebrow">{t("Game Complete")}</p>
          <h2>{t("{0} Results", t(gameTitle(round.game)))}</h2>
          <ol className="challenge-results">
            {round.placements.map((result) => (
              <li key={result.player}>
                <strong className="challenge-place">
                  {t("Place {0}", result.rank)}
                </strong>
                <Identity player={session.players[result.player]} />
                <span>
                  {t("Raw Score")}: <b>{result.rawScore}</b>
                </span>
                <strong>{t("+{0} Challenge Points", result.points)}</strong>
              </li>
            ))}
          </ol>
          <p className="challenge-tie-note">
            {t(
              "Equal game results share a place and its points. The next place is skipped.",
            )}
          </p>
          <h3>{t("Overall Scores")}</h3>
          <Overall session={session} />
          <button
            className="primary-button"
            onClick={() => setSession(advanceChallenge(session))}
          >
            {t(
              session.currentGameIndex === session.games.length - 1
                ? "View Final Results"
                : "Start Next Game",
            )}
            {session.currentGameIndex < session.games.length - 1 &&
              ` · ${t(gameTitle(session.games[session.currentGameIndex + 1]))}`}
            <ArrowRight aria-hidden="true" />
          </button>
        </section>
      </main>
    );
  return (
    <main className="challenge-page">
      {title}
      {notice}
      <section className="challenge-card challenge-centred challenge-champion">
        <Trophy size={56} aria-hidden="true" />
        <p className="eyebrow">{t("Challenge Complete")}</p>
        <h2>
          {t(
            champions.length > 1
              ? "Shared Heritage Games Champions"
              : "Heritage Games Champion",
          )}
        </h2>
        {champions.map((player) => (
          <div className="challenge-winner" key={player.id}>
            <Identity player={player} />
            <strong>{t("{0} Challenge Points", player.points)}</strong>
          </div>
        ))}
        <p>{t("Well played, everyone. Thank you for sharing the games!")}</p>
        {championTieRule(session) && (
          <p className="challenge-tie-note">{t(championTieRule(session)!)}</p>
        )}
        <h3>{t("Final Results")}</h3>
        <Overall session={session} />
        <div className="challenge-actions">
          <button
            className="primary-button"
            onClick={() => setSession(restartChallenge(session))}
          >
            {t("Play Again")}
          </button>
          <button className="secondary-button" onClick={newChallenge}>
            {t("New Challenge")}
          </button>
          <button className="secondary-button" onClick={onExit}>
            {t("Return Home")}
          </button>
        </div>
        <p className="challenge-tie-note">
          {t(
            "Ties: game wins, then second places, then normalised performance. Still equal? Share the place.",
          )}
        </p>
        <p>
          {t(
            "Normalised performance compares each score only within its own game. Carrom uses placement because opponents differ.",
          )}
        </p>
        <div className="challenge-final-games">
          {session.players.map((player, p) => (
            <details
              key={player.id}
              open={champions.some((champion) => champion.player === p)}
            >
              <summary>
                <Identity player={player} />
                {t("Game results")}
              </summary>
              <ol>
                {session.rounds.map((r) => (
                  <li key={r.game}>
                    <GameIcon game={r.game} />
                    {t(gameTitle(r.game))}
                    <strong>
                      {t(
                        "Place {0}",
                        r.placements.find((result) => result.player === p)
                          ?.rank ?? 0,
                      )}
                    </strong>
                  </li>
                ))}
              </ol>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
