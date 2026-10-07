import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/games/marblesPhysics.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { advanceMarbles, returnShooterToStart, MARBLES_HEIGHT: height, MARBLES_RING: ring } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const marble = (overrides = {}) => ({ id: 0, x: ring.x, y: ring.y, vx: 0, vy: 0, radius: 18, target: true, captured: false, color: "teal", ...overrides });

test("a target is banked exactly once when its whole marble crosses the ring", () => {
  const target = marble({ x: ring.x + ring.radius + 17, vx: 2 });
  const result = advanceMarbles([target]);
  assert.equal(result.captured, 1);
  assert.equal(target.captured, true);
  assert.equal(result.moving, false);
  assert.equal(advanceMarbles([target]).captured, 0);
});

test("a target touching the ring still belongs to the pile", () => {
  const target = marble({ x: ring.x + ring.radius + 18 });
  assert.equal(advanceMarbles([target]).captured, 0);
  assert.equal(target.captured, false);
});

test("both players return to the same launch with no overlap with a bottom-edge target", () => {
  const shooter = marble({ id: 100, target: false, radius: 20, x: 20, y: 20, vx: 3, vy: -5 });
  const target = marble({ y: ring.y + ring.radius + 18 });
  returnShooterToStart([target, shooter]);
  assert.equal(shooter.x, ring.x);
  assert.equal(shooter.vx, 0);
  assert.equal(shooter.vy, 0);
  assert.ok(Math.hypot(shooter.x - target.x, shooter.y - target.y) > shooter.radius + target.radius);
});

test("an aimed shot captures a target and comes to rest within a bounded time", () => {
  const shooter = marble({ id: 100, target: false, radius: 20 });
  const target = marble();
  const pile = [target, shooter];
  returnShooterToStart(pile);
  shooter.vy = -16.2 * 0.75;
  let captures = 0;
  let result;
  let steps = 0;
  do {
    result = advanceMarbles(pile);
    captures += result.captured;
    steps += 1;
  } while (result.moving && steps < 1200);
  assert.equal(captures, 1);
  assert.ok(steps < 1200, "the turn must finish instead of leaving the board rolling forever");
  assert.equal(result.moving, false);
  assert.equal(shooter.vx, 0);
  assert.equal(shooter.vy, 0);
});

test("a coincident collision separates safely without NaN or a stuck turn", () => {
  const pile = [marble(), marble({ id: 1 })];
  const result = advanceMarbles(pile);
  assert.equal(result.moving, false);
  assert.ok(pile.every((item) => Number.isFinite(item.x) && Number.isFinite(item.y)));
  assert.ok(Math.hypot(pile[0].x - pile[1].x, pile[0].y - pile[1].y) >= 36);
});

test("a missed maximum-power shot stays inside the board and settles", () => {
  const shooter = marble({ id: 100, target: false, radius: 20, x: 25, y: 25, vx: -16.2, vy: -16.2 });
  let result;
  let steps = 0;
  do {
    result = advanceMarbles([shooter]);
    assert.ok(shooter.x >= 20 && shooter.x <= 880);
    assert.ok(shooter.y >= 20 && shooter.y <= height - shooter.radius);
    steps += 1;
  } while (result.moving && steps < 1200);
  assert.equal(result.captured, 0);
  assert.equal(shooter.captured, false);
  assert.ok(steps < 1200);
});
