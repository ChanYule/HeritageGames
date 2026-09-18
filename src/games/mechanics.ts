export type Difficulty = "easy" | "medium" | "difficult";

export const difficultySettings = {
  easy: { label: "Easy", marbles: 5, marbleRadius: 20, sticks: 10, stickSpread: 46, stickLength: 28 },
  medium: { label: "Medium", marbles: 7, marbleRadius: 18, sticks: 18, stickSpread: 36, stickLength: 38 },
  difficult: { label: "Difficult", marbles: 10, marbleRadius: 14, sticks: 28, stickSpread: 20, stickLength: 38 },
} as const;

export type Point = { x: number; y: number };

export function shotVelocity(dx: number, dy: number) {
  const distance = Math.hypot(dx, dy);
  const scale = distance === 0 ? 0 : 0.09 * Math.min(distance, 180) / distance;
  return { x: dx * scale, y: dy * scale };
}

export function segmentsOverlap(a: Point, b: Point, c: Point, d: Point, thickness = 11) {
  const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const distance = (p: Point, q: Point, r: Point) => {
    const dx = r.x - q.x, dy = r.y - q.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - q.x) * dx + (p.y - q.y) * dy) / lengthSquared));
    return Math.hypot(p.x - q.x - t * dx, p.y - q.y - t * dy);
  };
  const crossing = cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
  return crossing || Math.min(distance(a, c, d), distance(b, c, d), distance(c, a, b), distance(d, a, b)) <= thickness;
}

export function canKick(y: number, vy: number, ground: number) {
  return vy > 0 && y > ground - 130 && y < ground - 8;
}

// Jittered, shuffled positions keep every target inside the ring and separated.
export function randomMarblePositions(random = Math.random, difficulty: Difficulty = "medium"): Point[] {
  const positions: Point[] = [];
  for (let row = -2; row <= 2; row++) {
    for (let column = -2; column <= 2; column++) {
      const x = column * 55 + (random() - 0.5) * 14;
      const y = row * 55 + (random() - 0.5) * 14;
      if (Math.hypot(x, y) <= 140) positions.push({ x, y });
    }
  }
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const angle = random() * Math.PI * 2;
  return positions.slice(0, difficultySettings[difficulty].marbles).map(({ x, y }) => ({
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  }));
}
