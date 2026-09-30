export type Power = "gentle" | "steady" | "strong";
export type Pocket = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type ArcadeKind = "carom" | "tin-can-knockdown";

export const CAROM_COINS = [
  { id: 1, x: 25, y: 24 }, { id: 2, x: 50, y: 24 }, { id: 3, x: 75, y: 24 },
  { id: 4, x: 37, y: 47 }, { id: 5, x: 63, y: 47 },
  { id: 6, x: 25, y: 70 }, { id: 7, x: 50, y: 70 }, { id: 8, x: 75, y: 70 },
] as const;
export const POCKETS: Record<Pocket, { x: number; y: number }> = {
  "top-left": { x: 9, y: 9 }, "top-right": { x: 91, y: 9 },
  "bottom-left": { x: 9, y: 91 }, "bottom-right": { x: 91, y: 91 },
};
export const CANS = [
  { id: 1, lane: 1 }, { id: 2, lane: 2 }, { id: 3, lane: 3 },
  { id: 4, lane: 1.5 }, { id: 5, lane: 2.5 }, { id: 6, lane: 2 },
] as const;

export function caromShot(coinId: number, pocket: Pocket, power: Power): boolean {
  const coin = CAROM_COINS.find(item => item.id === coinId);
  if (!coin) return false;
  const target = POCKETS[pocket];
  const distance = Math.hypot(coin.x - target.x, coin.y - target.y);
  const nearest = Math.min(...Object.values(POCKETS).map(point => Math.hypot(coin.x - point.x, coin.y - point.y)));
  if (distance > nearest + 22) return false;
  const needed: Power = distance < 48 ? "gentle" : distance < 66 ? "steady" : "strong";
  return power === needed || (needed === "steady" && power === "strong");
}

export function canThrow(standing: readonly number[], lane: number, power: Power): number[] {
  if (!Number.isInteger(lane) || lane < 0 || lane > 4) return [];
  const reach = power === "gentle" ? 0.55 : power === "steady" ? 0.82 : 1.12;
  const centre = 0.5 + lane * 0.75;
  return CANS.filter(can => standing.includes(can.id) && Math.abs(can.lane - centre) <= reach).map(can => can.id);
}
