import type { GameKey } from "./types";

export type CompetitionFormat = "quick" | "league";
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
};

export type Standing = Competitor & {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  scoreDifference: number;
};

const games: GameKey[] = ["marbles", "pick-up-sticks", "five-stones", "chapteh"];
export const competitionStorageKey = "heritage-games-competition-v1";

const match = (index: number, game: GameKey, a: Competitor, b: Competitor): CompetitionMatch => ({
  id: `match-${index + 1}-${a.id}-${b.id}`,
  game,
  playerIds: [a.id, b.id],
  status: "pending",
});

export function createCompetition(name: string, names: string[], format: CompetitionFormat): CompetitionSession {
  const competitors = names.map((playerName, index) => ({
    id: `player-${index + 1}`,
    name: playerName.trim(),
  }));

  let pairs: [Competitor, Competitor][] = [];
  if (competitors.length === 2) {
    pairs = games.map(() => [competitors[0], competitors[1]]);
  } else if (format === "quick") {
    pairs = competitors.map((player, index) => [player, competitors[(index + 1) % competitors.length]]);
  } else {
    for (let a = 0; a < competitors.length; a += 1) {
      for (let b = a + 1; b < competitors.length; b += 1) pairs.push([competitors[a], competitors[b]]);
    }
  }

  return {
    id: `cup-${Date.now()}`,
    name: name.trim() || "Heritage Games Cup",
    format,
    competitors,
    matches: pairs.map(([a, b], index) => match(index, games[index % games.length], a, b)),
    currentMatch: 0,
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

export function recordMatchResult(session: CompetitionSession, scores: [number, number]): CompetitionSession {
  const matches = session.matches.map((item, index) => index === session.currentMatch
    ? { ...item, status: "complete" as const, scores }
    : item);
  const next = matches.findIndex((item, index) => index > session.currentMatch && item.status === "pending");
  return {
    ...session,
    matches,
    currentMatch: next === -1 ? session.currentMatch : next,
    status: next === -1 ? "complete" : "active",
  };
}

export function competitionStandings(session: CompetitionSession): Standing[] {
  const table = new Map(session.competitors.map((player) => [player.id, {
    ...player, played: 0, wins: 0, draws: 0, losses: 0, points: 0, scoreDifference: 0,
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

  return [...table.values()].sort((a, b) =>
    b.points - a.points || b.wins - a.wins || b.scoreDifference - a.scoreDifference || a.name.localeCompare(b.name));
}

export function gameTitle(game: GameKey) {
  return ({ marbles: "Marbles", "pick-up-sticks": "Pick-Up Sticks", "five-stones": "Five Stones", chapteh: "Chapteh" })[game];
}
