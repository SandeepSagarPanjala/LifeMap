import type {ActivityRow} from '@/db/repositories/activities';
import {insertMoment, type MomentRow} from '@/db/repositories/moments';

export async function saveActivityMoment(activity: ActivityRow): Promise<MomentRow> {
  return insertMoment({
    type: 'activity',
    timestamp: new Date(),
    activityId: activity.id,
    activityEmoji: activity.emoji,
    activityLabel: activity.label,
    contentFormat: 'activity',
  });
}
