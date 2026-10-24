import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  appType: "custom",
  esbuild: { jsx: "automatic" },
});
try {
  const { default: Marbles, createMarbles } = await server.ssrLoadModule(
    "/src/games/MarblesGame.tsx",
  );
  const { default: Sticks } = await server.ssrLoadModule(
    "/src/games/PickUpSticksGame.tsx",
  );
  const { default: Arcade } = await server.ssrLoadModule(
    "/src/games/ArcadeTargetGame.tsx",
  );
  const { setLanguage } = await server.ssrLoadModule("/src/i18n.ts");
  const { seededRandom } = await server.ssrLoadModule(
    "/src/games/mechanics.ts",
  );
  const { default: Challenge } = await server.ssrLoadModule(
    "/src/components/Competition.tsx",
  );
  for (const [name, Component, props] of [
    ["Marbles", Marbles, {}],
    ["Sticks", Sticks, {}],
    ["Carrom", Arcade, { kind: "carom" }],
    ["Tin cans", Arcade, { kind: "tin-can-knockdown" }],
  ]) {
    test(`${name} standalone keeps two players and existing gameplay controls`, () => {
      const html = renderToString(createElement(Component, props));
      assert.match(html, /Player 1/);
      assert.match(html, /Player 2/);
      assert.equal(
        (html.match(/class="player-score player-/g) ?? []).length,
        2,
      );
      assert.match(html, /button/);
      assert.match(html, /Start new match|New match/);
    });
    if (name !== "Carrom")
      test(`${name} challenge renders a single named player with live controls`, () => {
        const html = renderToString(
          createElement(Component, {
            ...props,
            competitionMode: true,
            individualAttempt: { seed: 123, shots: 6 },
            fixedDifficulty: "easy",
            playerNames: ["Mary", "Mary"],
            playerColours: ["#695098", "#695098"],
          }),
        );
        assert.equal(
          (html.match(/class="player-score player-/g) ?? []).length,
          1,
        );
        assert.match(html, /Mary/);
        assert.match(html, /#695098/);
        assert.doesNotMatch(html, /turn-ready-overlay/);
      });
  }
  test("Carrom standalone and competition show single-board rules and coin/due progress", () => {
    for (const competitionMode of [false, true]) {
      const html = renderToString(createElement(Arcade, { kind: "carom", competitionMode, carromChallenge: competitionMode }));
      assert.match(html, /How to play Carrom/);
      assert.match(html, /White: 9 coins left; 0 due/);
      assert.match(html, /Black: 9 coins left; 0 due/);
      assert.match(html, /Single board/);
      assert.match(html, /Coins pocketed/);
      assert.match(html, /Player 1, 0 coins pocketed/);
      assert.doesNotMatch(html, /shot 1 of 6|All twelve shots/);
    }
  });
  test("Carrom guide and live rule phrases have Chinese translations", () => {
    const previousDocument = globalThis.document;
    globalThis.document = { documentElement: { lang: "en" } };
    setLanguage("zh");
    try {
      const html = renderToString(createElement(Arcade, { kind: "carom" }));
      assert.doesNotMatch(html, /How to play Carrom|Single board:|coins left;|Queen available/);
    } finally {
      setLanguage("en");
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    }
  });
  test("Tin cans uses the slingshot guide and accessible aim controls in standalone and Challenge", () => {
    for (const individualAttempt of [undefined, { seed: 123, shots: 6 }]) {
      const html = renderToString(createElement(Arcade, { kind: "tin-can-knockdown", competitionMode: Boolean(individualAttempt), individualAttempt }));
      assert.match(html, /Drag the ball back/);
      assert.match(html, /sling-scene/);
      assert.match(html, /Launch angle/);
      assert.match(html, /Strength/);
      assert.match(html, /Shoot ball|is ready/);
      assert.match(html, /Balls left: 3/);
    }
  });
  test("Marbles difficulty uses balanced non-overlapping four-colour layouts and seeded attempts", () => {
    for (const [difficulty, count] of [["easy", 8], ["medium", 12], ["difficult", 16]]) {
      const marbles = createMarbles(difficulty, 123);
      const targets = marbles.filter(m => m.target);
      assert.equal(targets.length, count);
      for (const colour of ["Red", "Blue", "Yellow", "Green"]) assert.equal(targets.filter(m => m.group === colour).length, count / 4);
      for (const a of marbles) for (const b of marbles) if (a.id !== b.id) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.radius + b.radius);
      assert.deepEqual(marbles, createMarbles(difficulty, 123));
    }
  });
  test("Marbles target indicator, first-hit rules and keyboard alternative are present", () => {
    const html = renderToString(createElement(Marbles));
    assert.match(html, /Target: Red/); assert.match(html, /target colour first/);
    assert.match(html, /Shoot marble/); assert.match(html, /Space to shoot/);
    assert.match(html, /Move shooter/); assert.match(html, /aria-pressed="false"/);
  });
  test("Redesigned games show translated rules and controls without changing player names", () => {
    const previousDocument = globalThis.document;
    globalThis.document = { documentElement: { lang: "en" } };
    try {
      setLanguage("zh");
      const tin = renderToString(createElement(Arcade, { kind: "tin-can-knockdown", playerNames: ["Mary", "Ahmad"] }));
      const marble = renderToString(createElement(Marbles, { playerNames: ["Mary", "Ahmad"] }));
      assert.match(tin, /Mary/); assert.match(marble, /Ahmad/);
      assert.doesNotMatch(tin, /First Throw|Drag the ball back|Launch angle|Balls left|Three balls each/);
      assert.doesNotMatch(marble, /Target: Red|Hit the target colour first|Move shooter|Use Move shooter/);
    } finally {
      setLanguage("en");
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    }
  });
  test("seeded challenge layouts repeat fairly and standalone remains random", () => {
    const a = seededRandom(123),
      b = seededRandom(123),
      other = seededRandom(124);
    const samplesA = Array.from({ length: 20 }, a),
      samplesB = Array.from({ length: 20 }, b);
    assert.deepEqual(samplesA, samplesB);
    assert.notDeepEqual(samplesA, Array.from({ length: 20 }, other));
    const props = {
      competitionMode: true,
      individualAttempt: { seed: 123, shots: 6 },
      fixedDifficulty: "easy",
    };
    const first = renderToString(
      createElement(Sticks, { ...props, playerNames: ["Mary", "Mary"] }),
    );
    const second = renderToString(
      createElement(Sticks, { ...props, playerNames: ["Ahmad", "Ahmad"] }),
    );
    assert.deepEqual(
      first.match(/data-stick-id="[^"]+"[^>]+style="[^"]+"/g),
      second.match(/data-stick-id="[^"]+"[^>]+style="[^"]+"/g),
    );
  });
  test("Challenge opens on mode selection with Quick recommended and clear next action", () => {
    const html = renderToString(createElement(Challenge, { onExit: () => {} }));
    assert.match(html, /Heritage Games Challenge/);
    assert.match(html, /Quick Challenge/);
    assert.match(html, /Full Challenge/);
    assert.match(html, /Next: Add Players/);
    assert.doesNotMatch(html, /Match schedule|Win 3/);
  });
  test("Challenge setup and individual guidance support Chinese without renaming players", () => {
    const previousDocument = globalThis.document;
    globalThis.document = { documentElement: { lang: "en" } };
    try {
      setLanguage("zh");
      const html = renderToString(
        createElement(Challenge, { onExit: () => {} }),
      );
      assert.ok(html.includes("\u4f20\u7edf\u6e38\u620f\u6311\u6218\u8d5b"));
      assert.doesNotMatch(
        html,
        /Choose Your Challenge|Quick Challenge|Full Challenge|Next: Add Players/,
      );
      const game = renderToString(
        createElement(Marbles, {
          competitionMode: true,
          individualAttempt: { seed: 123, shots: 6 },
          fixedDifficulty: "easy",
          playerNames: ["Mary", "Mary"],
        }),
      );
      assert.match(game, /Mary/);
      assert.doesNotMatch(
        game,
        /Six shots to knock marbles out|45 seconds per shot/,
      );
    } finally {
      setLanguage("en");
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    }
  });
} finally {
  await server.close();
}
