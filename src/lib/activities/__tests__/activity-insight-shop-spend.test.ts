import {
  activitySupportsShopSpend,
  formatShopVisitCount,
  resolveAmountFieldId,
  summarizeSpendByShop,
} from '@/lib/activities/activity-insight-shop-spend';
import type { ActivityFieldDefinition } from '@/lib/activities/activity-definition';
import type { MomentRow } from '@/db/repositories/moments';
import { makeMoment } from '../../../../__tests__/helpers/fixtures';

function activityMoment(
  partial: Partial<MomentRow> & Pick<MomentRow, 'id' | 'timestamp'>,
): MomentRow {
  return makeMoment({
    type: 'activity',
    activityId: 1,
    activityEmoji: '🍔',
    activityLabel: 'Junk Food',
    ...partial,
  });
}

const billFields: ActivityFieldDefinition[] = [
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
  {
    id: 'amount',
    type: 'money',
    label: 'Amount',
    required: false,
  },
];

describe('activity insight shop spend', () => {
  it('requires both shop name and amount fields', () => {
    expect(activitySupportsShopSpend(billFields)).toBe(true);
    expect(
      activitySupportsShopSpend([
        { id: 'amount', type: 'money', label: 'Amount', required: false },
      ]),
    ).toBe(false);
    expect(
      activitySupportsShopSpend([
        {
          id: 'shop_name',
          type: 'text',
          label: 'Shop name',
          required: false,
        },
      ]),
    ).toBe(false);
  });

  it('resolves amount from bill fillField', () => {
    expect(resolveAmountFieldId(billFields)).toBe('amount');
  });

  it('aggregates spend and visits per shop', () => {
    const rows = summarizeSpendByShop(
      [
        activityMoment({
          id: 1,
          timestamp: new Date('2026-08-01T12:00:00Z'),
          activityValuesJson: JSON.stringify({
            shop_name: { type: 'text', value: 'Whataburger' },
            amount: { type: 'money', amount: 12.5 },
          }),
        }),
        activityMoment({
          id: 2,
          timestamp: new Date('2026-08-02T12:00:00Z'),
          activityValuesJson: JSON.stringify({
            shop_name: { type: 'text', value: 'whataburger' },
            amount: { type: 'money', amount: 10 },
          }),
        }),
        activityMoment({
          id: 3,
          timestamp: new Date('2026-08-03T12:00:00Z'),
          activityValuesJson: JSON.stringify({
            shop_name: { type: 'text', value: 'Chipotle' },
            amount: { type: 'money', amount: 14 },
          }),
        }),
        activityMoment({
          id: 4,
          timestamp: new Date('2026-08-04T12:00:00Z'),
          activityValuesJson: JSON.stringify({
            amount: { type: 'money', amount: 5 },
          }),
        }),
      ],
      billFields,
    );

    expect(rows).toEqual([
      {
        shopKey: 'whataburger',
        shopName: 'Whataburger',
        visits: 2,
        totalAmount: 22.5,
      },
      {
        shopKey: 'chipotle',
        shopName: 'Chipotle',
        visits: 1,
        totalAmount: 14,
      },
      {
        shopKey: '__none__',
        shopName: 'No shop name',
        visits: 1,
        totalAmount: 5,
      },
    ]);
    expect(formatShopVisitCount(2)).toBe('2 visits');
    expect(formatShopVisitCount(1)).toBe('1 visit');
  });
});
