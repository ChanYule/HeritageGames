import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

let source = readFileSync(new URL("../src/competition.ts", import.meta.url), "utf8");
source = source.replace('import type { GameKey } from "./types";\n', "");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const competition = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("four-player sessions give equal play and first turns in every selected game", () => {
  for (const game of ["marbles", "pick-up-sticks", "five-stones", "chapteh", "all"]) {
    const cup = competition.createCompetition("Four friends", ["A", "B", "C", "D"], "four", game);
    assert.equal(cup.matches.length, game === "all" ? 16 : 4);
    for (const selected of new Set(cup.matches.map(match => match.game))) {
      if (game !== "all") assert.equal(selected, game);
      const matches = cup.matches.filter(match => match.game === selected);
      assert.equal(matches.length, 4);
      assert.equal(new Set(matches.slice(0, 2).flatMap(match => match.playerIds)).size, 4);
      for (const player of cup.competitors) {
        assert.equal(matches.filter(match => match.playerIds.includes(player.id)).length, 2);
        assert.equal(matches.filter(match => match.playerIds[0] === player.id).length, 1);
        const opponents = matches.filter(match => match.playerIds.includes(player.id)).flatMap(match => match.playerIds.filter(id => id !== player.id));
        assert.equal(new Set(opponents).size, 2);
      }
    }
  }
});

test("four-player results survive reload and complete without eliminating anyone", () => {
  let cup = competition.createCompetition("Friends", ["Mary", "Ahmad", "小明", "Devi"], "four", "all");
  for (let i = 0; i < 16; i += 1) {
    const expected = cup.matches[i].id;
    cup = competition.recordMatchResult(cup, [10, 10], expected);
    assert.equal(competition.recordMatchResult(cup, [99, 0], expected), cup);
    cup = competition.restoreCompetition(JSON.parse(JSON.stringify(cup)));
    assert.ok(cup);
  }
  assert.equal(cup.status, "complete");
  assert.deepEqual(competition.competitionStandings(cup).map(player => [player.played, player.points, player.rank]), Array.from({ length: 4 }, () => [8, 8, 1]));
});

test("four-player Five Stones retains the first attempt during handover", () => {
  const cup = competition.createCompetition("Friends", ["A", "B", "C", "D"], "four", "five-stones");
  cup.draft = { matchId: cup.matches[0].id, firstSoloScore: 25 };
  const restored = competition.restoreCompetition(JSON.parse(JSON.stringify(cup)));
  assert.deepEqual(restored.draft, cup.draft);
});

test("four-player sessions reject incorrect group sizes and unknown games", () => {
  assert.throws(() => competition.createCompetition("Friends", ["A", "B"], "four"));
  assert.throws(() => competition.createCompetition("Friends", ["A", "B", "C", "D"], "four", "unknown"));
  const legacy = competition.createCompetition("Friends", ["A", "B"], "quick");
  assert.equal(competition.restoreCompetition({ ...legacy, format: "four" }), null);
});

test("two participants play each of the four heritage games", () => {
  const cup = competition.createCompetition("Friendly Cup", ["Mary", "Ahmad"], "quick");
  assert.equal(cup.matches.length, 4);
  assert.deepEqual(cup.matches.map((match) => match.game), ["marbles", "pick-up-sticks", "five-stones", "chapteh"]);
});

test("quick cups give every participant two matches", () => {
  const cup = competition.createCompetition("Community Cup", ["A", "B", "C", "D", "E"], "quick");
  const appearances = new Map(cup.competitors.map((player) => [player.id, 0]));
  cup.matches.forEach((match) => match.playerIds.forEach((id) => appearances.set(id, appearances.get(id) + 1)));
  assert.deepEqual([...appearances.values()], [2, 2, 2, 2, 2]);
});

test("schedules balance first-player duties across every supported group size", () => {
  for (const format of ["quick", "league"]) {
    for (let count = 2; count <= 8; count += 1) {
      const names = Array.from({ length: count }, (_, index) => `Player ${index + 1}`);
      const cup = competition.createCompetition("Fair Cup", names, format);
      const starts = new Map(cup.competitors.map((player) => [player.id, 0]));
      const appearances = new Map(cup.competitors.map((player) => [player.id, 0]));
      cup.matches.forEach((match) => {
        starts.set(match.playerIds[0], starts.get(match.playerIds[0]) + 1);
        match.playerIds.forEach((id) => appearances.set(id, appearances.get(id) + 1));
      });
      assert.ok(Math.max(...starts.values()) - Math.min(...starts.values()) <= 1, `${count} players in ${format}`);
      assert.equal(new Set(appearances.values()).size, 1);
      assert.equal(new Set(cup.matches.map((match) => match.id)).size, cup.matches.length);
      if (format === "league" && count > 2) {
        assert.equal(cup.matches.length, count * (count - 1) / 2);
        assert.equal(new Set(cup.matches.map((match) => [...match.playerIds].sort().join("/"))).size, cup.matches.length);
      }
    }
  }
});

test("full league schedules each pairing once", () => {
  const cup = competition.createCompetition("League", ["A", "B", "C", "D"], "league");
  assert.equal(cup.matches.length, 6);
  assert.equal(new Set(cup.matches.map((match) => [...match.playerIds].sort().join("-"))).size, 6);
});

test("standings award three points for a win and one for a draw", () => {
  let cup = competition.createCompetition("Scores", ["A", "B"], "quick");
  cup = competition.recordMatchResult(cup, [5, 2]);
  cup = competition.recordMatchResult(cup, [10, 10]);
  const standings = competition.competitionStandings(cup);
  assert.equal(standings[0].name, "A");
  assert.equal(standings[0].points, 4);
  assert.equal(standings[1].points, 1);
  assert.equal(standings[0].played, 2);
});

test("a competition completes after its final recorded match", () => {
  let cup = competition.createCompetition("Finish", ["A", "B"], "quick");
  cup.matches.forEach(() => { cup = competition.recordMatchResult(cup, [1, 0]); });
  assert.equal(cup.status, "complete");
  assert.equal(cup.matches.every((match) => match.status === "complete"), true);
});

test("standings share places instead of comparing incompatible game scores", () => {
  let cup = competition.createCompetition("Shared trophy", ["A", "B"], "quick");
  cup = competition.recordMatchResult(cup, [1, 0]); // A wins marbles.
  cup = competition.recordMatchResult(cup, [100, 0]); // B starts and wins sticks.
  const standings = competition.competitionStandings(cup);
  assert.deepEqual(standings.map((player) => [player.name, player.points, player.rank]), [["A", 3, 1], ["B", 3, 1]]);
});

test("only valid, uniquely named participants can start a competition", () => {
  for (const names of [["A"], ["A", " a "], ["A", "Ａ"], ["A", ""], ["A", "B".repeat(25)], Array(9).fill("A")]) {
    assert.equal(competition.validCompetitorNames(names), false);
    assert.throws(() => competition.createCompetition("Bad", names, "quick"));
  }
  assert.equal(competition.validCompetitorNames([" Mary ", "Ahmad"]), true);
});

test("invalid scores and stale confirmation cannot advance or overwrite a match", () => {
  const initial = competition.createCompetition("Safe scoring", ["A", "B"], "quick");
  for (const scores of [[-1, 2], [NaN, 2], [Infinity, 2], [1.5, 2], [1], [1, 2, 3], ["1", 2]]) {
    assert.equal(competition.recordMatchResult(initial, scores), initial);
  }
  const matchId = initial.matches[0].id;
  const advanced = competition.recordMatchResult(initial, [1, 0], matchId);
  assert.equal(competition.recordMatchResult(advanced, [1, 0], matchId), advanced);
  assert.equal(advanced.currentMatch, 1);
  assert.equal(initial.matches[0].status, "pending");
  let completed = advanced;
  while (completed.status === "active") completed = competition.recordMatchResult(completed, [1, 0]);
  assert.equal(competition.recordMatchResult(completed, [999, 0]), completed);
});

test("storage validation rejects malformed competitors, games, and results", () => {
  const cup = competition.createCompetition("Restore", ["A", "B"], "quick");
  const clone = () => structuredClone(cup);
  const missingPlayer = clone(); missingPlayer.matches[0].playerIds[1] = "missing";
  const selfMatch = clone(); selfMatch.matches[0].playerIds[1] = selfMatch.matches[0].playerIds[0];
  const invalidGame = clone(); invalidGame.matches[0].game = "chess";
  const invalidResult = clone(); invalidResult.matches[0].status = "complete"; invalidResult.matches[0].scores = [null, 2];
  const duplicateId = clone(); duplicateId.matches[1].id = duplicateId.matches[0].id;
  const duplicatePlayer = clone(); duplicatePlayer.competitors[1].id = duplicatePlayer.competitors[0].id;
  for (const value of [null, {}, [], "garbage", missingPlayer, selfMatch, invalidGame, invalidResult, duplicateId, duplicatePlayer]) {
    assert.equal(competition.restoreCompetition(value), null);
  }
});

test("restoring storage repairs its progress cursor and retains a Five Stones handover", () => {
  let cup = competition.createCompetition("Restore", ["A", "B"], "quick");
  cup = competition.recordMatchResult(cup, [1, 0]);
  cup = competition.recordMatchResult(cup, [1, 0]);
  cup.draft = { matchId: cup.matches[2].id, firstSoloScore: 0 };
  cup.currentMatch = 500;
  cup.status = "complete";
  const restored = competition.restoreCompetition(JSON.parse(JSON.stringify(cup)));
  assert.equal(restored.currentMatch, 2);
  assert.equal(restored.status, "active");
  assert.equal(restored.draft.firstSoloScore, 0);
  restored.draft = { matchId: restored.matches[2].id, scores: [0, 12] };
  const result = competition.restoreCompetition(JSON.parse(JSON.stringify(restored)));
  assert.deepEqual(result.draft.scores, [0, 12]);
  const confirmed = competition.recordMatchResult(result, result.draft.scores, result.draft.matchId);
  assert.equal(confirmed.draft, undefined);
  assert.deepEqual(confirmed.matches[2].scores, [0, 12]);
});

test("restoring storage ignores stale handovers and derives completed status", () => {
  let cup = competition.createCompetition("Restore", ["A", "B"], "quick");
  cup.draft = { matchId: "old-match", scores: [999, 1] };
  assert.equal(competition.restoreCompetition(cup).draft, undefined);
  while (cup.status === "active") cup = competition.recordMatchResult(cup, [0, 0]);
  cup.status = "active";
  cup.currentMatch = 0;
  const restored = competition.restoreCompetition(cup);
  assert.equal(restored.status, "complete");
  assert.equal(restored.currentMatch, 3);
  assert.equal(competition.competitionStandings(restored).every((player) => player.rank === 1), true);
});
