import type { Point } from "./types";
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
// Swept segment against a moving box, in relative coordinates.
export function sweptBox(from: Point, to: Point, targetFrom: Point, targetTo: Point, halfWidth: number, halfHeight: number) {
  const start = [from.x - targetFrom.x, from.y - targetFrom.y];
  const delta = [to.x - targetTo.x - start[0], to.y - targetTo.y - start[1]];
  const extents = [halfWidth, halfHeight]; let enter = 0, leave = 1;
  for (let axis = 0; axis < 2; axis++) {
    if (Math.abs(delta[axis]) < 1e-10) { if (Math.abs(start[axis]) > extents[axis]) return false; continue; }
    let a = (-extents[axis] - start[axis]) / delta[axis], b = (extents[axis] - start[axis]) / delta[axis];
    if (a > b) [a, b] = [b, a]; enter = Math.max(enter, a); leave = Math.min(leave, b);
    if (enter > leave) return false;
  }
  return true;
}
