import {getTodayDateKey} from '@/lib/day-utils';
import type {HistoryData} from '@/lib/history-data-types';
import type {TripDetectionConfig} from '@/lib/trip-settings';

export type LoadHistoryCallbacks = {
  onPartial?: (data: HistoryData) => void;
};

export type CoalescedLoadOptions = LoadHistoryCallbacks & {
  force?: boolean;
};

type InflightToday = {
  promise: Promise<HistoryData>;
  onPartials: Array<(data: HistoryData) => void>;
  lastPartial?: HistoryData;
};

const inflightToday = new Map<string, InflightToday>();

/** One today load at a time — preload and map hook share the same promise. */
export async function loadHistoryForDayCoalesced(
  dateKey: string,
  detectionConfig: TripDetectionConfig,
  options?: CoalescedLoadOptions,
): Promise<HistoryData> {
  const {loadHistoryForSelectedDay} = await import('@/lib/trip-materialization');

  if (dateKey !== getTodayDateKey() || options?.force) {
    return loadHistoryForSelectedDay(dateKey, detectionConfig, options);
  }

  const existing = inflightToday.get(dateKey);
  if (existing != null) {
    if (options?.onPartial != null) {
      existing.onPartials.push(options.onPartial);
      if (existing.lastPartial != null) {
        options.onPartial(existing.lastPartial);
      }
    }
    return existing.promise;
  }

  const onPartials: Array<(data: HistoryData) => void> =
    options?.onPartial != null ? [options.onPartial] : [];
  const entry: InflightToday = {
    promise: Promise.resolve({} as HistoryData),
    onPartials,
  };

  entry.promise = loadHistoryForSelectedDay(dateKey, detectionConfig, {
    onPartial: partial => {
      entry.lastPartial = partial;
      for (const callback of onPartials) {
        callback(partial);
      }
    },
  }).finally(() => {
    inflightToday.delete(dateKey);
  });

  inflightToday.set(dateKey, entry);
  return entry.promise;
}
