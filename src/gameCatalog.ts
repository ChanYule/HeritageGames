import type { HeritageGameKey } from "./types";

export const games: { key: HeritageGameKey; title: string; subtitle: string; description: string; players: string; control: string }[] = [
  { key: "marbles", title: "Marbles", subtitle: "Aim, pull back and flick.", description: "Aim your big marble and knock the little ones out of the circle.", players: "2 players", control: "Aim & shoot" },
  { key: "pick-up-sticks", title: "Pick-Up Sticks", subtitle: "Steady hands win.", description: "Find a stick on top. Lift it gently without moving the others.", players: "2 players", control: "Tap & lift" },
  { key: "carom", title: "Carom", subtitle: "Line up a gentle strike.", description: "Place the striker, pull back, and pocket the coins.", players: "1–2 players", control: "Aim & strike" },
  { key: "tin-can-knockdown", title: "Tin Can Knockdown", subtitle: "Aim for the stack.", description: "Drag and throw the ball to topple the cans.", players: "1–2 players", control: "Aim & throw" },
];

export const arcadeGames = [
  { key: "sky-1942" as const, title: "SKY 1942", subtitle: "ACE SQUADRON", description: "Pilot your fighter aircraft, defeat enemy squadrons, collect power-ups, and survive challenging boss battles.", players: "1 Player", control: "Touch / Keyboard" },
  { key: "galaxy-defenders" as const, title: "Galaxy Defenders", subtitle: "Protect Earth from the alien invasion.", description: "Defend Earth from waves of alien invaders. Move your spaceship, fire at enemies, dodge incoming attacks, and aim for the highest score.", players: "1 Player", control: "Touch / Keyboard" },
];
export const allGames = [...games, ...arcadeGames];
export const isHeritageGame = (key: unknown): key is HeritageGameKey => games.some(game => game.key === key);
export const isArcadeGame = (key: unknown): key is import("./types").ArcadeGameKey => arcadeGames.some(game => game.key === key);
export function gameFromSearch(search: string): import("./types").GameKey | null {
  const raw = new URLSearchParams(search).get("game");
  const key = raw === "five-stones" ? "carom" : raw === "chapteh" ? "tin-can-knockdown" : raw;
  return allGames.find(game => game.key === key)?.key ?? null;
}
