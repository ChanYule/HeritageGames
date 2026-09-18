import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../src/games/mechanics.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { shotVelocity, segmentsOverlap, canKick, randomMarblePositions, difficultySettings } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const p = (x, y) => ({ x, y });

test("marble power caps long drags while preserving direction", () => {
  const velocity = shotVelocity(3000, -4000);
  assert.ok(Math.abs(Math.hypot(velocity.x, velocity.y) - 16.2) < 1e-10);
  assert.ok(Math.abs(velocity.x / velocity.y + 0.75) < 1e-10);
  assert.deepEqual(shotVelocity(0, 0), p(0, 0));
  assert.deepEqual(shotVelocity(0, -100), p(0, -9));
});
test("stick blocking follows crossings, parallel contact and separated endpoints", () => {
  assert.equal(segmentsOverlap(p(0, 0), p(100, 100), p(0, 100), p(100, 0)), true);
  assert.equal(segmentsOverlap(p(0, 0), p(100, 0), p(20, 8), p(80, 8)), true);
  assert.equal(segmentsOverlap(p(0, 0), p(100, 0), p(20, 20), p(80, 20)), false);
  assert.equal(segmentsOverlap(p(0, 0), p(100, 0), p(105, 0), p(200, 0)), true);
  assert.equal(segmentsOverlap(p(0, 0), p(100, 0), p(120, 0), p(200, 0)), false);
});
test("chapteh accepts one falling kick and rejects rising or out-of-zone kicks", () => {
  assert.equal(canKick(420, 5, 502), true);
  assert.equal(canKick(420, -11.1, 502), false);
  assert.equal(canKick(200, 5, 502), false);
  assert.equal(canKick(500, 5, 502), false);
});

for (const difficulty of ["easy", "medium", "difficult"]) {
test(`${difficulty} marble rounds contain the correct number of separated targets inside the ring`, () => {
  let seed = 12345;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  let previous;
  for (let round = 0; round < 100; round++) {
    const positions = randomMarblePositions(random, difficulty);
    const settings = difficultySettings[difficulty];
    assert.equal(positions.length, settings.marbles);
    assert.notDeepEqual(positions, previous);
    for (let i = 0; i < positions.length; i++) {
      assert.ok(Math.hypot(positions[i].x, positions[i].y) + settings.marbleRadius < 175);
      for (let j = 0; j < i; j++) {
        assert.ok(Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y) > settings.marbleRadius * 2);
      }
    }
    previous = positions;
  }
});
}
