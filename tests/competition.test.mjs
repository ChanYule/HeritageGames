import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

let source = readFileSync(new URL("../src/competition.ts", import.meta.url), "utf8");
source = source.replace('import type { GameKey } from "./types";\n', "");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const competition = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

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
