import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const { outputText } = ts.transpileModule(
  readFileSync(new URL("../src/competition.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
);
const c = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const names = (n) => Array.from({ length: n }, (_, i) => `Player ${i + 1}`);
const create = (n = 4, games = ["marbles", "tin-can-knockdown"]) =>
  c.startChallenge(c.createChallenge("quick", names(n), games));
const finish = (state, scores = [100, 0], winner) => {
  const turn = c.currentTurn(state);
  assert.ok(turn);
  return c.recordChallengeResult(
    c.readyChallenge(state),
    { scores, ...(winner === undefined ? {} : { winner }) },
    turn.id,
  );
};
const saved = (s) => c.restoreChallenge(JSON.parse(JSON.stringify(s)));

test("Quick Challenge requires two distinct selected games and 2–4 named players", () => {
  for (const n of [2, 3, 4]) {
    const s = c.createChallenge("quick", names(n), ["carom", "marbles"]);
    assert.equal(s.status, "lobby");
    assert.deepEqual(s.games, ["carom", "marbles"]);
    assert.equal(s.players.length, n);
  }
  for (const n of [1, 5]) assert.throws(() => create(n));
  for (const games of [
    ["marbles"],
    ["marbles", "marbles"],
    ["invalid", "carom"],
    c.challengeGames,
  ])
    assert.throws(() => c.createChallenge("quick", names(2), games));
  assert.throws(() =>
    c.createChallenge("quick", [" A ", "a"], ["marbles", "carom"]),
  );
  assert.throws(() =>
    c.createChallenge("quick", ["Ａ", "A"], ["marbles", "carom"]),
  );
});
test("Full Challenge contains all four games and preserves chosen order", () => {
  const s = c.createChallenge(
    "full",
    names(3),
    [...c.challengeGames].reverse(),
  );
  assert.equal(s.games.length, 4);
  assert.deepEqual(s.games, [...c.challengeGames].reverse());
  assert.throws(() =>
    c.createChallenge("full", names(3), ["carom", "marbles"]),
  );
});
for (const n of [2, 3, 4])
  test(`${n}-player placements award N down to 1 Challenge Points`, () => {
    const rows = c.calculatePlacements(
      Array.from({ length: n }, (_, i) => (n - i) * 100),
    );
    assert.deepEqual(
      rows.map((r) => r.points),
      Array.from({ length: n }, (_, i) => n - i),
    );
    assert.deepEqual(
      rows.map((r) => r.rank),
      Array.from({ length: n }, (_, i) => i + 1),
    );
  });
test("equal game results share place and points with skipped following places", () => {
  assert.deepEqual(
    c.calculatePlacements([900, 900, 800, 700]).map((r) => [r.rank, r.points]),
    [
      [1, 4],
      [1, 4],
      [3, 2],
      [4, 1],
    ],
  );
  assert.ok(
    c
      .calculatePlacements([0, 0, 0])
      .every((r) => r.rank === 1 && r.points === 3 && r.performance === 1),
  );
});
test("Ready is required before each attempt and completion cannot auto-start a player", () => {
  let s = create(3);
  const initial = c.currentTurn(s);
  assert.equal(s.status, "player_handover");
  assert.equal(c.recordChallengeResult(s, { scores: [100, 0] }, initial.id), s);
  s = finish(s);
  assert.equal(s.status, "player_handover");
  assert.deepEqual(c.currentTurn(s).players, [1]);
  const next = c.currentTurn(s);
  assert.equal(c.recordChallengeResult(s, { scores: [100, 0] }, next.id), s);
});
test("callbacks reject invalid scores, duplicate results and stale task ids", () => {
  let s = c.readyChallenge(create(2)),
    id = c.currentTurn(s).id;
  for (const scores of [
    [NaN, 0],
    [-1, 0],
    [1.5, 0],
    [Infinity, 1],
    [100],
    null,
  ])
    assert.equal(c.recordChallengeResult(s, { scores }, id), s);
  assert.equal(c.recordChallengeResult(s, { scores: [100, 0] }, "stale"), s);
  const next = c.recordChallengeResult(s, { scores: [100, 0] }, id);
  assert.equal(
    c.recordChallengeResult(c.readyChallenge(next), { scores: [999, 0] }, id)
      .rounds[0].attempts.length,
    1,
  );
});
test("every player completes one attempt before round results and manual next-game action", () => {
  let s = create(4);
  for (let i = 0; i < 4; i++) s = finish(s, [400 - i * 100, 0]);
  assert.equal(s.status, "round_results");
  assert.equal(s.currentGameIndex, 0);
  assert.equal(c.currentTurn(s), null);
  assert.deepEqual(
    s.rounds[0].placements.map((r) => r.points),
    [4, 3, 2, 1],
  );
  assert.equal(c.readyChallenge(s), s);
  s = c.advanceChallenge(s);
  assert.equal(s.currentGameIndex, 1);
  assert.equal(s.status, "player_handover");
  assert.deepEqual(c.currentTurn(s).players, [1]);
});
test("two-player Carrom uses one normal head-to-head and respects explicit game winner", () => {
  let s = create(2, ["carom", "marbles"]);
  assert.deepEqual(c.currentTurn(s).players, [0, 1]);
  s = finish(s, [400, 900], 0);
  assert.equal(s.status, "round_results");
  assert.equal(s.rounds[0].placements[0].player, 0);
  assert.equal(s.rounds[0].placements[0].points, 2);
});
test("three-player Carrom gives two duels and one first turn to everyone", () => {
  let s = create(3, ["carom", "marbles"]);
  const appearances = [0, 0, 0],
    starts = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const turn = c.currentTurn(s);
    turn.players.forEach((p) => appearances[p]++);
    starts[turn.players[0]]++;
    s = finish(s, [100, 100]);
  }
  assert.deepEqual(appearances, [2, 2, 2]);
  assert.deepEqual(starts, [1, 1, 1]);
  assert.equal(s.status, "round_results");
  assert.ok(
    s.rounds[0].placements.every((r) => r.rank === 1 && r.points === 3),
  );
});
test("four-player Carrom uses semifinal winners and remaining players, not a league", () => {
  let s = create(4, ["carom", "marbles"]);
  assert.deepEqual(c.currentTurn(s).players, [0, 1]);
  s = finish(s, [900, 400]);
  assert.deepEqual(c.currentTurn(s).players, [2, 3]);
  s = finish(s, [200, 800]);
  assert.deepEqual(c.currentTurn(s).players, [0, 3]);
  s = finish(s, [300, 900]);
  assert.deepEqual(c.currentTurn(s).players, [1, 2]);
  s = finish(s, [100, 700]);
  assert.equal(s.status, "round_results");
  assert.deepEqual(
    s.rounds[0].placements.map((r) => [r.player, r.rank, r.points]),
    [
      [3, 1, 4],
      [0, 2, 3],
      [2, 3, 2],
      [1, 4, 1],
    ],
  );
  const appearances = [0, 0, 0, 0];
  s.rounds[0].attempts.forEach((a) =>
    a.players.forEach((p) => appearances[p]++),
  );
  assert.deepEqual(appearances, [2, 2, 2, 2]);
});
test("Carrom semifinal draws replay without random advancement; final draws share first", () => {
  let s = create(4, ["carom", "marbles"]),
    id = c.currentTurn(s).id;
  s = finish(s, [100, 100]);
  assert.equal(s.rounds[0].attempts.length, 0);
  assert.equal(s.rounds[0].replays, 1);
  assert.notEqual(c.currentTurn(s).id, id);
  assert.equal(s.status, "player_handover");
  s = finish(s, [200, 100]);
  s = finish(s, [300, 100]);
  s = finish(s, [100, 100]);
  s = finish(s, [100, 100]);
  assert.deepEqual(
    s.rounds[0].placements.map((p) => p.rank),
    [1, 1, 3, 3],
  );
});
test("overall points never add incomparable raw scores and champion is stable", () => {
  let s = create(2);
  s = finish(s, [10000, 0]);
  s = finish(s, [1, 0]);
  s = c.advanceChallenge(s);
  s = finish(s, [999999, 0]);
  s = finish(s, [0, 0]);
  assert.deepEqual(
    c.overallScores(s).map((r) => r.points),
    [3, 3],
  );
  assert.equal(s.status, "round_results");
  s = c.advanceChallenge(s);
  assert.equal(s.status, "final_results");
  assert.equal(c.overallScores(s)[0].player, 1); // Rotated order: player 2 wins the second game with the better relative margin.
  assert.equal(c.advanceChallenge(s), s);
});
test("overall tie breaks use wins then second places then normalised performance", () => {
  const s = create(3);
  const result = (player, points, rank, performance) => ({
    player,
    points,
    rank,
    performance,
    rawScore: 100,
  });
  s.rounds[0].placements = [
    result(0, 3, 1, 0.5),
    result(1, 3, 2, 1),
    result(2, 2, 2, 0.8),
  ];
  s.rounds[1].placements = [
    result(0, 1, 3, 0),
    result(1, 1, 3, 0),
    result(2, 2, 2, 0.8),
  ];
  assert.deepEqual(
    c.overallScores(s).map((r) => r.player),
    [0, 2, 1],
  );
  s.rounds[0].placements = [
    result(0, 3, 1, 0.8),
    result(1, 3, 1, 0.9),
    result(2, 1, 3, 0),
  ];
  s.rounds[1].placements = [];
  assert.equal(c.overallScores(s)[0].player, 1);
});
test("meaningfully identical overall results share championship instead of using names", () => {
  let s = create(3);
  for (let g = 0; g < 2; g++) {
    for (let p = 0; p < 3; p++) s = finish(s, [100, 0]);
    s = c.advanceChallenge(s);
  }
  assert.equal(s.status, "final_results");
  assert.ok(c.overallScores(s).every((r) => r.rank === 1 && r.points === 6));
});
test("restart makes a fresh lobby with same roster, games, colours and shared level", () => {
  const original = c.createChallenge(
      "quick",
      names(4),
      ["marbles", "carom"],
      "medium",
    ),
    again = c.restartChallenge(original);
  assert.notEqual(again.id, original.id);
  assert.deepEqual(again.players, original.players);
  assert.deepEqual(again.games, original.games);
  assert.equal(again.difficulty, "medium");
  assert.equal(again.status, "lobby");
  assert.ok(again.rounds.every((r) => !r.attempts.length));
});
test("new challenge resets results and uses the newly selected roster and games", () => {
  const s = c.createChallenge("full", ["Mary", "Ahmad", "Mei"]),
    fresh = c.createChallenge("quick", ["Devi", "John"], ["carom", "marbles"]);
  assert.notEqual(s.id, fresh.id);
  assert.equal(fresh.players.length, 2);
  assert.equal(fresh.rounds.length, 2);
  assert.ok(fresh.rounds.every((r) => !r.placements.length));
});
test("refresh preserves completed results and returns only unfinished attempt to Ready", () => {
  let s = create(3);
  s = finish(s, [920, 0]);
  s = c.readyChallenge(s);
  const restored = saved(s);
  assert.ok(restored);
  assert.equal(restored.status, "player_handover");
  assert.equal(restored.rounds[0].attempts[0].scores[0], 920);
  assert.deepEqual(c.currentTurn(restored).players, [1]);
  assert.equal(c.challengeSeed(s), c.challengeSeed(restored));
});
test("saved round-results boundary and completed championship restore correctly", () => {
  let s = create(2);
  for (let g = 0; g < 2; g++) {
    for (let p = 0; p < 2; p++) s = finish(s, [100 + p, 0]);
    const r = saved(s);
    assert.equal(r.status, "round_results");
    assert.equal(r.currentGameIndex, g);
    assert.deepEqual(c.overallScores(r), c.overallScores(s));
    s = c.advanceChallenge(s);
  }
  const restored = saved(s);
  assert.equal(restored.status, "final_results");
  assert.deepEqual(c.overallScores(restored), c.overallScores(s));
});
test("bracket saves restore every semifinal, replay, final and placement boundary", () => {
  let s = create(4, ["carom", "marbles"]);
  s = finish(s, [10, 10]);
  s = saved(s);
  assert.ok(s);
  assert.equal(s.rounds[0].replays, 1);
  for (const scores of [
    [900, 400],
    [200, 800],
    [300, 900],
    [100, 700],
  ]) {
    s = finish(s, scores);
    const restored = saved(s);
    assert.ok(restored);
    assert.deepEqual(restored.rounds[0].placements, s.rounds[0].placements);
    s = restored;
  }
  assert.equal(s.status, "round_results");
});
test("storage validation rejects malformed results, unknown games and out-of-order attempts", () => {
  const s = create(2);
  assert.equal(c.restoreChallenge(null), null);
  assert.equal(c.restoreChallenge({ version: 1 }), null);
  for (const transform of [
    (x) => {
      x.players[1].name = x.players[0].name;
    },
    (x) => {
      x.games[0] = "unknown";
    },
    (x) => {
      x.status = "bad";
    },
    (x) => {
      x.rounds[1].attempts = [{ players: [0], scores: [50], winner: 0 }];
    },
  ]) {
    const data = JSON.parse(JSON.stringify(s));
    transform(data);
    assert.equal(c.restoreChallenge(data), null);
  }
  let done = finish(s, [100, 0]);
  const corrupt = JSON.parse(JSON.stringify(done));
  corrupt.rounds[0].attempts[0].scores = [Infinity];
  assert.equal(c.restoreChallenge(corrupt), null);
});
test("restoration derives cursor, points and identities instead of trusting saved totals", () => {
  let s = finish(create(2), [100, 0]);
  s.currentGameIndex = 99;
  s.players[0].colour = "red";
  s.rounds[0].placements = [{ points: 999 }];
  const r = saved(s);
  assert.ok(r);
  assert.equal(r.currentGameIndex, 0);
  assert.equal(r.players[0].colour, c.playerColours[0]);
  assert.equal(r.rounds[0].placements.length, 0);
});
test("Challenge identity colours remain stable when individual first-player order rotates", () => {
  let s = create(4);
  const identities = s.players.map((p) => [p.id, p.colour]);
  for (let i = 0; i < 4; i++) s = finish(s, [100, 0]);
  s = c.advanceChallenge(s);
  assert.deepEqual(c.currentTurn(s).players, [1]);
  assert.deepEqual(
    s.players.map((p) => [p.id, p.colour]),
    identities,
  );
});

for (const n of [2, 3, 4])
  test(`complete ${n}-player Full Challenge survives every handover and game boundary`, () => {
    let state = c.createChallenge("full", names(n));
    const original = state.players.map((p) => [p.id, p.colour]);
    state = c.startChallenge(state);
    let rounds = 0,
      attempts = 0;
    while (state.status !== "final_results") {
      if (state.status === "round_results") {
        rounds++;
        const restored = saved(state);
        assert.ok(restored);
        assert.equal(restored.currentGameIndex, state.currentGameIndex);
        state = c.advanceChallenge(restored);
        continue;
      }
      assert.equal(state.status, "player_handover");
      const before = c.currentTurn(state);
      assert.ok(before);
      state = c.readyChallenge(state);
      const afterRefresh = saved(state);
      assert.equal(afterRefresh.status, "player_handover");
      assert.deepEqual(c.currentTurn(afterRefresh).players, before.players);
      state = finish(afterRefresh, [700 + attempts, 100]);
      attempts++;
      assert.ok(attempts <= 16);
    }
    assert.equal(rounds, 4);
    assert.equal(attempts, n === 2 ? 7 : n === 3 ? 12 : 16);
    assert.deepEqual(
      state.players.map((p) => [p.id, p.colour]),
      original,
    );
    assert.ok(state.rounds.every((r) => r.placements.length === n));
    assert.ok(c.overallScores(state).some((r) => r.rank === 1));
    assert.equal(saved(state).status, "final_results");
  });
test("champion screen explanation follows the actual tie-break", () => {
  let s = create(2);
  s = finish(s, [100, 0]);
  s = finish(s, [100, 0]);
  s = c.advanceChallenge(s);
  s = finish(s, [100, 0]);
  s = finish(s, [100, 0]);
  s = c.advanceChallenge(s);
  assert.equal(c.championTieRule(s), "Equal results: shared champions.");
  s.rounds[1].placements[0].performance = 0.9;
  assert.equal(
    c.championTieRule(s),
    "Equal points and placements. Normalised performance decides the champion.",
  );
});
