import { t, useLanguage } from "../i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, Medal, RotateCcw, Trophy, Users2 } from "lucide-react";
import GameShell from "./GameShell";
import LanguageSwitcher from "./LanguageSwitcher";
import MarblesGame from "../games/MarblesGame";
import PickUpSticksGame from "../games/PickUpSticksGame";
import FiveStonesGame from "../games/FiveStonesGame";
import ChaptehGame from "../games/ChaptehGame";
import {
  competitionStandings,
  competitionStorageKey,
  createCompetition,
  gameTitle,
  recordMatchResult,
  restoreCompetition,
  validCompetitorNames,
  validScores,
  type CompetitionFormat,
  type CompetitionSession,
} from "../competition";
import type { GameKey, GameResult } from "../types";
import { games } from "../gameCatalog";

type Stage = "setup" | "ready" | "playing" | "result" | "standings";

const loadSession = () => {
  try {
    const stored = localStorage.getItem(competitionStorageKey);
    let session: CompetitionSession | null = null;
    if (stored) {
      try { session = restoreCompetition(JSON.parse(stored)); }
      catch { return { session: null, unavailable: false, invalid: true }; }
    }
    return { session, unavailable: false, invalid: Boolean(stored && !session) };
  } catch {
    return { session: null, unavailable: true, invalid: false };
  }
};

export default function Competition({ onExit, initialGame = "marbles", startInSetup = false }: { onExit: () => void; initialGame?: GameKey; startInSetup?: boolean }) {
  useLanguage();
  const [loaded] = useState(loadSession);
  const [session, setSession] = useState<CompetitionSession | null>(loaded.session);
  const [stage, setStage] = useState<Stage>(startInSetup ? "setup" : loaded.session?.draft?.scores ? "result" : loaded.session ? "standings" : "setup");
  const [competitionName, setCompetitionName] = useState("Heritage Games Cup");
  const [format, setFormat] = useState<CompetitionFormat>("four");
  const [selectedGame, setSelectedGame] = useState<GameKey | "all">(initialGame);
  const [names, setNames] = useState(["", "", "", ""]);
  const [storageUnavailable, setStorageUnavailable] = useState(loaded.unavailable);
  const [invalidSave, setInvalidSave] = useState(loaded.invalid);
  const [confirmReset, setConfirmReset] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resultHandledRef = useRef(false);
  const pendingScores = session?.draft?.scores ?? null;
  const firstSoloScore = session?.draft?.firstSoloScore;
  const soloPlayer: 0 | 1 = firstSoloScore === undefined ? 0 : 1;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [stage, session?.currentMatch]);

  useEffect(() => {
    if (!session) return;
    try {
      localStorage.setItem(competitionStorageKey, JSON.stringify(session));
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
    }
  }, [session]);

  const currentMatch = session?.matches[session.currentMatch];
  const players = useMemo(() => {
    if (!session || !currentMatch) return null;
    return currentMatch.playerIds.map((id) => session.competitors.find((item) => item.id === id)!) as [
      CompetitionSession["competitors"][number], CompetitionSession["competitors"][number]
    ];
  }, [session, currentMatch]);
  const standings = useMemo(() => session ? competitionStandings(session) : [], [session]);
  const cleanNames = names.map((name, index) => name.trim() || (format === "four" ? t("Player {0}", index + 1) : ""));
  const canStart = validCompetitorNames(cleanNames);
  const duplicateNames = new Set(cleanNames.filter(Boolean).map((name) => name.normalize("NFKC").toLocaleLowerCase())).size < cleanNames.filter(Boolean).length;
  const setupMatchCount = format === "four" ? selectedGame === "all" ? 16 : 4 : names.length === 2 ? 4 : format === "quick" ? names.length : names.length * (names.length - 1) / 2;
  const storageNotice = storageUnavailable ? <p className="competition-storage-note" role="status">{t("Saving is unavailable on this device. Keep this page open to keep your competition.")}</p> : null;

  const startCompetition = () => {
    if (!canStart) return;
    if (session && !window.confirm(t("Start a new competition? This will replace the saved competition and its results."))) return;
    const next = createCompetition(competitionName, cleanNames, format, selectedGame);
    setInvalidSave(false);
    setSession(next);
    setStage("ready");
  };

  const addPlayer = () => {
    if (names.length < 8) setNames((current) => [...current, ""]);
  };

  const removePlayer = (index: number) => {
    if (names.length > 2) setNames((current) => current.filter((_, playerIndex) => playerIndex !== index));
  };

  const beginMatch = () => {
    resultHandledRef.current = false;
    setStage("playing");
  };

  const finishVersus = ({ scores }: GameResult) => {
    if (!currentMatch || resultHandledRef.current || !validScores(scores)) return;
    resultHandledRef.current = true;
    setSession((current) => current ? { ...current, draft: { matchId: currentMatch.id, scores } } : current);
    setStage("result");
  };

  const finishSolo = (score: number) => {
    if (!currentMatch || resultHandledRef.current || !validScores([score, score])) return;
    resultHandledRef.current = true;
    if (soloPlayer === 0) {
      setSession((current) => current ? { ...current, draft: { matchId: currentMatch.id, firstSoloScore: score } } : current);
      setStage("ready");
    } else {
      const scores: [number, number] = [firstSoloScore ?? 0, score];
      setSession((current) => current ? { ...current, draft: { matchId: currentMatch.id, scores } } : current);
      setStage("result");
    }
  };

  const saveResult = () => {
    if (!session || !pendingScores || !currentMatch) return;
    const matchId = currentMatch.id;
    setSession((current) => current ? recordMatchResult(current, pendingScores, matchId) : current);
    setStage("standings");
  };

  const startNext = () => {
    if (!session || session.status === "complete") return;
    setConfirmReset(false);
    setStage(pendingScores ? "result" : "ready");
  };

  const resetCompetition = () => {
    try { localStorage.removeItem(competitionStorageKey); } catch { setStorageUnavailable(true); }
    setSession(null);
    setNames(["", "", "", ""]);
    setFormat("four");
    setSelectedGame(initialGame);
    setConfirmReset(false);
    setStage("setup");
  };

  if (!session || stage === "setup") {
    return (
      <main className="competition-page premium-page professional-page">
        <div className="competition-language"><LanguageSwitcher /></div>
        {storageNotice}
        {session ? <div className="competition-storage-note"><p>{t("A saved competition is available. Continue it, or start a new session below.")}</p><button className="secondary-button" onClick={() => setStage(pendingScores ? "result" : "standings")}>{t("Continue competition")}</button></div> : null}
        {invalidSave ? <p className="competition-storage-note" role="status">{t("The previous saved competition could not be opened. Create a new one below.")}</p> : null}
        <header className="competition-topbar">
          <button className="back-button premium-back-button" onClick={onExit}><ChevronLeft size={18} /> {t("Home")}</button>
          <div><p className="eyebrow">{t("Same-device competition")}</p><h1 ref={headingRef} tabIndex={-1}>{t("Play together with 4 players")}</h1></div>
        </header>
        <form className="competition-card competition-setup" aria-labelledby="competition-setup-title" onSubmit={(event) => { event.preventDefault(); startCompetition(); }}>
          <div className="competition-intro-icon"><Trophy size={34} /></div>
          <div>
            <p className="eyebrow">{t("Friendly competition")}</p>
            <h2 id="competition-setup-title">{t("Who is playing today?")}</h2>
            <p>{format === "four" ? t("Four friends, one screen. Play in pairs, swap partners and cheer each other on. Everyone gets two matches per game.") : t("Enter 2 to 8 names. The device will guide everyone through each handover, match and result.")}</p>
          </div>
          {format === "four" ? <fieldset className="four-game-picker">
            <legend>{t("1. Choose a game")}</legend>
            {games.map((game) => <label key={game.key} className={selectedGame === game.key ? "is-selected" : ""}>
              <input type="radio" name="four-game" checked={selectedGame === game.key} onChange={() => setSelectedGame(game.key)} />
              <strong>{t(game.title)}</strong><span>{t("4 matches · everyone plays twice")}</span>
            </label>)}
            <label className={selectedGame === "all" ? "is-selected" : ""}><input type="radio" name="four-game" checked={selectedGame === "all"} onChange={() => setSelectedGame("all")} /><strong>{t("All 4 games")}</strong><span>{t("16 matches · a longer session")}</span></label>
          </fieldset> : null}
          <details className="four-more-options"><summary>{t("More session options")}</summary>
          <label className="competition-field">{t("Competition name")} <input value={competitionName} maxLength={40} onChange={(event) => setCompetitionName(event.target.value)} />
          </label>
          <fieldset className="competition-format">
            <legend>{t("Competition length")}</legend>
            <label className={format === "four" ? "is-selected" : ""}>
              <input type="radio" name="format" checked={format === "four"} onChange={() => { setFormat("four"); setNames((current) => Array.from({ length: 4 }, (_, i) => current[i] ?? "")); }} />
              <strong>{t("4-player session")}</strong><span>{t("Easy setup · equal play")}</span>
            </label>
            <label className={format === "quick" ? "is-selected" : ""}>
              <input type="radio" name="format" checked={format === "quick"} onChange={() => setFormat("quick")} />
              <strong>{t("Quick Cup")}</strong><span>{names.length === 2 ? t("All 4 games") : t("2 matches each")}</span>
            </label>
            <label className={format === "league" ? "is-selected" : ""}>
              <input type="radio" name="format" checked={format === "league"} onChange={() => setFormat("league")} />
              <strong>{t("Full league")}</strong><span>{names.length === 2 ? t("All 4 games") : t("Everyone meets once")}</span>
            </label>
          </fieldset>
          </details>
          <h3>{format === "four" ? t("2. Add names, or use Player 1–4") : t("Who is playing today?")}</h3>
          <div className="competition-player-list">
            {names.map((name, index) => (
              <div className="competition-player-field" key={index}>
                <span className={`competition-player-number seat-${index % 4 + 1}`}>{index + 1}</span>
                <label className="sr-only" htmlFor={`participant-${index}`}>{t("Participant {0} name", index + 1)}</label>
                <input
                  id={`participant-${index}`}
                  autoComplete="off"
                  required={format !== "four"}
                  aria-describedby="competition-participants-help"
                  value={name}
                  maxLength={24}
                  placeholder={t("Player {0}", index + 1)}
                  onChange={(event) => setNames((current) => current.map((item, playerIndex) => playerIndex === index ? event.target.value : item))}
                />
                {format !== "four" && names.length > 2 ? <button type="button" onClick={() => removePlayer(index)} aria-label={t("Remove participant {0}", index + 1)}>{t("Remove")}</button> : null}
              </div>
            ))}
          </div>
          <p id="competition-participants-help" className="competition-setup-summary" role="status">{duplicateNames ? t("Use different names or add initials so everyone knows whose turn it is.") : t("{0} participants · {1} matches", names.length, setupMatchCount)}</p>
          <p className="competition-fairness-note">{t("A win earns 3 points. A draw earns 1 each. Equal points and wins share a place.")}</p>
          <div className="competition-setup-actions">
            {format !== "four" ? <button className="secondary-button" type="button" onClick={addPlayer} disabled={names.length >= 8}><Users2 size={17} /> {t("Add participant")}</button> : null}
            <button className="primary-button" type="submit" disabled={!canStart}>{format === "four" ? t("Start 4-player session") : t("Create competition")} <ArrowRight size={18} /></button>
          </div>
        </form>
      </main>
    );
  }

  if (!currentMatch || !players) return null;
  const title = t(gameTitle(currentMatch.game));
  const completedCount = session.matches.filter((item) => item.status === "complete").length;
  const champions = standings.filter((player) => player.rank === 1);
  const nextMatch = session.matches[session.currentMatch + 1];
  const groupRoster = session.format === "four" ? <section className={`four-roster ${stage === "playing" ? "four-roster-playing" : ""}`} aria-label={t("Our four players")}>
    {session.competitors.map((player, index) => {
      const playing = currentMatch.game === "five-stones" ? player.id === players[soloPlayer].id : currentMatch.playerIds.includes(player.id);
      return <div key={player.id} className={`four-seat seat-${index + 1} ${playing ? "is-playing" : ""}`}>
        <span className="four-seat-number">{index + 1}</span><strong>{player.name}</strong>
        <span>{playing ? t("Playing now") : t("Cheer them on")}</span>
        <small>{t("{0} cup points", standings.find((item) => item.id === player.id)?.points ?? 0)}</small>
      </div>;
    })}
    {currentMatch.game === "five-stones" && soloPlayer === 0 ? <p>{t("Next turn: {0}", players[1].name)}</p> : nextMatch ? <p>{t("Up next: {0} and {1}", ...nextMatch.playerIds.map((id) => session.competitors.find((player) => player.id === id)!.name))}</p> : <p>{t("Last match. Cheer everyone on!")}</p>}
  </section> : null;
  const matchGuidance = {
    marbles: [t("45 seconds for each shot"), t("Tap the ring to aim, then press Shoot marble."), t("Controlled shots are often easier than full power")],
    "pick-up-sticks": [t("45 seconds for the whole turn"), t("A clean pickup lets you continue"), t("Lifting a blocked stick passes the turn. Tapping to select a stick is safe.")],
    "five-stones": [t("Each participant has up to 12 tosses"), t("Follow the numbered pickup plan, then catch"), t("Nine successful catches complete the challenge")],
    chapteh: [t("Both participants play at the same time"), t("Wait for Kick now, then choose a near or far shot"), t("The first participant to 7 points wins")],
  }[currentMatch.game];

  if (stage === "playing") {
    const labels: [string, string] = [players[0].name, players[1].name];
    const game = currentMatch.game === "marbles"
      ? <MarblesGame playerNames={labels} onComplete={finishVersus} competitionMode />
      : currentMatch.game === "pick-up-sticks"
        ? <PickUpSticksGame playerNames={labels} onComplete={finishVersus} competitionMode />
        : currentMatch.game === "chapteh"
          ? <ChaptehGame playerNames={labels} onComplete={finishVersus} competitionMode />
          : <FiveStonesGame playerName={labels[soloPlayer]} onComplete={finishSolo} competitionMode />;
    return (
      <GameShell title={title} subtitle={currentMatch.game === "five-stones" ? t("{0}'s scored attempt", labels[soloPlayer]) : t("{0} vs {1}", labels[0], labels[1])} onBack={() => {
        if (window.confirm(t("Return to the match lobby? This unfinished attempt will restart. Confirmed results are kept."))) setStage("ready");
      }} backLabel={t("Match lobby")}>
        {storageNotice}
        {groupRoster}
        <div className="competition-game-banner" role="status">
          <span>{t("Match")} {completedCount + 1} {t("of")} {session.matches.length}</span>
          <strong>{currentMatch.game === "five-stones" ? t("{0}'s turn", labels[soloPlayer]) : t("{0} vs {1}", labels[0], labels[1])}</strong>
          <small>{t("The result appears when the game finishes")}</small>
        </div>
        {game}
      </GameShell>
    );
  }

  if (stage === "result" && pendingScores) {
    const winner = pendingScores[0] === pendingScores[1] ? null : pendingScores[0] > pendingScores[1] ? players[0] : players[1];
    return (
      <main className="competition-page premium-page professional-page">
        <div className="competition-language"><LanguageSwitcher /></div>
        {storageNotice}
        <section className="competition-card competition-result" aria-live="polite">
          <div className="competition-intro-icon"><Medal size={36} /></div>
          <p className="eyebrow">{t("Match complete ·")} {title}</p>
          <h1 ref={headingRef} tabIndex={-1}>{winner ? t("{0} wins!", winner.name) : t("It’s a draw")}</h1>
          <div className="competition-result-score">
            <div><span>{players[0].name}</span><strong>{pendingScores[0]}</strong></div>
            <b>–</b>
            <div><span>{players[1].name}</span><strong>{pendingScores[1]}</strong></div>
          </div>
          <p>{winner ? t("{0} earns 3 competition points.", winner.name) : t("Both participants earn 1 competition point.")}</p>
          <p>{t("Check both scores together, then confirm to update the standings.")}</p>
          <button className="primary-button" onClick={saveResult}><Check size={18} /> {t("Confirm result")}</button>
        </section>
      </main>
    );
  }

  if (stage === "ready") {
    const isSecondSoloAttempt = currentMatch.game === "five-stones" && soloPlayer === 1;
    return (
      <main className="competition-page premium-page professional-page">
        <div className="competition-language"><LanguageSwitcher /></div>
        {storageNotice}
        <header className="competition-topbar">
          <button className="back-button premium-back-button" onClick={() => setStage("standings")}><ChevronLeft size={18} /> {t("Standings")}</button>
          <div><p className="eyebrow">{session.name}</p><h1 ref={headingRef} tabIndex={-1}>{t("Match")} {completedCount + 1} {t("of")} {session.matches.length}</h1></div>
        </header>
        <section className="competition-card competition-handover">
          <p className="eyebrow">{isSecondSoloAttempt ? t("Pass the device") : t("Next match")}</p>
          <h2>{title}</h2>
          {groupRoster}
          {currentMatch.game === "five-stones" ? (
            <>
              <div className="competition-versus single-player"><strong>{players[soloPlayer].name}</strong><span>{t("Scored attempt")}</span></div>
              {isSecondSoloAttempt ? <p>{t("{0} scored {1}. Now hand the device to {2}.", players[0].name, firstSoloScore ?? 0, players[1].name)}</p> : <p>{t("Each participant gets the same challenge. The higher score wins.")}</p>}
            </>
          ) : (
            <div className="competition-versus"><strong>{players[0].name}</strong><span>{t("versus")}</span><strong>{players[1].name}</strong></div>
          )}
          <div className="competition-match-brief">
            <strong>{t("How this match works")}</strong>
            <ul>{matchGuidance.map((item) => <li key={item}><Check size={17} /> <span>{item}</span></li>)}</ul>
          </div>
          {currentMatch.game === "marbles" || currentMatch.game === "pick-up-sticks" ? <p className="competition-first-player">{t("{0} goes first", players[0].name)}</p> : null}
          <div className="competition-ready-note"><Check size={18} /><span>{t("Take your time reading. The game begins only when you press Ready.")}</span></div>
          <button className="primary-button competition-ready-button" onClick={beginMatch}>{currentMatch.game === "five-stones" ? t("{0} is ready", players[soloPlayer].name) : t("Both players are ready")} <ArrowRight size={19} /></button>
        </section>
      </main>
    );
  }

  return (
    <main className="competition-page premium-page professional-page">
        <div className="competition-language"><LanguageSwitcher /></div>
      {storageNotice}
      <header className="competition-topbar">
        <button className="back-button premium-back-button" onClick={onExit}><ChevronLeft size={18} /> {t("Home")}</button>
        <div><p className="eyebrow">{t("Competition standings")}</p><h1 ref={headingRef} tabIndex={-1}>{session.name}</h1></div>
      </header>
      <section className="competition-card standings-card">
        {session.status === "complete" ? <div className="competition-champion"><Trophy size={30} /><span>{champions.length > 1 ? t("Joint champions") : t("Champion")}</span><strong>{champions.map((player) => player.name).join(" & ")}</strong><p>{t("Well played, everyone. Thank you for sharing the games!")}</p></div> : null}
        <div className="standings-heading"><div><p className="eyebrow">{t("Live table")}</p><h2>{t("{0} of {1} matches complete", completedCount, session.matches.length)}</h2></div><span>{t("Win 3 · Draw 1 · Loss 0")}</span></div>
        <progress className="competition-progress" value={completedCount} max={session.matches.length} aria-label={t("Competition progress")} />
        <p className="competition-fairness-note">{t("Equal points and wins share a place. Scores from different games are not compared.")}</p>
        <div className="standings-table-wrap">
          <table className="standings-table">
            <caption className="sr-only">{t("Competition standings")}</caption>
            <thead><tr><th scope="col">{t("Place")}</th><th scope="col">{t("Participant")}</th><th scope="col">{t("Played")}</th><th scope="col">{t("Wins")}</th><th scope="col">{t("Draws")}</th><th scope="col">{t("Points")}</th></tr></thead>
            <tbody>{standings.map((player) => <tr key={player.id}><td>{player.rank}</td><th scope="row">{player.name}</th><td>{player.played}</td><td>{player.wins}</td><td>{player.draws}</td><td><strong>{player.points}</strong></td></tr>)}</tbody>
          </table>
        </div>
        <div className="competition-standings-actions">
          {session.status === "active" ? <button className="primary-button" onClick={startNext}>{firstSoloScore !== undefined ? t("Continue match") : t("Next match")} <ArrowRight size={18} /></button> : null}
          <button className="secondary-button" onClick={() => setConfirmReset(true)}><RotateCcw size={17} /> {t("New competition")}</button>
        </div>
        {confirmReset ? <div className="competition-reset-confirm" role="group" aria-labelledby="competition-reset-title">
          <strong id="competition-reset-title">{t("Start a new competition?")}</strong>
          <p>{t("This will clear the current competition and its results.")}</p>
          <div><button className="secondary-button" autoFocus onClick={() => setConfirmReset(false)}>{t("Keep this competition")}</button><button className="primary-button" onClick={resetCompetition}>{t("Start a new competition")}</button></div>
        </div> : null}
        <p className="competition-save-note">{storageUnavailable ? t("Keep this page open to keep your results.") : t("Confirmed results are saved on this device. You can return from Home at any time.")}</p>
      </section>
      <section className="competition-card competition-schedule" aria-labelledby="competition-schedule-title">
        <h2 id="competition-schedule-title">{t("Match schedule")}</h2>
        <ol className="competition-match-list">{session.matches.map((item, index) => {
          const [first, second] = item.playerIds.map((id) => session.competitors.find((player) => player.id === id)!);
          return <li key={item.id} className={item.status === "complete" ? "is-complete" : index === session.currentMatch ? "is-next" : ""} aria-current={item.status === "pending" && index === session.currentMatch ? "step" : undefined}>
            <span className="competition-match-number">{index + 1}</span>
            <div><strong>{t("{0} vs {1}", first.name, second.name)}</strong><span>{t(gameTitle(item.game))}</span></div>
            <span className="competition-match-status">{item.scores ? `${item.scores[0]} – ${item.scores[1]}` : index === session.currentMatch ? t("Next match") : t("Upcoming")}</span>
          </li>;
        })}</ol>
      </section>
    </main>
  );
}
