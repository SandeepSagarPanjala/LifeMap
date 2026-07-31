/**
 * LifeMap Sleep Score — National Sleep Foundation adult indicators only.
 *
 * Quantity (Hirshkowitz et al., Sleep Health 2015):
 * - Adults: 7–9 hours recommended
 *
 * Continuity / awake (Ohayon et al., Sleep Health 2017; NSF public checklist):
 * - WASO ≤20 minutes
 * - Sleep efficiency ≥85%
 * - Awakenings >5 minutes: ≤1 per night
 *
 * Architecture where NSF published an adult “good” range (Ohayon 2017):
 * - REM 21–30% of total sleep
 * - N3 / Deep 16–20% of total sleep
 * - Core / N2: NSF published no adult “good” range (only that N2 >81%
 *   does not indicate good quality) — shown, not scored as a positive check
 *
 * Sleep latency ≤30 min is on the NSF checklist but omitted until HealthKit
 * provides reliable in-bed→asleep timing.
 *
 * Score = round(100 × checksPassed / checksTotal). No LifeMap-invented tapers.
 * Not Apple Sleep Score. Not an official NSF product score.
 */

export const SLEEP_SCORE_FORMULA_FOOTNOTE =
  'NSF adult checklist: 7–9h, WASO ≤20 min, efficiency ≥85%, ≤1 awakening >5 min, REM 21–30%, Deep 16–20%. Core has no NSF adult good range. Not Apple Sleep Score.';

export type SleepScoreBand =
  | 'Very Low'
  | 'Low'
  | 'OK'
  | 'High'
  | 'Very High';

export type SleepScoreInput = {
  asleepMs: number;
  awakeMs: number;
  /** Episodes of wake after sleep onset lasting more than 5 minutes. */
  awakeningsOver5Min: number;
  /** Optional time-in-bed for efficiency; defaults to asleep + awake. */
  timeInBedMs?: number | null;
  remMs?: number;
  coreMs?: number;
  deepMs?: number;
};

export type NsfCheckId =
  | 'duration'
  | 'waso'
  | 'efficiency'
  | 'awakenings'
  | 'rem'
  | 'deep';

export type NsfCheck = {
  id: NsfCheckId;
  label: string;
  passed: boolean;
  /** What this night measured. */
  detail: string;
  /** Exact NSF adult rule used. */
  rule: string;
};

export type SleepStageContext = {
  remShare: number | null;
  deepShare: number | null;
  coreShare: number | null;
  remInNsfGoodRange: boolean | null;
  deepInNsfGoodRange: boolean | null;
};

export type SleepScoreResult = {
  total: number;
  band: SleepScoreBand;
  checksPassed: number;
  checksTotal: number;
  /** Minimum passes NSF would call “most” (~75%). */
  goodAtChecks: number;
  checks: NsfCheck[];
  stages: SleepStageContext;
};

/** NSF adult recommended sleep duration. */
export const NSF_ADULT_DURATION_MIN_MS = 7 * 3600_000;
export const NSF_ADULT_DURATION_MAX_MS = 9 * 3600_000;
/** NSF adult good WASO. */
export const NSF_ADULT_WASO_GOOD_MAX_MS = 20 * 60_000;
/** NSF adult good sleep efficiency. */
export const NSF_ADULT_EFFICIENCY_GOOD_MIN = 0.85;
/** NSF adult good awakenings >5 min. */
export const NSF_ADULT_AWAKENINGS_GOOD_MAX = 1;
/** NSF adult REM share indicating good sleep quality. */
export const NSF_ADULT_REM_GOOD_MIN = 0.21;
export const NSF_ADULT_REM_GOOD_MAX = 0.3;
/** NSF adult N3/deep share indicating good sleep quality. */
export const NSF_ADULT_DEEP_GOOD_MIN = 0.16;
export const NSF_ADULT_DEEP_GOOD_MAX = 0.2;
/** NSF: N2/Core above this does not indicate good sleep quality. */
export const NSF_ADULT_CORE_NOT_GOOD_MIN = 0.81;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** NSF public copy: answering yes to most checks → good quality (~75%). */
export function nsfGoodAtChecks(checksTotal: number): number {
  return Math.max(1, Math.ceil(checksTotal * 0.75));
}

function bandForPassed(passed: number, total: number): SleepScoreBand {
  if (total <= 0) {
    return 'Very Low';
  }
  const ratio = passed / total;
  if (ratio >= 1) {
    return 'Very High';
  }
  if (passed >= nsfGoodAtChecks(total)) {
    return 'High';
  }
  if (ratio >= 0.5) {
    return 'OK';
  }
  if (ratio > 0) {
    return 'Low';
  }
  return 'Very Low';
}

function formatMinutes(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) {
    return `${mins}m`;
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatHours(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) {
    return `${m}m`;
  }
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function pctLabel(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function stageContext(input: SleepScoreInput): SleepStageContext {
  const asleep = input.asleepMs;
  if (asleep <= 0) {
    return {
      remShare: null,
      deepShare: null,
      coreShare: null,
      remInNsfGoodRange: null,
      deepInNsfGoodRange: null,
    };
  }
  const remShare =
    input.remMs != null ? clamp(input.remMs / asleep, 0, 1) : null;
  const deepShare =
    input.deepMs != null ? clamp(input.deepMs / asleep, 0, 1) : null;
  const coreShare =
    input.coreMs != null ? clamp(input.coreMs / asleep, 0, 1) : null;
  return {
    remShare,
    deepShare,
    coreShare,
    remInNsfGoodRange:
      remShare == null
        ? null
        : remShare >= NSF_ADULT_REM_GOOD_MIN &&
          remShare <= NSF_ADULT_REM_GOOD_MAX,
    deepInNsfGoodRange:
      deepShare == null
        ? null
        : deepShare >= NSF_ADULT_DEEP_GOOD_MIN &&
          deepShare <= NSF_ADULT_DEEP_GOOD_MAX,
  };
}

export function computeLifeMapSleepScore(
  input: SleepScoreInput,
): SleepScoreResult {
  const asleepMs = Math.max(0, input.asleepMs);
  const awakeMs = Math.max(0, input.awakeMs);
  const timeInBedMs = Math.max(
    asleepMs + awakeMs,
    input.timeInBedMs ?? 0,
    1,
  );
  const efficiency = asleepMs / timeInBedMs;
  const awakenings = Math.max(0, Math.floor(input.awakeningsOver5Min));
  const stages = stageContext(input);
  const hasStagedSleep =
    (input.remMs ?? 0) + (input.coreMs ?? 0) + (input.deepMs ?? 0) > 0;

  const checks: NsfCheck[] = [
    {
      id: 'duration',
      label: 'Duration',
      passed:
        asleepMs >= NSF_ADULT_DURATION_MIN_MS &&
        asleepMs <= NSF_ADULT_DURATION_MAX_MS,
      detail: `Slept ${formatHours(asleepMs)}`,
      rule: 'NSF adults: 7–9 hours recommended',
    },
    {
      id: 'waso',
      label: 'Awake (WASO)',
      passed: awakeMs <= NSF_ADULT_WASO_GOOD_MAX_MS,
      detail: `Awake ${formatMinutes(awakeMs)} after sleep onset`,
      rule: 'NSF adults: ≤20 minutes awake after sleep onset',
    },
    {
      id: 'efficiency',
      label: 'Efficiency',
      passed: efficiency >= NSF_ADULT_EFFICIENCY_GOOD_MIN,
      detail: `${Math.round(efficiency * 100)}% asleep while in bed`,
      rule: 'NSF: ≥85% sleep efficiency (e.g. 7 of 8 hours)',
    },
    {
      id: 'awakenings',
      label: 'Awakenings',
      passed: awakenings <= NSF_ADULT_AWAKENINGS_GOOD_MAX,
      detail:
        awakenings === 1
          ? '1 awakening over 5 minutes'
          : `${awakenings} awakenings over 5 minutes`,
      rule: 'NSF adults: ≤1 awakening longer than 5 minutes',
    },
  ];

  if (hasStagedSleep && stages.remShare != null) {
    checks.push({
      id: 'rem',
      label: 'REM',
      passed: stages.remInNsfGoodRange === true,
      detail: `${formatHours(input.remMs ?? 0)} · ${pctLabel(stages.remShare)} of asleep`,
      rule: 'NSF adults: REM 21–30% indicates good sleep quality',
    });
  }

  if (hasStagedSleep && stages.deepShare != null) {
    checks.push({
      id: 'deep',
      label: 'Deep',
      passed: stages.deepInNsfGoodRange === true,
      detail: `${formatHours(input.deepMs ?? 0)} · ${pctLabel(stages.deepShare)} of asleep`,
      rule: 'NSF adults: Deep (N3) 16–20% indicates good sleep quality',
    });
  }

  const checksPassed = checks.filter(c => c.passed).length;
  const checksTotal = checks.length;
  const goodAtChecks = nsfGoodAtChecks(checksTotal);
  const total = Math.round((100 * checksPassed) / checksTotal);

  return {
    total,
    band: bandForPassed(checksPassed, checksTotal),
    checksPassed,
    checksTotal,
    goodAtChecks,
    checks,
    stages,
  };
}
