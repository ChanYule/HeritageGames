import type { SoundName } from "./types";
// One context per mounted game; original synthesized effects, with bounded voices.
export class SkyAudio {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = 0;
  async unlock() {
    try {
      if (!this.ctx) {
        const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Audio) return;
        this.ctx = new Audio(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : .45; this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") await this.ctx.resume();
    } catch { /* Silent gameplay remains available. */ }
  }
  setMuted(value: boolean) { this.muted = value; if (this.master && this.ctx) this.master.gain.setValueAtTime(value ? 0 : .45, this.ctx.currentTime); }
  suspend() { if (this.ctx?.state === "running") void this.ctx.suspend().catch(() => {}); }
  dispose() { const ctx = this.ctx; this.ctx = null; this.master = null; if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {}); }
  private tone(freq: number, duration: number, type: OscillatorType = "square", gain = .12, slide = freq, delay = 0) {
    const ctx = this.ctx, master = this.master; if (this.muted || !ctx || !master || ctx.state !== "running" || this.voices >= 12) return;
    const osc = ctx.createOscillator(), volume = ctx.createGain(), start = ctx.currentTime + delay;
    this.voices++; osc.type = type; osc.frequency.setValueAtTime(freq, start); osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), start + duration);
    volume.gain.setValueAtTime(gain, start); volume.gain.exponentialRampToValueAtTime(.001, start + duration);
    osc.connect(volume).connect(master); osc.onended = () => { this.voices--; osc.disconnect(); volume.disconnect(); }; osc.start(start); osc.stop(start + duration + .02);
  }
  private noise(duration: number) {
    const ctx = this.ctx, master = this.master; if (this.muted || !ctx || !master || ctx.state !== "running" || this.voices >= 12) return;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter(); this.voices++;
    source.buffer = buffer; gain.gain.value = .2; filter.type = "lowpass"; filter.frequency.value = 2200;
    source.connect(filter).connect(gain).connect(master); source.onended = () => { this.voices--; source.disconnect(); gain.disconnect(); filter.disconnect(); }; source.start();
  }
  play(name: SoundName) {
    switch (name) {
      case "shoot": this.tone(880, .07, "square", .08, 1200); break;
      case "enemyShoot": this.tone(300, .09, "sawtooth", .06, 180); break;
      case "explosion": this.noise(.28); this.tone(120, .2, "square", .07, 40); break;
      case "bossExplosion": this.noise(.6); for (let i = 0; i < 3; i++) this.tone(150 - i * 20, .3, "square", .1, 30, i * .12); break;
      case "hit": this.tone(220, .25, "sawtooth", .18, 60); break;
      case "loop": this.tone(400, .4, "sine", .15, 900); break;
      case "powerup": [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, .09, "square", .12, f, i * .06)); break;
      case "levelUp": [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .15, "square", .14, f, i * .1)); break;
      case "gameOver": [392, 349, 293, 220].forEach((f, i) => this.tone(f, .35, "sawtooth", .14, f, i * .22)); break;
    }
  }
}
