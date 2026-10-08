import type { SkyEngine } from "./engine";
import type { SkyInput } from "./input";
// Injectable scheduler makes loop ownership and teardown testable.
export function startLoop(engine: SkyEngine, input: SkyInput, autoFire: () => boolean, render: () => void, notify: () => void,
  request: (callback: FrameRequestCallback) => number = requestAnimationFrame,
  cancel: (id: number) => void = cancelAnimationFrame) {
  let id = 0, last: number | null = null, lastNotify = -Infinity, alive = true;
  const frame = (time: number) => {
    if (!alive) return;
    input.sync(); engine.advance(last === null ? 0 : (time - last) / 1000, input.value, autoFire()); last = time;
    render(); if (time - lastNotify >= 100) { notify(); lastNotify = time; }
    id = request(frame);
  };
  id = request(frame);
  return () => { alive = false; cancel(id); input.clear(); };
}
