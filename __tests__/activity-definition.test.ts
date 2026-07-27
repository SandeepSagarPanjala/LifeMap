import {
  parseActivityCatalogYaml,
  parseActivityYaml,
  stringifyActivityYaml,
} from '../src/lib/activities/parse-activity-yaml';
import { parseAmountFromOcrText } from '../src/lib/activities/parse-amount-from-ocr';
import { validateActivityDefinition } from '../src/lib/activities/validate-activity-definition';

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
    expect(parsed.definition.fields).toHaveLength(3);
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

  it('accepts currency amount without total keyword', () => {
    expect(parseAmountFromOcrText('Paid $42.00 today')).toBe(42);
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
