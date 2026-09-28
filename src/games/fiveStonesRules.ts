export const FIVE_STONES_PATTERNS = [[1, 1, 1, 1], [2, 2], [3, 1], [4]] as const;
export const FIVE_STONES_ATTEMPT_LIMIT = 12;
export const FIVE_STONES_TOSS_MS = { practice: 8000, challenge: 4800 } as const;

export type FiveStonesRound = {
  stage: number;
  step: number;
  score: number;
  throws: number;
  successes: number;
  collected: number[];
  selected: number[];
  inAir: boolean;
};

export function newFiveStonesRound(): FiveStonesRound {
  return { stage: 1, step: 0, score: 0, throws: 0, successes: 0, collected: [], selected: [], inAir: false };
}

export function fiveStonesComplete(round: FiveStonesRound) {
  return round.stage === 4 && round.step === FIVE_STONES_PATTERNS[3].length;
}

export function fiveStonesTarget(round: FiveStonesRound) {
  return FIVE_STONES_PATTERNS[round.stage - 1][round.step] ?? 0;
}

type Action =
  | { type: "toss"; limit?: number }
  | { type: "collect"; id: number }
  | { type: "catch"; progress: number }
  | { type: "miss" };

// The state transition is synchronous so rapid taps cannot collect or score twice.
export function advanceFiveStones(round: FiveStonesRound, action: Action): FiveStonesRound {
  if (action.type === "toss") {
    if (round.inAir || fiveStonesComplete(round) || round.throws >= (action.limit ?? Infinity)) return round;
    return { ...round, inAir: true, selected: [], throws: round.throws + 1 };
  }
  if (!round.inAir) return round;
  if (action.type === "miss" || (action.type === "catch" && action.progress >= 100)) {
    return { ...round, inAir: false, selected: [] };
  }
  const target = fiveStonesTarget(round);
  if (action.type === "collect") {
    if (!Number.isInteger(action.id) || action.id < 0 || action.id > 3 || round.collected.includes(action.id) || round.selected.includes(action.id) || round.selected.length >= target) return round;
    return { ...round, selected: [...round.selected, action.id] };
  }
  if (action.type !== "catch" || !Number.isFinite(action.progress) || action.progress < 50 || round.selected.length !== target) return round;
  const step = round.step + 1;
  const nextStage = step >= FIVE_STONES_PATTERNS[round.stage - 1].length && round.stage < 4;
  return {
    ...round,
    inAir: false,
    stage: nextStage ? round.stage + 1 : round.stage,
    step: nextStage ? 0 : step,
    score: round.score + target * 120 + Math.max(0, Math.round((100 - action.progress) * 2)),
    successes: round.successes + 1,
    collected: nextStage ? [] : [...round.collected, ...round.selected],
    selected: [],
  };
}
