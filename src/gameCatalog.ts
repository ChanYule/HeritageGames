import type { GameKey } from "./types";

export const games: { key: GameKey; title: string; subtitle: string; description: string; players: string; control: string }[] = [
  { key: "marbles", title: "Marbles", subtitle: "Aim, pull back and flick.", description: "Aim your big marble and knock the little ones out of the circle.", players: "2 players", control: "Aim & shoot" },
  { key: "pick-up-sticks", title: "Pick-Up Sticks", subtitle: "Steady hands win.", description: "Find a stick on top. Lift it gently without moving the others.", players: "2 players", control: "Tap & lift" },
  { key: "carom", title: "Carom", subtitle: "Line up a gentle strike.", description: "Place the striker, pull back, and pocket the coins.", players: "1–2 players", control: "Aim & strike" },
  { key: "tin-can-knockdown", title: "Tin Can Knockdown", subtitle: "Aim for the stack.", description: "Drag and throw the ball to topple the cans.", players: "1–2 players", control: "Aim & throw" },
];
