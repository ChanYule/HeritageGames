import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const server = await createServer({ configFile: false, server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom", esbuild: { jsx: "automatic" } });
try {
  const { SkyEngine, emptyInput } = await server.ssrLoadModule("/src/games/sky1942/engine.ts");
  const { SkyInput } = await server.ssrLoadModule("/src/games/sky1942/input.ts");
  const { startLoop } = await server.ssrLoadModule("/src/games/sky1942/runtime.ts");
  const { SkyAudio } = await server.ssrLoadModule("/src/games/sky1942/audio.ts");
  const scoring = await server.ssrLoadModule("/src/games/sky1942/scoring.ts");
  const { sweptHit } = await server.ssrLoadModule("/src/games/sky1942/collisions.ts");
  const { games, arcadeGames, gameFromSearch, isHeritageGame } = await server.ssrLoadModule("/src/gameCatalog.ts");
  const { challengeGames, createChallenge, restoreChallenge } = await server.ssrLoadModule("/src/competition.ts");
  const { default: Home } = await server.ssrLoadModule("/src/components/Home.tsx");
  const { default: Sky } = await server.ssrLoadModule("/src/games/Sky1942Game.tsx");
  const { setLanguage, translate } = await server.ssrLoadModule("/src/i18n.ts");
  const play = () => { const g = new SkyEngine(() => .9); g.reset(); return g; };
  const run = (g, seconds, input = emptyInput(), fps = 60, auto = false) => { for (let i = 0; i < Math.round(seconds * fps); i++) g.advance(1 / fps, input, auto); };
  const enemy = (x = 240, y = 300) => ({ x, y, px: x, py: y, origin: x, kind: "straight", time: 0, fire: 5, target: null, dead: false, formation: -1 });
  const bullet = (x, y, vy, friendly = true) => ({ x, y, px: x, py: y, vx: 0, vy, friendly, dead: false });
  const store = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

  test("SKY starts on its menu, starts with three lives/rolls, restarts cleanly", () => {
    const g = new SkyEngine(); assert.equal(g.phase, "menu"); g.reset(); assert.equal(g.phase, "playing"); assert.equal(g.player.lives, 3); assert.equal(g.player.loops, 3);
    g.collect("gun"); run(g, 2); g.reset(); assert.equal(g.score, 0); assert.equal(g.stage, 1); assert.equal(g.player.weapon, 1); assert.equal(g.enemies.length, 0);
  });
  test("normalised diagonal and analog movement remain identical across 30/60/144Hz", () => {
    for (const fps of [30, 60, 144]) {
      const g = play(); run(g, .5, { ...emptyInput(), x: 1, y: -1 }, fps); assert.ok(Math.abs(Math.hypot(g.player.x - 240, g.player.y - 600) - 110) < 1e-7);
      const analog = play(); run(analog, .5, { ...emptyInput(), x: .5 }, fps); assert.ok(Math.abs(analog.player.x - 295) < 1e-7);
    }
  });
  test("all aircraft boundaries clamp, drag target moves without snapping", () => {
    const g = play(); run(g, 10, { ...emptyInput(), x: 1, y: -1 }); assert.equal(g.player.x, 459); assert.equal(g.player.y, 24);
    run(g, 10, { ...emptyInput(), x: -1, y: 1 }); assert.equal(g.player.x, 21); assert.equal(g.player.y, 696);
    g.reset(); g.advance(1 / 120, { ...emptyInput(), target: { x: 450, y: 600 } }); assert.ok(g.player.x > 240 && g.player.x < 242);
  });
  test("pause freezes timers and score; resume handles a long delta without a jump", () => {
    const g = play(); run(g, .2); g.pause(); const elapsed = g.elapsed, position = g.player.x;
    run(g, 20, { ...emptyInput(), fire: true, x: 1 }, 60, true); assert.equal(g.elapsed, elapsed); assert.equal(g.score, 0); assert.equal(g.player.x, position);
    g.resume(); g.advance(20, { ...emptyInput(), x: 1 }); assert.ok(g.player.x - position <= 22.000001);
  });
  test("continuous fire, auto fire, cooldown and upgraded patterns obey time rather than frames", () => {
    const counts = [];
    for (const fps of [30, 60, 144]) { const g = play(); g.spawnTimer = 100; run(g, .5, { ...emptyInput(), fire: true }, fps); counts.push(g.bullets.length); }
    assert.deepEqual(counts, [4, 4, 4]);
    for (const weapon of [1, 2, 3]) { const g = play(); g.player.weapon = weapon; g.advance(1 / 120, emptyInput(), true); assert.equal(g.bullets.length, weapon); }
    const menu = new SkyEngine(); run(menu, 1, emptyInput(), 60, true); assert.equal(menu.bullets.length, 0);
  });
  test("swept collision catches fast projectiles and moving targets", () => {
    assert.equal(sweptHit({ x: 0, y: 300 }, { x: 480, y: 300 }, { x: 240, y: 310 }, { x: 240, y: 290 }, 10), true);
    const g = play(); g.enemies.push(enemy()); g.bullets.push(bullet(240, 400, -24000)); g.advance(1 / 120, emptyInput()); assert.equal(g.kills, 1); assert.equal(g.score, 50); assert.equal(g.enemies.length, 0);
  });
  test("enemy destruction scores once even when multiple bullets arrive", () => {
    const g = play(); const e = enemy(); g.enemies.push(e); g.bullets.push(bullet(240, 300, 0), bullet(240, 300, 0)); g.advance(1 / 120, emptyInput()); g.destroyEnemy(e); assert.equal(g.kills, 1); assert.equal(g.score, 50);
  });
  test("formation bonuses require every plane to be killed; escaped planes disqualify", () => {
    const g = play(); g.spawnWave(); for (const e of [...g.enemies]) g.destroyEnemy(e); assert.equal(g.score, 3 * 50 + 200);
    const missed = play(); missed.spawnWave(); missed.enemies[0].y = 751; missed.advance(1 / 120, emptyInput()); for (const e of missed.enemies) missed.destroyEnemy(e); assert.equal(missed.score, 100);
  });
  test("three readable enemy types and enemy fire unlock follow stage progression", () => {
    for (const [random, kind] of [[.1, "straight"], [.5, "zigzag"], [.9, "diver"]]) { const g = new SkyEngine(() => random); g.reset(); g.stage = 2; g.spawnWave(); assert.ok(g.enemies.every(e => e.kind === kind)); run(g, 1); assert.ok(g.enemies.every(e => Number.isFinite(e.x) && e.x >= 24 && e.x <= 456)); }
    const g = play(); const e = enemy(240, 100); e.fire = 0; g.enemies.push(e); g.advance(1 / 120, emptyInput()); assert.equal(g.bullets.length, 0); g.stage = 3; g.advance(1 / 120, emptyInput()); assert.equal(g.bullets.filter(b => !b.friendly).length, 1);
  });
  test("damage, invincibility and game over prevent repeated life loss", () => {
    const g = play(); g.bullets.push(bullet(240, 600, 0, false), bullet(240, 600, 0, false)); g.advance(1 / 120, emptyInput()); assert.equal(g.player.lives, 2); g.damage(); assert.equal(g.player.lives, 2);
    g.player.invincible = 0; g.damage(); g.player.invincible = 0; g.damage(); assert.equal(g.phase, "gameover"); g.damage(); assert.equal(g.player.lives, 0);
  });
  test("enemy-aircraft contact and boss contact damage the player fairly", () => {
    const g = play(); g.enemies.push(enemy(240, 600)); g.advance(1 / 120, emptyInput()); assert.equal(g.player.lives, 2); assert.equal(g.score, 0);
    g.player.invincible = 0; g.spawnBoss(); g.boss.y = 110; g.boss.entering = false; g.player.y = 110; g.advance(1 / 120, emptyInput()); assert.equal(g.player.lives, 1);
  });
  test("barrel roll spends one charge, protects, expires and awards no farming points", () => {
    const g = play(), input = { ...emptyInput(), roll: true }; g.advance(1 / 120, input); assert.equal(g.player.loops, 2); assert.equal(input.roll, false); g.damage(); assert.equal(g.player.lives, 3); assert.equal(g.score, 0);
    input.roll = true; g.advance(1 / 120, input); assert.equal(g.player.loops, 2); run(g, 1.2); assert.equal(g.player.roll, 0); g.player.loops = 0; input.roll = true; g.advance(1 / 120, input); assert.equal(g.player.roll, 0);
  });
  test("all powerups apply once, caps work and shield timer expires", () => {
    const g = play(); for (const kind of ["gun", "shield", "life", "loop"]) g.pickups.push({ x: 240, y: 600, kind, dead: false }); g.advance(1 / 120, emptyInput()); assert.equal(g.score, 400); assert.equal(g.player.weapon, 2); assert.equal(g.player.lives, 4); assert.equal(g.player.loops, 4); g.advance(1 / 120, emptyInput()); assert.equal(g.score, 400);
    g.damage(); assert.equal(g.player.lives, 4); run(g, 5.1); assert.equal(g.player.shield, 0); g.damage(); assert.equal(g.player.lives, 3);
    for (let i = 0; i < 20; i++) { g.collect("gun"); g.collect("loop"); g.collect("life"); } assert.equal(g.player.weapon, 3); assert.equal(g.player.loops, 5); assert.equal(g.player.lives, 9);
  });
  test("boss entrance, patterns, damage, unique defeat bonus and stage transition", () => {
    const g = play(); g.spawnBoss(); assert.equal(g.boss.hp, 58); run(g, 3.1); assert.equal(g.boss.entering, false); run(g, 3); assert.ok(g.bullets.some(b => !b.friendly));
    g.boss.hp = 1; g.bullets.push(bullet(g.boss.x, g.boss.y, 0)); g.advance(1 / 120, emptyInput()); assert.equal(g.boss, null); assert.equal(g.phase, "transition"); assert.equal(g.score, 3100); g.defeatBoss(); assert.equal(g.score, 3100);
    g.pause(); run(g, 3); assert.equal(g.stage, 1); g.resume(); run(g, 2.5); assert.equal(g.phase, "playing"); assert.equal(g.stage, 2); assert.equal(g.stageKills, 0);
  });
  test("kill threshold introduces the boss after surviving enemies leave", () => {
    const g = play(); g.stageKills = 16; run(g, 1); assert.ok(g.boss); assert.equal(g.enemies.length, 0);
  });
  test("extended gameplay keeps projectiles, particles, pickups and enemies bounded", () => {
    const g = play(); g.player.shield = 1000; run(g, 120, emptyInput(), 60, true); assert.ok(g.bullets.length <= 180); assert.ok(g.particles.length <= 100); assert.ok(g.pickups.length <= 10); assert.ok(g.enemies.length <= 36); assert.ok(Number.isFinite(g.score));
  });
  test("scripted movement and firing can clear successive bosses through eight stages", () => {
    const g = play(); g.player.shield = 1000;
    for (let n = 0; n < 14400; n++) {
      const target = g.boss && !g.boss.entering ? g.boss : g.enemies.find(e => e.y > 0 && e.y < 500);
      g.advance(1 / 60, { ...emptyInput(), target: { x: target?.x ?? 240, y: 600 } }, true);
      assert.ok(g.bullets.length <= 180 && g.enemies.length <= 36 && g.particles.length <= 100);
    }
    assert.ok(g.stage >= 8); assert.ok(g.kills > 200); assert.ok(g.score > 50000); assert.equal(g.phase, "playing");
  });
  test("leaderboard validates and migrates legacy entries; corrupted storage is safe", () => {
    assert.deepEqual(scoring.validateScores([{ name: "ACE", score: 20 }, { name: "BAD", score: -1 }, null, { name: "INF", score: Infinity }, { name: "BAD", score: 4, stage: "x" }]), [{ name: "ACE", score: 20, stage: 1 }]);
    const s = store(); s.setItem(scoring.LEADERBOARD_KEY, "{broken"); assert.deepEqual(scoring.readScores(s), []); s.setItem(scoring.BEST_KEY, "NaN"); assert.equal(scoring.readBest(s), 0);
    const blocked = { getItem() { throw Error(); }, setItem() { throw Error(); } }; assert.deepEqual(scoring.readScores(blocked), []); assert.equal(scoring.saveScore(blocked, "ACE", 100, 1), false);
  });
  test("top five, personal best, latest stage and safe text names persist separately", () => {
    const s = store(); for (let i = 1; i <= 6; i++) assert.equal(scoring.saveScore(s, "<b>ACE</b>", i * 100, i), true);
    const list = scoring.readScores(s); assert.equal(list.length, 5); assert.equal(list[0].score, 600); assert.equal(scoring.readBest(s), 600); assert.equal(scoring.readLatest(s).stage, 6); assert.equal(scoring.saveScore(s, "LOW", 50, 1), false);
    assert.equal(s.getItem("heritage-games-challenge-v2"), null);
  });
  test("keyboard roll latching, simultaneous pointer/keyboard fire and cleanup", () => {
    const i = new SkyInput(); i.key("KeyL", true); assert.equal(i.value.roll, true); i.value.roll = false; i.key("KeyL", true, true); assert.equal(i.value.roll, false); i.key("KeyL", false); i.key("KeyL", true); assert.equal(i.value.roll, true);
    i.pointerFire = true; i.joystick = { x: .5, y: -.5 }; i.key("KeyW", true); i.key("Space", false); assert.equal(i.value.fire, true); assert.equal(i.value.x, .5); i.clear(); assert.deepEqual(i.value, emptyInput());
    const handlers = new Map(); const target = { addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
    const unbind = i.bind(target, () => true, () => {}, () => {}, () => {}); assert.equal(handlers.size, 3); unbind(); assert.equal(handlers.size, 0);
  });
  test("animation owns one pending frame and stale callbacks cannot restart after cleanup", () => {
    const g = play(), i = new SkyInput(), callbacks = new Map(); let next = 0;
    const request = callback => { callbacks.set(++next, callback); return next; }, cancel = id => callbacks.delete(id);
    const stop = startLoop(g, i, () => true, () => {}, () => {}, request, cancel);
    const first = callbacks.get(1); callbacks.delete(1); first(0); assert.equal(callbacks.size, 1); const stale = callbacks.get(2); stop(); stale(1000); assert.equal(callbacks.size, 0); assert.equal(g.elapsed, 0);
  });
  test("mute before interaction creates no audio context and dispose is safe", () => {
    const a = new SkyAudio(); a.setMuted(true); a.play("shoot"); assert.equal(a.muted, true); a.suspend(); a.dispose(); a.setMuted(false); assert.equal(a.muted, false);
  });
  test("Retro Arcade retains SKY alongside Galaxy; Heritage Games and restored competition remain separate", () => {
    assert.equal(games.length, 4); assert.deepEqual(arcadeGames.map(g => g.key), ["sky-1942", "galaxy-defenders"]); assert.deepEqual(challengeGames, games.map(g => g.key)); assert.equal(isHeritageGame("sky-1942"), false); assert.equal(isHeritageGame("galaxy-defenders"), false);
    const session = createChallenge("full", ["Mary", "John"]); assert.ok(restoreChallenge(JSON.parse(JSON.stringify(session)))); session.games[0] = "sky-1942"; assert.equal(restoreChallenge(session), null);
    assert.throws(() => createChallenge("quick", ["Mary", "John"], ["marbles", "sky-1942"]));
  });
  test("arcade deep link, old game aliases and unknown game navigation resolve safely", () => {
    assert.equal(gameFromSearch("?game=sky-1942"), "sky-1942"); assert.equal(gameFromSearch("?game=five-stones"), "carom"); assert.equal(gameFromSearch("?game=chapteh"), "tin-can-knockdown"); assert.equal(gameFromSearch("?game=unknown"), null);
  });
  test("homepage renders both categories, preserved artwork and a direct arcade play action", () => {
    const html = renderToString(createElement(Home, { onPlay() {}, onCompetition() {} })); assert.match(html, /id="retro-arcade"/); assert.match(html, /SKY 1942/); assert.match(html, /Play Now/); for (const game of games) assert.match(html, new RegExp(`heritage-art-${game.key}`)); assert.equal((html.match(/Add to Challenge/g) ?? []).length, 4);
  });
  test("arcade menus use shared Chinese language with no separate preference", () => {
    const previous = globalThis.document; globalThis.document = { documentElement: { lang: "en" } }; setLanguage("zh");
    try { const html = renderToString(createElement(Sky, { onExit() {} })); assert.match(html, /开始游戏/); assert.match(html, /王牌飞行中队/); assert.doesNotMatch(html, /Start Game|High Scores|Settings|Pilot your aircraft/); }
    finally { setLanguage("en"); if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
    for (const phrase of ["How to Play", "WEAPON UPGRADED", "SHIELD ACTIVATED", "EXTRA LIFE", "BARREL ROLL +1", "PAUSED", "GAME OVER", "Auto Fire", "Return to Retro Arcade"]) assert.notEqual(translate("zh", phrase), phrase);
  });
  test("all direct arcade UI phrases have Chinese translations", () => {
    const source = readFileSync(new URL("../src/games/Sky1942Game.tsx", import.meta.url), "utf8");
    for (const [, phrase] of source.matchAll(/\bt\("([^"]+)"/g)) if (phrase !== "SKY 1942") assert.notEqual(translate("zh", phrase), phrase, phrase);
  });
  test("arcade back action and history preserve query routing and retro return anchor", () => {
    const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8"); assert.match(app, /addEventListener\("popstate"/); assert.match(app, /history\.back\(\)/); assert.match(app, /homeUrl\.hash = "retro-arcade"/); assert.match(app, /<Sky1942Game onExit=\{closeGame\}/);
  });
} finally { await server.close(); }
