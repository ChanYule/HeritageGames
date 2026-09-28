import type { GameKey } from "./types";

export const games: { key: GameKey; title: string; subtitle: string; description: string; players: string; control: string }[] = [
  { key: "marbles", title: "Marbles", subtitle: "Aim, pull back and flick.", description: "Aim your big marble and knock the little ones out of the circle.", players: "2 players", control: "Aim & shoot" },
  { key: "pick-up-sticks", title: "Pick-Up Sticks", subtitle: "Steady hands win.", description: "Find a stick on top. Lift it gently without moving the others.", players: "2 players", control: "Tap & lift" },
  { key: "five-stones", title: "Five Stones", subtitle: "Toss, collect and catch.", description: "Toss a stone, gather the others, then catch. Take it one step at a time.", players: "1 player · take turns in competition", control: "Tap & catch" },
  { key: "chapteh", title: "Chapteh", subtitle: "Kick it across. Keep it alive.", description: "Share the screen and tap your side to kick the chapteh back to your friend.", players: "2 players", control: "Tap to kick" },
];
