import {getDayRange, getTodayDateKey} from '@/lib/day-utils';

export type ExportPeriodScope = 'today' | 'all' | 'day';

export type ExportPeriod = {
  scope: ExportPeriodScope;
  dateKey?: string;
  startAt: Date;
  endAt: Date;
};

export function resolveExportPeriod(
  scope: ExportPeriodScope,
  dateKey?: string,
): ExportPeriod {
  if (scope === 'all') {
    return {
      scope,
      startAt: new Date(0),
      endAt: new Date('2100-01-01T00:00:00.000Z'),
    };
  }

  const key = scope === 'today' ? getTodayDateKey() : dateKey;
  if (!key) {
    throw new Error('dateKey is required for day export scope');
  }

  const {start, end} = getDayRange(key);
  return {
    scope,
    dateKey: key,
    startAt: start,
    endAt: end,
  };
}

export function exportPeriodLabel(period: ExportPeriod): string {
  if (period.scope === 'all') {
    return 'all';
  }
  return period.dateKey ?? getTodayDateKey();
}
