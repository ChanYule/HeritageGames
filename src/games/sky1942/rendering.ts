import { PALETTE, SPR_PLAYER, SPR_ENEMY_STRAIGHT, SPR_ENEMY_ZIGZAG, SPR_ENEMY_DIVER, SPR_BOSS, SPR_POWERUP } from "./entities";
import { CONFIG } from "./config";
import type { SkyEngine } from "./engine";
export function drawSprite(ctx: CanvasRenderingContext2D, sprite: string[], x: number, y: number, size: number) {
  const left = x - sprite[0].length * size / 2, top = y - sprite.length * size / 2;
  sprite.forEach((row, ry) => [...row].forEach((ch, rx) => { const color = PALETTE[ch]; if (color) { ctx.fillStyle = color; ctx.fillRect(Math.round(left + rx * size), Math.round(top + ry * size), size, size); } }));
}
export function renderSky(ctx: CanvasRenderingContext2D, g: SkyEngine, reduced: boolean) {
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#123849"; ctx.fillRect(0, 0, 480, 720);
  const scroll = reduced ? 0 : g.elapsed * 32;
  ctx.fillStyle = "#1b4554";
  for (let i = 0; i < 36; i++) { const x = (i * 137) % 480, y = ((i * 79 + scroll) % 780) - 30; ctx.fillRect(x, y, 20 + i % 4 * 7, 2); }
  ctx.fillStyle = "#345f55"; ctx.beginPath(); const islandY = (140 + scroll * .6) % 1000 - 200; ctx.ellipse(420, islandY, 80, 110, .3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#497165"; ctx.fillRect(390, islandY - 40, 40, 80);
  ctx.fillStyle = "#a5c7cb"; ctx.globalAlpha = .12;
  for (let i = 0; i < 6; i++) { const x = i * 97 % 480, y = (i * 151 + scroll * .5) % 800 - 60; ctx.fillRect(x, y, 60, 15); ctx.fillRect(x + 10, y - 10, 30, 15); }
  ctx.globalAlpha = 1;
  if (!reduced && g.shake > 0) ctx.translate(Math.sin(g.elapsed * 90) * 2, Math.cos(g.elapsed * 80) * 2);
  for (const e of g.enemies) drawSprite(ctx, e.kind === "straight" ? SPR_ENEMY_STRAIGHT : e.kind === "zigzag" ? SPR_ENEMY_ZIGZAG : SPR_ENEMY_DIVER, e.x, e.y, 3);
  if (g.boss) { drawSprite(ctx, SPR_BOSS, g.boss.x, g.boss.y, 4); if (g.boss.flash > 0) { ctx.fillStyle = "rgba(255,240,180,.25)"; ctx.fillRect(g.boss.x - 34, g.boss.y - 20, 68, 40); } }
  for (const b of g.bullets) {
    ctx.fillStyle = b.friendly ? "#ffed96" : "#fff0d0";
    if (b.friendly) ctx.fillRect(b.x - 2, b.y - 7, 4, 12);
    else { ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#db4b39"; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
  }
  for (const pu of g.pickups) { ctx.fillStyle = "#112833"; ctx.fillRect(pu.x - 16, pu.y - 16, 32, 32); drawSprite(ctx, SPR_POWERUP[pu.kind], pu.x, pu.y, 4); }
  for (const fx of g.particles) { ctx.globalAlpha = Math.min(1, fx.life * 3); ctx.fillStyle = fx.color; ctx.fillRect(fx.x, fx.y, fx.size, fx.size); } ctx.globalAlpha = 1;
  const p = g.player;
  ctx.save(); ctx.translate(p.x, p.y);
  if (p.roll > 0 && !reduced) ctx.scale(Math.cos((CONFIG.rollDuration - p.roll) / CONFIG.rollDuration * Math.PI * 2) * .7 + .3, 1);
  if (p.invincible > 0) ctx.globalAlpha = .65;
  drawSprite(ctx, SPR_PLAYER, 0, 0, 3); ctx.restore();
  if (p.roll > 0 || p.shield > 0 || p.invincible > 0) { ctx.strokeStyle = p.roll > 0 ? "#ffe48e" : "#93ecf4"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 28, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = "#fff"; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  if (p.muzzle > 0 && !reduced) { ctx.fillStyle = "#ffe88d"; ctx.fillRect(p.x - 4, p.y - 31, 8, 5); }
  ctx.restore();
}
