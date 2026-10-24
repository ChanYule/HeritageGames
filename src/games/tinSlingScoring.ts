/** Credit only improvements to a player's best score on each level. */
export function creditSlingScore(bestScores: Map<string, number>, level: number, player: 0 | 1, score: number): number {
  if (!Number.isSafeInteger(score) || score < 0) return 0;
  const key = `${level}:${player}`;
  const previous = bestScores.get(key) ?? 0;
  const best = Math.max(previous, score);
  bestScores.set(key, best);
  return best - previous;
}
