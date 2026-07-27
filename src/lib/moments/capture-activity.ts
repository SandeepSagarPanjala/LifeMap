import type { ActivityRow } from '@/db/repositories/activities';
import { insertMoment, type MomentRow } from '@/db/repositories/moments';
import {
  serializeActivityValuesJson,
  type ActivityValuesMap,
} from '@/lib/activities/activity-definition';

export async function saveActivityMoment(
  activity: ActivityRow,
  values?: ActivityValuesMap,
): Promise<MomentRow> {
  const activityValuesJson =
    values != null && Object.keys(values).length > 0
      ? serializeActivityValuesJson(values)
      : null;

  return insertMoment({
    type: 'activity',
    timestamp: new Date(),
    activityId: activity.id,
    activityEmoji: activity.emoji,
    activityLabel: activity.label,
    contentFormat: 'activity',
    activityValuesJson,
  });
}
