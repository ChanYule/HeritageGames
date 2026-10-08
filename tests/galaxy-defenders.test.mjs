import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

const server = await createServer({ configFile: false, server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom", esbuild: { jsx: "automatic" } });
try {
  const { GalaxyEngine, emptyInput } = await server.ssrLoadModule("/src/games/galaxyDefenders/engine.ts");
  const { CONFIG: C, MODES } = await server.ssrLoadModule("/src/games/galaxyDefenders/config.ts");
  const { GalaxyInput } = await server.ssrLoadModule("/src/games/galaxyDefenders/input.ts");
  const { startGalaxyLoop } = await server.ssrLoadModule("/src/games/galaxyDefenders/runtime.ts");
  const { sweptBox } = await server.ssrLoadModule("/src/games/galaxyDefenders/collision.ts");
  const { GalaxyAudio } = await server.ssrLoadModule("/src/games/galaxyDefenders/audio.ts");
  const scoring = await server.ssrLoadModule("/src/games/galaxyDefenders/scoring.ts");
  const { readArcadeMute, writeArcadeMute, arcadeMuteKey } = await server.ssrLoadModule("/src/games/arcadePreferences.ts");
  const { games, arcadeGames, gameFromSearch, isHeritageGame, isArcadeGame } = await server.ssrLoadModule("/src/gameCatalog.ts");
  const { createChallenge, restoreChallenge, challengeGames } = await server.ssrLoadModule("/src/competition.ts");
  const { default: Home } = await server.ssrLoadModule("/src/components/Home.tsx");
  const { default: Galaxy } = await server.ssrLoadModule("/src/games/GalaxyDefendersGame.tsx");
  const { translate, setLanguage } = await server.ssrLoadModule("/src/i18n.ts");
  const { ALIENS, SHIP } = await server.ssrLoadModule("/src/games/galaxyDefenders/entities.ts");
  const play = (mode = "beginner", sounds = []) => { const g = new GalaxyEngine(() => .5, name => sounds.push(name)); g.reset(mode); return g; };
  const run = (g, seconds, input = emptyInput(), fps = 60, auto = false) => { for (let i = 0; i < Math.round(seconds * fps); i++) g.advance(1 / fps, input, auto); };
  const store = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };
  const laser = (x, y, vy, friendly = true) => ({ x, y, px: x, py: y, vx: 0, vy, friendly, dead: false });
  const approx = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} ≈ ${expected}`);

  test("Galaxy starts on a menu, initializes 45 spaced aliens and three lives", () => {
    const g = new GalaxyEngine(); assert.equal(g.phase, "menu"); assert.equal(g.aliens.length, 45); assert.equal(g.player.lives, 3);
    assert.deepEqual(g.aliens.filter(a => a.column === 0).map(a => a.kind), ["red", "red", "green", "green", "purple"]);
    for (const a of g.aliens) { assert.ok(a.x > 20 && a.x < 460); for (const b of g.aliens) if (a.id !== b.id) assert.ok(Math.abs(a.x - b.x) > C.alienHalfWidth * 2 || Math.abs(a.y - b.y) > C.alienHalfHeight * 2); }
  });
  test("start, pause, resume and restart preserve/freshen the correct state", () => {
    const g = play(); g.destroyAlien(g.aliens[0]); const score = g.score; g.pause(); const elapsed = g.elapsed; run(g, 10, { x: 1, fire: true, targetX: null }, 60, true); assert.equal(g.score, score); assert.equal(g.elapsed, elapsed); assert.equal(g.player.x, 240); g.resume(); run(g, .2); assert.equal(g.phase, "playing"); g.reset("classic"); assert.equal(g.score, 0); assert.equal(g.wave, 1); assert.equal(g.destroyed, 0); assert.equal(g.player.lives, 3); assert.equal(g.aliens.length, 45); assert.equal(g.mode, "classic");
  });
  test("horizontal motion is immediate, time-based and bounded at 30/60/144 Hz", () => {
    for (const fps of [30, 60, 144]) { const g = play(); run(g, .5, { ...emptyInput(), x: 1 }, fps); approx(g.player.x, 385); assert.equal(g.player.y, 650); run(g, 2, { ...emptyInput(), x: 1 }, fps); assert.equal(g.player.x, 458); run(g, 3, { ...emptyInput(), x: -1 }, fps); assert.equal(g.player.x, 22); }
  });
  test("manual continuous fire and auto fire share a fixed cooldown", () => {
    const counts = [];
    for (const fps of [30, 60, 144]) { const g = play(); run(g, .5, { ...emptyInput(), fire: true }, fps); counts.push(g.lasers.filter(b => b.friendly).length); }
    assert.deepEqual(counts, [3, 3, 3]); const g = play(); run(g, .5, emptyInput(), 60, true); assert.equal(g.lasers.length, 3); g.pause(); run(g, 2, emptyInput(), 60, true); assert.equal(g.lasers.length, 3);
    const menu = new GalaxyEngine(); run(menu, 2, emptyInput(), 60, true); assert.equal(menu.lasers.length, 0);
  });
  test("fast lasers sweep moving alien boxes and clean up after a hit", () => {
    assert.equal(sweptBox({ x: 100, y: 350 }, { x: 100, y: 100 }, { x: 110, y: 220 }, { x: 90, y: 220 }, 13, 11), true);
    const g = play(), a = g.aliens.find(a => a.row === 4 && a.column === 4); g.lasers.push(laser(a.x, a.y + 80, -24000)); g.advance(1 / 120, emptyInput()); assert.equal(a.alive, false); assert.equal(g.score, 10); assert.equal(g.destroyed, 1); assert.equal(g.lasers.length, 0);
  });
  test("alien types award configured points exactly once", () => {
    const g = play(); const aliens = [g.aliens[0], g.aliens[18], g.aliens[36]]; for (const a of aliens) { g.destroyAlien(a); g.destroyAlien(a); } assert.equal(g.score, 60); assert.equal(g.destroyed, 3);
    const dup = play(); const a = dup.aliens[40]; dup.lasers.push(laser(a.x, a.y, 0), laser(a.x, a.y, 0)); dup.advance(1 / 120, emptyInput()); assert.equal(dup.destroyed, 1);
  });
  test("offscreen projectiles are removed and active projectile/particle counts are bounded", () => {
    const g = play(); g.lasers.push(laser(10, -30, -600), laser(20, 750, 200, false)); g.advance(1 / 120, emptyInput()); assert.equal(g.lasers.length, 0);
    for (let i = 0; i < 30; i++) g.fireEnemies(); assert.ok(g.lasers.length <= MODES.beginner.maxEnemyBullets);
    for (const a of [...g.aliens]) g.destroyAlien(a); assert.ok(g.particles.length <= C.maxParticles);
  });
  test("formation moves together, reverses at a boundary and descends smoothly once", () => {
    const g = play(); const a = g.aliens[0], b = g.aliens[8], gap = b.x - a.x; run(g, 4.4); approx(b.x - a.x, gap); assert.equal(g.direction, -1); approx(a.y, C.top + C.descent); assert.ok(b.x + C.alienHalfWidth <= C.width - C.margin + 1e-7);
    const descent = a.y; run(g, 1); approx(a.y, descent);
  });
  test("formation uses living boundaries and speeds up as aliens are removed", () => {
    const g = play(), originalSpeed = g.speed; for (const a of g.aliens) if (a.column !== 4) a.alive = false;
    assert.ok(g.speed > originalSpeed); g.moveFormation(.5); assert.equal(g.direction, 1); assert.ok(g.aliens.find(a => a.alive).x < 460);
    g.wave = 10000; assert.equal(g.speed, MODES.beginner.maxSpeed); assert.equal(g.enemyBulletSpeed, MODES.beginner.maxBulletSpeed); assert.equal(g.firingInterval, MODES.beginner.minInterval);
  });
  test("only the lowest surviving alien in each column can shoot", () => {
    const g = play(); assert.ok(g.bottomShooters().every(a => a.row === 4)); g.aliens.find(a => a.row === 4 && a.column === 4).alive = false; assert.equal(g.bottomShooters().find(a => a.column === 4).row, 3); g.fireEnemies(); assert.equal(g.lasers.length, 1); const bullet = g.lasers[0]; assert.ok(g.bottomShooters().some(a => a.x === bullet.x && a.y + 15 === bullet.y)); assert.ok(bullet.vy > 0);
  });
  test("early attacks are sparse; later bursts and aimed shots respect mode caps", () => {
    const g = play(); g.fireEnemies(); assert.equal(g.lasers.length, 1); g.lasers = []; g.wave = 3; g.player.x = 22; g.fireEnemies(); assert.equal(g.lasers.length, 2); assert.ok(g.lasers.some(b => b.vx < 0)); g.lasers = []; g.wave = 6; for (let n = 0; n < 20; n++) g.fireEnemies(); assert.ok(g.lasers.length <= 4);
  });
  test("Beginner has slower formations/shots, fewer attacks and a forgiving hitbox", () => {
    const beginner = play(), classic = play("classic"); assert.ok(beginner.speed < classic.speed); assert.ok(beginner.enemyBulletSpeed < classic.enemyBulletSpeed); assert.ok(beginner.firingInterval > classic.firingInterval); assert.ok(MODES.beginner.hitRadius < MODES.classic.hitRadius); assert.equal(MODES.beginner.autoFire, true); assert.equal(MODES.classic.autoFire, false);
    for (const g of [beginner, classic]) { const initial = g.speed; g.wave = 2; assert.ok(g.speed > initial); g.wave = 1000; assert.ok(g.speed <= MODES[g.mode].maxSpeed); }
  });
  test("player hit costs one life and protection blocks repeat damage until expiry", () => {
    const g = play(); g.lasers.push(laser(240, 650, 0, false), laser(240, 650, 0, false)); g.advance(1 / 120, emptyInput()); assert.equal(g.player.lives, 2); g.damage(); assert.equal(g.player.lives, 2); g.lasers = []; run(g, 1.9); assert.equal(g.player.invincible, 0); g.damage(); assert.equal(g.player.lives, 1);
  });
  test("all lives lost ends gameplay exactly once and forbids further scoring", () => {
    const sounds = [], g = play("beginner", sounds); for (let n = 0; n < 3; n++) { g.player.invincible = 0; g.damage(); } assert.equal(g.phase, "gameover"); assert.equal(g.reason, "lives"); assert.equal(sounds.filter(s => s === "gameover").length, 1); const score = g.score, elapsed = g.elapsed; g.destroyAlien(g.aliens[0]); g.damage(); run(g, 5, emptyInput(), 60, true); assert.equal(g.score, score); assert.equal(g.elapsed, elapsed);
  });
  test("invasion of the defence line ends the game before hit scoring", () => {
    const g = play(); g.aliens[0].y = C.defenceLine - C.alienHalfHeight; g.lasers.push(laser(g.aliens[0].x, g.aliens[0].y, 0)); g.advance(1 / 120, emptyInput()); assert.equal(g.phase, "gameover"); assert.equal(g.reason, "invasion"); assert.equal(g.score, 0);
  });
  test("wave completion awards one bonus and preserves lives/score into a fresh wave", () => {
    const g = play(); g.player.lives = 2; for (const a of [...g.aliens]) g.destroyAlien(a); assert.equal(g.score, 1090); assert.equal(g.phase, "transition"); g.destroyAlien(g.aliens[0]); assert.equal(g.score, 1090); g.pause(); run(g, 3); assert.equal(g.wave, 1); g.resume(); run(g, 2.1); assert.equal(g.wave, 2); assert.equal(g.aliens.filter(a => a.alive).length, 45); assert.equal(g.player.lives, 2); assert.equal(g.score, 1090);
  });
  test("normal play can clear several complete waves without forced destruction", () => {
    for (const mode of ["beginner", "classic"]) {
    const g = play(mode); g.player.invincible = 1000;
    for (let n = 0; n < 10800 && g.wave < 4; n++) {
      const candidates = g.bottomShooters().sort((a, b) => Math.abs(a.x - g.player.x) - Math.abs(b.x - g.player.x));
      const a = candidates[0]; g.advance(1 / 60, { ...emptyInput(), targetX: a ? a.x + g.direction * g.speed * (g.player.y - a.y) / C.playerLaserSpeed : null }, true);
      if (g.phase === "gameover") break; g.player.invincible = 1000;
      assert.ok(g.lasers.length <= C.maxBullets && g.particles.length <= C.maxParticles);
    }
    assert.ok(g.wave >= 4); assert.ok(g.destroyed >= 135); assert.equal(g.score, 3270);
    }
  });
  test("keyboard and multi-pointer controls combine without stuck releases", () => {
    const input = new GalaxyInput(); input.press(1, "left"); input.press(2, "fire"); assert.equal(input.value.x, -1); assert.equal(input.value.fire, true); input.press(3, "left"); input.release(1); assert.equal(input.value.x, -1); input.release(2); assert.equal(input.value.fire, false); input.key("Space", true); input.release(3); assert.equal(input.value.x, 0); assert.equal(input.value.fire, true); input.clear(); assert.deepEqual(input.value, emptyInput());
  });
  test("relative drag never snaps on press, maps display coordinates and cleans cancellation", () => {
    const input = new GalaxyInput(), g = play(); assert.equal(input.startDrag(1, 60, 240), true); assert.equal(input.value.targetX, null); assert.equal(input.startDrag(2, 100, 240), false); input.moveDrag(1, 80, 2); assert.equal(input.value.targetX, 280); g.advance(1 / 120, input.value); assert.ok(g.player.x > 240 && g.player.x < 243); input.release(1); assert.equal(input.value.targetX, null);
  });
  test("keyboard typing guards, held-key cleanup, pause repeat guard and listener teardown", () => {
    const previous = globalThis.HTMLElement; class Element { constructor(kind) { this.kind = kind; } closest(query) { return query.includes(this.kind) ? this : null; } }
    globalThis.HTMLElement = Element;
    try {
      const handlers = new Map(), target = { addEventListener: (key, fn) => handlers.set(key, fn), removeEventListener: key => handlers.delete(key) }; let pauses = 0, blurs = 0;
      const input = new GalaxyInput(), unbind = input.bind(target, () => true, () => pauses++, () => {}, () => blurs++);
      let prevented = false; handlers.get("keydown")({ code: "Space", target: new Element("input"), preventDefault() { prevented = true; } }); assert.equal(input.value.fire, false); assert.equal(prevented, false);
      handlers.get("keydown")({ code: "KeyD", target: null, preventDefault() { prevented = true; } }); assert.equal(input.value.x, 1); assert.equal(prevented, true);
      handlers.get("keydown")({ code: "KeyP", target: null, repeat: false }); handlers.get("keydown")({ code: "KeyP", target: null, repeat: true }); assert.equal(pauses, 1);
      handlers.get("blur")(); assert.equal(blurs, 1); assert.deepEqual(input.value, emptyInput()); unbind(); assert.equal(handlers.size, 0);
    } finally { if (previous === undefined) delete globalThis.HTMLElement; else globalThis.HTMLElement = previous; }
  });
  test("one animation loop notifies score changes immediately and stops stale callbacks", () => {
    const g = play(), input = new GalaxyInput(), callbacks = new Map(); let next = 0, notifications = 0;
    const stop = startGalaxyLoop(g, input, () => false, () => {}, () => notifications++, cb => { callbacks.set(++next, cb); return next; }, id => callbacks.delete(id));
    const first = callbacks.get(1); callbacks.delete(1); first(0); g.destroyAlien(g.aliens[0]); const second = callbacks.get(2); callbacks.delete(2); second(16); assert.equal(notifications, 2); const stale = callbacks.get(3); stop(); stale(1000); assert.equal(callbacks.size, 0);
  });
  test("wave transitions clear held pointers and keyboard input before the next formation", () => {
    const g = play(), input = new GalaxyInput(); let callback;
    input.press(1, "right"); input.press(2, "fire"); input.key("KeyA", true);
    for (const a of [...g.aliens]) g.destroyAlien(a);
    const stop = startGalaxyLoop(g, input, () => false, () => {}, () => {}, cb => { callback = cb; return 1; }, () => {});
    callback(0); assert.deepEqual(input.value, emptyInput()); run(g, 2.1); assert.equal(g.wave, 2); assert.deepEqual(input.value, emptyInput()); stop();
  });
  test("scores reject corrupt/untrusted data and keep two mode rankings separate", () => {
    const s = store(), entry = { name: "<ACE>", score: 500, wave: 3, mode: "beginner" }; assert.deepEqual(scoring.validate([entry, null, { ...entry, score: -1 }, { ...entry, score: Infinity }, { ...entry, wave: 0 }, { ...entry, mode: "classic" }], "beginner"), [entry]);
    s.setItem(scoring.scoreKey("beginner"), "{broken"); assert.deepEqual(scoring.readScores(s, "beginner"), []); scoring.recordResult(s, entry); const submit = new scoring.ScoreSubmission(); assert.equal(submit.save(s, entry), true); assert.equal(scoring.readBest(s, "beginner"), 500); assert.equal(scoring.readLatest(s, "beginner").wave, 3); assert.equal(scoring.readBest(s, "classic"), 0); assert.deepEqual(scoring.readScores(s, "classic"), []);
  });
  test("top-five entries, one submission per flight and blocked storage are safe", () => {
    const s = store(), submit = new scoring.ScoreSubmission(); for (let n = 1; n <= 7; n++) { submit.reset(); const entry = { name: `ACE${n}`, score: n * 100, wave: n, mode: "classic" }; scoring.recordResult(s, entry); assert.equal(submit.save(s, entry), true); assert.equal(submit.save(s, entry), false); }
    assert.equal(scoring.readScores(s, "classic").length, 5); assert.equal(scoring.readBest(s, "classic"), 700); submit.reset(); assert.equal(submit.save(s, { name: "LOW", score: 100, wave: 1, mode: "classic" }), false);
    const blocked = { getItem() { throw Error(); }, setItem() { throw Error(); } }; assert.equal(scoring.readBest(blocked, "beginner"), 0); assert.equal(scoring.recordResult(blocked, { name: "A", score: 1, wave: 1, mode: "beginner" }), false);
  });
  test("arcade mute inherits SKY's preference and stays shared without touching competition", () => {
    const old = globalThis.localStorage, s = store(); globalThis.localStorage = s;
    try { s.setItem("sky1942_settings_v1", JSON.stringify({ muted: true })); assert.equal(readArcadeMute(), true); writeArcadeMute(false); assert.equal(readArcadeMute(), false); assert.equal(s.getItem(arcadeMuteKey), "false"); assert.equal(s.getItem("heritage-games-challenge-v2"), null); } finally { if (old === undefined) delete globalThis.localStorage; else globalThis.localStorage = old; }
    const audio = new GalaxyAudio(); audio.setMuted(true); for (const name of ["shoot", "destroy", "hit", "complete", "wave", "gameover", "record"]) audio.effect(name); assert.equal(audio.muted, true); audio.suspend(); audio.dispose();
  });
  test("Galaxy route/category integrate while both arcade games remain excluded from Challenge", () => {
    assert.equal(gameFromSearch("?game=galaxy-defenders"), "galaxy-defenders"); assert.equal(gameFromSearch("?game=sky-1942"), "sky-1942"); assert.equal(isArcadeGame("galaxy-defenders"), true); assert.equal(isHeritageGame("galaxy-defenders"), false); assert.equal(games.length, 4); assert.deepEqual(arcadeGames.map(g => g.key), ["sky-1942", "galaxy-defenders"]); assert.deepEqual(challengeGames, games.map(g => g.key));
    const challenge = createChallenge("full", ["Mary", "John"]); assert.ok(restoreChallenge(JSON.parse(JSON.stringify(challenge)))); challenge.games[0] = "galaxy-defenders"; assert.equal(restoreChallenge(challenge), null); assert.throws(() => createChallenge("quick", ["Mary", "John"], ["marbles", "galaxy-defenders"]));
  });
  test("homepage renders both arcade cards and four original game cards/artwork", () => {
    const html = renderToString(createElement(Home, { onPlay() {}, onCompetition() {} })); assert.match(html, /Galaxy Defenders/); assert.match(html, /SKY 1942/); assert.match(html, /galaxy-card-art/); for (const game of games) assert.match(html, new RegExp(`heritage-art-${game.key}`)); assert.equal((html.match(/Add to Challenge/g) ?? []).length, 4);
  });
  test("Galaxy menus/HUD and all direct phrases translate using the shared Chinese store", () => {
    const previous = globalThis.document; globalThis.document = { documentElement: { lang: "en" } }; setLanguage("zh");
    try { const html = renderToString(createElement(Galaxy, { onExit() {} })); assert.match(html, /银河守卫者/); assert.match(html, /开始游戏/); assert.doesNotMatch(html, /Choose Difficulty|Settings|High Scores|Auto Fire|Beginner Mode|Protect Earth/); } finally { setLanguage("en"); if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
    const source = readFileSync(new URL("../src/games/GalaxyDefendersGame.tsx", import.meta.url), "utf8"); for (const [, phrase] of source.matchAll(/\bt\("([^"]+)"/g)) assert.notEqual(translate("zh", phrase), phrase, phrase);
    for (const phrase of ["Beginner Mode", "Classic Mode", "The aliens reached the defence line.", "NEW HIGH SCORE", "Move left", "Move right", "WAVE COMPLETE +100"]) assert.notEqual(translate("zh", phrase), phrase);
  });
  test("original sprite families have two frames, consistent pixel rows and cyan ship", () => {
    for (const family of Object.values(ALIENS)) { assert.equal(family.length, 2); assert.notDeepEqual(family[0], family[1]); for (const frame of family) assert.ok(frame.every(row => row.length === frame[0].length)); } assert.ok(SHIP.some(row => row.includes("C")));
  });
} finally { await server.close(); }
