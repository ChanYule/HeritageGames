import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/games/arcadeRules.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { CAROM_COINS, CANS, caromShot, canThrow } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("Carom offers a makeable corner pocket for every coin", () => {
  for (const coin of CAROM_COINS) {
    const options = ["top-left", "top-right", "bottom-left", "bottom-right"].flatMap(pocket =>
      ["gentle", "steady", "strong"].filter(power => caromShot(coin.id, pocket, power)));
    assert.ok(options.length > 0, `coin ${coin.id} should have a scoring shot`);
  }
});

test("Carom coin targets stay separated on a narrow phone board", () => {
  const playfield = 244; // 280px board with an 18px border on each side.
  for (let i = 0; i < CAROM_COINS.length; i += 1) {
    for (let j = i + 1; j < CAROM_COINS.length; j += 1) {
      const a = CAROM_COINS[i];
      const b = CAROM_COINS[j];
      const gap = Math.hypot(a.x - b.x, a.y - b.y) * playfield / 100;
      assert.ok(gap >= 44, `coins ${a.id} and ${b.id} overlap touch targets`);
    }
  }
});

test("Carom strength changes a shot and invalid targets never score", () => {
  assert.equal(caromShot(1, "top-left", "gentle"), true);
  assert.equal(caromShot(1, "top-left", "strong"), false);
  assert.equal(caromShot(1, "bottom-right", "strong"), false);
  assert.equal(caromShot(999, "top-left", "steady"), false);
});

test("all five tin can lanes can hit and stronger throws reach farther", () => {
  const standing = CANS.map(can => can.id);
  for (let lane = 0; lane < 5; lane += 1) {
    assert.ok(canThrow(standing, lane, "gentle").length > 0, `lane ${lane + 1} should be useful`);
    assert.ok(canThrow(standing, lane, "strong").length >= canThrow(standing, lane, "gentle").length);
  }
});

test("fallen cans cannot score twice and invalid lanes do nothing", () => {
  const standing = CANS.map(can => can.id);
  const first = canThrow(standing, 2, "strong");
  assert.ok(first.length > 0);
  const remaining = standing.filter(id => !first.includes(id));
  assert.ok(canThrow(remaining, 2, "strong").every(id => !first.includes(id)));
  assert.deepEqual(canThrow(standing, -1, "strong"), []);
  assert.deepEqual(canThrow(standing, 5, "strong"), []);
});
