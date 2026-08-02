import { buildActivityFieldWidgets } from '@/lib/activities/activity-field-widgets';
import type { ActivityRow } from '@/db/repositories/activities';
import type { MomentRow } from '@/db/repositories/moments';
import { makeMoment } from '../../../../__tests__/helpers/fixtures';

function activityMoment(
  partial: Partial<MomentRow> & Pick<MomentRow, 'id' | 'timestamp'>,
): MomentRow {
  return makeMoment({
    type: 'activity',
    activityId: 1,
    activityEmoji: '🏋️',
    activityLabel: 'Gym',
    ...partial,
  });
}

const baseActivity: ActivityRow = {
  id: 1,
  emoji: '🏋️',
  label: 'Gym',
  sortOrder: 0,
  createdAt: new Date('2026-01-15T00:00:00Z'),
  archivedAt: null,
  schemaVersion: 1,
  source: 'blank',
  templateId: null,
  definitionJson: '[]',
  fields: [
    { id: 'spend', type: 'money', label: 'Spend', required: false },
    { id: 'reps', type: 'number', label: 'Reps', required: false },
    { id: 'items', type: 'list', label: 'Items', required: false },
    {
      id: 'focus',
      type: 'choice',
      label: 'Focus',
      required: false,
      options: ['Legs', 'Arms'],
    },
    { id: 'length', type: 'duration', label: 'Length', required: false },
    { id: 'sore', type: 'toggle', label: 'Sore', required: false },
    { id: 'note', type: 'text', label: 'Note', required: false },
    { id: 'shot', type: 'photo', label: 'Photo', required: false },
    {
      id: 'bill',
      type: 'scan',
      label: 'Bill',
      required: false,
      extract: 'amount',
    },
  ],
  intent: 'more',
  reminderEnabled: false,
  reminderRepeat: 'daily',
  reminderTimeMinutes: null,
  reminderWeekday: null,
  reminderDayOfMonth: null,
  reminderAnchorAt: null,
  reminderSound: 'ding',
};

describe('buildActivityFieldWidgets', () => {
  it('returns no widgets when fields have no values', () => {
    const widgets = buildActivityFieldWidgets({
      activity: baseActivity,
      moments: [
        activityMoment({
          id: 1,
          timestamp: new Date('2026-07-01T12:00:00Z'),
          activityValuesJson: '{}',
        }),
      ],
    });
    expect(widgets).toEqual([]);
  });

  it('ignores text, photo, and bill even when present', () => {
    const widgets = buildActivityFieldWidgets({
      activity: baseActivity,
      moments: [
        activityMoment({
          id: 1,
          timestamp: new Date('2026-07-01T12:00:00Z'),
          activityValuesJson: JSON.stringify({
            note: { type: 'text', value: 'hello' },
            shot: { type: 'photo', uris: ['file://a.jpg'] },
            bill: { type: 'scan', uris: ['file://b.jpg'] },
          }),
        }),
      ],
    });
    expect(widgets).toEqual([]);
  });

  it('builds widgets for money number list choice duration toggle when data exists', () => {
    const widgets = buildActivityFieldWidgets({
      activity: baseActivity,
      moments: [
        activityMoment({
          id: 1,
          timestamp: new Date('2026-07-01T12:00:00Z'),
          activityValuesJson: JSON.stringify({
            spend: { type: 'money', amount: 10 },
            reps: { type: 'number', value: 12 },
            items: { type: 'list', items: ['Squat', 'Bench'] },
            focus: { type: 'choice', value: 'Legs' },
            length: { type: 'duration', seconds: 2400 },
            sore: { type: 'toggle', value: true },
          }),
        }),
        activityMoment({
          id: 2,
          timestamp: new Date('2026-07-02T12:00:00Z'),
          activityValuesJson: JSON.stringify({
            spend: { type: 'money', amount: 20 },
            reps: { type: 'number', value: 8 },
            items: { type: 'list', items: ['Squat'] },
            focus: { type: 'choice', value: 'Legs' },
            length: { type: 'duration', seconds: 1800 },
            sore: { type: 'toggle', value: false },
          }),
        }),
      ],
    });

    expect(widgets.map(w => w.kind)).toEqual([
      'money',
      'number',
      'list',
      'choice',
      'duration',
      'toggle',
    ]);
    const money = widgets.find(w => w.kind === 'money');
    expect(money?.count).toBe(2);
    expect(money?.kind === 'money' && money.week).toEqual(expect.any(Number));
    expect(money?.kind === 'money' && money.month).toEqual(expect.any(Number));
    expect(money?.kind === 'money' && money.year).toEqual(expect.any(Number));
    expect(widgets.find(w => w.kind === 'list')?.topItems[0]?.label).toBe(
      'Squat',
    );
    expect(widgets.find(w => w.kind === 'choice')?.favorite).toBe('Legs');
    expect(widgets.find(w => w.kind === 'toggle')?.yesCount).toBe(1);
  });
});
