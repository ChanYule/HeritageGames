export type ArcadeGameKey = "sky-1942" | "galaxy-defenders";
export type GameKey = HeritageGameKey | ArcadeGameKey;
export type HeritageGameKey = "marbles" | "pick-up-sticks" | "carom" | "tin-can-knockdown";

export type GameDefinition = {
  key: GameKey;
  title: string;
  subtitle: string;
  description: string;
  difficulty: string;
  players: string;
  accent: string;
};

export type GameResult = {
  scores: [number, number];
  winner?: 0 | 1 | null;
};

export type CompetitionGameProps = {
  playerNames?: [string, string];
  competitionMode?: boolean;
  individualAttempt?: { seed: number; shots: number };
  fixedDifficulty?: "easy" | "medium" | "difficult";
  playerColours?: [string, string];
  carromChallenge?: boolean;
  onComplete?: (result: GameResult) => void;
};
