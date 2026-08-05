import { mergeBillParseResults } from '@/lib/activities/merge-bill-parse';
import type { BillParseResult } from '@/lib/activities/bill-parse-native';

function result(
  amount: number | null,
  items: string[],
  shopName: string | null = null,
): BillParseResult {
  return { amount, items, shopName, source: 'heuristics' };
}

describe('mergeBillParseResults', () => {
  it('sums totals from separate restaurant bills and merges items', () => {
    const merged = mergeBillParseResults([
      result(12.5, ['Ice cream'], 'Sweet Shop'),
      result(8, ['Dessert'], 'Other Cafe'),
    ]);
    expect(merged.amount).toBe(20.5);
    expect(merged.items).toEqual(['Ice cream', 'Dessert']);
    expect(merged.shopName).toBe('Sweet Shop');
  });

  it('keeps items from pages without a total and uses the page that has one', () => {
    const merged = mergeBillParseResults([
      result(null, ['Milk', 'Eggs', 'Bread']),
      result(84.32, ['Tax'], 'Whole Foods'),
    ]);
    expect(merged.amount).toBe(84.32);
    expect(merged.items).toEqual(['Milk', 'Eggs', 'Bread', 'Tax']);
    expect(merged.shopName).toBe('Whole Foods');
  });

  it('returns null amount when no image has a total', () => {
    const merged = mergeBillParseResults([
      result(null, ['Item A']),
      result(null, ['Item B']),
    ]);
    expect(merged.amount).toBeNull();
    expect(merged.items).toEqual(['Item A', 'Item B']);
    expect(merged.shopName).toBeNull();
  });

  it('dedupes items case-insensitively', () => {
    const merged = mergeBillParseResults([
      result(10, ['Coffee']),
      result(5, ['coffee', 'Muffin']),
    ]);
    expect(merged.amount).toBe(15);
    expect(merged.items).toEqual(['Coffee', 'Muffin']);
  });

  it('keeps the first shop name across pages', () => {
    const merged = mergeBillParseResults([
      result(null, ['Page 1 item'], null),
      result(22, ['Page 2 item'], 'Chipotle'),
    ]);
    expect(merged.shopName).toBe('Chipotle');
  });
});
