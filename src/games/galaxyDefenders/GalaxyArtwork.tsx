import { SHIP, ALIENS, PALETTE } from "./entities";
function Pixels({ rows, x, y, size }: { rows: string[]; x: number; y: number; size: number }) {
  return <g>{rows.flatMap((row, ry) => [...row].map((ch, rx) => PALETTE[ch] ? <rect key={`${rx}-${ry}`} x={x + rx * size} y={y + ry * size} width={size} height={size} fill={PALETTE[ch]} /> : null))}</g>;
}
export function ShipIcon() { return <svg viewBox="0 0 40 36" aria-hidden="true" shapeRendering="crispEdges"><Pixels rows={SHIP} x={4} y={3} size={2.5} /></svg>; }
export function GalaxyArtwork() {
  return <svg className="galaxy-preview" viewBox="0 0 360 200" aria-hidden="true" shapeRendering="crispEdges">
    <rect width="360" height="200" fill="#030509" />
    {Array.from({ length: 28 }, (_, i) => <rect key={i} x={(i * 97 + 15) % 360} y={(i * 43 + 10) % 200} width="1" height="1" fill="#94a1b4" />)}
    {(["red", "green", "purple"] as const).flatMap((kind, row) => Array.from({ length: 6 }, (_, col) => <Pixels key={`${kind}-${col}`} rows={ALIENS[kind][0]} x={55 + col * 42} y={48 + row * 26} size={2} />))}
    <Pixels rows={SHIP} x={166} y={154} size={2.5} /><rect x="182" y="129" width="3" height="12" fill="#ff6f76" /><rect x="114" y="113" width="3" height="10" fill="#ffe18b" />
  </svg>;
}
