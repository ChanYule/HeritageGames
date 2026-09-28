import type { GameKey } from "./types";

export type CompetitionFormat = "four" | "quick" | "league";
export type CompetitionStatus = "active" | "complete";

export type Competitor = {
  id: string;
  name: string;
};

export type CompetitionMatch = {
  id: string;
  game: GameKey;
  playerIds: [string, string];
  status: "pending" | "complete";
  scores?: [number, number];
};

export type CompetitionSession = {
  id: string;
  name: string;
  format: CompetitionFormat;
  competitors: Competitor[];
  matches: CompetitionMatch[];
  currentMatch: number;
  status: CompetitionStatus;
  createdAt: string;
  draft?: {
    matchId: string;
    firstSoloScore?: number;
    scores?: [number, number];
  };
};

export type Standing = Competitor & {
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  scoreDifference: number;
};

const games: GameKey[] = ["marbles", "pick-up-sticks", "five-stones", "chapteh"];
export const competitionStorageKey = "heritage-games-competition-v1";

const validScore = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export const validScores = (value: unknown): value is [number, number] => Array.isArray(value) && value.length === 2 && value.every(validScore);
const nameKey = (name: string) => name.trim().normalize("NFKC").toLocaleLowerCase();

export function validCompetitorNames(names: string[]): boolean {
  return names.length >= 2 && names.length <= 8 && names.every((name) => name.trim().length > 0 && name.trim().length <= 24)
    && new Set(names.map(nameKey)).size === names.length;
}

// Treat browser storage as untrusted. Derive progress from validated results rather
// than trusting a saved cursor, and retain completed attempts during a handover.
export function restoreCompetition(value: unknown): CompetitionSession | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.id !== "string" || !data.id || typeof data.name !== "string" || data.name.length > 40
    || (data.format !== "four" && data.format !== "quick" && data.format !== "league") || typeof data.createdAt !== "string"
    || !Number.isFinite(Date.parse(data.createdAt)) || !Array.isArray(data.competitors) || !Array.isArray(data.matches)) return null;
  const competitors: Competitor[] = [];
  for (const player of data.competitors) {
    if (!player || typeof player.id !== "string" || !player.id || typeof player.name !== "string") return null;
    competitors.push({ id: player.id, name: player.name.trim() });
  }
  if (!validCompetitorNames(competitors.map((player) => player.name))) return null;
  if (data.format === "four" && (competitors.length < 2 || competitors.length > 4)) return null;
  const ids = new Set(competitors.map((player) => player.id));
  if (ids.size !== competitors.length || data.matches.length === 0 || data.matches.length > 28) return null;
  const matches: CompetitionMatch[] = [];
  for (const item of data.matches) {
    if (!item || typeof item.id !== "string" || !item.id || !games.includes(item.game)
      || !Array.isArray(item.playerIds) || item.playerIds.length !== 2 || item.playerIds[0] === item.playerIds[1]
      || !item.playerIds.every((id: unknown) => typeof id === "string" && ids.has(id))
      || (item.status !== "pending" && item.status !== "complete")
      || (item.status === "complete" && !validScores(item.scores))) return null;
    matches.push({ id: item.id, game: item.game, playerIds: [...item.playerIds] as [string, string], status: item.status,
      ...(item.status === "complete" ? { scores: [...item.scores] as [number, number] } : {}) });
  }
  if (new Set(matches.map((item) => item.id)).size !== matches.length) return null;
  const pending = matches.findIndex((item) => item.status === "pending");
  const restored: CompetitionSession = {
    id: data.id, name: data.name.trim() || "Heritage Games Cup", format: data.format, createdAt: data.createdAt,
    competitors, matches, currentMatch: pending === -1 ? matches.length - 1 : pending, status: pending === -1 ? "complete" : "active",
  };
  const draft = data.draft as Record<string, unknown> | undefined;
  if (pending !== -1 && draft && draft.matchId === matches[pending].id) {
    if (validScores(draft.scores)) restored.draft = { matchId: matches[pending].id, scores: [...draft.scores] };
    else if (matches[pending].game === "five-stones" && validScore(draft.firstSoloScore)) {
      restored.draft = { matchId: matches[pending].id, firstSoloScore: draft.firstSoloScore };
    }
  }
  return restored;
}

const match = (index: number, game: GameKey, a: Competitor, b: Competitor): CompetitionMatch => ({
  id: `match-${index + 1}-${a.id}-${b.id}`,
  game,
  playerIds: [a.id, b.id],
  status: "pending",
});

export function createCompetition(name: string, names: string[], format: CompetitionFormat, selectedGame: GameKey | "all" = "all"): CompetitionSession {
  if (!validCompetitorNames(names)) throw new Error("Enter 2 to 8 different participant names.");
  if (format !== "four" && format !== "quick" && format !== "league") throw new Error("Choose a competition format.");
  if (format === "four" && (names.length < 2 || names.length > 4)) throw new Error("Choose 2 to 4 players.");
  if (selectedGame !== "all" && !games.includes(selectedGame)) throw new Error("Choose a game.");
  const competitors = names.map((playerName, index) => ({
    id: `player-${index + 1}`,
    name: playerName.trim(),
  }));

  let pairs: [Competitor, Competitor][] = [];
  if (format === "four") {
    // Every participant plays twice per game, and starts once. The four-player
    // opening pairs are disjoint to keep waits short.
    const roundPairs = competitors.length === 2
      ? [[0, 1], [1, 0]]
      : competitors.length === 3
        ? [[0, 1], [2, 0], [1, 2]]
        : [[0, 1], [2, 3], [1, 2], [3, 0]];
    const selectedGames = selectedGame === "all" ? games : [selectedGame];
    pairs = selectedGames.flatMap(() => roundPairs.map(([a, b]): [Competitor, Competitor] => [competitors[a], competitors[b]]));
  } else if (competitors.length === 2) {
    pairs = games.map((_, index) => index % 2 === 0 ? [competitors[0], competitors[1]] : [competitors[1], competitors[0]]);
  } else if (format === "quick") {
    pairs = competitors.map((player, index) => [player, competitors[(index + 1) % competitors.length]]);
  } else {
    // Round-robin rounds spread everyone's appearances through the event. Orient each
    // pair around a circle so first-player duties differ by at most one match.
    const rotation: (Competitor | null)[] = [...competitors];
    if (rotation.length % 2) rotation.push(null);
    for (let round = 0; round < rotation.length - 1; round += 1) {
      for (let index = 0; index < rotation.length / 2; index += 1) {
        const a = rotation[index];
        const b = rotation[rotation.length - 1 - index];
        if (!a || !b) continue;
        const aIndex = competitors.indexOf(a);
        const bIndex = competitors.indexOf(b);
        const distance = (bIndex - aIndex + competitors.length) % competitors.length;
        const aStarts = distance < competitors.length / 2 || (distance === competitors.length / 2 && aIndex < bIndex);
        pairs.push(aStarts ? [a, b] : [b, a]);
      }
      rotation.splice(1, 0, rotation.pop()!);
    }
  }

  return {
    id: `cup-${Date.now()}`,
    name: name.trim().slice(0, 40) || "Heritage Games Cup",
    format,
    competitors,
    matches: pairs.map(([a, b], index) => match(index,
      format === "four" ? selectedGame === "all" ? games[Math.floor(index / competitors.length)] : selectedGame : games[index % games.length], a, b)),
    currentMatch: 0,
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

export function recordMatchResult(session: CompetitionSession, scores: [number, number], expectedMatchId = session.matches[session.currentMatch]?.id): CompetitionSession {
  const current = session.matches[session.currentMatch];
  if (session.status !== "active" || !current || current.status !== "pending" || current.id !== expectedMatchId || !validScores(scores)) return session;
  const matches = session.matches.map((item, index) => index === session.currentMatch
    ? { ...item, status: "complete" as const, scores: [...scores] as [number, number] }
    : item);
  const next = matches.findIndex((item, index) => index > session.currentMatch && item.status === "pending");
  return {
    ...session,
    draft: undefined,
    matches,
    currentMatch: next === -1 ? session.currentMatch : next,
    status: next === -1 ? "complete" : "active",
  };
}

export function competitionStandings(session: CompetitionSession): Standing[] {
  const table = new Map(session.competitors.map((player) => [player.id, {
    ...player, rank: 1, played: 0, wins: 0, draws: 0, losses: 0, points: 0, scoreDifference: 0,
  }]));

  session.matches.forEach((item) => {
    if (item.status !== "complete" || !item.scores) return;
    const first = table.get(item.playerIds[0]);
    const second = table.get(item.playerIds[1]);
    if (!first || !second) return;
    first.played += 1;
    second.played += 1;
    first.scoreDifference += item.scores[0] - item.scores[1];
    second.scoreDifference += item.scores[1] - item.scores[0];
    if (item.scores[0] === item.scores[1]) {
      first.draws += 1; second.draws += 1; first.points += 1; second.points += 1;
    } else {
      const winner = item.scores[0] > item.scores[1] ? first : second;
      const loser = item.scores[0] > item.scores[1] ? second : first;
      winner.wins += 1; winner.points += 3; loser.losses += 1;
    }
  });

  // A stick point and a Five Stones point have different scales. Equal cup
  // points and wins share a place; names only make tied rows stable to read.
  const standings = [...table.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
  standings.forEach((player, index) => {
    const previous = standings[index - 1];
    player.rank = previous && player.points === previous.points && player.wins === previous.wins ? previous.rank : index + 1;
  });
  return standings;
}

export function gameTitle(game: GameKey) {
  return ({ marbles: "Marbles", "pick-up-sticks": "Pick-Up Sticks", "five-stones": "Five Stones", chapteh: "Chapteh" })[game];
}
