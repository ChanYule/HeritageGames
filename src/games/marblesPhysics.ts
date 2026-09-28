export type Marble = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  target: boolean;
  captured: boolean;
  color: string;
};

export const MARBLES_WIDTH = 900;
export const MARBLES_HEIGHT = 560;
export const MARBLES_RING = { x: MARBLES_WIDTH / 2, y: MARBLES_HEIGHT / 2, radius: 175 };

export function returnShooterToStart(marbles: Marble[]) {
  const shooter = marbles.find((marble) => !marble.target);
  if (!shooter) return;
  shooter.x = MARBLES_RING.x;
  // A target still touching the ring cannot overlap this starting position.
  shooter.y = MARBLES_HEIGHT - 40;
  shooter.vx = 0;
  shooter.vy = 0;
}

/** Advance one fixed physics step, banking targets as soon as they leave the ring. */
export function advanceMarbles(marbles: Marble[], dt = 1) {
  let captured = 0;
  const captureOutside = (marble: Marble) => {
    if (!marble.target || marble.captured) return;
    if (Math.hypot(marble.x - MARBLES_RING.x, marble.y - MARBLES_RING.y) - marble.radius <= MARBLES_RING.radius) return;
    marble.captured = true;
    marble.vx = 0;
    marble.vy = 0;
    captured += 1;
  };

  for (const marble of marbles) {
    if (marble.captured) continue;
    marble.x += marble.vx * dt;
    marble.y += marble.vy * dt;
    marble.vx *= Math.pow(0.985, dt);
    marble.vy *= Math.pow(0.985, dt);
    captureOutside(marble);
    if (marble.captured) continue;

    if (marble.x - marble.radius < 0) {
      marble.x = marble.radius;
      marble.vx = Math.abs(marble.vx) * 0.65;
    } else if (marble.x + marble.radius > MARBLES_WIDTH) {
      marble.x = MARBLES_WIDTH - marble.radius;
      marble.vx = -Math.abs(marble.vx) * 0.65;
    }
    if (marble.y - marble.radius < 0) {
      marble.y = marble.radius;
      marble.vy = Math.abs(marble.vy) * 0.65;
    } else if (marble.y + marble.radius > MARBLES_HEIGHT) {
      marble.y = MARBLES_HEIGHT - marble.radius;
      marble.vy = -Math.abs(marble.vy) * 0.65;
    }
  }

  for (let i = 0; i < marbles.length; i++) {
    for (let j = i + 1; j < marbles.length; j++) {
      const a = marbles[i], b = marbles[j];
      if (a.captured || b.captured) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const minDistance = a.radius + b.radius;
      if (distance >= minDistance) continue;
      const nx = distance === 0 ? 1 : dx / distance;
      const ny = distance === 0 ? 0 : dy / distance;
      const overlap = minDistance - distance;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;

      const speedAlongNormal = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (speedAlongNormal < 0) {
        const impulse = -(1 + 0.88) * speedAlongNormal / 2;
        a.vx -= impulse * nx;
        a.vy -= impulse * ny;
        b.vx += impulse * nx;
        b.vy += impulse * ny;
      }
    }
  }

  for (const marble of marbles) {
    captureOutside(marble);
    if (Math.hypot(marble.vx, marble.vy) < 0.07) {
      marble.vx = 0;
      marble.vy = 0;
    }
  }
  return { captured, moving: marbles.some((marble) => !marble.captured && (marble.vx !== 0 || marble.vy !== 0)) };
}
