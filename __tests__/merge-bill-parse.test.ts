import { mergeBillParseResults } from '@/lib/activities/merge-bill-parse';
import type { BillParseResult } from '@/lib/activities/bill-parse-native';

function result(
  amount: number | null,
  items: string[],
): BillParseResult {
  return { amount, items, source: 'heuristics' };
}

describe('mergeBillParseResults', () => {
  it('sums totals from separate restaurant bills and merges items', () => {
    const merged = mergeBillParseResults([
      result(12.5, ['Ice cream']),
      result(8, ['Dessert']),
    ]);
    expect(merged.amount).toBe(20.5);
    expect(merged.items).toEqual(['Ice cream', 'Dessert']);
  });

  it('keeps items from pages without a total and uses the page that has one', () => {
    const merged = mergeBillParseResults([
      result(null, ['Milk', 'Eggs', 'Bread']),
      result(84.32, ['Tax']),
    ]);
    expect(merged.amount).toBe(84.32);
    expect(merged.items).toEqual(['Milk', 'Eggs', 'Bread', 'Tax']);
  });

  it('returns null amount when no image has a total', () => {
    const merged = mergeBillParseResults([
      result(null, ['Item A']),
      result(null, ['Item B']),
    ]);
    expect(merged.amount).toBeNull();
    expect(merged.items).toEqual(['Item A', 'Item B']);
  });

  it('dedupes items case-insensitively', () => {
    const merged = mergeBillParseResults([
      result(10, ['Coffee']),
      result(5, ['coffee', 'Muffin']),
    ]);
    expect(merged.amount).toBe(15);
    expect(merged.items).toEqual(['Coffee', 'Muffin']);
  });
});
