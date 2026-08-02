import type { BillParseResult } from '@/lib/activities/bill-parse-native';
import { ACTIVITY_MAX_LIST_ITEMS } from '@/lib/activities/parse-items-from-ocr';

export type MergedBillParse = {
  /** Sum of all non-null totals, or null when none found. */
  amount: number | null;
  items: string[];
};

/**
 * Merge OCR results from multiple receipt images:
 * - Sum every image that has a total (restaurant: two bills → one amount).
 * - Images without a total still contribute line items (long-receipt pages).
 */
export function mergeBillParseResults(
  results: readonly BillParseResult[],
): MergedBillParse {
  let amountSum = 0;
  let hasAmount = false;
  const items: string[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.amount != null && Number.isFinite(result.amount)) {
      amountSum += result.amount;
      hasAmount = true;
    }
    for (const item of result.items) {
      const trimmed = item.trim().replace(/\s+/g, ' ');
      if (!trimmed) {
        continue;
      }
      const key = trimmed.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push(trimmed);
      if (items.length >= ACTIVITY_MAX_LIST_ITEMS) {
        return {
          amount: hasAmount ? amountSum : null,
          items,
        };
      }
    }
  }

  return {
    amount: hasAmount ? amountSum : null,
    items,
  };
}
