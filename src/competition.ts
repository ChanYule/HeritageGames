import type { HeritageGameKey, GameResult } from "./types";

export const challengeStorageKey = "heritage-games-challenge-v2";
export const legacyCompetitionStorageKey = "heritage-games-competition-v1";
export const challengeGames: HeritageGameKey[] = [
  "marbles",
  "pick-up-sticks",
  "carom",
  "tin-can-knockdown",
];
export const playerColours = [
  "#266579",
  "#9d4938",
  "#695098",
  "#486527",
] as const;
export type ChallengeType = "quick" | "full";
export type ChallengeStatus =
  | "lobby"
  | "playing"
  | "player_handover"
  | "round_results"
  | "final_results";
export type ChallengePlayer = { id: string; name: string; colour: string };
export type Turn = { id: string; players: number[]; label: string };
export type Attempt = Turn & { scores: number[]; winner: number | null };
export type Placement = {
  player: number;
  rawScore: number;
  rank: number;
  points: number;
  performance: number;
};
export type ChallengeRound = {
  game: HeritageGameKey;
  attempts: Attempt[];
  replays: number;
  placements: Placement[];
};
export type Challenge = {
  version: 2;
  id: string;
  createdAt: string;
  type: ChallengeType;
  difficulty: "easy" | "medium" | "difficult";
  games: HeritageGameKey[];
  players: ChallengePlayer[];
  currentGameIndex: number;
  status: ChallengeStatus;
  rounds: ChallengeRound[];
};
export type OverallScore = ChallengePlayer & {
  player: number;
  rank: number;
  points: number;
  wins: number;
  seconds: number;
  performance: number;
};
const validScore = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export const validScores = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every(validScore);
export const validPlayerNames = (names: string[]) =>
  names.length >= 2 &&
  names.length <= 4 &&
  names.every((n) => n.trim().length > 0 && n.trim().length <= 24) &&
  new Set(names.map((n) => n.trim().normalize("NFKC").toLocaleLowerCase()))
    .size === names.length;
export const gameTitle = (game: HeritageGameKey) =>
  ({
    marbles: "Marbles",
    "pick-up-sticks": "Pick-Up Sticks",
    carom: "Carrom",
    "tin-can-knockdown": "Tin-Can Knockdown",
  })[game];
export const challengeDuration = (type: ChallengeType) =>
  type === "quick" ? "Around 10 to 15 minutes" : "Around 20 to 30 minutes";

export function createChallenge(
  type: ChallengeType,
  names: string[],
  games: HeritageGameKey[] = challengeGames,
  difficulty: Challenge["difficulty"] = "easy",
): Challenge {
  if (!validPlayerNames(names))
    throw new Error("Enter 2 to 4 different player names.");
  if (type !== "quick" && type !== "full")
    throw new Error("Choose a challenge.");
  if (
    games.length !== (type === "quick" ? 2 : 4) ||
    new Set(games).size !== games.length ||
    games.some((g) => !challengeGames.includes(g))
  )
    throw new Error("Choose two different games or all four games.");
  if (!["easy", "medium", "difficult"].includes(difficulty))
    throw new Error("Choose a level.");
  return {
    version: 2,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    type,
    difficulty,
    games: [...games],
    players: names.map((name, i) => ({
      id: `player-${i + 1}`,
      name: name.trim(),
      colour: playerColours[i],
    })),
    currentGameIndex: 0,
    status: "lobby",
    rounds: games.map((game) => ({
      game,
      attempts: [],
      replays: 0,
      placements: [],
    })),
  };
}

/** Competition ranking: equal results share rank and points; the next rank skips places (1,1,3). */
export function calculatePlacements(scores: number[]): Placement[] {
  if (scores.length < 2 || scores.length > 4 || !scores.every(validScore))
    throw new Error("Invalid round scores.");
  const max = Math.max(...scores);
  return scores
    .map((rawScore, player) => {
      const rank = 1 + scores.filter((score) => score > rawScore).length;
      return {
        player,
        rawScore,
        rank,
        points: scores.length + 1 - rank,
        performance: max ? rawScore / max : 1,
      };
    })
    .sort((a, b) => a.rank - b.rank || a.player - b.player);
}

export function currentTurn(state: Challenge): Turn | null {
  const round = state.rounds[state.currentGameIndex];
  if (!round || round.placements.length || state.status === "final_results")
    return null;
  const n = state.players.length,
    count = round.attempts.length;
  let players: number[], label: string;
  if (round.game !== "carom") {
    if (count >= n) return null;
    players = [(count + state.currentGameIndex) % n];
    label = "Individual attempt";
  } else if (n === 2) {
    if (count) return null;
    players = [0, 1];
    label = "Carrom round";
  } else if (n === 3) {
    // Each player has two duels and starts exactly once. No byes or scoring advantages.
    const pairs = [
      [0, 1],
      [2, 0],
      [1, 2],
    ];
    if (count >= pairs.length) return null;
    players = pairs[count];
    label = "Carrom round";
  } else {
    // Two semifinals, a final, and a placement game: every player has exactly two completed games (drawn semifinals replay).
    // Drawn semifinals replay; tied final/placement games share the respective place.
    if (count >= 4) return null;
    const winners = round.attempts.slice(0, 2).map((a) => a.winner);
    const losers = round.attempts
      .slice(0, 2)
      .map((a) => a.players.find((p) => p !== a.winner));
    if (
      count >= 2 &&
      (winners.some((w) => w === null) || losers.some((l) => l === undefined))
    )
      return null;
    players =
      count === 0
        ? [0, 1]
        : count === 1
          ? [2, 3]
          : count === 2
            ? (winners as number[])
            : (losers as number[]);
    label =
      count < 2 ? "Semi-final {0}" : count === 2 ? "Final" : "Placement Game";
  }
  return {
    id: `${state.id}:${state.currentGameIndex}:${count}:${round.replays}`,
    players,
    label,
  };
}
export function startChallenge(state: Challenge): Challenge {
  return state.status === "lobby"
    ? { ...state, status: "player_handover" }
    : state;
}
export function readyChallenge(state: Challenge): Challenge {
  return state.status === "player_handover" && currentTurn(state)
    ? { ...state, status: "playing" }
    : state;
}
export function pauseChallenge(state: Challenge): Challenge {
  return state.status === "playing"
    ? { ...state, status: "player_handover" }
    : state;
}

function headToHeadPlacements(
  state: Challenge,
  round: ChallengeRound,
): Placement[] {
  const n = state.players.length;
  const raw = state.players.map((_, p) =>
    round.attempts.reduce(
      (sum, a) =>
        sum + (a.players.includes(p) ? a.scores[a.players.indexOf(p)] : 0),
      0,
    ),
  );
  if (n < 4) {
    const duelPoints = state.players.map((_, p) =>
      round.attempts.reduce(
        (sum, a) =>
          sum +
          (!a.players.includes(p)
            ? 0
            : a.winner === null
              ? 1
              : a.winner === p
                ? 3
                : 0),
        0,
      ),
    );
    return calculatePlacements(duelPoints).map((result) => ({
      ...result,
      rawScore: raw[result.player],
      performance: (n - result.rank) / (n - 1),
    }));
  }
  return state.players
    .map((_, player) => {
      const final = round.attempts[2],
        placement = round.attempts[3];
      const bout = final.players.includes(player) ? final : placement,
        base = bout === final ? 1 : 3;
      const rank =
        base + (bout.winner === null || bout.winner === player ? 0 : 1);
      return {
        player,
        rawScore: raw[player],
        rank,
        points: n + 1 - rank,
        performance: (n - rank) / (n - 1),
      };
    })
    .sort((a, b) => a.rank - b.rank || a.player - b.player);
}

export function recordChallengeResult(
  state: Challenge,
  result: GameResult,
  expectedTurnId: string,
): Challenge {
  const turn = currentTurn(state);
  if (
    state.status !== "playing" ||
    !turn ||
    turn.id !== expectedTurnId ||
    !validScores(result.scores)
  )
    return state;
  if (
    result.winner !== undefined &&
    result.winner !== null &&
    result.winner !== 0 &&
    result.winner !== 1
  )
    return state;
  const index = state.currentGameIndex,
    previous = state.rounds[index];
  const scores =
    turn.players.length === 1 ? [result.scores[0]] : [...result.scores];
  const side =
    result.winner === undefined
      ? scores[0] === scores[1]
        ? null
        : scores[0] > scores[1]
          ? 0
          : 1
      : result.winner;
  const winner =
    turn.players.length === 1
      ? turn.players[0]
      : side === null
        ? null
        : turn.players[side];
  if (
    previous.game === "carom" &&
    state.players.length === 4 &&
    previous.attempts.length < 2 &&
    winner === null
  ) {
    return {
      ...state,
      status: "player_handover",
      rounds: state.rounds.map((r, i) =>
        i === index ? { ...r, replays: r.replays + 1 } : r,
      ),
    };
  }
  const round = {
    ...previous,
    attempts: [...previous.attempts, { ...turn, scores, winner }],
  };
  const complete =
    round.attempts.length ===
    (round.game === "carom"
      ? state.players.length === 2
        ? 1
        : state.players.length
      : state.players.length);
  if (complete) {
    if (round.game === "carom")
      round.placements = headToHeadPlacements(state, round);
    else {
      const raw = state.players.map(
        (_, p) =>
          round.attempts.find((a) => a.players[0] === p)?.scores[0] ?? 0,
      );
      round.placements = calculatePlacements(raw);
    }
  }
  return {
    ...state,
    status: complete ? "round_results" : "player_handover",
    rounds: state.rounds.map((r, i) => (i === index ? round : r)),
  };
}
export function advanceChallenge(state: Challenge): Challenge {
  if (state.status !== "round_results") return state;
  return state.currentGameIndex === state.games.length - 1
    ? { ...state, status: "final_results" }
    : {
        ...state,
        currentGameIndex: state.currentGameIndex + 1,
        status: "player_handover",
      };
}
export const restartChallenge = (state: Challenge) =>
  createChallenge(
    state.type,
    state.players.map((p) => p.name),
    state.games,
    state.difficulty,
  );

export function overallScores(state: Challenge): OverallScore[] {
  const rows = state.players
    .map((p, player) => {
      const results = state.rounds.flatMap((r) =>
        r.placements.filter((result) => result.player === player),
      );
      return {
        ...p,
        player,
        rank: 1,
        points: results.reduce((s, r) => s + r.points, 0),
        wins: results.filter((r) => r.rank === 1).length,
        seconds: results.filter((r) => r.rank === 2).length,
        performance: results.reduce((s, r) => s + r.performance, 0),
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        b.seconds - a.seconds ||
        b.performance - a.performance ||
        a.player - b.player,
    );
  rows.forEach((r, i) => {
    const previous = rows[i - 1];
    r.rank =
      previous &&
      previous.points === r.points &&
      previous.wins === r.wins &&
      previous.seconds === r.seconds &&
      Math.abs(previous.performance - r.performance) < 1e-9
        ? previous.rank
        : i + 1;
  });
  return rows;
}
export function challengeSeed(state: Challenge): number {
  return [...`${state.id}:${state.currentGameIndex}`].reduce(
    (seed, char) => (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0,
    17,
  );
}

const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
/** Replay validated results to derive placements and cursors. Never trust saved points or player colours.
 * In-progress physics is not serialised: refresh restarts only the current attempt behind Ready. */
export function restoreChallenge(value: unknown): Challenge | null {
  if (
    !object(value) ||
    value.version !== 2 ||
    typeof value.id !== "string" ||
    !value.id ||
    value.id.length > 100 ||
    typeof value.createdAt !== "string" ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    (value.type !== "quick" && value.type !== "full") ||
    !Array.isArray(value.games) ||
    !Array.isArray(value.players) ||
    !Array.isArray(value.rounds)
  )
    return null;
  const games = value.games;
  if (
    games.length !== (value.type === "quick" ? 2 : 4) ||
    new Set(games).size !== games.length ||
    !games.every(
      (g) => typeof g === "string" && challengeGames.includes(g as HeritageGameKey),
    )
  )
    return null;
  const names: string[] = [];
  for (const p of value.players) {
    if (!object(p) || typeof p.name !== "string") return null;
    names.push(p.name);
  }
  if (!validPlayerNames(names) || value.rounds.length !== games.length)
    return null;
  if (
    value.difficulty !== "easy" &&
    value.difficulty !== "medium" &&
    value.difficulty !== "difficult"
  )
    return null;
  let state = createChallenge(
    value.type,
    names,
    games as HeritageGameKey[],
    value.difficulty,
  );
  state = { ...state, id: value.id, createdAt: value.createdAt };
  const statuses: ChallengeStatus[] = [
    "lobby",
    "playing",
    "player_handover",
    "round_results",
    "final_results",
  ];
  if (!statuses.includes(value.status as ChallengeStatus)) return null;
  let foundIncomplete = false;
  for (let i = 0; i < value.rounds.length; i++) {
    const round = value.rounds[i];
    if (
      !object(round) ||
      round.game !== games[i] ||
      !Array.isArray(round.attempts) ||
      round.attempts.length > 4 ||
      !Number.isSafeInteger(round.replays) ||
      Number(round.replays) < 0 ||
      Number(round.replays) > 1000
    )
      return null;
    if (foundIncomplete && round.attempts.length) return null;
    if (i > 0 && !foundIncomplete) state = advanceChallenge(state);
    if (state.status === "lobby") state = startChallenge(state);
    state = {
      ...state,
      rounds: state.rounds.map((r, j) =>
        j === i ? { ...r, replays: Number(round.replays) } : r,
      ),
    };
    for (const attempt of round.attempts) {
      if (
        !object(attempt) ||
        !Array.isArray(attempt.scores) ||
        !attempt.scores.every(validScore) ||
        !Array.isArray(attempt.players)
      )
        return null;
      const turn = currentTurn(state);
      if (
        !turn ||
        turn.players.length !== attempt.scores.length ||
        turn.players.join() !== attempt.players.join()
      )
        return null;
      const winner = attempt.winner;
      if (
        winner !== null &&
        (typeof winner !== "number" || !turn.players.includes(winner))
      )
        return null;
      const scores: [number, number] = [
        attempt.scores[0] as number,
        turn.players.length === 1 ? 0 : (attempt.scores[1] as number),
      ];
      const before = state.rounds[i].attempts.length;
      state = recordChallengeResult(
        readyChallenge(state),
        {
          scores,
          winner:
            turn.players.length === 1
              ? undefined
              : winner === null
                ? null
                : (turn.players.indexOf(winner as number) as 0 | 1),
        },
        turn.id,
      );
      if (state.rounds[i].attempts.length !== before + 1) return null;
    }
    if (!state.rounds[i].placements.length) foundIncomplete = true;
  }
  // Preserve an explicitly reviewed round boundary; later empty rounds do not skip it.
  const firstIncomplete = state.rounds.findIndex((r) => !r.placements.length);
  const completeCount =
    firstIncomplete === -1 ? state.games.length : firstIncomplete;
  const boundary = value.status === "round_results" && completeCount > 0;
  state = {
    ...state,
    currentGameIndex: boundary
      ? completeCount - 1
      : Math.min(completeCount, state.games.length - 1),
    status:
      completeCount === state.games.length
        ? value.status === "final_results"
          ? "final_results"
          : "round_results"
        : boundary
          ? "round_results"
          : value.status === "lobby" &&
              completeCount === 0 &&
              !state.rounds[0].attempts.length
            ? "lobby"
            : "player_handover",
  };
  return state;
}

export function championTieRule(state: Challenge): string | null {
  const [first, second] = overallScores(state);
  if (!second || first.points !== second.points) return null;
  if (first.wins !== second.wins)
    return "Equal Challenge Points. Game wins decide the champion.";
  if (first.seconds !== second.seconds)
    return "Equal points and wins. Second places decide the champion.";
  if (Math.abs(first.performance - second.performance) >= 1e-9)
    return "Equal points and placements. Normalised performance decides the champion.";
  return "Equal results: shared champions.";
}
