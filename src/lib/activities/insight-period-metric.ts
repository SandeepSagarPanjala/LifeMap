import { TZDate } from '@date-fns/tz';
import { endOfMonth, startOfMonth } from 'date-fns';

import type { ActivityFieldDefinition } from '@/lib/activities/activity-definition';
import { parseActivityValuesJson } from '@/lib/activities/activity-definition';
import type { MomentRow } from '@/db/repositories/moments';
import { APP_TIMEZONE } from '@/lib/timezone';

export type InsightMetricKind = 'money' | 'number' | 'duration';

export type InsightPeriodMetric =
  | { id: 'logs'; kind: 'logs' }
  | {
      id: string;
      kind: InsightMetricKind;
      fieldId: string;
      label: string;
    };

export function metricFieldsFromDefinition(
  fields: readonly ActivityFieldDefinition[],
): Array<{
  fieldId: string;
  label: string;
  kind: InsightMetricKind;
}> {
  const out: Array<{
    fieldId: string;
    label: string;
    kind: InsightMetricKind;
  }> = [];
  for (const field of fields) {
    if (
      field.type === 'money' ||
      field.type === 'number' ||
      field.type === 'duration'
    ) {
      out.push({
        fieldId: field.id,
        label: field.label,
        kind: field.type,
      });
    }
  }
  return out;
}

function fieldContribution(
  moment: MomentRow,
  fieldId: string,
  kind: InsightMetricKind,
): number {
  const value = parseActivityValuesJson(moment.activityValuesJson)[fieldId];
  if (value == null) {
    return 0;
  }
  if (kind === 'money' && value.type === 'money') {
    return value.amount;
  }
  if (kind === 'number' && value.type === 'number') {
    return value.value;
  }
  if (kind === 'duration' && value.type === 'duration') {
    return value.seconds;
  }
  return 0;
}

/** Per-log contribution for the selected insights metric. */
export function momentMetricContribution(
  moment: MomentRow,
  metric: InsightPeriodMetric,
): number {
  if (metric.kind === 'logs') {
    return 1;
  }
  return fieldContribution(moment, metric.fieldId, metric.kind);
}

export function sumMetricInRange(
  moments: readonly MomentRow[],
  metric: InsightPeriodMetric,
  start: Date,
  end: Date,
): number {
  const startMs = start.getTime();
  const endMs = end.getTime();
  let total = 0;
  for (const moment of moments) {
    const t = moment.timestamp.getTime();
    if (t < startMs || t > endMs) {
      continue;
    }
    total += momentMetricContribution(moment, metric);
  }
  return total;
}

export function metricValuesByMonth(
  moments: readonly MomentRow[],
  metric: InsightPeriodMetric,
  year: number,
): number[] {
  const values = Array.from({ length: 12 }, () => 0);
  for (const moment of moments) {
    const z = new TZDate(moment.timestamp, APP_TIMEZONE);
    if (z.getFullYear() !== year) {
      continue;
    }
    const month = z.getMonth();
    if (metric.kind === 'logs') {
      values[month]! += 1;
      continue;
    }
    values[month]! += fieldContribution(moment, metric.fieldId, metric.kind);
  }
  return values;
}

export function sumMetricInMonth(
  moments: readonly MomentRow[],
  metric: InsightPeriodMetric,
  monthDate: Date,
): number {
  const monthStart = startOfMonth(new TZDate(monthDate, APP_TIMEZONE));
  const monthEnd = endOfMonth(monthStart);
  return sumMetricInRange(moments, metric, monthStart, monthEnd);
}

export function formatMetricCompact(
  metric: InsightPeriodMetric,
  value: number,
): string {
  if (metric.kind === 'logs') {
    return String(Math.round(value));
  }
  if (metric.kind === 'money') {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (metric.kind === 'number') {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  const minutes = Math.round(value / 60);
  if (minutes < 1) {
    return value > 0 ? '<1m' : '0m';
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h ${rem}m`;
}

/** Short period (Today / This Week): "3 logs", "Spent $12", "Total 5", "1h 20m". */
export function formatMetricShortPhrase(
  metric: InsightPeriodMetric,
  value: number,
): string {
  if (metric.kind === 'logs') {
    const n = Math.round(value);
    return `${n} ${n === 1 ? 'log' : 'logs'}`;
  }
  if (metric.kind === 'money') {
    return `Spent ${formatMetricCompact(metric, value)}`;
  }
  if (metric.kind === 'number') {
    return `Total ${formatMetricCompact(metric, value)}`;
  }
  return formatMetricCompact(metric, value);
}

/** Month / year headers: "3 Logs this Month", "Spent $12 this Year". */
export function formatMetricPeriodPhrase(
  metric: InsightPeriodMetric,
  value: number,
  period: 'Month' | 'Year',
): string {
  if (metric.kind === 'logs') {
    const n = Math.round(value);
    return `${n} Logs this ${period}`;
  }
  if (metric.kind === 'money') {
    return `Spent ${formatMetricCompact(metric, value)} this ${period}`;
  }
  if (metric.kind === 'number') {
    return `Total ${formatMetricCompact(metric, value)} this ${period}`;
  }
  return `${formatMetricCompact(metric, value)} this ${period}`;
}
