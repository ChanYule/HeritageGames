import { emptyInput } from "./engine";
export type Action = "left" | "right" | "fire";
export class GalaxyInput {
  value = emptyInput();
  private keys = new Set<string>();
  private pointers = new Map<number, Action>();
  private drag: { id: number; start: number; ship: number } | null = null;
  sync() {
    const held = (action: Action) => [...this.pointers.values()].includes(action);
    this.value.x = Number(held("right") || this.keys.has("ArrowRight") || this.keys.has("KeyD")) - Number(held("left") || this.keys.has("ArrowLeft") || this.keys.has("KeyA"));
    this.value.fire = held("fire") || this.keys.has("Space");
  }
  key(code: string, down: boolean) { if (down) this.keys.add(code); else this.keys.delete(code); this.sync(); }
  press(id: number, action: Action) { if (!this.pointers.has(id)) this.pointers.set(id, action); this.sync(); }
  release(id: number) { this.pointers.delete(id); if (this.drag?.id === id) { this.drag = null; this.value.targetX = null; } this.sync(); }
  startDrag(id: number, clientX: number, shipX: number) { if (this.drag) return false; this.drag = { id, start: clientX, ship: shipX }; return true; }
  moveDrag(id: number, clientX: number, scale: number) { if (this.drag?.id === id) this.value.targetX = this.drag.ship + (clientX - this.drag.start) * scale; }
  clear() { this.keys.clear(); this.pointers.clear(); this.drag = null; Object.assign(this.value, emptyInput()); }
  bind(target: Window, active: () => boolean, pause: () => void, escape: () => void, blur: () => void) {
    const down = (event: KeyboardEvent) => {
      const element = event.target instanceof HTMLElement ? event.target : null;
      if (element?.closest("input,textarea,select,[contenteditable=true]")) return;
      if (event.code === "KeyP" && !event.repeat) { pause(); return; }
      if (event.code === "Escape" && !event.repeat) { escape(); return; }
      if (!active() || !["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"].includes(event.code)) return;
      if (event.code === "Space" && element?.closest("button")) return;
      event.preventDefault(); this.key(event.code, true);
    };
    const up = (event: KeyboardEvent) => this.key(event.code, false);
    const loseFocus = () => { this.clear(); blur(); };
    target.addEventListener("keydown", down); target.addEventListener("keyup", up); target.addEventListener("blur", loseFocus);
    return () => { target.removeEventListener("keydown", down); target.removeEventListener("keyup", up); target.removeEventListener("blur", loseFocus); this.clear(); };
  }
}
