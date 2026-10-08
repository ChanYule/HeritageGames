import { SkyAudio } from "../sky1942/audio";
import type { Sound } from "./types";
import type { SoundName } from "../sky1942/types";
const effects: Record<Sound, SoundName> = { shoot: "shoot", destroy: "explosion", hit: "hit", complete: "powerup", wave: "levelUp", gameover: "gameOver", record: "levelUp" };
// Reuse the site's original synthesized tones, bounded voices and context teardown.
export class GalaxyAudio extends SkyAudio {
  effect(name: Sound) { this.play(effects[name]); }
}
