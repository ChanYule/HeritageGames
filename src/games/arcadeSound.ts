let audio: AudioContext | null = null;
let lastSound = 0;

export function playArcadeSound(kind: "strike" | "wood" | "pocket" | "throw" | "metal" | "fall" | "score", enabled: boolean) {
  if (!enabled || typeof window === "undefined" || typeof AudioContext === "undefined") return;
  const now = performance.now();
  if (kind === "wood" || kind === "metal") {
    if (now - lastSound < 70) return;
    lastSound = now;
  }
  audio ??= new AudioContext();
  if (audio.state === "suspended") void audio.resume();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const tones = { strike: 175, wood: 240, pocket: 390, throw: 145, metal: 600, fall: 110, score: 520 };
  oscillator.type = kind === "metal" ? "triangle" : "sine";
  oscillator.frequency.setValueAtTime(tones[kind] * (.93 + Math.random() * .14), audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(tones[kind] * .55, audio.currentTime + .12);
  gain.gain.setValueAtTime(.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(kind === "score" ? .045 : .025, audio.currentTime + .012);
  gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .17);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(); oscillator.stop(audio.currentTime + .18);
}

export function vibrateArcade(duration: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(duration);
}
