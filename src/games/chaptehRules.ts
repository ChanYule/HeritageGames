export const CHAPTEH_GROUND = 502;
export const CHAPTEH_ZONE_HEIGHT = 190;
export const CHAPTEH_GRAVITY = 0.34;

export function canSeniorKick(y: number, vy: number) {
  return vy > 0 && y > CHAPTEH_GROUND - CHAPTEH_ZONE_HEIGHT && y < CHAPTEH_GROUND - 8;
}

// Aim every return into the other player's zone, including very early/late kicks.
// Constant horizontal speed from the old kick position could sail off the court.
export type ChaptehAim = "centre" | "near" | "far";
export function chaptehReturnVelocity(x: number, y: number, player: 0 | 1, aim: ChaptehAim = "centre") {
  const vy = -10.9;
  const targetFraction = aim === "near" ? 0.62 : aim === "far" ? 0.84 : 0.73;
  const targetX = 760 * (player === 0 ? targetFraction : 1 - targetFraction);
  const targetY = CHAPTEH_GROUND - 85;
  const flightFrames = (-vy + Math.sqrt(vy * vy + 2 * CHAPTEH_GRAVITY * (targetY - y))) / CHAPTEH_GRAVITY;
  return { vx: (targetX - x) / flightFrames, vy };
}

export function chaptehTimeScale(pace: "gentle" | "lively", level: number, inKickZone = false) {
  // Give extra reaction time exactly when the visible Kick now cue appears.
  return pace === "gentle" ? (inKickZone ? 0.2 : 0.38) : 0.52 + Math.min(5, Math.max(0, level)) * 0.015;
}
