import type { HistoryData } from '@/lib/history-data-types';
import {
  bumpHistoryDayLoadGeneration,
  isCurrentHistoryDayLoad,
  resetHistoryLoadGenerationForTests,
} from '@/lib/history-load-generation';
import { loadHistoryForSelectedDay } from '@/lib/trip-materialization';
import type { TripDetectionConfig } from '@/lib/trip-settings';

export { isCurrentHistoryDayLoad } from '@/lib/history-load-generation';

export type LoadHistoryCallbacks = {
  onPartial?: (data: HistoryData) => void;
};

export type CoalescedLoadOptions = LoadHistoryCallbacks & {
  force?: boolean;
  preferStored?: boolean;
  /** When set, stale loads skip heavy work and must not cache results. */
  loadGeneration?: number;
};

type InflightEntry = {
  promise: Promise<HistoryData>;
  onPartials: Array<(data: HistoryData) => void>;
  lastPartial?: HistoryData;
};

const inflightByDateKey = new Map<string, InflightEntry>();

/** Invalidate in-flight loads — only the latest generation may cache results. */
export function beginHistoryDayLoad(): number {
  // Drop stale partial listeners so closures do not retain HistoryData.
  for (const entry of inflightByDateKey.values()) {
    entry.onPartials.length = 0;
    entry.lastPartial = undefined;
  }
  return bumpHistoryDayLoadGeneration();
}

/** @internal — reset between tests. */
export function resetHistoryDayLoadStateForTests(): void {
  resetHistoryLoadGenerationForTests();
  inflightByDateKey.clear();
}

/** Share one in-flight promise per date key (all days, including today). */
export async function loadHistoryForDayCoalesced(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  options?: CoalescedLoadOptions,
): Promise<HistoryData> {
  if (!options?.force) {
    const existing = inflightByDateKey.get(dateKey);
    if (existing != null) {
      if (options?.onPartial != null) {
        existing.onPartials.length = 0;
        existing.onPartials.push(options.onPartial);
        if (existing.lastPartial != null) {
          options.onPartial(existing.lastPartial);
        }
      }
      return existing.promise;
    }
  }

  const onPartials: Array<(data: HistoryData) => void> =
    options?.onPartial != null ? [options.onPartial] : [];
  const entry: InflightEntry = {
    promise: Promise.resolve({} as HistoryData),
    onPartials,
  };

  entry.promise = loadHistoryForSelectedDay(dateKey, detectionConfig, {
    force: options?.force,
    preferStored: options?.preferStored,
    loadGeneration: options?.loadGeneration,
    onPartial: partial => {
      entry.lastPartial = partial;
      for (const callback of onPartials) {
        callback(partial);
      }
    },
  }).finally(() => {
    inflightByDateKey.delete(dateKey);
  });

  if (!options?.force) {
    inflightByDateKey.set(dateKey, entry);
  }

  return entry.promise;
}
