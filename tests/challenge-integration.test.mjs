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
  const { default: Marbles } = await server.ssrLoadModule(
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
