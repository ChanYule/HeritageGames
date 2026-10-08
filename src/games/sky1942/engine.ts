import { CONFIG as C, enemyScores, pickupLabels } from "./config";
import { clamp, overlaps, sweptHit } from "./collisions";
import type { Input, Phase, Player, Bullet, Enemy, Boss, Pickup, PickupKind, Particle, SoundName } from "./types";

export const emptyInput = (): Input => ({ x: 0, y: 0, fire: false, roll: false, target: null });
export class SkyEngine {
  phase: Phase = "menu";
  player!: Player;
  bullets: Bullet[] = [];
  enemies: Enemy[] = [];
  pickups: Pickup[] = [];
  particles: Particle[] = [];
  boss: Boss | null = null;
  score = 0; stage = 1; kills = 0; stageKills = 0;
  elapsed = 0; spawnTimer = .6; transitionTimer = 0;
  notice = ""; noticeTimer = 0; shake = 0;
  private formationId = 0;
  private formations = new Map<number, { remaining: number; escaped: boolean }>();
  private accumulator = 0;
  constructor(private random: () => number = Math.random, private sound: (name: SoundName) => void = () => {}) { this.reset("menu"); }
  reset(phase: Phase = "playing") {
    this.player = { x: 240, y: 600, lives: C.lives, loops: C.loops, weapon: 1, cooldown: 0, invincible: 0, roll: 0, shield: 0, muzzle: 0 };
    this.phase = phase; this.score = 0; this.stage = 1; this.kills = 0; this.stageKills = 0;
    this.bullets = []; this.enemies = []; this.pickups = []; this.particles = []; this.boss = null;
    this.elapsed = 0; this.spawnTimer = .6; this.transitionTimer = 0; this.accumulator = 0;
    this.notice = ""; this.noticeTimer = 0; this.shake = 0; this.formations.clear(); this.formationId = 0;
  }
  pause() { if (this.phase === "playing" || this.phase === "transition") { this.phase = "paused"; this.accumulator = 0; } }
  resume() { if (this.phase === "paused") { this.phase = this.transitionTimer > 0 ? "transition" : "playing"; this.accumulator = 0; } }
  advance(delta: number, input: Input, autoFire = false) {
    if (this.phase !== "playing" && this.phase !== "transition") { this.accumulator = 0; input.roll = false; return; }
    this.accumulator += clamp(delta, 0, .1);
    while (this.accumulator + 1e-10 >= C.step) { this.accumulator -= C.step; this.step(C.step, input, autoFire); }
  }
  private step(dt: number, input: Input, autoFire: boolean) {
    if (this.phase !== "playing" && this.phase !== "transition") return;
    this.elapsed += dt; this.noticeTimer = Math.max(0, this.noticeTimer - dt); this.shake = Math.max(0, this.shake - dt);
    for (const fx of this.particles) { fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.life -= dt; }
    this.particles = this.particles.filter(fx => fx.life > 0);
    if (this.phase === "transition") {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) { this.stage++; this.stageKills = 0; this.spawnTimer = 1.2; this.phase = "playing"; this.notify("STAGE {0}"); this.sound("levelUp"); }
      return;
    }
    const p = this.player, before = { x: p.x, y: p.y };
    p.invincible = Math.max(0, p.invincible - dt); p.roll = Math.max(0, p.roll - dt); p.shield = Math.max(0, p.shield - dt); p.muzzle = Math.max(0, p.muzzle - dt);
    let x = input.x, y = input.y;
    if (input.target) { x = input.target.x - p.x; y = input.target.y - p.y; const distance = Math.hypot(x, y); if (distance > 0) { const scale = Math.min(1, distance / (C.playerSpeed * dt)); x = x / distance * scale; y = y / distance * scale; } }
    const length = Math.max(1, Math.hypot(x, y)), speed = C.playerSpeed * (p.roll > 0 ? .65 : 1);
    p.x = clamp(p.x + x / length * speed * dt, 21, C.width - 21); p.y = clamp(p.y + y / length * speed * dt, 24, C.height - 24);
    if (input.roll) { input.roll = false; if (p.loops > 0 && p.roll <= 0) { p.loops--; p.roll = C.rollDuration; this.sound("loop"); } }
    p.cooldown -= dt;
    if ((input.fire || autoFire) && p.cooldown <= 0) { this.shoot(); p.cooldown += C.fireCooldown; p.muzzle = .06; this.sound("shoot"); }
    if (!input.fire && !autoFire) p.cooldown = Math.max(0, p.cooldown);
    const needed = C.baseKills + C.killsGrowth * (this.stage - 1);
    if (!this.boss) {
      this.spawnTimer -= dt;
      if (this.stageKills >= needed) { if (!this.enemies.length && this.spawnTimer <= 0) this.spawnBoss(); }
      else if (this.spawnTimer <= 0 && this.enemies.length <= C.maxEnemies - 5) { this.spawnWave(); this.spawnTimer = Math.max(C.minSpawnInterval, C.baseSpawnInterval - C.spawnIntervalReduction * (this.stage - 1)); }
    }
    for (const e of this.enemies) {
      e.px = e.x; e.py = e.y; e.time += dt;
      const base = C.enemySpeeds[e.kind] * (1 + C.speedGrowth * Math.min(12, this.stage - 1));
      e.y += base * dt * (e.kind === "diver" && e.target === null ? .7 : 1);
      if (e.kind === "zigzag") e.x = clamp(e.origin + Math.sin(e.time * 2.6) * 48, 24, 456);
      if (e.kind === "diver") { if (e.y > 90 && e.target === null) e.target = p.x; if (e.target !== null) e.x += clamp(e.target - e.x, -base * dt, base * dt); }
      e.fire -= dt;
      if (this.stage >= C.enemyFireStage && e.fire <= 0 && e.y > 10 && e.y < p.y - 130 && !e.dead) { this.aim(e.x, e.y + 15); e.fire = C.enemyFireInterval + this.random() * 1.5; }
      if (e.y > 750 && !e.dead) { e.dead = true; this.resolveFormation(e, false); }
    }
    this.updateBoss(dt);
    for (const b of this.bullets) {
      b.px = b.x; b.py = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.friendly) {
        for (const e of this.enemies) if (!e.dead && sweptHit({ x: b.px, y: b.py }, b, { x: e.px, y: e.py }, e, 18)) { b.dead = true; this.destroyEnemy(e); break; }
        const boss = this.boss;
        if (!b.dead && boss && !boss.entering && sweptHit({ x: b.px, y: b.py }, b, boss, boss, 48)) { b.dead = true; boss.hp--; boss.flash = .08; if (boss.hp <= 0) this.defeatBoss(); }
      } else if (!this.invulnerable && sweptHit({ x: b.px, y: b.py }, b, before, p, C.hitRadius + 4)) { b.dead = true; this.damage(); }
      if (b.y < -30 || b.y > 750 || b.x < -30 || b.x > 510) b.dead = true;
    }
    if (!this.invulnerable) {
      for (const e of this.enemies) if (!e.dead && sweptHit({ x: e.px, y: e.py }, e, before, p, C.hitRadius + 10)) { e.dead = true; this.resolveFormation(e, false); this.explode(e.x, e.y); this.damage(); break; }
      if (this.boss && overlaps(this.boss, p, 46)) this.damage();
    }
    for (const pickup of this.pickups) { pickup.y += 70 * dt; if (!pickup.dead && this.phase === "playing" && overlaps(pickup, p, 26)) { pickup.dead = true; this.collect(pickup.kind); } if (pickup.y > 750) pickup.dead = true; }
    this.enemies = this.enemies.filter(e => !e.dead); this.bullets = this.bullets.filter(b => !b.dead); this.pickups = this.pickups.filter(pu => !pu.dead);
  }
  get invulnerable() { return this.player.invincible > 0 || this.player.roll > 0 || this.player.shield > 0 || this.phase !== "playing"; }
  private bullet(x: number, y: number, vx: number, vy: number, friendly: boolean) { if (this.bullets.length < C.maxBullets) this.bullets.push({ x, y, px: x, py: y, vx, vy, friendly, dead: false }); }
  private shoot() {
    const p = this.player;
    if (p.weapon !== 2) this.bullet(p.x, p.y - 22, 0, -C.bulletSpeed, true);
    if (p.weapon >= 2) for (const side of [-1, 1]) this.bullet(p.x + side * (p.weapon === 2 ? 8 : 14), p.y - 22, p.weapon === 3 ? side * 90 : 0, -C.bulletSpeed, true);
  }
  private aim(x: number, y: number) { const dx = this.player.x - x, dy = this.player.y - y, length = Math.hypot(dx, dy) || 1; this.bullet(x, y, dx / length * C.enemyBulletSpeed, dy / length * C.enemyBulletSpeed, false); this.sound("enemyShoot"); }
  spawnWave() {
    const id = ++this.formationId, count = this.stage === 1 ? 3 : 5, pattern = Math.floor(this.random() * 4);
    const kind = this.stage === 1 ? "straight" : (["straight", "zigzag", "diver"] as const)[Math.floor(this.random() * 3)];
    this.formations.set(id, { remaining: count, escaped: false });
    for (let i = 0; i < count; i++) {
      const x = pattern === 3 ? (i % 2 ? 360 : 120) + Math.floor(i / 2) * 24 : 240 + (i - (count - 1) / 2) * 58;
      const y = -40 - (pattern === 0 ? Math.abs(i - (count - 1) / 2) * 35 : pattern === 1 ? i * 55 : i * 28);
      this.enemies.push({ x, y, px: x, py: y, origin: x, kind, time: 0, fire: 1.6 + this.random() * 2, target: null, dead: false, formation: id });
    }
  }
  private resolveFormation(e: Enemy, killed: boolean) {
    const group = this.formations.get(e.formation); if (!group) return;
    group.remaining--; if (!killed) group.escaped = true;
    if (group.remaining <= 0) { if (!group.escaped) { this.score += C.formationBonus; this.notify("FORMATION CLEARED +200"); } this.formations.delete(e.formation); }
  }
  destroyEnemy(e: Enemy) {
    if (e.dead) return; e.dead = true; this.kills++; this.stageKills++; this.score += enemyScores[e.kind]; this.resolveFormation(e, true); this.explode(e.x, e.y); this.sound("explosion");
    if (this.random() < C.dropChance && this.pickups.length < 10) this.pickups.push({ x: e.x, y: e.y, kind: (["gun", "shield", "life", "loop"] as const)[Math.floor(this.random() * 4)], dead: false });
  }
  spawnBoss() { const maxHp = C.bossBaseHp + this.stage * C.bossHpGrowth; this.boss = { x: 240, y: -80, hp: maxHp, maxHp, entering: true, fire: 1.2, time: 0, pattern: 0, flash: 0 }; this.notify("BOSS APPROACHING"); }
  private updateBoss(dt: number) {
    const b = this.boss; if (!b) return; b.flash = Math.max(0, b.flash - dt);
    if (b.entering) { b.y += C.bossEntranceSpeed * dt; if (b.y >= 110) { b.y = 110; b.entering = false; } return; }
    b.time += dt; b.x = 240 + Math.sin(b.time * .55) * 140; b.fire -= dt;
    if (b.fire > 0) return;
    b.fire = Math.max(C.bossMinFireInterval, C.bossBaseFireInterval - this.stage * C.bossFireIntervalReduction); b.pattern++;
    if (b.pattern % 3 === 0) this.aim(b.x, b.y + 35);
    else { const count = b.pattern % 3 === 1 ? 5 : 4; for (let i = 0; i < count; i++) { const angle = Math.PI / 2 + (i - (count - 1) / 2) * .24; const speed = C.bossBulletSpeed + Math.min(10, this.stage) * C.bossBulletSpeedGrowth; this.bullet(b.x, b.y + 35, Math.cos(angle) * speed, Math.sin(angle) * speed, false); } this.sound("enemyShoot"); }
  }
  defeatBoss() {
    if (!this.boss || this.phase !== "playing") return;
    const b = this.boss; this.boss = null; this.score += C.bossBonus; this.explode(b.x, b.y, true); this.sound("bossExplosion"); this.shake = .22;
    this.bullets = []; this.enemies = []; this.formations.clear(); this.collect("gun");
    this.phase = "transition"; this.transitionTimer = C.stageTransition; this.notify("STAGE COMPLETE +3000");
  }
  damage() {
    if (this.invulnerable) return; const p = this.player; p.lives--; p.weapon = 1; p.invincible = C.invincible; p.x = 240; p.y = 600; this.shake = .15; this.sound("hit");
    if (p.lives <= 0) { this.phase = "gameover"; this.sound("gameOver"); }
  }
  collect(kind: PickupKind) {
    const p = this.player; this.score += C.pickupScore;
    if (kind === "gun") p.weapon = Math.min(3, p.weapon + 1);
    if (kind === "shield") p.shield = C.shieldDuration;
    if (kind === "life") p.lives = Math.min(9, p.lives + 1);
    if (kind === "loop") p.loops = Math.min(5, p.loops + 1);
    this.notify(pickupLabels[kind]); this.sound("powerup");
  }
  private notify(label: string) { this.notice = label; this.noticeTimer = 2; }
  private explode(x: number, y: number, big = false) {
    for (let i = 0; i < (big ? 32 : 12) && this.particles.length < C.maxParticles; i++) { const angle = this.random() * Math.PI * 2, speed = this.random() * (big ? 150 : 85); this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .4 + this.random() * .3, color: i % 2 ? "#ffb84d" : "#f57549", size: big ? 6 : 3 }); }
  }
}
