import { SPR_PLAYER, SPR_POWERUP, PALETTE } from "./entities";
export function SkyArtwork({ pickup }: { pickup?: keyof typeof SPR_POWERUP }) {
  const sprite = pickup ? SPR_POWERUP[pickup] : SPR_PLAYER;
  return <svg viewBox="0 0 80 80" aria-hidden="true" shapeRendering="crispEdges">{sprite.flatMap((row, y) => [...row].map((ch, x) => {
    const color = PALETTE[ch];
    return color ? <rect key={`${x}-${y}`} x={(80 - sprite[0].length * 5) / 2 + x * 5} y={(80 - sprite.length * 5) / 2 + y * 5} width="5" height="5" fill={color} /> : null;
  }))}</svg>;
}
