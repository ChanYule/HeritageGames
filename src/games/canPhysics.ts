export type Can = { id: number; x: number; y: number; vx: number; vy: number; angle: number; spin: number; fallen: boolean };
export type CanWorld = { cans: Can[]; ball: { x: number; y: number; vx: number; vy: number; power: number; time: number; hit: number[] } | null; elapsed: number; quiet: number; impacts: number; falls: number };
const WIDTH = 52, HEIGHT = 60, FLOOR = 405;

export function createCanWorld(): CanWorld {
  return { cans: [
    { id: 1, x: 244, y: FLOOR - 30 }, { id: 2, x: 300, y: FLOOR - 30 }, { id: 3, x: 356, y: FLOOR - 30 },
    { id: 4, x: 272, y: FLOOR - 91 }, { id: 5, x: 328, y: FLOOR - 91 }, { id: 6, x: 300, y: FLOOR - 152 },
  ].map(c => ({ ...c, vx: 0, vy: 0, angle: 0, spin: 0, fallen: false })), ball: null, elapsed: 0, quiet: 0, impacts: 0, falls: 0 };
}

export function throwBall(world: CanWorld, targetX: number, targetY: number, power: number): boolean {
  if (world.ball) return false;
  if (!Number.isFinite(targetX + targetY + power)) return false;
  const velocity = ballVelocity(targetX, targetY, power);
  world.ball = { x: 300, y: 535, ...velocity, power: Math.max(.1, Math.min(1, power)), time: 0, hit: [] };
  world.elapsed = 0; world.quiet = 0; world.impacts = 0; world.falls = 0;
  return true;
}

function bounds(can: Can) {
  const c = Math.abs(Math.cos(can.angle)), s = Math.abs(Math.sin(can.angle));
  return { hw: (WIDTH * c + HEIGHT * s) / 2, hh: (HEIGHT * c + WIDTH * s) / 2 };
}

export function stepCans(world: CanWorld, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return;
  const h = Math.min(dt, 1 / 30);
  const speed = Math.max(0, world.ball ? Math.hypot(world.ball.vx, world.ball.vy) : 0, ...world.cans.map(c => Math.hypot(c.vx, c.vy) + Math.abs(c.spin) * 40));
  const substeps = Math.max(4, Math.ceil(speed * h / 4));
  for (let step = 0; step < substeps; step++) {
    const d = h / substeps;
    const ball = world.ball;
    if (ball) {
      ball.time += d; ball.vy += 260 * d;
      ball.x += ball.vx * d; ball.y += ball.vy * d;
      for (const can of world.cans) {
        // Circle against the actual rotated tin, with a contact-point torque.
        const co = Math.cos(can.angle), si = Math.sin(can.angle);
        const dx = ball.x - can.x, dy = ball.y - can.y;
        const lx = dx * co + dy * si, ly = -dx * si + dy * co;
        const qx = Math.max(-26, Math.min(26, lx)), qy = Math.max(-30, Math.min(30, ly));
        const ex = lx - qx, ey = ly - qy, distance = Math.hypot(ex, ey);
        if (distance >= 16) continue;
        const ux = distance ? ex / distance : 0, uy = distance ? ey / distance : 1;
        const nx = ux * co - uy * si, ny = ux * si + uy * co;
        ball.x += nx * (16 - distance + .01); ball.y += ny * (16 - distance + .01);
        const rx = qx * co - qy * si, ry = qx * si + qy * co;
        const relative = (ball.vx - can.vx + can.spin * ry) * nx + (ball.vy - can.vy - can.spin * rx) * ny;
        if (relative < 0) {
          const arm = rx * ny - ry * nx;
          const impulse = -1.35 * relative / (1 / .7 + 1 + arm * arm / 526);
          ball.vx += impulse * nx / .7; ball.vy += impulse * ny / .7;
          can.vx -= impulse * nx; can.vy -= impulse * ny;
          can.spin -= impulse * arm / 526;
          if (!ball.hit.includes(can.id)) { world.impacts++; ball.hit.push(can.id); }
        }
      }
      if (ball.time > 2.8 || ball.x < -20 || ball.x > 620 || ball.y < -30 || (ball.vy > 0 && ball.y > 575)) world.ball = null;
    }
    for (const can of world.cans) {
      const supported = can.y + bounds(can).hh >= FLOOR - 2 || world.cans.some(other => other !== can && other.y > can.y + 40 && Math.abs(other.x - can.x) < WIDTH - 5 && Math.abs((can.y + bounds(can).hh) - (other.y - bounds(other).hh)) < 4);
      if (!supported || Math.abs(can.vy) > 3 || Math.abs(can.vx) > 8 || Math.abs(can.spin) > .08) can.vy += 620 * d;
      else can.vy = 0;
      can.x += can.vx * d; can.y += can.vy * d; can.angle += can.spin * d;
      const box = bounds(can);
      if (can.y + box.hh > FLOOR) {
        can.y = FLOOR - box.hh;
        if (can.vy > 0) can.vy = can.vy > 65 ? -can.vy * .13 : 0;
        can.vx *= Math.exp(-12 * d); can.spin *= Math.exp(-16 * d);
        // Contact beneath an off-centre mass tips a moving tin; resting tins sleep.
        if (Math.abs(can.spin) > .08) can.spin += Math.sin(can.angle * 2) * 9 * d;
        if (Math.abs(can.vx) < 2) can.vx = 0;
        if (Math.abs(can.spin) < .03) can.spin = 0;
      }
      if (can.x - box.hw < 35 || can.x + box.hw > 565) {
        can.x = Math.max(35 + box.hw, Math.min(565 - box.hw, can.x));
        can.vx *= -.25; can.spin *= .7;
      }
      can.vx *= Math.exp(-.5 * d); can.spin *= Math.exp(-1 * d);
      if (Math.abs(can.vx) < .3) can.vx = 0;
      if (Math.abs(can.spin) < .008) can.spin = 0;
      if (!can.fallen && (Math.abs(can.angle) > .65 || can.y > FLOOR - HEIGHT * .42 && Math.abs(can.x - ([244,300,356,272,328,300][can.id - 1])) > 35)) {
        can.fallen = true; world.falls++;
      }
    }
    // The contacts are resolved in height order so that the lower row supports the upper rows.
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < world.cans.length; i++) for (let j = i + 1; j < world.cans.length; j++) {
      const a = world.cans[i], b = world.cans[j];
      const contact = tinContact(a, b);
      if (!contact) continue;
      const { nx, ny, overlap } = contact;
      a.x -= nx * overlap * .5; a.y -= ny * overlap * .5;
      b.x += nx * overlap * .5; b.y += ny * overlap * .5;
      const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (approach < 0) {
        const impulse = -approach * .54;
        a.vx -= impulse * nx; a.vy -= impulse * ny;
        b.vx += impulse * nx; b.vy += impulse * ny;
        if (Math.abs(approach) > 20) {
          const torque = ((b.x - a.x) * ny - (b.y - a.y) * nx) * impulse / 1800;
          a.spin -= torque; b.spin -= torque;
        }
        if (approach < -35) world.impacts++;
      }

    }
  }
  for (const can of world.cans) {
    const box = bounds(can);
    if (can.y + box.hh > FLOOR) { can.y = FLOOR - box.hh; if (can.vy > 0 && can.vy < 30) can.vy = 0; }
  }
  const quiet = !world.ball && world.cans.every(c => Math.abs(c.vx) < 2 && Math.abs(c.vy) < 2 && Math.abs(c.spin) < .03);
  world.quiet = quiet ? world.quiet + h : 0;
  if (world.quiet >= .35) world.cans.forEach(c => { c.vx = 0; c.vy = 0; c.spin = 0; });
  world.elapsed += h;
}

export function cansSettled(world: CanWorld): boolean {
  return !world.ball && world.elapsed > 1 && world.quiet >= .35;
}

export function ballVelocity(targetX: number, targetY: number, power: number) {
  const duration = .65 - Math.max(.1, Math.min(1, power)) * .32;
  return { vx: (targetX - 300) / duration, vy: (targetY - 535 - .5 * 260 * duration * duration) / duration };
}
/** Separating axes for two oriented rectangular tins. */
function tinContact(a: Can, b: Can) {
  let overlap = Infinity, nx = 0, ny = 0;
  for (const angle of [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2]) {
    const x = Math.cos(angle), y = Math.sin(angle);
    const extent = (can: Can) => 26 * Math.abs(Math.cos(can.angle) * x + Math.sin(can.angle) * y) + 30 * Math.abs(-Math.sin(can.angle) * x + Math.cos(can.angle) * y);
    const distance = (b.x - a.x) * x + (b.y - a.y) * y;
    const depth = extent(a) + extent(b) - Math.abs(distance);
    if (depth <= 0) return null;
    if (depth < overlap) { overlap = depth; nx = x * (Math.sign(distance) || 1); ny = y * (Math.sign(distance) || 1); }
  }
  return { nx, ny, overlap };
}
