export type Disc = { id: number; x: number; y: number; vx: number; vy: number; r: number; pocketed: boolean; sink?: number };
export type CaromWorld = { discs: Disc[]; pocketed: number[]; impacts: number; edges: number; elapsed: number; flashes: { x: number; y: number; life: number }[] };
export const BOARD = 600;
const MIN = 31;
const MAX = BOARD - MIN;
const POCKETS = [[MIN, MIN], [MAX, MIN], [MIN, MAX], [MAX, MAX]];


export function createCaromWorld(): CaromWorld {
  const positions = [[300, 300]];
  // Two touching hexagonal rings, rather than twelve spaced coins on a circle.
  for (let ring = 1; ring <= 2; ring++) {
    const vertices = Array.from({ length: 6 }, (_, i) => [Math.cos(i * Math.PI / 3) * 31 * ring, Math.sin(i * Math.PI / 3) * 31 * ring]);
    for (let side = 0; side < 6; side++) for (let step = 0; step < ring; step++) {
      const a = vertices[side], b = vertices[(side + 1) % 6];
      positions.push([300 + a[0] + (b[0] - a[0]) * step / ring, 300 + a[1] + (b[1] - a[1]) * step / ring]);
    }
  }
  let whiteId = 2, blackId = 3;
  return { discs: positions.map(([x, y], index) => {
    const white = index <= 6 ? index % 2 === 1 : [0, 3].includes((index - 7) % 4);
    const id = index === 0 ? 1 : white ? (whiteId += 2) - 2 : (blackId += 2) - 2;
    return { id, x, y, vx: 0, vy: 0, r: 15, pocketed: false };
  }), pocketed: [], impacts: 0, edges: 0, elapsed: 0, flashes: [] };
}

export const strikerBaseline = (player: 0 | 1): number => player === 0 ? 480 : 120;

export function legalStrikerX(world: CaromWorld, desired: number, player: 0 | 1 = 0): number {
  const x = Math.max(115, Math.min(485, desired));
  const choices = [x, ...Array.from({ length: 75 }, (_, i) => i % 2 ? x + (i + 1) * 5 : x - (i + 1) * 5)];
  return choices.find(candidate => candidate >= 115 && candidate <= 485 && world.discs.every(d => d.pocketed || Math.hypot(candidate - d.x, strikerBaseline(player) - d.y) >= d.r + 21)) ?? x;
}

export function shootCarom(world: CaromWorld, x: number, vx: number, vy: number, player: 0 | 1 = 0): boolean {
  if (!Number.isFinite(x + vx + vy) || world.discs.some(d => d.id === 0) || x < 115 || x > 485 || !Number.isFinite(vx + vy)) return false;
  if (world.discs.some(d => !d.pocketed && Math.hypot(x - d.x, strikerBaseline(player) - d.y) < d.r + 21)) return false;
  world.discs.push({ id: 0, x, y: strikerBaseline(player), vx, vy, r: 20, pocketed: false });
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
export type CaromMatch = {
  active: 0 | 1;
  queenPending: 0 | 1 | null;
  queenCovered: 0 | 1 | null;
  winner: 0 | 1 | null;
  dues: [number, number];
  recoveredDue: [boolean, boolean];
  points: [number, number];
  breakComplete: boolean;
  breakAttempts: number;
};
export const createCaromMatch = (): CaromMatch => ({ active: 0, queenPending: null, queenCovered: null, winner: null, dues: [0, 0], recoveredDue: [false, false], points: [0, 0], breakComplete: false, breakAttempts: 0 });
function returnCoin(world: CaromWorld, id: number): boolean {
  const disc = world.discs.find(d => d.id === id);
  if (!disc) return false;
  // Automatic umpire placement: nearest free position; dues avoid the centre circle.
  for (let radius = id === 1 ? 0 : 31; radius <= (id === 1 ? 96 : 65); radius += 1) for (let i = 0; i < 72; i++) {
    const x = 300 + radius * Math.cos(i * Math.PI / 36), y = 300 + radius * Math.sin(i * Math.PI / 36);
    if (world.discs.every(d => d === disc || d.id === 0 || d.pocketed || Math.hypot(d.x - x, d.y - y) >= d.r + disc.r + .1)) {
      Object.assign(disc, { x, y, vx: 0, vy: 0, pocketed: false, sink: 0 }); return true;
    }
  }
  return false;
}
/** Single-board singles rules for legal digital strokes (AICF laws 72-112).
 * Physical referee fouls, discretionary claims and tournament time limits are omitted.
 */
export function resolveCaromTurn(world: CaromWorld, match: CaromMatch) {
  const player = match.active, opponent = (1 - player) as 0 | 1;
  const colour = player === 0 ? "light" : "dark";
  const own = world.pocketed.filter(id => id !== 0 && coinColour(id) === colour);
  const foul = world.pocketed.includes(0), queen = world.pocketed.includes(1);
  const count = (side: 0 | 1) => world.discs.filter(d => d.id !== 0 && coinColour(d.id) === (side === 0 ? "light" : "dark") && !d.pocketed).length;
  const beforePocketed = 9 - count(player) - own.length;
  const dueBefore = match.dues[player];
  const pendingBefore = match.queenPending === player;
  let message = own.length ? "Own coin pocketed. Play again." : "No own coin pocketed. Pass the turn.";
  const finish = (winner: 0 | 1, points: number, reason: string) => {
    match.winner = winner; match.points[winner] = Math.min(12, Math.max(1, points));
    return { foul, own: own.length, winner, message: reason };
  };
  if (match.winner !== null) return { foul, own: 0, winner: match.winner, message: "Board complete." };

  if (!match.breakComplete) {
    if (world.impacts > 0 || beforePocketed > 0 || world.pocketed.some(id => id !== 0)) match.breakComplete = true;
    else {
      match.breakAttempts++;
      if (foul || match.breakAttempts >= 3) match.active = opponent;
      return { foul, own: 0, winner: null, message: match.active === player ? "Break missed. Try again (up to three attempts)." : "Break missed. Pass the turn; no striker due before the break." };
    }
  }

  // End-of-board exceptions are assessed before returning striker dues.
  if (!count(opponent) && !count(player) && foul) {
    return finish(opponent, (match.queenCovered === player ? 1 : 3), "Striker pocketed with both last coins. Board lost.");
  }
  if (!count(player) && !queen && !pendingBefore && match.queenCovered === null) {
    return finish(opponent, 3, "Last own coin pocketed before the queen. Board lost.");
  }
  if (!count(opponent) && (count(player) > 0 || foul)) {
    return finish(opponent, count(player) + (match.queenCovered === player ? 0 : 3), "Opponent's last coin pocketed. Board lost.");
  }

  if (foul) {
    // Proper stroke with own coins + striker: return every own coin AND a due; retain turn.
    for (const id of own) if (!returnCoin(world, id)) match.dues[player]++;
    match.dues[player]++;
    message = own.length ? "Striker pocketed: own coins returned plus one due. Play again." : "Striker pocketed: one own coin due. Pass the turn.";
  }
  // Dues accrue even before any own coin is available; pay them as soon as possible.
  for (const side of [0, 1] as const) {
    for (const d of world.discs) {
      if (!match.dues[side]) break;
      if (d.id !== 0 && d.pocketed && coinColour(d.id) === (side === 0 ? "light" : "dark") && returnCoin(world, d.id)) {
        match.dues[side]--; match.recoveredDue[side] = true;
      }
    }
  }
  let continueTurn = own.length > 0;
  if (queen) {
    if (foul || dueBefore > 0 || (!beforePocketed && !own.length && !match.recoveredDue[player])) {
      returnCoin(world, 1); match.queenPending = null;
      message = foul ? message : "Queen returned: pocket an own coin and clear dues first.";
      continueTurn = foul ? (own.length > 0 || beforePocketed > 0) : false;
      if (foul && continueTurn && !own.length) message = "Queen returned; one own coin due. Play again.";
    } else if (own.length >= (beforePocketed > 0 ? 1 : 2)) {
      match.queenCovered = player; match.queenPending = null;
      message = "Queen covered. Play again."; continueTurn = true;
    } else {
      match.queenPending = player; continueTurn = true;
      message = "Cover the queen with your own coin this shot.";
    }
  } else if (pendingBefore) {
    if (own.length && !foul) {
      match.queenCovered = player; match.queenPending = null;
      message = "Queen covered. Play again.";
    } else if (!own.length) {
      returnCoin(world, 1); match.queenPending = null;
      message = "Queen cover missed. Queen returned; pass the turn.";
    }
    // Own coin + striker during cover retains pending queen for one further attempt (law 101).
  }
  if (!count(player) && match.queenCovered !== null && !foul) {
    return finish(player, count(opponent) + (match.queenCovered === player ? 3 : 0), "All own coins pocketed. Board won.");
  }
  if (!count(opponent)) return finish(opponent, count(player) + (match.queenCovered === opponent ? 3 : 0), "Opponent's last coin pocketed. Board lost.");
  match.active = continueTurn ? player : opponent;
  return { foul, own: own.length, winner: match.winner, message };
}
