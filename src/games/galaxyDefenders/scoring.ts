import type { Mode } from "./types";
export type Score = { name: string; score: number; wave: number; mode: Mode };
export type ScoreStore = Pick<Storage, "getItem" | "setItem"> & { sessionOnly?: boolean };
export const scoreKey = (mode: Mode) => `galaxy_defenders_${mode}_scores_v1`;
export const bestKey = (mode: Mode) => `galaxy_defenders_${mode}_best_v1`;
export const latestKey = (mode: Mode) => `galaxy_defenders_${mode}_latest_v1`;
const validNumber = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
export function validate(raw: unknown, mode: Mode): Score[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is Score => !!item && typeof item === "object" && typeof item.name === "string" && validNumber(item.score) && validNumber(item.wave) && item.wave > 0 && item.wave <= 10000 && item.mode === mode)
    .map(item => ({ name: item.name.trim().slice(0, 12) || "AAA", score: item.score, wave: item.wave, mode })).sort((a, b) => b.score - a.score).slice(0, 5);
}
export function readScores(store: ScoreStore, mode: Mode) { try { return validate(JSON.parse(store.getItem(scoreKey(mode)) ?? "[]"), mode); } catch { return []; } }
export function readBest(store: ScoreStore, mode: Mode) { try { const stored = Number(store.getItem(bestKey(mode))); return Math.max(validNumber(stored) ? stored : 0, readScores(store, mode)[0]?.score ?? 0); } catch { return 0; } }
export function readLatest(store: ScoreStore, mode: Mode) { try { return validate([JSON.parse(store.getItem(latestKey(mode)) ?? "null")], mode)[0] ?? null; } catch { return null; } }
export const qualifies = (score: number, entries: Score[]) => validNumber(score) && score > 0 && (entries.length < 5 || score > entries[entries.length - 1].score);
export function recordResult(store: ScoreStore, entry: Score) {
  if (!validate([entry], entry.mode).length) return false;
  try { store.setItem(bestKey(entry.mode), String(Math.max(readBest(store, entry.mode), entry.score))); store.setItem(latestKey(entry.mode), JSON.stringify(entry)); return !store.sessionOnly; } catch { return false; }
}
export class ScoreSubmission {
  private submitted = false;
  reset() { this.submitted = false; }
  save(store: ScoreStore, entry: Score) {
    if (this.submitted || !validate([entry], entry.mode).length || !qualifies(entry.score, readScores(store, entry.mode))) return false;
    try { const entries = validate([...readScores(store, entry.mode), entry], entry.mode); store.setItem(scoreKey(entry.mode), JSON.stringify(entries)); this.submitted = true; return true; } catch { return false; }
  }
}
export function browserScores(): ScoreStore {
  try { return window.localStorage; } catch { const values = new Map<string, string>(); return { sessionOnly: true, getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } }; }
}
