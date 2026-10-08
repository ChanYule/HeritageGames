import type { GalaxyEngine } from "./engine";
import type { GalaxyInput } from "./input";
export function startGalaxyLoop(engine: GalaxyEngine, input: GalaxyInput, auto: () => boolean, render: () => void, notify: () => void,
  request: (cb: FrameRequestCallback) => number = requestAnimationFrame, cancel: (id: number) => void = cancelAnimationFrame) {
  let alive = true, id = 0, last: number | null = null, lastHud = -Infinity, revision = -1;
  const frame = (time: number) => {
    if (!alive) return;
    input.sync(); engine.advance(last === null ? 0 : (time - last) / 1000, input.value, auto()); last = time;
    if (engine.phase !== "playing") input.clear();
    render();
    if (revision !== engine.revision || time - lastHud >= 100) { revision = engine.revision; lastHud = time; notify(); }
    id = request(frame);
  };
  id = request(frame);
  return () => { alive = false; cancel(id); input.clear(); };
}
