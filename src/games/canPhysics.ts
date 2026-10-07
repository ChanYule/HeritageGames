export type Can = { id: number; x: number; y: number; vx: number; vy: number; angle: number; spin: number; fallen: boolean };
export type CanWorld = { cans: Can[]; ball: { x: number; y: number; targetX: number; targetY: number; power: number; time: number } | null; elapsed: number; impacts: number; falls: number };
const WIDTH = 52, HEIGHT = 60, FLOOR = 405;

export function createCanWorld(): CanWorld {
  return { cans: [
    { id: 1, x: 244, y: FLOOR - 30 }, { id: 2, x: 300, y: FLOOR - 30 }, { id: 3, x: 356, y: FLOOR - 30 },
    { id: 4, x: 272, y: FLOOR - 91 }, { id: 5, x: 328, y: FLOOR - 91 }, { id: 6, x: 300, y: FLOOR - 152 },
  ].map(c => ({ ...c, vx: 0, vy: 0, angle: 0, spin: 0, fallen: false })), ball: null, elapsed: 0, impacts: 0, falls: 0 };
}

export function throwBall(world: CanWorld, targetX: number, targetY: number, power: number): boolean {
  if (world.ball) return false;
  world.ball = { x: 300, y: 470, targetX: Math.max(105, Math.min(495, targetX)), targetY: Math.max(190, Math.min(385, targetY)), power: Math.max(.3, Math.min(1, power)), time: 0 };
  world.elapsed = 0; world.impacts = 0; world.falls = 0;
  return true;
}

function bounds(can: Can) {
  const c = Math.abs(Math.cos(can.angle)), s = Math.abs(Math.sin(can.angle));
  return { hw: (WIDTH * c + HEIGHT * s) / 2, hh: (HEIGHT * c + WIDTH * s) / 2 };
}

export function stepCans(world: CanWorld, dt: number): void {
  const h = Math.min(dt, 1 / 30);
  const ball = world.ball;
  if (ball) {
    ball.time += h;
    const progress = Math.min(1, ball.time / (.72 - ball.power * .12));
    ball.x = 300 + (ball.targetX - 300) * progress;
    ball.y = 470 + (ball.targetY - 470) * progress - Math.sin(progress * Math.PI) * (75 + ball.power * 45);
    if (progress === 1) {
      const candidates = world.cans.filter(c => !c.fallen && Math.abs(c.x - ball.targetX) < 44 && Math.abs(c.y - ball.targetY) < 48);
      const hit = candidates.sort((a, b) => Math.hypot(a.x - ball.targetX, a.y - ball.targetY) - Math.hypot(b.x - ball.targetX, b.y - ball.targetY))[0];
      if (hit) {
        const side = (ball.targetX - hit.x) / 28;
        const height = (hit.y - ball.targetY) / 30;
        hit.vx += (side * 110 + 32) * ball.power;
        hit.vy -= (90 + height * 55) * ball.power;
        hit.spin += (side * 2.5 + height * 2.8 + .4) * ball.power;
        world.impacts++;
      }
      world.ball = null;
    }
  }
  const substeps = 3;
  for (let step = 0; step < substeps; step++) {
    const d = h / substeps;
    for (const can of world.cans) {
      const supported = can.y + HEIGHT / 2 >= FLOOR - 2 || world.cans.some(other => other !== can && other.y > can.y + 40 && Math.abs(other.x - can.x) < WIDTH - 5 && Math.abs((can.y + HEIGHT / 2) - (other.y - HEIGHT / 2)) < 4);
      if (!supported || Math.abs(can.vy) > 3 || Math.abs(can.vx) > 8 || Math.abs(can.spin) > .08) can.vy += 620 * d;
      else can.vy = 0;
      can.x += can.vx * d; can.y += can.vy * d; can.angle += can.spin * d;
      const box = bounds(can);
      if (can.y + box.hh > FLOOR) {
        can.y = FLOOR - box.hh;
        if (can.vy > 0) can.vy = can.vy > 65 ? -can.vy * .13 : 0;
        can.vx *= .94; can.spin *= .88;
      }
      if (can.x - box.hw < 35 || can.x + box.hw > 565) {
        can.x = Math.max(35 + box.hw, Math.min(565 - box.hw, can.x));
        can.vx *= -.25; can.spin *= .7;
      }
      can.vx *= .996; can.spin *= .992;
      if (Math.abs(can.vx) < .3) can.vx = 0;
      if (Math.abs(can.spin) < .008) can.spin = 0;
      if (!can.fallen && (Math.abs(can.angle) > .65 || can.y > FLOOR - HEIGHT * .42 && Math.abs(can.x - ([244,300,356,272,328,300][can.id - 1])) > 35)) {
        can.fallen = true; world.falls++;
      }
    }
    // The contacts are resolved in height order so that the lower row supports the upper rows.
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < world.cans.length; i++) for (let j = i + 1; j < world.cans.length; j++) {
      const a = world.cans[i], b = world.cans[j];
      const ab = bounds(a), bb = bounds(b);
      const ox = ab.hw + bb.hw - Math.abs(a.x - b.x);
      const oy = ab.hh + bb.hh - Math.abs(a.y - b.y);
      if (ox <= 0 || oy <= 0) continue;
      if (ox < oy) {
        const sign = Math.sign(b.x - a.x) || 1;
        a.x -= sign * ox * .5; b.x += sign * ox * .5;
        const relative = b.vx - a.vx;
        if (relative * sign < 0) {
          const impulse = relative * .52;
          a.vx += impulse; b.vx -= impulse;
          a.spin -= impulse * .012; b.spin += impulse * .012;
          if (Math.abs(relative) > 35) world.impacts++;
        }
      } else {
        const sign = Math.sign(b.y - a.y) || 1;
        a.y -= sign * oy * .5; b.y += sign * oy * .5;
        const relative = b.vy - a.vy;
        if (relative * sign < 0) {
          const impulse = relative * .51;
          a.vy += impulse; b.vy -= impulse;
          if (Math.abs(relative) > 20) {
            a.vx -= (b.x - a.x) * Math.abs(impulse) * .005;
            b.vx += (b.x - a.x) * Math.abs(impulse) * .005;
          }
          if (Math.abs(relative) > 35) world.impacts++;
        }
      }
    }
  }
  world.elapsed += h;
}

export function cansSettled(world: CanWorld): boolean {
  return !world.ball && world.elapsed > 1 && (world.cans.every(c => Math.abs(c.vx) < 2 && Math.abs(c.vy) < 2 && Math.abs(c.spin) < .03) || world.elapsed > 9);
}
