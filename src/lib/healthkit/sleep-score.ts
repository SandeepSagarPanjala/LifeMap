/**
 * LifeMap Sleep Score — weighted duration / efficiency / architecture score.
 *
 * Weights (adult NSF-oriented targets):
 * - Duration 50% — linear to 8h (480 min) target, capped at 100
 * - Efficiency 20% — clinical ≥85% healthy; scaled 60%→85%→100%
 * - Composition 30% — Deep ~15–25% and REM ~20–25% of asleep time
 *
 * Not Apple Sleep Score.
 */

export const SLEEP_SCORE_FORMULA_FOOTNOTE = 'NSF-based estimate';

/** Adult night: 7–9h total; REM 20–25%, Deep 15–25%, rest Core. */
export const SLEEP_STAGES_AIM_COPY =
  'Aim for 1h 25m–2h 15m REM · 1h–2h 15m Deep · remaining Core';

export const SLEEP_STAGE_AIMS = [
  { key: 'rem', label: 'REM', aim: '1h 25m–2h 15m', color: '#08BCD4' },
  { key: 'deep', label: 'Deep', aim: '1h–2h 15m', color: '#4036B8' },
  { key: 'core', label: 'Core', aim: 'Remaining sleep', color: '#0A84FF' },
] as const;

export type SleepScoreBand =
  | 'Very Low'
  | 'Low'
  | 'OK'
  | 'High'
  | 'Very High';

/** Minute-based input matching the scoring algorithm. */
export type SleepData = {
  /** Core + REM + Deep (+ unspecified asleep). */
  durationMinutes: number;
  awakeMinutes: number;
  remMinutes: number;
  coreMinutes: number;
  deepMinutes: number;
  /** Reserved for future age-specific targets (defaults to adult). */
  age?: number;
};

export type SleepScoreInput = {
  asleepMs: number;
  awakeMs: number;
  /** Kept for rollups / future use; not used in the weighted score. */
  awakeningsOver5Min?: number;
  timeInBedMs?: number | null;
  remMs?: number;
  coreMs?: number;
  deepMs?: number;
};

export type SleepScoreResult = {
  total: number;
  band: SleepScoreBand;
  /** 0–100 component quality, before weight. */
  durationScore: number;
  efficiencyScore: number;
  compositionScore: number;
  /** Weighted points toward 50 / 20 / 30 (may differ from `total` by ±1 after rounding). */
  durationPoints: number;
  efficiencyPoints: number;
  compositionPoints: number;
  efficiencyPct: number;
  awakePct: number;
  deepPct: number;
  remPct: number;
  corePct: number;
};

const TARGET_DURATION_MINUTES = 480;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function bandForTotal(total: number): SleepScoreBand {
  if (total >= 90) {
    return 'Very High';
  }
  if (total >= 75) {
    return 'High';
  }
  if (total >= 50) {
    return 'OK';
  }
  if (total >= 25) {
    return 'Low';
  }
  return 'Very Low';
}

/**
 * Weighted sleep score from minute components (Gemini / NSF-oriented formula).
 */
export function calculateSleepScore(data: SleepData): number {
  return computeSleepScoreFromMinutes(data).total;
}

export function computeSleepScoreFromMinutes(
  data: SleepData,
): SleepScoreResult {
  const durationMinutes = Math.max(0, data.durationMinutes);
  const awakeMinutes = Math.max(0, data.awakeMinutes);
  const remMinutes = Math.max(0, data.remMinutes);
  const deepMinutes = Math.max(0, data.deepMinutes);
  // coreMinutes used for corePct in result
  void data.age;

  let durationScore = (durationMinutes / TARGET_DURATION_MINUTES) * 100;
  if (durationScore > 100) {
    durationScore = 100;
  }

  const totalTimeInBed = durationMinutes + awakeMinutes;
  const efficiencyPct =
    totalTimeInBed > 0 ? (durationMinutes / totalTimeInBed) * 100 : 0;
  let efficiencyScore = 0;
  if (efficiencyPct >= 85) {
    efficiencyScore = 80 + ((efficiencyPct - 85) / 15) * 20;
  } else if (efficiencyPct >= 60) {
    efficiencyScore = ((efficiencyPct - 60) / 25) * 80;
  }
  efficiencyScore = clamp(efficiencyScore, 0, 100);

  const actualDeepPct =
    durationMinutes > 0 ? (deepMinutes / durationMinutes) * 100 : 0;
  const actualRemPct =
    durationMinutes > 0 ? (remMinutes / durationMinutes) * 100 : 0;

  let deepScore = 0;
  if (actualDeepPct >= 15 && actualDeepPct <= 25) {
    deepScore = 100;
  } else if (actualDeepPct < 15) {
    deepScore = (actualDeepPct / 15) * 100;
  } else {
    deepScore = 90;
  }

  let remScore = 0;
  if (actualRemPct >= 20 && actualRemPct <= 25) {
    remScore = 100;
  } else if (actualRemPct < 20) {
    remScore = (actualRemPct / 20) * 100;
  } else {
    remScore = 90;
  }

  const compositionScore = (deepScore + remScore) / 2;
  const durationPoints = durationScore * 0.5;
  const efficiencyPoints = efficiencyScore * 0.2;
  const compositionPoints = compositionScore * 0.3;
  const finalScore = durationPoints + efficiencyPoints + compositionPoints;
  const total = Math.round(clamp(finalScore, 0, 100));

  const coreMinutes = Math.max(0, data.coreMinutes);
  const actualCorePct =
    durationMinutes > 0 ? (coreMinutes / durationMinutes) * 100 : 0;
  const awakePct =
    totalTimeInBed > 0 ? (awakeMinutes / totalTimeInBed) * 100 : 0;

  return {
    total,
    band: bandForTotal(total),
    durationScore: Math.round(durationScore),
    efficiencyScore: Math.round(efficiencyScore),
    compositionScore: Math.round(compositionScore),
    durationPoints: Math.round(durationPoints),
    efficiencyPoints: Math.round(efficiencyPoints),
    compositionPoints: Math.round(compositionPoints),
    efficiencyPct: Math.round(efficiencyPct),
    awakePct: Math.round(awakePct),
    deepPct: Math.round(actualDeepPct),
    remPct: Math.round(actualRemPct),
    corePct: Math.round(actualCorePct),
  };
}

/** Convenience wrapper over ms-based HealthKit day rollups. */
export function computeLifeMapSleepScore(
  input: SleepScoreInput,
): SleepScoreResult {
  const asleepMs = Math.max(0, input.asleepMs);
  const awakeMs = Math.max(0, input.awakeMs);
  const remMs = Math.max(0, input.remMs ?? 0);
  const coreMs = Math.max(0, input.coreMs ?? 0);
  const deepMs = Math.max(0, input.deepMs ?? 0);

  return computeSleepScoreFromMinutes({
    durationMinutes: asleepMs / 60_000,
    awakeMinutes: awakeMs / 60_000,
    remMinutes: remMs / 60_000,
    coreMinutes: coreMs / 60_000,
    deepMinutes: deepMs / 60_000,
  });
}
