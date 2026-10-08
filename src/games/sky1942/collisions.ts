import type { Point } from "./types";
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const overlaps = (a: Point, b: Point, radius: number) => Math.hypot(a.x - b.x, a.y - b.y) <= radius;
// Sweep in relative coordinates: both projectile and target can move between steps.
export function sweptHit(from: Point, to: Point, targetFrom: Point, targetTo: Point, radius: number) {
  const x = from.x - targetFrom.x, y = from.y - targetFrom.y;
  const dx = to.x - targetTo.x - x, dy = to.y - targetTo.y - y;
  const t = clamp(-(x * dx + y * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(x + dx * t, y + dy * t) <= radius;
}
