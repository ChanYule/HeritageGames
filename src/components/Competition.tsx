import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronLeft, Medal, RotateCcw, Trophy, Users2 } from "lucide-react";
import GameShell from "./GameShell";
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
  type CompetitionFormat,
  type CompetitionSession,
} from "../competition";
import type { GameResult } from "../types";

type Stage = "setup" | "ready" | "playing" | "result" | "standings";

const loadSession = (): CompetitionSession | null => {
  try {
    const stored = localStorage.getItem(competitionStorageKey);
    return stored ? JSON.parse(stored) as CompetitionSession : null;
  } catch {
    return null;
  }
};

export default function Competition({ onExit }: { onExit: () => void }) {
  const [session, setSession] = useState<CompetitionSession | null>(() => loadSession());
  const [stage, setStage] = useState<Stage>(() => loadSession() ? "standings" : "setup");
  const [competitionName, setCompetitionName] = useState("Heritage Games Cup");
  const [format, setFormat] = useState<CompetitionFormat>("quick");
  const [names, setNames] = useState(["", ""]);
  const [pendingScores, setPendingScores] = useState<[number, number] | null>(null);
  const [soloScores, setSoloScores] = useState<[number | null, number | null]>([null, null]);
  const [soloPlayer, setSoloPlayer] = useState<0 | 1>(0);

  useEffect(() => {
    if (session) localStorage.setItem(competitionStorageKey, JSON.stringify(session));
  }, [session]);

  const currentMatch = session?.matches[session.currentMatch];
  const players = useMemo(() => {
    if (!session || !currentMatch) return null;
    return currentMatch.playerIds.map((id) => session.competitors.find((item) => item.id === id)!) as [
      CompetitionSession["competitors"][number], CompetitionSession["competitors"][number]
    ];
  }, [session, currentMatch]);
  const standings = useMemo(() => session ? competitionStandings(session) : [], [session]);

  const startCompetition = () => {
    const cleanNames = names.map((name) => name.trim()).filter(Boolean);
    if (cleanNames.length < 2) return;
    const next = createCompetition(competitionName, cleanNames, format);
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
    setPendingScores(null);
    if (currentMatch?.game === "five-stones" && soloScores[0] === null) {
      setSoloScores([null, null]);
      setSoloPlayer(0);
    }
    setStage("playing");
  };

  const finishVersus = ({ scores }: GameResult) => {
    setPendingScores(scores);
    setStage("result");
  };

  const finishSolo = (score: number) => {
    if (soloPlayer === 0) {
      setSoloScores([score, null]);
      setSoloPlayer(1);
      setStage("ready");
    } else {
      const scores: [number, number] = [soloScores[0] ?? 0, score];
      setSoloScores(scores);
      setPendingScores(scores);
      setStage("result");
    }
  };

  const saveResult = () => {
    if (!session || !pendingScores) return;
    const next = recordMatchResult(session, pendingScores);
    setSession(next);
    setPendingScores(null);
    setStage("standings");
  };

  const startNext = () => {
    if (!session || session.status === "complete") return;
    setSoloScores([null, null]);
    setSoloPlayer(0);
    setStage("ready");
  };

  const resetCompetition = () => {
    localStorage.removeItem(competitionStorageKey);
    setSession(null);
    setNames(["", ""]);
    setPendingScores(null);
    setStage("setup");
  };

  if (!session || stage === "setup") {
    return (
      <main className="competition-page premium-page professional-page">
        <header className="competition-topbar">
          <button className="back-button premium-back-button" onClick={onExit}><ChevronLeft size={18} /> Home</button>
          <div><p className="eyebrow">Same-device competition</p><h1>Create your Heritage Games Cup</h1></div>
        </header>
        <section className="competition-card competition-setup" aria-labelledby="competition-setup-title">
          <div className="competition-intro-icon"><Trophy size={34} /></div>
          <div>
            <p className="eyebrow">Friendly competition</p>
            <h2 id="competition-setup-title">Who is playing today?</h2>
            <p>Enter 2 to 8 names. The device will guide everyone through each handover, match and result.</p>
          </div>
          <label className="competition-field">Competition name
            <input value={competitionName} maxLength={40} onChange={(event) => setCompetitionName(event.target.value)} />
          </label>
          <fieldset className="competition-format">
            <legend>Competition length</legend>
            <label className={format === "quick" ? "is-selected" : ""}>
              <input type="radio" name="format" checked={format === "quick"} onChange={() => setFormat("quick")} />
              <strong>Quick Cup</strong><span>{names.length === 2 ? "All 4 games" : "2 matches each"}</span>
            </label>
            <label className={format === "league" ? "is-selected" : ""}>
              <input type="radio" name="format" checked={format === "league"} onChange={() => setFormat("league")} />
              <strong>Full league</strong><span>Everyone meets once</span>
            </label>
          </fieldset>
          <div className="competition-player-list">
            {names.map((name, index) => (
              <label className="competition-player-field" key={index}>
                <span className={`competition-player-number player-${index % 2 + 1}`}>{index + 1}</span>
                <span className="sr-only">Participant {index + 1} name</span>
                <input
                  value={name}
                  maxLength={24}
                  placeholder={`Participant ${index + 1}`}
                  onChange={(event) => setNames((current) => current.map((item, playerIndex) => playerIndex === index ? event.target.value : item))}
                />
                {names.length > 2 ? <button type="button" onClick={() => removePlayer(index)} aria-label={`Remove participant ${index + 1}`}>Remove</button> : null}
              </label>
            ))}
          </div>
          <div className="competition-setup-actions">
            <button className="secondary-button" type="button" onClick={addPlayer} disabled={names.length >= 8}><Users2 size={17} /> Add participant</button>
            <button className="primary-button" type="button" onClick={startCompetition} disabled={names.filter((name) => name.trim()).length < 2}>Create competition <ArrowRight size={18} /></button>
          </div>
        </section>
      </main>
    );
  }

  if (!currentMatch || !players) return null;
  const title = gameTitle(currentMatch.game);
  const completedCount = session.matches.filter((item) => item.status === "complete").length;
  const matchGuidance = {
    marbles: ["45 seconds for each shot", "Drag away from the target, then release", "Controlled shots are often easier than full power"],
    "pick-up-sticks": ["45 seconds for the whole turn", "A clean pickup lets you continue", "Touching a blocked stick passes the turn"],
    "five-stones": ["Both participants use the same generous pace", "Toss, collect the exact number, then catch", "You may finish after one throw and record the current score"],
    chapteh: ["Both participants play at the same time", "Wait for your Kick now cue", "The first participant to 7 points wins"],
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
      <GameShell title={title} subtitle={currentMatch.game === "five-stones" ? `${labels[soloPlayer]}'s scored attempt` : `${labels[0]} vs ${labels[1]}`} onBack={() => setStage("ready")} backLabel="Match lobby">
        <div className="competition-game-banner" role="status">
          <span>Match {completedCount + 1} of {session.matches.length}</span>
          <strong>{currentMatch.game === "five-stones" ? `${labels[soloPlayer]}'s turn` : `${labels[0]} vs ${labels[1]}`}</strong>
          <small>The result appears when the game finishes</small>
        </div>
        {game}
      </GameShell>
    );
  }

  if (stage === "result" && pendingScores) {
    const winner = pendingScores[0] === pendingScores[1] ? null : pendingScores[0] > pendingScores[1] ? players[0] : players[1];
    return (
      <main className="competition-page premium-page professional-page">
        <section className="competition-card competition-result" aria-live="polite">
          <div className="competition-intro-icon"><Medal size={36} /></div>
          <p className="eyebrow">Match complete · {title}</p>
          <h1>{winner ? `${winner.name} wins!` : "It’s a draw"}</h1>
          <div className="competition-result-score">
            <div><span>{players[0].name}</span><strong>{pendingScores[0]}</strong></div>
            <b>–</b>
            <div><span>{players[1].name}</span><strong>{pendingScores[1]}</strong></div>
          </div>
          <p>{winner ? `${winner.name} earns 3 competition points.` : "Both participants earn 1 competition point."}</p>
          <button className="primary-button" onClick={saveResult}><Check size={18} /> Confirm result</button>
        </section>
      </main>
    );
  }

  if (stage === "ready") {
    const isSecondSoloAttempt = currentMatch.game === "five-stones" && soloPlayer === 1 && soloScores[0] !== null;
    return (
      <main className="competition-page premium-page professional-page">
        <header className="competition-topbar">
          <button className="back-button premium-back-button" onClick={() => setStage("standings")}><ChevronLeft size={18} /> Standings</button>
          <div><p className="eyebrow">{session.name}</p><h1>Match {completedCount + 1} of {session.matches.length}</h1></div>
        </header>
        <section className="competition-card competition-handover">
          <p className="eyebrow">{isSecondSoloAttempt ? "Pass the device" : "Next match"}</p>
          <h2>{title}</h2>
          {currentMatch.game === "five-stones" ? (
            <>
              <div className="competition-versus single-player"><strong>{players[soloPlayer].name}</strong><span>Scored attempt</span></div>
              {isSecondSoloAttempt ? <p>{players[0].name} scored <strong>{soloScores[0]}</strong>. Now hand the device to {players[1].name}.</p> : <p>Each participant gets the same challenge. The higher score wins.</p>}
            </>
          ) : (
            <div className="competition-versus"><strong>{players[0].name}</strong><span>versus</span><strong>{players[1].name}</strong></div>
          )}
          <div className="competition-match-brief">
            <strong>How this match works</strong>
            <ul>{matchGuidance.map((item) => <li key={item}><Check size={17} /> <span>{item}</span></li>)}</ul>
          </div>
          <div className="competition-ready-note"><Check size={18} /><span>Read the match guide above. Timing begins after everyone presses Ready.</span></div>
          <button className="primary-button competition-ready-button" onClick={beginMatch}>{isSecondSoloAttempt ? `${players[1].name} is ready` : "Both players are ready"} <ArrowRight size={19} /></button>
        </section>
      </main>
    );
  }

  return (
    <main className="competition-page premium-page professional-page">
      <header className="competition-topbar">
        <button className="back-button premium-back-button" onClick={onExit}><ChevronLeft size={18} /> Home</button>
        <div><p className="eyebrow">Competition standings</p><h1>{session.name}</h1></div>
      </header>
      <section className="competition-card standings-card">
        {session.status === "complete" ? <div className="competition-champion"><Trophy size={30} /><span>Champion</span><strong>{standings[0]?.name}</strong></div> : null}
        <div className="standings-heading"><div><p className="eyebrow">Live table</p><h2>{completedCount} of {session.matches.length} matches complete</h2></div><span>Win 3 · Draw 1 · Loss 0</span></div>
        <div className="standings-table-wrap">
          <table className="standings-table">
            <thead><tr><th>Place</th><th>Participant</th><th>Played</th><th>W</th><th>D</th><th>Points</th></tr></thead>
            <tbody>{standings.map((player, index) => <tr key={player.id}><td>{index + 1}</td><th scope="row">{player.name}</th><td>{player.played}</td><td>{player.wins}</td><td>{player.draws}</td><td><strong>{player.points}</strong></td></tr>)}</tbody>
          </table>
        </div>
        <div className="competition-standings-actions">
          {session.status === "active" ? <button className="primary-button" onClick={startNext}>Next match <ArrowRight size={18} /></button> : null}
          <button className="secondary-button" onClick={resetCompetition}><RotateCcw size={17} /> New competition</button>
        </div>
      </section>
    </main>
  );
}
