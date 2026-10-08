export const LEADERBOARD_KEY = "sky1942_leaderboard_v1";
export const BEST_KEY = "sky1942_highscore_v1";
export const LATEST_KEY = "sky1942_latest_v1";
export type ScoreEntry = { name: string; score: number; stage: number };
export type ScoreStore = Pick<Storage, "getItem" | "setItem">;
const validScore = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
export function validateScores(raw: unknown): ScoreEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is ScoreEntry => !!entry && typeof entry === "object" && typeof entry.name === "string" && validScore(entry.score) && (entry.stage === undefined || (Number.isSafeInteger(entry.stage) && entry.stage >= 1 && entry.stage <= 10000)))
    .map(entry => ({ name: entry.name.trim().slice(0, 12) || "AAA", score: entry.score, stage: entry.stage ?? 1 })).sort((a, b) => b.score - a.score).slice(0, 5);
}
export function readScores(store: ScoreStore): ScoreEntry[] { try { return validateScores(JSON.parse(store.getItem(LEADERBOARD_KEY) ?? "[]")); } catch { return []; } }
export function readBest(store: ScoreStore) { try { const n = Number(store.getItem(BEST_KEY)); return Math.max(validScore(n) ? n : 0, readScores(store)[0]?.score ?? 0); } catch { return 0; } }
export const qualifies = (score: number, entries: ScoreEntry[]) => validScore(score) && score > 0 && (entries.length < 5 || score > entries[entries.length - 1].score);
export function saveBest(store: ScoreStore, score: number, stage: number) {
  try { if (!validScore(score)) return false; store.setItem(BEST_KEY, String(Math.max(readBest(store), score))); store.setItem(LATEST_KEY, JSON.stringify({ name: "AAA", score, stage })); return true; } catch { return false; }
}
export function readLatest(store: ScoreStore) { try { return validateScores([JSON.parse(store.getItem(LATEST_KEY) ?? "null")])[0] ?? null; } catch { return null; } }
export function saveScore(store: ScoreStore, name: string, score: number, stage: number) {
  const entries = readScores(store);
  if (!qualifies(score, entries)) return false;
  const next = validateScores([...entries, { name, score, stage }]);
  try { store.setItem(LEADERBOARD_KEY, JSON.stringify(next)); return saveBest(store, score, stage); } catch { return false; }
}
