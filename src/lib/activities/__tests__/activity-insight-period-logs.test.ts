import {
  momentsInRange,
  resolveShopNameFieldId,
  shopNameFromMoment,
} from '@/lib/activities/activity-insight-period-logs';
import type { MomentRow } from '@/db/repositories/moments';

function momentStub(
  partial: Partial<MomentRow> & Pick<MomentRow, 'id' | 'timestamp'>,
): MomentRow {
  return {
    type: 'activity',
    finishedAt: null,
    contentPath: null,
    thumbnailPath: null,
    voiceAttachmentPath: null,
    voiceAttachmentBytes: null,
    voiceDurationSec: null,
    voiceTranscript: null,
    photoAttachmentsJson: null,
    tagsJson: null,
    textBody: null,
    caption: null,
    title: null,
    moodLabel: null,
    moodReason: null,
    moodVariant: null,
    contentBytes: null,
    sourceBytes: null,
    contentFormat: null,
    activityId: 1,
    activityEmoji: '🍔',
    activityLabel: 'Junk Food',
    activityValuesJson: null,
    importSource: null,
    ...partial,
  };
}

describe('activity insight period logs', () => {
  it('resolves shop name field from bill scan linkage', () => {
    expect(
      resolveShopNameFieldId([
        {
          id: 'bill',
          type: 'scan',
          label: 'Bill',
          required: false,
          extract: 'amount',
          fillField: 'amount',
          fillShopNameField: 'shop_name',
        },
        {
          id: 'shop_name',
          type: 'text',
          label: 'Shop name',
          required: false,
        },
      ]),
    ).toBe('shop_name');
  });

  it('reads shop name from activity values json', () => {
    const moment = momentStub({
      id: 1,
      timestamp: new Date('2026-08-01T12:00:00Z'),
      activityValuesJson: JSON.stringify({
        shop_name: { type: 'text', value: 'Chipotle' },
        amount: { type: 'money', amount: 14.5 },
      }),
    });
    expect(shopNameFromMoment(moment, 'shop_name')).toBe('Chipotle');
    expect(shopNameFromMoment(moment, null)).toBeNull();
  });

  it('filters and sorts moments in range newest first', () => {
    const a = momentStub({
      id: 1,
      timestamp: new Date('2026-08-01T10:00:00Z'),
    });
    const b = momentStub({
      id: 2,
      timestamp: new Date('2026-08-02T10:00:00Z'),
    });
    const c = momentStub({
      id: 3,
      timestamp: new Date('2026-08-05T10:00:00Z'),
    });
    const rows = momentsInRange(
      [a, b, c],
      new Date('2026-08-01T00:00:00Z'),
      new Date('2026-08-03T23:59:59Z'),
    );
    expect(rows.map(row => row.id)).toEqual([2, 1]);
  });
});
