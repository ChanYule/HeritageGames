import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

async function load(name) {
  const source = readFileSync(new URL(`../src/games/${name}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const carom = await load("caromPhysics");
const cans = await load("canPhysics");
const advance = (world, step, settled, max = 1600) => {
  for (let i = 0; i < max && !settled(world); i++) step(world, 1 / 60);
  assert.ok(settled(world), "shot should settle");
};

test("Carom weak and strong shots settle without escaping walls or overlapping", () => {
  const travel = [];
  for (const speed of [180, 500]) {
    const world = carom.createCaromWorld();
    assert.ok(carom.shootCarom(world, 300, 0, -speed));
    assert.equal(carom.shootCarom(world, 300, 0, -speed), false);
    advance(world, carom.stepCarom, carom.caromSettled);
    travel.push(world.discs[world.discs.length - 1].y);
    for (const disc of world.discs.filter(d => !d.pocketed)) {
      assert.ok(disc.x >= 31 + disc.r - .01 && disc.x <= 569 - disc.r + .01);
      assert.ok(disc.y >= 31 + disc.r - .01 && disc.y <= 569 - disc.r + .01);
      assert.ok(Number.isFinite(disc.x + disc.y));
    }
    for (let i = 0; i < world.discs.length; i++) for (let j = i + 1; j < world.discs.length; j++) {
      const a = world.discs[i], b = world.discs[j];
      if (!a.pocketed && !b.pocketed) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r - .1);
    }
  }
  assert.notEqual(travel[0], travel[1], "strength changes the shot path");
});

test("Carom striker placement rejects overlap and pocket events are unique", () => {
  const world = carom.createCaromWorld();
  world.discs.push({ id: 10, x: 300, y: 480, vx: 0, vy: 0, r: 15, pocketed: false });
  assert.notEqual(carom.legalStrikerX(world, 300), 300);
  assert.equal(carom.shootCarom(world, 300, 0, -300), false);
  const pocketWorld = carom.createCaromWorld();
  pocketWorld.discs = [{ id: 1, x: 58, y: 58, vx: -60, vy: -60, r: 15, pocketed: false }];
  for (let i = 0; i < 120; i++) carom.stepCarom(pocketWorld, 1 / 60);
  assert.deepEqual(pocketWorld.pocketed, [1]);
});

test("Carom edge rebounds lose speed and stopped discs stay still", () => {
  const world = carom.createCaromWorld();
  world.discs = [{ id: 1, x: 120, y: 350, vx: -420, vy: 0, r: 15, pocketed: false }];
  for (let i = 0; i < 60; i++) carom.stepCarom(world, 1 / 60);
  assert.ok(world.edges > 0);
  assert.ok(world.discs[0].x >= 46);
  assert.ok(Math.hypot(world.discs[0].vx, world.discs[0].vy) < 420);
  advance(world, carom.stepCarom, carom.caromSettled);
  const { x, y } = world.discs[0];
  for (let i = 0; i < 100; i++) carom.stepCarom(world, 1 / 60);
  assert.equal(world.discs[0].x, x);
  assert.equal(world.discs[0].y, y);
});

test("Can throws have an arc, cause distinct physical outcomes, and settle", () => {
  const miss = cans.createCanWorld();
  assert.ok(cans.throwBall(miss, -50, 200, .8));
  assert.equal(cans.throwBall(miss, 300, 315, .8), false);
  advance(miss, cans.stepCans, cans.cansSettled);
  assert.equal(miss.impacts, 0);
  assert.equal(miss.falls, 0);
  const hit = cans.createCanWorld();
  assert.ok(cans.throwBall(hit, 300, 315, 1));
  advance(hit, cans.stepCans, cans.cansSettled);
  assert.ok(hit.impacts > 0);
  assert.ok(hit.falls > 0, "a direct strong throw should topple at least one can");
  assert.ok(hit.cans.some(c => c.fallen || Math.abs(c.angle) > .1 || Math.abs(c.x - [244,300,356,272,328,300][c.id - 1]) > 3));
  for (const can of hit.cans) {
    assert.ok(Number.isFinite(can.x + can.y + can.angle));
    assert.ok(can.y <= 405);
  }
  const fallen = hit.cans.filter(c => c.fallen).length;
  assert.ok(cans.throwBall(hit, -1000, 200, .8));
  advance(hit, cans.stepCans, cans.cansSettled);
  assert.equal(hit.cans.filter(c => c.fallen).length, fallen);
});

test("Top and bottom can hits respond differently and resting cans stay on the shelf", () => {
  const top = cans.createCanWorld(), bottom = cans.createCanWorld();
  cans.throwBall(top, 300, 253, 1);
  cans.throwBall(bottom, 300, 375, 1);
  advance(top, cans.stepCans, cans.cansSettled);
  advance(bottom, cans.stepCans, cans.cansSettled);
  assert.notDeepEqual(top.cans.map(c => [Math.round(c.x), Math.round(c.angle * 10)]), bottom.cans.map(c => [Math.round(c.x), Math.round(c.angle * 10)]));
  for (const world of [top, bottom]) for (const can of world.cans) {
    const halfHeight = (60 * Math.abs(Math.cos(can.angle)) + 52 * Math.abs(Math.sin(can.angle))) / 2;
    assert.ok(can.y + halfHeight <= 405 + .1, "can stays on or above the shelf");
    assert.ok(Math.abs(can.spin) < .1, "can stops spinning");
  }
});

test("Both physics loops finish twelve consecutive turns without duplicate events", () => {
  let board = carom.createCaromWorld();
  let stack = cans.createCanWorld();
  for (let turn = 0; turn < 12; turn++) {
    const x = carom.legalStrikerX(board, 250 + turn * 8);
    assert.ok(carom.shootCarom(board, x, 20, -300));
    advance(board, carom.stepCarom, carom.caromSettled);
    assert.equal(new Set(board.pocketed).size, board.pocketed.length);
    board.discs = board.discs.filter(d => d.id !== 0);
    board.discs.forEach(d => { d.vx = 0; d.vy = 0; });
    if (board.discs.every(d => d.pocketed)) board = carom.createCaromWorld();

    const beforeFallen = stack.cans.filter(c => c.fallen).length;
    assert.ok(cans.throwBall(stack, turn % 2 ? 300 : -50, turn % 2 ? 315 : 200, .8));
    advance(stack, cans.stepCans, cans.cansSettled);
    assert.equal(stack.falls, stack.cans.filter(c => c.fallen).length - beforeFallen);
    stack.cans.forEach(c => { c.vx = 0; c.vy = 0; c.spin = 0; });
    if (stack.cans.every(c => c.fallen)) stack = cans.createCanWorld();
  }
});
