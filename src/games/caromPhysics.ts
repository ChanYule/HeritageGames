export type Disc = { id: number; x: number; y: number; vx: number; vy: number; r: number; pocketed: boolean; sink?: number };
export type CaromWorld = { discs: Disc[]; pocketed: number[]; impacts: number; edges: number; elapsed: number; flashes: { x: number; y: number; life: number }[] };
export const BOARD = 600;
const MIN = 31;
const MAX = BOARD - MIN;
const POCKETS = [[MIN, MIN], [MAX, MIN], [MIN, MAX], [MAX, MAX]];


export function createCaromWorld(): CaromWorld {
  const positions = [[300, 300]];
  for (const [radius, count] of [[31, 6], [62, 12]]) for (let i = 0; i < count; i++) {
    const angle = i * Math.PI * 2 / count;
    positions.push([300 + Math.cos(angle) * radius, 300 + Math.sin(angle) * radius]);
  }
  return { discs: positions.map(([x, y], index) => ({ id: index + 1, x, y, vx: 0, vy: 0, r: 15, pocketed: false })), pocketed: [], impacts: 0, edges: 0, elapsed: 0, flashes: [] };
}

export function legalStrikerX(world: CaromWorld, desired: number): number {
  const x = Math.max(115, Math.min(485, desired));
  const choices = [x, ...Array.from({ length: 75 }, (_, i) => i % 2 ? x + (i + 1) * 5 : x - (i + 1) * 5)];
  return choices.find(candidate => candidate >= 115 && candidate <= 485 && world.discs.every(d => d.pocketed || Math.hypot(candidate - d.x, 480 - d.y) >= d.r + 21)) ?? x;
}

export function shootCarom(world: CaromWorld, x: number, vx: number, vy: number): boolean {
  if (!Number.isFinite(x + vx + vy) || world.discs.some(d => d.id === 0) || x < 115 || x > 485 || !Number.isFinite(vx + vy)) return false;
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
  if (!Number.isFinite(dt) || dt <= 0) return;
  const step = Math.min(dt, 1 / 30);
  const speed = Math.max(0, ...world.discs.map(d => Math.hypot(d.vx, d.vy)));
  const substeps = Math.max(1, Math.ceil(step / (1 / 240)), Math.ceil(speed * step / 5));
  const h = step / substeps;
  for (let k = 0; k < substeps; k++) {
    for (const d of world.discs) {
      if (d.pocketed) { d.sink = Math.max(0, (d.sink ?? 0) - h); continue; }
      d.x += d.vx * h; d.y += d.vy * h;
      const speed = Math.hypot(d.vx, d.vy);
      const next = Math.max(0, speed - 85 * h);
      if (speed && next >= 4) { d.vx *= next / speed; d.vy *= next / speed; }
      else { d.vx = 0; d.vy = 0; }
      const pocket = POCKETS.find(([px, py]) => Math.hypot(d.x - px, d.y - py) < 30);
      if (pocket) {
        d.x = pocket[0]; d.y = pocket[1]; d.sink = .28;
        d.pocketed = true; d.vx = 0; d.vy = 0; world.pocketed.push(d.id);
        world.flashes.push({ x: d.x, y: d.y, life: .28 }); continue;
      }
      if (d.x - d.r < MIN) { d.x = MIN + d.r; if (d.vx < 0) { d.vx *= -.58; world.edges++; } }
      if (d.x + d.r > MAX) { d.x = MAX - d.r; if (d.vx > 0) { d.vx *= -.58; world.edges++; } }
      if (d.y - d.r < MIN) { d.y = MIN + d.r; if (d.vy < 0) { d.vy *= -.58; world.edges++; } }
      if (d.y + d.r > MAX) { d.y = MAX - d.r; if (d.vy > 0) { d.vy *= -.58; world.edges++; } }
    }
    for (let pass = 0; pass < 4; pass++) for (let i = 0; i < world.discs.length; i++) for (let j = i + 1; j < world.discs.length; j++) {
      const a = world.discs[i], b = world.discs[j];
      if (a.pocketed || b.pocketed) continue;
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
      const overlap = a.r + b.r - distance;
      if (overlap <= 0) continue;
      const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0;
      const ia = a.id === 0 ? .55 : 1, ib = b.id === 0 ? .55 : 1;
      a.x -= nx * overlap * ia / (ia + ib); a.y -= ny * overlap * ia / (ia + ib);
      b.x += nx * overlap * ib / (ia + ib); b.y += ny * overlap * ib / (ia + ib);
      const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (approach < 0) {
        const impulse = -(1 + .82) * approach / (ia + ib);
        a.vx -= impulse * nx * ia; a.vy -= impulse * ny * ia;
        b.vx += impulse * nx * ib; b.vy += impulse * ny * ib;
        if (approach < -30) { world.impacts++; world.flashes.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, life: .12 }); }
      }
    }
  }
  for (const d of world.discs) if (!d.pocketed) {
    d.x = Math.max(MIN + d.r, Math.min(MAX - d.r, d.x));
    d.y = Math.max(MIN + d.r, Math.min(MAX - d.r, d.y));
  }
  world.elapsed += step;
  world.flashes = world.flashes.filter(flash => (flash.life -= step) > 0);
}

export function caromSettled(world: CaromWorld): boolean {
  return world.elapsed > .4 && (world.discs.every(d => d.pocketed || Math.hypot(d.vx, d.vy) < 4));
}

export const coinColour = (id: number): "queen" | "light" | "dark" => id === 1 ? "queen" : id % 2 === 0 ? "light" : "dark";
export type CaromMatch = { active: 0 | 1; queenPending: 0 | 1 | null; queenCovered: 0 | 1 | null; winner: 0 | 1 | null };
export const createCaromMatch = (): CaromMatch => ({ active: 0, queenPending: null, queenCovered: null, winner: null });
function returnCoin(world: CaromWorld, id: number) {
  const disc = world.discs.find(d => d.id === id);
  if (!disc) return;
  for (let radius = 0; radius < 220; radius += 32) for (let i = 0; i < 36; i++) {
    const x = 300 + radius * Math.cos(i * Math.PI / 18), y = 300 + radius * Math.sin(i * Math.PI / 18);
    if (world.discs.every(d => d === disc || d.pocketed || Math.hypot(d.x - x, d.y - y) >= d.r + disc.r + 1)) {
      Object.assign(disc, { x, y, vx: 0, vy: 0, pocketed: false }); return;
    }
  }
}
/** Fixed colours, one following shot to cover queen, and one returned coin for a foul. */
export function resolveCaromTurn(world: CaromWorld, match: CaromMatch) {
  const player = match.active, colour = player === 0 ? "light" : "dark";
  const own = world.pocketed.filter(id => coinColour(id) === colour && id !== 0);
  const foul = world.pocketed.includes(0);
  if (foul) {
    const penalty = own[0] ?? world.discs.find(d => d.pocketed && coinColour(d.id) === colour)?.id;
    if (penalty !== undefined) returnCoin(world, penalty);
  }
  if (world.pocketed.includes(1)) match.queenPending = player;
  if (match.queenPending === player) {
    if (own.length && !foul) { match.queenCovered = player; match.queenPending = null; }
    else if (foul || !world.pocketed.includes(1)) { returnCoin(world, 1); match.queenPending = null; }
  }
  const remaining = world.discs.filter(d => !d.pocketed && coinColour(d.id) === colour);
  if (!remaining.length) {
    if (match.queenCovered !== null && !foul) match.winner = player;
    else { const last = own[own.length - 1]; if (last !== undefined) returnCoin(world, last); }
  }
  if (foul || (!own.length && match.queenPending !== player)) match.active = player === 0 ? 1 : 0;
  return { foul, own: own.length, winner: match.winner };
}
