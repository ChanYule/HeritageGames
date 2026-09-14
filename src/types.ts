export type GameKey = "marbles" | "pick-up-sticks" | "five-stones" | "chapteh";

export type GameDefinition = {
  key: GameKey;
  title: string;
  subtitle: string;
  description: string;
  difficulty: string;
  players: string;
  accent: string;
};
