import type { ActivityRow } from '@/db/repositories/activities';
import type { MomentRow } from '@/db/repositories/moments';
import {
  parseActivityValuesJson,
  type ActivityFieldDefinition,
} from '@/lib/activities/activity-definition';
import { summarizeAmounts } from '@/lib/activities/activity-insights';

/** Field types that get v3 widgets (photo / bill / text intentionally omitted). */
export const ACTIVITY_FIELD_WIDGET_TYPES = [
  'money',
  'number',
  'list',
  'choice',
  'duration',
  'toggle',
] as const;

export type ActivityFieldWidgetType =
  (typeof ACTIVITY_FIELD_WIDGET_TYPES)[number];

export type RankedToken = {
  label: string;
  count: number;
  share: number;
};

export type ActivityFieldWidget =
  | {
      kind: 'money';
      fieldId: string;
      title: string;
      sentence: string;
      subtitle: string;
      total: number;
      average: number;
      week: number;
      month: number;
      year: number;
      count: number;
    }
  | {
      kind: 'number';
      fieldId: string;
      title: string;
      sentence: string;
      subtitle: string;
      total: number;
      average: number;
      latest: number;
      count: number;
    }
  | {
      kind: 'list';
      fieldId: string;
      title: string;
      sentence: string;
      subtitle: string;
      topItems: RankedToken[];
      totalMentions: number;
    }
  | {
      kind: 'choice';
      fieldId: string;
      title: string;
      sentence: string;
      subtitle: string;
      options: RankedToken[];
      favorite: string;
      count: number;
    }
  | {
      kind: 'duration';
      fieldId: string;
      title: string;
      sentence: string;
      subtitle: string;
      averageSeconds: number;
      totalSeconds: number;
      count: number;
    }
  | {
      kind: 'toggle';
      fieldId: string;
      title: string;
      sentence: string;
      subtitle: string;
      yesCount: number;
      noCount: number;
      yesShare: number;
      count: number;
    };

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDurationMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) {
    return 'under a minute';
  }
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function rankedFromTallies(
  tallies: Map<string, number>,
  limit: number,
): RankedToken[] {
  const total = [...tallies.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) {
    return [];
  }
  return [...tallies.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      share: count / total,
    }));
}

function moneyWidget(
  field: ActivityFieldDefinition,
  moments: readonly MomentRow[],
  now: Date = new Date(),
): ActivityFieldWidget | null {
  if (field.type !== 'money') {
    return null;
  }
  let count = 0;
  for (const moment of moments) {
    const value = parseActivityValuesJson(moment.activityValuesJson)[field.id];
    if (value?.type === 'money') {
      count += 1;
    }
  }
  if (count === 0) {
    return null;
  }
  const [summary] = summarizeAmounts(moments, [field], 'all', now);
  if (summary == null) {
    return null;
  }
  const total = summary.all;
  const average = total / count;
  return {
    kind: 'money',
    fieldId: field.id,
    title: field.label,
    sentence: `Average ${field.label.toLowerCase()} is ${formatMoney(average)} per log.`,
    subtitle: `${formatMoney(total)} across ${count} log${count === 1 ? '' : 's'}`,
    total,
    average,
    week: summary.week,
    month: summary.month,
    year: summary.year,
    count,
  };
}

function numberWidget(
  field: ActivityFieldDefinition,
  moments: readonly MomentRow[],
): ActivityFieldWidget | null {
  if (field.type !== 'number') {
    return null;
  }
  const samples: Array<{ at: number; value: number }> = [];
  for (const moment of moments) {
    const value = parseActivityValuesJson(moment.activityValuesJson)[field.id];
    if (value?.type === 'number') {
      samples.push({ at: moment.timestamp.getTime(), value: value.value });
    }
  }
  if (samples.length === 0) {
    return null;
  }
  samples.sort((a, b) => a.at - b.at);
  const values = samples.map(sample => sample.value);
  const total = values.reduce((a, b) => a + b, 0);
  const average = total / values.length;
  const latest = samples[samples.length - 1]!.value;
  return {
    kind: 'number',
    fieldId: field.id,
    title: field.label,
    sentence: `Average ${field.label.toLowerCase()} is ${formatNumber(average)}.`,
    subtitle: `Latest ${formatNumber(latest)} · ${values.length} log${values.length === 1 ? '' : 's'}`,
    total,
    average,
    latest,
    count: values.length,
  };
}

function listWidget(
  field: ActivityFieldDefinition,
  moments: readonly MomentRow[],
): ActivityFieldWidget | null {
  if (field.type !== 'list') {
    return null;
  }
  const tallies = new Map<string, number>();
  let totalMentions = 0;
  for (const moment of moments) {
    const value = parseActivityValuesJson(moment.activityValuesJson)[field.id];
    if (value?.type !== 'list') {
      continue;
    }
    for (const item of value.items) {
      const key = item.trim();
      if (!key) {
        continue;
      }
      tallies.set(key, (tallies.get(key) ?? 0) + 1);
      totalMentions += 1;
    }
  }
  if (totalMentions === 0) {
    return null;
  }
  const topItems = rankedFromTallies(tallies, 5);
  const top = topItems[0]!;
  return {
    kind: 'list',
    fieldId: field.id,
    title: field.label,
    sentence: `${top.label} shows up most in ${field.label.toLowerCase()}.`,
    subtitle: `${totalMentions} item${totalMentions === 1 ? '' : 's'} logged`,
    topItems,
    totalMentions,
  };
}

function choiceWidget(
  field: ActivityFieldDefinition,
  moments: readonly MomentRow[],
): ActivityFieldWidget | null {
  if (field.type !== 'choice') {
    return null;
  }
  const tallies = new Map<string, number>();
  for (const moment of moments) {
    const value = parseActivityValuesJson(moment.activityValuesJson)[field.id];
    if (value?.type === 'choice' && value.value.trim()) {
      const key = value.value.trim();
      tallies.set(key, (tallies.get(key) ?? 0) + 1);
    }
  }
  const count = [...tallies.values()].reduce((a, b) => a + b, 0);
  if (count === 0) {
    return null;
  }
  const options = rankedFromTallies(tallies, 6);
  const favorite = options[0]!;
  return {
    kind: 'choice',
    fieldId: field.id,
    title: field.label,
    sentence: `${favorite.label} is your most common ${field.label.toLowerCase()}.`,
    subtitle: `${Math.round(favorite.share * 100)}% of ${count} log${count === 1 ? '' : 's'}`,
    options,
    favorite: favorite.label,
    count,
  };
}

function durationWidget(
  field: ActivityFieldDefinition,
  moments: readonly MomentRow[],
): ActivityFieldWidget | null {
  if (field.type !== 'duration') {
    return null;
  }
  const secondsList: number[] = [];
  for (const moment of moments) {
    const value = parseActivityValuesJson(moment.activityValuesJson)[field.id];
    if (value?.type === 'duration' && value.seconds > 0) {
      secondsList.push(value.seconds);
    }
  }
  if (secondsList.length === 0) {
    return null;
  }
  const totalSeconds = secondsList.reduce((a, b) => a + b, 0);
  const averageSeconds = totalSeconds / secondsList.length;
  return {
    kind: 'duration',
    fieldId: field.id,
    title: field.label,
    sentence: `Typical ${field.label.toLowerCase()} is ${formatDurationMinutes(averageSeconds)}.`,
    subtitle: `${formatDurationMinutes(totalSeconds)} total · ${secondsList.length} log${secondsList.length === 1 ? '' : 's'}`,
    averageSeconds,
    totalSeconds,
    count: secondsList.length,
  };
}

function toggleWidget(
  field: ActivityFieldDefinition,
  moments: readonly MomentRow[],
): ActivityFieldWidget | null {
  if (field.type !== 'toggle') {
    return null;
  }
  let yesCount = 0;
  let noCount = 0;
  for (const moment of moments) {
    const value = parseActivityValuesJson(moment.activityValuesJson)[field.id];
    if (value?.type !== 'toggle') {
      continue;
    }
    if (value.value) {
      yesCount += 1;
    } else {
      noCount += 1;
    }
  }
  const count = yesCount + noCount;
  if (count === 0) {
    return null;
  }
  const yesShare = yesCount / count;
  const sentence =
    yesShare >= 0.5
      ? `Usually yes for ${field.label.toLowerCase()} (${Math.round(yesShare * 100)}%).`
      : `Usually no for ${field.label.toLowerCase()} (${Math.round((1 - yesShare) * 100)}%).`;
  return {
    kind: 'toggle',
    fieldId: field.id,
    title: field.label,
    sentence,
    subtitle: `Yes ${yesCount} · No ${noCount}`,
    yesCount,
    noCount,
    yesShare,
    count,
  };
}

/**
 * Build v3 field widgets for an activity.
 * Skips photo / scan (bill) / text. Omits a widget when that field has no values.
 */
export function buildActivityFieldWidgets(input: {
  activity: ActivityRow;
  moments: readonly MomentRow[];
}): ActivityFieldWidget[] {
  const { activity, moments } = input;
  const widgets: ActivityFieldWidget[] = [];

  for (const field of activity.fields) {
    if (field.type === 'photo' || field.type === 'scan' || field.type === 'text') {
      continue;
    }
    let widget: ActivityFieldWidget | null = null;
    switch (field.type) {
      case 'money':
        widget = moneyWidget(field, moments);
        break;
      case 'number':
        widget = numberWidget(field, moments);
        break;
      case 'list':
        widget = listWidget(field, moments);
        break;
      case 'choice':
        widget = choiceWidget(field, moments);
        break;
      case 'duration':
        widget = durationWidget(field, moments);
        break;
      case 'toggle':
        widget = toggleWidget(field, moments);
        break;
      default:
        break;
    }
    if (widget != null) {
      widgets.push(widget);
    }
  }

  return widgets;
}
