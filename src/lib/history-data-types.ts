import type { LocationPointRow } from '@/db/repositories/location-days';
import type { MomentRow } from '@/db/repositories/moments';
import type { DayTimelineEntry } from '@/lib/trip-detection';
import type { HistoryTimeRange } from '@/lib/history-timeline';

export type HistoryData = {
  dateKey: string;
  points: LocationPointRow[];
  entries: DayTimelineEntry[];
  range: HistoryTimeRange;
  /** Day moments loaded with the timeline (map pins / stay chips). */
  moments?: MomentRow[];
};
