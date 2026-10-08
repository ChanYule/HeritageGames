import { ALIENS, PALETTE, SHIP } from "./entities";
import { CONFIG as C } from "./config";
import type { GalaxyEngine } from "./engine";
export function sprite(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number, size: number) {
  const left = x - rows[0].length * size / 2, top = y - rows.length * size / 2;
  rows.forEach((row, ry) => [...row].forEach((ch, rx) => { const color = PALETTE[ch]; if (color) { ctx.fillStyle = color; ctx.fillRect(Math.round(left + rx * size), Math.round(top + ry * size), size, size); } }));
}
export function renderGalaxy(ctx: CanvasRenderingContext2D, g: GalaxyEngine, reduced: boolean) {
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.fillStyle = "#030509"; ctx.fillRect(0, 0, C.width, C.height);
  for (let i = 0; i < 58; i++) { ctx.fillStyle = i % 3 ? "#5c6878" : "#95a0b0"; const size = i % 7 === 0 ? 2 : 1; ctx.fillRect((i * 137 + 19) % C.width, ((i * 79 + (reduced ? 0 : g.elapsed * 8)) % C.height), size, size); }
  const frame = reduced ? 0 : Math.floor(g.elapsed * 2) % 2;
  for (const a of g.aliens) if (a.alive) sprite(ctx, ALIENS[a.kind][frame], a.x, a.y, 2);
  for (const b of g.lasers) if (!b.dead) {
    ctx.fillStyle = b.friendly ? "#ff6f76" : "#ffe18b";
    if (b.friendly) ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 7, 4, 13);
    else { ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 6, 4, 12); ctx.fillRect(Math.round(b.x) - 4, Math.round(b.y) - 1, 8, 3); }
  }
  ctx.strokeStyle = "#345264"; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(12, C.defenceLine); ctx.lineTo(C.width - 12, C.defenceLine); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#769aa8"; ctx.font = "12px ui-monospace, monospace"; ctx.textAlign = "center";
  // Defence-line wording is explained outside canvas in both languages.
  for (const fx of g.particles) { ctx.globalAlpha = Math.min(1, fx.life * 3); ctx.fillStyle = fx.color; ctx.fillRect(fx.x, fx.y, 3, 3); } ctx.globalAlpha = 1;
  const p = g.player;
  if (p.invincible > 0) { ctx.strokeStyle = "#7beef4"; ctx.strokeRect(p.x - 23, p.y - 21, 46, 42); }
  if (p.flash > 0) ctx.globalAlpha = .55;
  ctx.save(); ctx.translate(p.x, p.y); if (!reduced) ctx.rotate(p.lean); sprite(ctx, SHIP, 0, 0, 2.5); ctx.restore(); ctx.globalAlpha = 1;
  if (p.muzzle > 0 && !reduced) { ctx.fillStyle = "#e7ffff"; ctx.fillRect(p.x - 3, p.y - 24, 6, 4); }
  ctx.restore();
}
