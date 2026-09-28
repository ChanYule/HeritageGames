import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

async function loadRules(name) {
  const source = readFileSync(new URL(`../src/games/${name}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { advanceFiveStones: advance, newFiveStonesRound, fiveStonesTarget, fiveStonesComplete, fiveStonesRequiredIds, fiveStonesSelectionCorrect, FIVE_STONES_ATTEMPT_LIMIT, FIVE_STONES_TOSS_MS, FIVE_STONES_LEVEL_MS } = await loadRules("fiveStonesRules");
const { canSeniorKick, CHAPTEH_GROUND, CHAPTEH_GRAVITY, chaptehReturnVelocity, chaptehTimeScale } = await loadRules("chaptehRules");

test("Five Stones pickup plans demand the correct stones while allowing a wrong choice to be fixed", () => {
  let round = advance(newFiveStonesRound(true), { type: "toss" });
  assert.deepEqual(fiveStonesRequiredIds(round), [2]);
  round = advance(round, { type: "collect", id: 0 });
  assert.equal(fiveStonesSelectionCorrect(round, "medium"), false);
  assert.equal(fiveStonesSelectionCorrect(round, "easy"), true);
  assert.equal(advance(round, { type: "catch", progress: 65, level: "medium" }), round);
  round = advance(round, { type: "unselect", id: 0 });
  assert.equal(round.selected.length, 0);
  round = advance(round, { type: "collect", id: 2 });
  assert.equal(fiveStonesSelectionCorrect(round, "medium"), true);
  round = advance(round, { type: "catch", progress: 65, level: "medium" });
  assert.equal(round.successes, 1);
  assert.deepEqual(fiveStonesRequiredIds(round), [0]);
  assert.ok(FIVE_STONES_LEVEL_MS.easy > FIVE_STONES_LEVEL_MS.medium);
  assert.ok(FIVE_STONES_LEVEL_MS.medium > FIVE_STONES_LEVEL_MS.difficult);
});

test("Five Stones pickup plans stay possible through all nine catches", () => {
  let round = newFiveStonesRound();
  for (let step = 0; step < 9; step += 1) {
    round = advance(round, { type: "toss" });
    const required = fiveStonesRequiredIds(round);
    assert.equal(required.length, fiveStonesTarget(round));
    for (const id of required) round = advance(round, { type: "collect", id });
    round = advance(round, { type: "catch", progress: 60, level: "difficult" });
    assert.equal(round.successes, step + 1);
  }
  assert.equal(fiveStonesComplete(round), true);
});

test("Five Stones reshuffles solo plans but shares one fixed competition plan", () => {
  const fixed = newFiveStonesRound(true);
  assert.deepEqual(newFiveStonesRound(true).plans, fixed.plans);
  const shuffled = newFiveStonesRound(false, () => 0);
  assert.notDeepEqual(shuffled.plans, fixed.plans);
  for (const plan of shuffled.plans) assert.deepEqual([...plan].sort(), [0, 1, 2, 3]);
});

test("Chapteh near and far shots follow distinct, reachable paths on both sides", () => {
  for (const player of [0, 1]) {
    const startX = player === 0 ? 140 : 620;
    const landing = {};
    for (const aim of ["near", "far"]) {
      const velocity = chaptehReturnVelocity(startX, 410, player, aim);
      const flight = (-velocity.vy + Math.sqrt(velocity.vy ** 2 + 2 * CHAPTEH_GRAVITY * (CHAPTEH_GROUND - 85 - 410))) / CHAPTEH_GRAVITY;
      landing[aim] = startX + velocity.vx * flight;
      assert.ok(player === 0 ? landing[aim] > 380 && landing[aim] < 760 : landing[aim] > 0 && landing[aim] < 380);
      assert.ok(canSeniorKick(CHAPTEH_GROUND - 85, velocity.vy + CHAPTEH_GRAVITY * flight));
    }
    assert.ok(Math.abs(landing.near - landing.far) > 100);
  }
});

function collectTarget(round) {
  let next = round;
  for (const id of [0, 1, 2, 3].filter((id) => !round.collected.includes(id)).slice(0, fiveStonesTarget(round))) {
    next = advance(next, { type: "collect", id });
  }
  return next;
}

test("Five Stones completes all four authentic patterns in nine distinct catches", () => {
  let round = newFiveStonesRound();
  const targets = [];
  for (let count = 0; count < 9; count++) {
    targets.push(fiveStonesTarget(round));
    round = advance(round, { type: "toss", limit: FIVE_STONES_ATTEMPT_LIMIT });
    round = collectTarget(round);
    round = advance(round, { type: "catch", progress: 50 });
  }
  assert.deepEqual(targets, [1, 1, 1, 1, 2, 2, 3, 1, 4]);
  assert.equal(round.score, 16 * 120 + 9 * 100);
  assert.equal(round.successes, 9);
  assert.equal(round.throws, 9);
  assert.equal(fiveStonesComplete(round), true);
  assert.equal(advance(round, { type: "toss" }), round);
  assert.equal(advance(round, { type: "catch", progress: 50 }), round);
});

test("Five Stones ignores repeated taps, early catches, invalid IDs and excess pickups", () => {
  const initial = newFiveStonesRound();
  assert.equal(advance(initial, { type: "collect", id: 0 }), initial);
  let round = advance(initial, { type: "toss" });
  assert.equal(advance(round, { type: "toss" }), round);
  assert.equal(advance(round, { type: "collect", id: -1 }), round);
  assert.equal(advance(round, { type: "collect", id: 4 }), round);
  assert.equal(advance(round, { type: "catch", progress: 60 }), round);
  round = advance(round, { type: "collect", id: 0 });
  assert.equal(advance(round, { type: "collect", id: 0 }), round);
  assert.equal(advance(round, { type: "collect", id: 1 }), round);
  assert.equal(advance(round, { type: "catch", progress: 49.99 }), round);
  assert.equal(advance(round, { type: "catch", progress: NaN }), round);
  round = advance(round, { type: "catch", progress: 75 });
  assert.equal(round.score, 170);
  assert.equal(advance(round, { type: "catch", progress: 75 }), round);
});

test("A missed catch restores only the current pickups without losing earlier progress", () => {
  let round = advance(newFiveStonesRound(), { type: "toss" });
  round = advance(collectTarget(round), { type: "catch", progress: 60 });
  round = advance(round, { type: "toss" });
  const failed = advance(collectTarget(round), { type: "catch", progress: 100 });
  assert.deepEqual(failed.collected, [0]);
  assert.deepEqual(failed.selected, []);
  assert.equal(failed.step, 1);
  assert.equal(failed.score, 200);
  assert.equal(failed.successes, 1);
  assert.equal(failed.inAir, false);
});

test("Competition grants twelve tosses and the final toss remains playable", () => {
  let round = newFiveStonesRound();
  for (let count = 0; count < 11; count++) {
    round = advance(round, { type: "toss", limit: FIVE_STONES_ATTEMPT_LIMIT });
    round = advance(round, { type: "miss" });
  }
  round = advance(round, { type: "toss", limit: FIVE_STONES_ATTEMPT_LIMIT });
  assert.equal(round.inAir, true);
  round = advance(collectTarget(round), { type: "catch", progress: 50 });
  assert.equal(round.throws, 12);
  assert.equal(round.score, 220);
  assert.equal(advance(round, { type: "toss", limit: FIVE_STONES_ATTEMPT_LIMIT }), round);
  assert.equal(advance(round, { type: "toss" }).throws, 13);
  assert.equal(FIVE_STONES_TOSS_MS.practice, 8000);
  assert.ok(FIVE_STONES_TOSS_MS.challenge < FIVE_STONES_TOSS_MS.practice);
});

test("Chapteh only accepts a falling kick in the visible senior kick zone", () => {
  assert.equal(canSeniorKick(CHAPTEH_GROUND - 189, 1), true);
  assert.equal(canSeniorKick(CHAPTEH_GROUND - 9, 1), true);
  assert.equal(canSeniorKick(CHAPTEH_GROUND - 8, 1), false);
  assert.equal(canSeniorKick(CHAPTEH_GROUND - 191, 1), false);
  assert.equal(canSeniorKick(CHAPTEH_GROUND - 90, -1), false);
});

test("Early and late Chapteh returns reach the other player's zone without leaving court", () => {
  for (const player of [0, 1]) {
    for (const x of player === 0 ? [40, 200, 379] : [381, 560, 720]) {
      for (const y of [313, 350, 410, 493]) {
        const velocity = chaptehReturnVelocity(x, y, player);
        const flight = (-velocity.vy + Math.sqrt(velocity.vy ** 2 + 2 * CHAPTEH_GRAVITY * (CHAPTEH_GROUND - 85 - y))) / CHAPTEH_GRAVITY;
        const receivedX = x + velocity.vx * flight;
        assert.ok(Math.abs(receivedX - 760 * (player === 0 ? .73 : .27)) < 1e-8);
        assert.ok(canSeniorKick(CHAPTEH_GROUND - 85, velocity.vy + CHAPTEH_GRAVITY * flight));
        const landing = (-velocity.vy + Math.sqrt(velocity.vy ** 2 + 2 * CHAPTEH_GRAVITY * (CHAPTEH_GROUND - y))) / CHAPTEH_GRAVITY;
        assert.ok(x + velocity.vx * landing > 0 && x + velocity.vx * landing < 760);
      }
    }
  }
});

test("Gentle Chapteh pace stays fair throughout the match and gives over one second to serve", () => {
  assert.equal(chaptehTimeScale("gentle", 0), chaptehTimeScale("gentle", 5));
  const enterFrames = Math.sqrt(2 * (CHAPTEH_GROUND - 190 - 150) / CHAPTEH_GRAVITY);
  const exitFrames = Math.sqrt(2 * (CHAPTEH_GROUND - 8 - 150) / CHAPTEH_GRAVITY);
  const windowMs = (exitFrames - enterFrames) * 16.67 / chaptehTimeScale("gentle", 0, true);
  assert.ok(windowMs > 1000, `${windowMs}ms kick window`);
});
