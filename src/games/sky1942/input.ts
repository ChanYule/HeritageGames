import { emptyInput } from "./engine";
import type { Input } from "./types";
const moves: Record<string, [number, number]> = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
export class SkyInput {
  value: Input = emptyInput();
  joystick = { x: 0, y: 0 };
  private keys = new Set<string>();
  pointerFire = false;
  clear() { this.keys.clear(); this.joystick = { x: 0, y: 0 }; this.pointerFire = false; Object.assign(this.value, emptyInput()); }
  sync() {
    let x = this.joystick.x, y = this.joystick.y;
    for (const key of this.keys) { const move = moves[key]; if (move) { x += move[0]; y += move[1]; } }
    this.value.x = x; this.value.y = y; this.value.fire = this.pointerFire || this.keys.has("Space");
  }
  key(code: string, down: boolean, repeat = false) {
    if (down) { if (code === "KeyL" && !repeat && !this.keys.has(code)) this.value.roll = true; this.keys.add(code); }
    else this.keys.delete(code);
    this.sync();
  }
  bind(target: Window, active: () => boolean, pause: () => void, escape: () => void, blur: () => void) {
    const typing = (event: KeyboardEvent) => event.target instanceof HTMLElement && Boolean(event.target.closest("input,textarea,select,[contenteditable=true]"));
    const down = (event: KeyboardEvent) => {
      if (typing(event)) return;
      if (event.code === "Escape" && !event.repeat) { escape(); return; }
      if (event.code === "KeyP" && !event.repeat) { pause(); return; }
      if (!active() || !(moves[event.code] || event.code === "Space" || event.code === "KeyL")) return;
      if (event.code === "Space" && event.target instanceof HTMLElement && event.target.closest("button")) return;
      event.preventDefault(); this.key(event.code, true, event.repeat);
    };
    const up = (event: KeyboardEvent) => { this.key(event.code, false); };
    const loseFocus = () => { this.clear(); blur(); };
    target.addEventListener("keydown", down); target.addEventListener("keyup", up); target.addEventListener("blur", loseFocus);
    return () => { target.removeEventListener("keydown", down); target.removeEventListener("keyup", up); target.removeEventListener("blur", loseFocus); this.clear(); };
  }
}
