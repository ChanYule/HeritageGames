import { CONFIG as C, MODES } from "./config";
import { clamp, sweptBox } from "./collision";
import type { Alien, Input, Laser, Mode, Particle, Phase, Player, Sound } from "./types";
export const emptyInput = (): Input => ({ x: 0, fire: false, targetX: null });
export class GalaxyEngine {
  phase: Phase = "menu"; mode: Mode = "beginner";
  player!: Player; aliens: Alien[] = []; lasers: Laser[] = []; particles: Particle[] = [];
  score = 0; wave = 1; destroyed = 0; elapsed = 0;
  direction = 1; descentRemaining = 0; shotTimer = 2.8; transitionTimer = 0;
  reason: "lives" | "invasion" | null = null;
  private accumulator = 0;
  revision = 0;
  constructor(private random: () => number = Math.random, private sound: (name: Sound) => void = () => {}) { this.reset("beginner", "menu"); }
  reset(mode: Mode = this.mode, phase: Phase = "playing") {
    this.mode = mode; this.phase = phase;
    this.player = { x: 240, y: C.playerY, lives: C.lives, invincible: 0, flash: 0, muzzle: 0, cooldown: 0, lean: 0 };
    this.score = 0; this.wave = 1; this.destroyed = 0; this.elapsed = 0; this.reason = null;
    this.lasers = []; this.particles = []; this.transitionTimer = 0; this.accumulator = 0;
    this.createFormation(); this.revision++;
  }
  createFormation() {
    this.aliens = [];
    const startX = (C.width - (C.columns - 1) * C.columnGap) / 2;
    for (let row = 0; row < C.rows; row++) for (let column = 0; column < C.columns; column++) {
      const x = startX + column * C.columnGap, y = C.top + row * C.rowGap;
      this.aliens.push({ id: row * C.columns + column, column, row, kind: row < 2 ? "red" : row < 4 ? "green" : "purple", x, y, px: x, py: y, alive: true });
    }
    this.direction = 1; this.descentRemaining = 0; this.shotTimer = this.firingInterval;
  }
  get speed() { const m = MODES[this.mode], count = this.aliens.filter(a => a.alive).length; return Math.min(m.maxSpeed, m.speed + (this.wave - 1) * m.speedGrowth + m.lastAlienBoost * (1 - count / (C.rows * C.columns))); }
  get firingInterval() { const m = MODES[this.mode]; return Math.max(m.minInterval, m.shotInterval - (this.wave - 1) * m.intervalReduction); }
  get enemyBulletSpeed() { const m = MODES[this.mode]; return Math.min(m.maxBulletSpeed, m.bulletSpeed + (this.wave - 1) * m.bulletGrowth); }
  pause() { if (this.phase === "playing" || this.phase === "transition") { this.phase = "paused"; this.accumulator = 0; this.revision++; } }
  resume() { if (this.phase === "paused") { this.phase = this.transitionTimer > 0 ? "transition" : "playing"; this.accumulator = 0; this.revision++; } }
  advance(delta: number, input: Input, autoFire = false) {
    if (this.phase !== "playing" && this.phase !== "transition") { this.accumulator = 0; return; }
    this.accumulator += clamp(delta, 0, .1);
    while (this.accumulator + 1e-10 >= C.step) { this.accumulator -= C.step; this.step(C.step, input, autoFire); }
  }
  private step(dt: number, input: Input, autoFire: boolean) {
    if (this.phase !== "playing" && this.phase !== "transition") return;
    this.elapsed += dt;
    for (const fx of this.particles) { fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.life -= dt; }
    this.particles = this.particles.filter(fx => fx.life > 0);
    if (this.phase === "transition") {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) { this.wave++; this.createFormation(); this.player.invincible = 1; this.phase = "playing"; this.sound("wave"); this.revision++; }
      return;
    }
    const p = this.player, before = { x: p.x, y: p.y };
    p.invincible = Math.max(0, p.invincible - dt); p.flash = Math.max(0, p.flash - dt); p.muzzle = Math.max(0, p.muzzle - dt);
    const move = input.targetX === null ? clamp(input.x, -1, 1) * C.playerSpeed * dt : clamp(input.targetX - p.x, -C.playerSpeed * dt, C.playerSpeed * dt);
    p.lean = clamp(move / (C.playerSpeed * dt), -1, 1) * .07;
    p.x = clamp(p.x + move, C.playerHalfWidth + 4, C.width - C.playerHalfWidth - 4);
    p.cooldown -= dt;
    if ((input.fire || autoFire) && p.cooldown <= 0) { this.addLaser(p.x, p.y - 21, 0, -C.playerLaserSpeed, true); p.cooldown += C.fireCooldown; p.muzzle = .06; this.sound("shoot"); }
    if (!input.fire && !autoFire) p.cooldown = Math.max(0, p.cooldown);
    this.moveFormation(dt);
    if (this.aliens.some(a => a.alive && a.y + C.alienHalfHeight >= C.defenceLine)) { this.end("invasion"); return; }
    this.shotTimer -= dt;
    if (this.shotTimer <= 0) { this.fireEnemies(); this.shotTimer += this.firingInterval; }
    for (const b of this.lasers) { b.px = b.x; b.py = b.y; b.x += b.vx * dt; b.y += b.vy * dt; }
    // Resolve incoming hits first so a finished game cannot award later points.
    for (const b of this.lasers) {
      if (b.friendly || b.dead || p.invincible > 0) continue;
      const radius = MODES[this.mode].hitRadius;
      if (sweptBox({ x: b.px, y: b.py }, b, before, p, radius + 3, radius + 5)) { b.dead = true; this.damage(); if (p.lives <= 0) return; }
    }
    for (const b of this.lasers) {
      if (!b.friendly || b.dead || this.phase !== "playing") continue;
      // Lasers travel upwards: the closest live target must absorb the shot first.
      const candidates = this.aliens.filter(a => a.alive).sort((a, other) => other.y - a.y);
      for (const a of candidates) if (sweptBox({ x: b.px, y: b.py }, b, { x: a.px, y: a.py }, a, C.alienHalfWidth + 2, C.alienHalfHeight + 5)) { b.dead = true; this.destroyAlien(a); break; }
    }
    this.lasers = this.lasers.filter(b => !b.dead && b.y >= -20 && b.y <= C.height + 20 && b.x >= -20 && b.x <= C.width + 20);
    this.aliens = this.aliens.filter(a => a.alive);
  }
  moveFormation(dt: number) {
    const living = this.aliens.filter(a => a.alive); if (!living.length) return;
    const left = Math.min(...living.map(a => a.x)) - C.alienHalfWidth, right = Math.max(...living.map(a => a.x)) + C.alienHalfWidth;
    const desired = this.direction * this.speed * dt;
    const dx = clamp(desired, C.margin - left, C.width - C.margin - right);
    if (Math.abs(desired - dx) > 1e-8 && this.descentRemaining <= 0) { this.direction *= -1; this.descentRemaining = C.descent; }
    const dy = Math.min(this.descentRemaining, C.descentSpeed * dt); this.descentRemaining -= dy;
    for (const a of living) { a.px = a.x; a.py = a.y; a.x += dx; a.y += dy; }
  }
  bottomShooters() {
    const columns = new Map<number, Alien>();
    for (const a of this.aliens) { const bottom = columns.get(a.column); if (a.alive && (!bottom || bottom.y < a.y)) columns.set(a.column, a); }
    return [...columns.values()];
  }
  fireEnemies() {
    if (this.phase !== "playing") return;
    const shooters = this.bottomShooters(), m = MODES[this.mode];
    const slots = m.maxEnemyBullets - this.lasers.filter(b => !b.friendly && !b.dead).length;
    const burst = Math.min(slots, shooters.length, this.wave < 3 ? 1 : this.wave < 6 ? 2 : 3);
    for (let i = 0; i < burst; i++) {
      const index = Math.min(shooters.length - 1, Math.floor(this.random() * shooters.length));
      const [a] = shooters.splice(index, 1), speed = this.enemyBulletSpeed;
      const vx = this.wave >= 3 && i === 0 ? clamp((this.player.x - a.x) * .22, -55, 55) : 0;
      this.addLaser(a.x, a.y + 15, vx, speed, false);
    }
  }
  private addLaser(x: number, y: number, vx: number, vy: number, friendly: boolean) {
    if (this.lasers.length >= C.maxBullets) return;
    this.lasers.push({ x, y, px: x, py: y, vx, vy, friendly, dead: false });
  }
  destroyAlien(a: Alien) {
    if (!a.alive || this.phase !== "playing") return;
    a.alive = false; this.destroyed++; this.score += C.points[a.kind]; this.revision++;
    this.explode(a.x, a.y, a.kind === "red" ? "#ff625f" : a.kind === "green" ? "#86ed87" : "#cd8cfa"); this.sound("destroy");
    if (!this.aliens.some(alien => alien.alive)) {
      this.score += C.waveBonus; this.phase = "transition"; this.transitionTimer = C.waveTransition; this.lasers = []; this.sound("complete"); this.revision++;
    }
  }
  damage() {
    if (this.phase !== "playing" || this.player.invincible > 0) return;
    const p = this.player; p.lives--; p.invincible = C.invincibility; p.flash = .25; p.x = 240; this.revision++; this.sound("hit"); this.explode(p.x, p.y, "#54e7ef");
    if (p.lives <= 0) this.end("lives");
  }
  private end(reason: "lives" | "invasion") { if (this.phase !== "playing") return; this.phase = "gameover"; this.reason = reason; this.revision++; this.sound("gameover"); }
  private explode(x: number, y: number, color: string) {
    for (let i = 0; i < 10 && this.particles.length < C.maxParticles; i++) { const angle = this.random() * Math.PI * 2, speed = 20 + this.random() * 60; this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .4, color }); }
  }
}
