import {
  parseActivityCatalogYaml,
  parseActivityYaml,
  stringifyActivityYaml,
} from '../src/lib/activities/parse-activity-yaml';
import { parseAmountFromOcrText } from '../src/lib/activities/parse-amount-from-ocr';
import { parseItemsFromOcrText } from '../src/lib/activities/parse-items-from-ocr';
import { validateActivityDefinition } from '../src/lib/activities/validate-activity-definition';
import {
  parseActivityValuesJson,
  serializeActivityValuesJson,
} from '../src/lib/activities/activity-definition';

describe('validateActivityDefinition', () => {
  it('accepts one-tap activities with empty fields', () => {
    const result = validateActivityDefinition({
      schemaVersion: 1,
      name: 'Gym',
      emoji: '🏋️',
      fields: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.definition.fields).toEqual([]);
    }
  });

  it('requires scan fillField to target money', () => {
    const result = validateActivityDefinition({
      schemaVersion: 1,
      name: 'Junk Food',
      emoji: '🍔',
      fields: [
        {
          id: 'receipt',
          type: 'scan',
          label: 'Receipt',
          required: false,
          extract: 'amount',
          fillField: 'amount',
        },
        {
          id: 'amount',
          type: 'number',
          label: 'Money',
          required: true,
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it('accepts bill with amount + optional items list', () => {
    const result = validateActivityDefinition({
      schemaVersion: 1,
      name: 'Junk Food',
      emoji: '🍔',
      fields: [
        {
          id: 'receipt',
          type: 'scan',
          label: 'Bill',
          required: false,
          extract: 'amount',
          fillField: 'amount',
          fillItemsField: 'items',
        },
        {
          id: 'amount',
          type: 'money',
          label: 'Amount',
          required: true,
        },
        {
          id: 'items',
          type: 'list',
          label: 'Items',
          required: false,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.definition.fields[0]?.fillItemsField).toBe('items');
    }
  });

  it('requires fillItemsField to target a list field', () => {
    const result = validateActivityDefinition({
      schemaVersion: 1,
      name: 'Junk Food',
      emoji: '🍔',
      fields: [
        {
          id: 'receipt',
          type: 'scan',
          label: 'Bill',
          required: false,
          extract: 'amount',
          fillField: 'amount',
          fillItemsField: 'amount',
        },
        {
          id: 'amount',
          type: 'money',
          label: 'Amount',
          required: true,
        },
      ],
    });
    expect(result.ok).toBe(false);
  });
});

describe('activity values', () => {
  it('round-trips photo tags, list items, and zero money', () => {
    const raw = serializeActivityValuesJson({
      food: {
        type: 'photo',
        uris: ['moments/a.jpg', 'moments/a2.jpg'],
        tags: ['Food', 'Plate'],
      },
      bill: {
        type: 'scan',
        uris: ['moments/b.jpg'],
        tags: ['Paper', 'Receipt'],
      },
      amount: { type: 'money', amount: 0 },
      items: {
        type: 'list',
        items: ['FFL Bread Ezeki', 'Hass Avocados'],
      },
    });
    const parsed = parseActivityValuesJson(raw);
    expect(parsed.food).toEqual({
      type: 'photo',
      uris: ['moments/a.jpg', 'moments/a2.jpg'],
      tags: ['Food', 'Plate'],
    });
    expect(parsed.bill).toEqual({
      type: 'scan',
      uris: ['moments/b.jpg'],
      tags: ['Paper', 'Receipt'],
    });
    expect(parsed.amount).toEqual({ type: 'money', amount: 0 });
    expect(parsed.items).toEqual({
      type: 'list',
      items: ['FFL Bread Ezeki', 'Hass Avocados'],
    });
  });

  it('normalizes legacy single-uri photo and scan values', () => {
    const parsed = parseActivityValuesJson(
      JSON.stringify({
        food: { type: 'photo', uri: 'moments/legacy.jpg' },
        bill: { type: 'scan', uri: 'moments/legacy-bill.jpg', tags: ['Paper'] },
      }),
    );
    expect(parsed.food).toEqual({
      type: 'photo',
      uris: ['moments/legacy.jpg'],
    });
    expect(parsed.bill).toEqual({
      type: 'scan',
      uris: ['moments/legacy-bill.jpg'],
      tags: ['Paper'],
    });
  });
});

describe('parseActivityYaml', () => {
  it('round-trips junk food template', () => {
    const yaml = `schemaVersion: 1
name: Junk Food
emoji: "🍔"
fields:
  - id: food_photo
    type: photo
    label: Food
    required: false
  - id: receipt
    type: scan
    label: Bill
    required: false
    extract: amount
    fillField: amount
    fillItemsField: items
  - id: items
    type: list
    label: Items
    required: false
  - id: amount
    type: money
    label: Amount
    required: true
`;
    const parsed = parseActivityYaml(yaml);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.definition.fields).toHaveLength(4);
    const again = parseActivityYaml(stringifyActivityYaml(parsed.definition));
    expect(again.ok).toBe(true);
  });
});

describe('parseActivityCatalogYaml', () => {
  it('parses a catalog with multiple activities', () => {
    const yaml = `
schemaVersion: 1
activities:
  - schemaVersion: 1
    id: gym
    name: Gym
    emoji: "🏋️"
    fields: []
  - schemaVersion: 1
    name: Coffee
    emoji: "☕"
    fields:
      - id: amount
        type: money
        label: Amount
        required: true
`;
    const parsed = parseActivityCatalogYaml(yaml);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.catalog.schemaVersion).toBe(1);
    expect(parsed.catalog.activities).toHaveLength(2);
    expect(parsed.catalog.activities[0]?.templateId).toBe('gym');
    expect(parsed.catalog.activities[1]?.name).toBe('Coffee');
  });

  it('rejects catalogs without an activities list', () => {
    const parsed = parseActivityCatalogYaml('schemaVersion: 1\nname: Solo\n');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toMatch(/activities list/i);
    }
  });

  it('prefixes per-activity validation errors', () => {
    const yaml = `
activities:
  - schemaVersion: 1
    name: Broken
    emoji: "❌"
    fields:
      - id: 123bad
        type: text
        label: Note
        required: false
`;
    const parsed = parseActivityCatalogYaml(yaml);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toMatch(/^Activity 1:/);
    }
  });

  it('rejects duplicate template ids', () => {
    const yaml = `
activities:
  - schemaVersion: 1
    id: gym
    name: Gym
    emoji: "🏋️"
    fields: []
  - schemaVersion: 1
    id: gym
    name: Gym Again
    emoji: "🏋️"
    fields: []
`;
    const parsed = parseActivityCatalogYaml(yaml);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toMatch(/duplicate template id/i);
    }
  });
});

describe('parseAmountFromOcrText', () => {
  it('prefers total line over subtotal', () => {
    const text = `
Subtotal 12.00
Tax 1.00
Total $15.50
`;
    expect(parseAmountFromOcrText(text)).toBe(15.5);
  });

  it('prefers total over larger subtotal when labels and amounts split lines', () => {
    const text = `
Subtotal
$22.48
Delivery Fee
$0.00
Service Fee
$1.12
Estimated Tax
$0.93
Discount
-$11.24
DoorDash Credits
-$0.65
Dasher Tip
$2.00
Total
$14.64
`;
    expect(parseAmountFromOcrText(text)).toBe(14.64);
  });

  it('prefers the total that appears after subtotal in reading order', () => {
    const text = `
Subtotal
$22.48
Delivery Fee
$0.00
Service Fee
$1.12
Total
$25.85
`;
    expect(parseAmountFromOcrText(text)).toBe(25.85);
  });

  it('does not treat Sub Total as Total', () => {
    expect(parseAmountFromOcrText('Sub Total $22.48')).toBeNull();
    expect(
      parseAmountFromOcrText('Sub Total $22.48 Delivery Fee $0.99 Total $25.85'),
    ).toBe(25.85);
  });

  it('prefers total when both subtotal and total have currency on the same line', () => {
    const text = `
Subtotal $22.48
Total $14.64
`;
    expect(parseAmountFromOcrText(text)).toBe(14.64);
  });

  it('finds total in concatenated OCR that also contains subtotal', () => {
    const text =
      'Subtotal $22.48 Delivery Fee $0.99 Service Fee $2.37 Estimated Tax $0.93 Total $25.85';
    expect(parseAmountFromOcrText(text)).toBe(25.85);
  });

  it('does not fall back to subtotal when total is missing on a bill', () => {
    const text = `
Subtotal $22.48
Delivery Fee $0.99
Service Fee $2.37
Estimated Tax $0.93
`;
    expect(parseAmountFromOcrText(text)).toBeNull();
  });

  it('accepts currency amount without total keyword', () => {
    expect(parseAmountFromOcrText('Paid $42.00 today')).toBe(42);
  });

  it('accepts a zero total', () => {
    expect(parseAmountFromOcrText('Total $0.00')).toBe(0);
  });

  it('does not guess bare numbers from non-bill text', () => {
    const text = `
function add(a, b) {
  return a + b; // line 361
}
const n = 361;
`;
    expect(parseAmountFromOcrText(text)).toBeNull();
  });
});

describe('parseItemsFromOcrText', () => {
  it('groups Natural Grocers multiline items into rich tags', () => {
    // Real Vision-style OCR: name, qty@price, and BF line total on separate lines.
    const text = `
Natural Grocers by Vitamin Cottage
110 W University Dr
Denton, TX 76201
940-205-5330
07/28/26 06:07 PM
Store U063 Reg 3 Emp 40727 Txn 156
01202 FFL Bread Ezeki 24 o
2 @ 7.19 USD
14.38 BF
40235 Seedless Red Grapes
2.26 lb @ 4.29 USD/lb
9.70 BF
42253 Hass Avocados
3 @ 1.99 USD
5.97 BF
NPWR $1.39 Avocados
-1.80
SUBTOTAL 28.25 USD
B 28.25 @ 0.000% = 0.00
TOTAL USD 28.25
Discover USD 28.25
`;
    expect(parseItemsFromOcrText(text)).toEqual([
      'FFL Bread Ezeki 24 o · 2 @ $7.19 = $14.38',
      'Seedless Red Grapes · 2.26 lb @ $4.29/lb = $9.70',
      'Hass Avocados · 3 @ $1.99 = $5.97',
    ]);
  });

  it('handles qty and line total glued on one OCR line', () => {
    const text = `
01202 FFL Bread Ezeki 24 o
2 @ 7.19 14.38
40235 Seedless Red Grapes
2.26 lb @ 4.29 /lb 9.70
42253 Hass Avocados
3 @ 1.99 5.97
Subtotal 28.25
TOTAL 28.25
`;
    expect(parseItemsFromOcrText(text)).toEqual([
      'FFL Bread Ezeki 24 o · 2 @ $7.19 = $14.38',
      'Seedless Red Grapes · 2.26 lb @ $4.29/lb = $9.70',
      'Hass Avocados · 3 @ $1.99 = $5.97',
    ]);
  });
});

describe('parseAmountFromOcrText currency code', () => {
  it('reads TOTAL USD 28.25 (Natural Grocers style)', () => {
    const text = `
SUBTOTAL 28.25 USD
TOTAL USD 28.25
Discover USD 28.25
`;
    expect(parseAmountFromOcrText(text)).toBe(28.25);
  });
});
