export type Difficulty = "easy" | "medium" | "difficult";

export const difficultySettings = {
  easy: { label: "Easy", marbles: 8, marbleRadius: 18, sticks: 10, stickSpread: 46, stickLength: 28 },
  medium: { label: "Medium", marbles: 11, marbleRadius: 16, sticks: 18, stickSpread: 36, stickLength: 38 },
  difficult: { label: "Difficult", marbles: 14, marbleRadius: 13, sticks: 28, stickSpread: 20, stickLength: 38 },
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

export function chaptehPaceLevel(rally: number, totalPoints: number) {
  const rallySteps = Math.floor(Math.max(0, rally) / 4);
  const matchSteps = Math.floor(Math.max(0, totalPoints) / 3);
  return Math.min(5, rallySteps + matchSteps);
}

export function chaptehFlightTuning(level: number) {
  const safeLevel = Math.max(0, Math.min(5, level));
  return {
    horizontalSpeed: 4.8 + safeLevel * 0.32,
    gravity: 0.34 + safeLevel * 0.027,
  };
}

// Random non-overlapping positions keep every target comfortably inside the ring.
export function randomMarblePositions(random = Math.random, difficulty: Difficulty = "medium"): Point[] {
  const settings = difficultySettings[difficulty];
  const positions: Point[] = [];
  const maxRadius = 138;
  const minDistance = settings.marbleRadius * 2 + 5;
  let attempts = 0;

  while (positions.length < settings.marbles && attempts < 6000) {
    attempts += 1;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * maxRadius;
    const candidate = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    if (positions.every((point) => Math.hypot(point.x - candidate.x, point.y - candidate.y) > minDistance)) {
      positions.push(candidate);
    }
  }

  if (positions.length < settings.marbles) {
    const fallback: Point[] = [];
    for (let ring = 0; ring < 3 && fallback.length < settings.marbles; ring++) {
      const ringRadius = ring === 0 ? 0 : ring === 1 ? 60 : 118;
      const slots = ring === 0 ? 1 : ring === 1 ? 6 : 12;
      const offset = random() * Math.PI * 2;
      for (let index = 0; index < slots && fallback.length < settings.marbles; index++) {
        const angle = offset + (Math.PI * 2 * index) / slots;
        const candidate = { x: Math.cos(angle) * ringRadius, y: Math.sin(angle) * ringRadius };
        if (fallback.every((point) => Math.hypot(point.x - candidate.x, point.y - candidate.y) > minDistance)) {
          fallback.push(candidate);
        }
      }
    }
    return fallback.slice(0, settings.marbles);
  }

  return positions;
}
