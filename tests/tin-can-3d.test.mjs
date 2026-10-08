import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../src/games/tinCan3DPhysics.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText.replace('"cannon-es"', JSON.stringify(import.meta.resolve("cannon-es")));
const game = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const settle = world => {
  for (let i = 0; i < 3600 && !game.tinWorldSettled(world); i++) game.stepTinWorld(world, 1 / 120);
  assert.ok(game.tinWorldSettled(world), "3D bodies must physically settle");
};
test("3D rack has six upright supported cylinders and does not collapse on a miss", () => {
  const world = game.createTinWorld();
  assert.equal(world.cans.length, 6);
  assert.ok(game.throwTinBall(world, 2.8, 2.8, .7)); settle(world);
  assert.equal(world.falls, 0);
  for (const can of world.cans) assert.ok(can.body.quaternion.vmult({ x: 0, y: 1, z: 0 }).y > .95);
});
test("3D ball moves into depth and transfers momentum to cans", () => {
  const world = game.createTinWorld(); game.throwTinBall(world, 0, 1.5, .8);
  const startZ = world.ball.position.z; game.stepTinWorld(world, .02); assert.ok(world.ball.position.z < startZ);
  settle(world); assert.ok(world.impacts > 0); assert.ok(world.cans.some(can => Math.abs(can.body.position.z - can.start.z) > .1));
  assert.ok(world.falls > 0); assert.ok(world.falls <= 6);
});
test("3D impacts rotate cans about depth axes and produce finite positions", () => {
  const world = game.createTinWorld(); game.throwTinBall(world, .16, 2.45, 1); settle(world);
  assert.ok(world.cans.some(can => Math.abs(can.body.quaternion.x) > .1 || Math.abs(can.body.quaternion.z) > .1));
  for (const can of world.cans) assert.ok(Object.values(can.body.position).every(Number.isFinite));
});
test("invalid and duplicate 3D launches are rejected; power changes launch speed", () => {
  const world = game.createTinWorld(); assert.equal(game.throwTinBall(world, NaN, 2, .5), false);
  assert.equal(game.throwTinBall(world, 0, 2, .5), true); assert.equal(game.throwTinBall(world, 0, 2, .5), false);
  assert.ok(Math.abs(game.launchVelocity(0, 2, 1).z) > Math.abs(game.launchVelocity(0, 2, .1).z));
});
test("3D falls score once and repeated throws settle without duplicating fallen cans", () => {
  const world = game.createTinWorld(); let total = 0;
  for (let shot = 0; shot < 6; shot++) {
    assert.ok(game.throwTinBall(world, shot % 2 ? -.3 : .3, 1.7, .8)); settle(world); total += world.falls;
  }
  assert.equal(total, world.cans.filter(can => can.fallen).length);
});
test("3D completion requires quiet cans rather than an elapsed timeout", () => {
  const world = game.createTinWorld(); world.elapsed = 30; world.quiet = 0;
  world.cans[0].body.wakeUp(); world.cans[0].body.velocity.set(1, 0, 0);
  assert.equal(game.tinWorldSettled(world), false);
});
