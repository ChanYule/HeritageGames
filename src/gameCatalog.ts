import type { GameKey } from "./types";

export const games: { key: GameKey; title: string; subtitle: string; description: string; players: string; control: string }[] = [
  { key: "marbles", title: "Marbles", subtitle: "Aim, pull back and flick.", description: "Aim your big marble and knock the little ones out of the circle.", players: "2 players", control: "Aim & shoot" },
  { key: "pick-up-sticks", title: "Pick-Up Sticks", subtitle: "Steady hands win.", description: "Find a stick on top. Lift it gently without moving the others.", players: "2 players", control: "Tap & lift" },
  { key: "five-stones", title: "Five Stones", subtitle: "Toss, plan and catch.", description: "Follow a numbered pickup plan, then catch the stone. Choose how much to remember.", players: "1 player · take turns in competition", control: "Plan & catch" },
  { key: "chapteh", title: "Chapteh", subtitle: "Choose your shot. Keep it alive.", description: "Choose a near or far kick and watch its path across the court.", players: "2 players", control: "Aim & kick" },
];
