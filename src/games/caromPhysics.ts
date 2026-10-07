export type Disc = { id: number; x: number; y: number; vx: number; vy: number; r: number; pocketed: boolean };
export type CaromWorld = { discs: Disc[]; pocketed: number[]; impacts: number; edges: number; elapsed: number; flashes: { x: number; y: number; life: number }[] };
export const BOARD = 600;
const MIN = 31;
const MAX = BOARD - MIN;
const POCKETS = [[MIN, MIN], [MAX, MIN], [MIN, MAX], [MAX, MAX]];
const initial = [[244, 243], [276, 243], [308, 243], [340, 243], [260, 272], [292, 272], [324, 272], [276, 301], [308, 301]];

export function createCaromWorld(): CaromWorld {
  return { discs: initial.map(([x, y], index) => ({ id: index + 1, x, y, vx: 0, vy: 0, r: 15, pocketed: false })), pocketed: [], impacts: 0, edges: 0, elapsed: 0, flashes: [] };
}

export function legalStrikerX(world: CaromWorld, desired: number): number {
  const x = Math.max(115, Math.min(485, desired));
  const choices = [x, ...Array.from({ length: 75 }, (_, i) => i % 2 ? x + (i + 1) * 5 : x - (i + 1) * 5)];
  return choices.find(candidate => candidate >= 115 && candidate <= 485 && world.discs.every(d => d.pocketed || Math.hypot(candidate - d.x, 480 - d.y) >= d.r + 21)) ?? x;
}

export function shootCarom(world: CaromWorld, x: number, vx: number, vy: number): boolean {
  if (world.discs.some(d => d.id === 0) || x < 115 || x > 485 || !Number.isFinite(vx + vy)) return false;
  if (world.discs.some(d => !d.pocketed && Math.hypot(x - d.x, 480 - d.y) < d.r + 21)) return false;
  world.discs.push({ id: 0, x, y: 480, vx, vy, r: 20, pocketed: false });
  world.pocketed = [];
  world.impacts = 0;
  world.edges = 0;
  world.elapsed = 0;
  world.flashes = [];
  return true;
}

export function stepCarom(world: CaromWorld, dt: number): void {
  const step = Math.min(dt, 1 / 30);
  const substeps = Math.max(1, Math.ceil(step / (1 / 180)));
  const h = step / substeps;
  for (let k = 0; k < substeps; k++) {
    for (const d of world.discs) {
      if (d.pocketed) continue;
      d.x += d.vx * h; d.y += d.vy * h;
      const speed = Math.hypot(d.vx, d.vy);
      const next = Math.max(0, speed - 85 * h);
      if (speed && next >= 4) { d.vx *= next / speed; d.vy *= next / speed; }
      else { d.vx = 0; d.vy = 0; }
      if (POCKETS.some(([px, py]) => Math.hypot(d.x - px, d.y - py) < 30)) {
        d.pocketed = true; d.vx = 0; d.vy = 0; world.pocketed.push(d.id);
        world.flashes.push({ x: d.x, y: d.y, life: .28 }); continue;
      }
      if (d.x - d.r < MIN) { d.x = MIN + d.r; if (d.vx < 0) { d.vx *= -.58; world.edges++; } }
      if (d.x + d.r > MAX) { d.x = MAX - d.r; if (d.vx > 0) { d.vx *= -.58; world.edges++; } }
      if (d.y - d.r < MIN) { d.y = MIN + d.r; if (d.vy < 0) { d.vy *= -.58; world.edges++; } }
      if (d.y + d.r > MAX) { d.y = MAX - d.r; if (d.vy > 0) { d.vy *= -.58; world.edges++; } }
    }
    for (let i = 0; i < world.discs.length; i++) for (let j = i + 1; j < world.discs.length; j++) {
      const a = world.discs[i], b = world.discs[j];
      if (a.pocketed || b.pocketed) continue;
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) || .001;
      const overlap = a.r + b.r - distance;
      if (overlap <= 0) continue;
      const nx = dx / distance, ny = dy / distance;
      a.x -= nx * overlap * .5; a.y -= ny * overlap * .5;
      b.x += nx * overlap * .5; b.y += ny * overlap * .5;
      const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (approach < 0) {
        const impulse = -(1 + .82) * approach / 2;
        a.vx -= impulse * nx; a.vy -= impulse * ny;
        b.vx += impulse * nx; b.vy += impulse * ny;
        if (approach < -30) { world.impacts++; world.flashes.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, life: .12 }); }
      }
    }
  }
  world.elapsed += step;
  world.flashes = world.flashes.filter(flash => (flash.life -= step) > 0);
}

export function caromSettled(world: CaromWorld): boolean {
  return world.elapsed > .4 && (world.discs.every(d => d.pocketed || Math.hypot(d.vx, d.vy) < 4) || world.elapsed > 14);
}
