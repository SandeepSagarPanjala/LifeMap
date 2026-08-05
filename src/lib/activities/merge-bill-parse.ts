import type { BillParseResult } from '@/lib/activities/bill-parse-native';
import { ACTIVITY_MAX_LIST_ITEMS } from '@/lib/activities/parse-items-from-ocr';

export type MergedBillParse = {
  /** Sum of all non-null totals, or null when none found. */
  amount: number | null;
  items: string[];
  /** First non-empty shop / restaurant name across images. */
  shopName: string | null;
};

/**
 * Merge OCR results from multiple receipt images:
 * - Sum every image that has a total (restaurant: two bills → one amount).
 * - Images without a total still contribute line items (long-receipt pages).
 * - Keep the first shop name found (usually the header of the first page).
 */
export function mergeBillParseResults(
  results: readonly BillParseResult[],
): MergedBillParse {
  let amountSum = 0;
  let hasAmount = false;
  const items: string[] = [];
  const seen = new Set<string>();
  let shopName: string | null = null;

  for (const result of results) {
    if (result.amount != null && Number.isFinite(result.amount)) {
      amountSum += result.amount;
      hasAmount = true;
    }
    if (shopName == null && result.shopName != null) {
      const trimmed = result.shopName.trim().replace(/\s+/g, ' ');
      if (trimmed) {
        shopName = trimmed;
      }
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
          shopName,
        };
      }
    }
  }

  return {
    amount: hasAmount ? amountSum : null,
    items,
    shopName,
  };
}
