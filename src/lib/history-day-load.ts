import type {HistoryData} from '@/lib/history-data-types';
import type {TripDetectionConfig} from '@/lib/trip-settings';

export type LoadHistoryCallbacks = {
  onPartial?: (data: HistoryData) => void;
};

export type CoalescedLoadOptions = LoadHistoryCallbacks & {
  force?: boolean;
  preferStored?: boolean;
};

type InflightEntry = {
  promise: Promise<HistoryData>;
  onPartials: Array<(data: HistoryData) => void>;
  lastPartial?: HistoryData;
};

const inflightByDateKey = new Map<string, InflightEntry>();

let globalLoadGeneration = 0;

/** Invalidate in-flight loads — only the latest generation may cache results. */
export function beginHistoryDayLoad(): number {
  globalLoadGeneration += 1;
  return globalLoadGeneration;
}

export function isCurrentHistoryDayLoad(generation: number): boolean {
  return generation === globalLoadGeneration;
}

/** @internal — reset between tests. */
export function resetHistoryDayLoadStateForTests(): void {
  globalLoadGeneration = 0;
  inflightByDateKey.clear();
}

/** Share one in-flight promise per date key (all days, including today). */
export async function loadHistoryForDayCoalesced(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  options?: CoalescedLoadOptions,
): Promise<HistoryData> {
  const {loadHistoryForSelectedDay} = await import('@/lib/trip-materialization');

  if (!options?.force) {
    const existing = inflightByDateKey.get(dateKey);
    if (existing != null) {
      if (options?.onPartial != null) {
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
