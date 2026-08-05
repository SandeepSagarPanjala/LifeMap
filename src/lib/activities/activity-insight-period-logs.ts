import type { ActivityFieldDefinition } from '@/lib/activities/activity-definition';
import { parseActivityValuesJson } from '@/lib/activities/activity-definition';
import type { MomentRow } from '@/db/repositories/moments';

/** Text field id linked from a Bill scan as shop / restaurant name. */
export function resolveShopNameFieldId(
  fields: readonly ActivityFieldDefinition[],
): string | null {
  for (const field of fields) {
    if (
      field.type === 'scan' &&
      typeof field.fillShopNameField === 'string' &&
      field.fillShopNameField.trim()
    ) {
      return field.fillShopNameField.trim();
    }
  }
  return null;
}

export function shopNameFromMoment(
  moment: MomentRow,
  shopNameFieldId: string | null,
): string | null {
  if (shopNameFieldId == null) {
    return null;
  }
  const value = parseActivityValuesJson(moment.activityValuesJson)[
    shopNameFieldId
  ];
  if (value?.type !== 'text') {
    return null;
  }
  const trimmed = value.value.trim().replace(/\s+/g, ' ');
  return trimmed || null;
}

/** Moments in [start, end], newest first. */
export function momentsInRange(
  moments: readonly MomentRow[],
  start: Date,
  end: Date,
): MomentRow[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return moments
    .filter(moment => {
      const t = moment.timestamp.getTime();
      return t >= startMs && t <= endMs;
    })
    .slice()
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
