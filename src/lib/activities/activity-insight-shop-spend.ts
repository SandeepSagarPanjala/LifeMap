import type { ActivityFieldDefinition } from '@/lib/activities/activity-definition';
import { parseActivityValuesJson } from '@/lib/activities/activity-definition';
import {
  resolveShopNameFieldId,
  shopNameFromMoment,
} from '@/lib/activities/activity-insight-period-logs';
import type { MomentRow } from '@/db/repositories/moments';

const MISSING_SHOP_LABEL = 'No shop name';

/** Money field filled by a bill scan, else the first money field. */
export function resolveAmountFieldId(
  fields: readonly ActivityFieldDefinition[],
): string | null {
  for (const field of fields) {
    if (
      field.type === 'scan' &&
      typeof field.fillField === 'string' &&
      field.fillField.trim()
    ) {
      const fillId = field.fillField.trim();
      const target = fields.find(candidate => candidate.id === fillId);
      if (target?.type === 'money') {
        return fillId;
      }
    }
  }
  const money = fields.find(field => field.type === 'money');
  return money?.id ?? null;
}

export function activitySupportsShopSpend(
  fields: readonly ActivityFieldDefinition[],
): boolean {
  return (
    resolveShopNameFieldId(fields) != null &&
    resolveAmountFieldId(fields) != null
  );
}

function amountFromMoment(
  moment: MomentRow,
  amountFieldId: string,
): number {
  const value = parseActivityValuesJson(moment.activityValuesJson)[
    amountFieldId
  ];
  if (value?.type !== 'money') {
    return 0;
  }
  return Number.isFinite(value.amount) ? value.amount : 0;
}

export type ShopSpendRow = {
  /** Display label (original casing). */
  shopName: string;
  /** Case-insensitive grouping key. */
  shopKey: string;
  visits: number;
  totalAmount: number;
};

/**
 * Total spent and visit count per shop. Sorted by spend desc, then visits.
 */
export function summarizeSpendByShop(
  moments: readonly MomentRow[],
  fields: readonly ActivityFieldDefinition[],
): ShopSpendRow[] {
  const shopFieldId = resolveShopNameFieldId(fields);
  const amountFieldId = resolveAmountFieldId(fields);
  if (shopFieldId == null || amountFieldId == null) {
    return [];
  }

  const byKey = new Map<
    string,
    { shopName: string; visits: number; totalAmount: number }
  >();

  for (const moment of moments) {
    const rawName = shopNameFromMoment(moment, shopFieldId);
    const shopName = rawName ?? MISSING_SHOP_LABEL;
    const shopKey = rawName == null ? '__none__' : rawName.toLowerCase();
    const amount = amountFromMoment(moment, amountFieldId);
    const existing = byKey.get(shopKey);
    if (existing == null) {
      byKey.set(shopKey, {
        shopName,
        visits: 1,
        totalAmount: amount,
      });
      continue;
    }
    existing.visits += 1;
    existing.totalAmount += amount;
  }

  return [...byKey.entries()]
    .map(([shopKey, row]) => ({
      shopKey,
      shopName: row.shopName,
      visits: row.visits,
      totalAmount: row.totalAmount,
    }))
    .sort((a, b) => {
      if (b.totalAmount !== a.totalAmount) {
        return b.totalAmount - a.totalAmount;
      }
      if (b.visits !== a.visits) {
        return b.visits - a.visits;
      }
      return a.shopName.localeCompare(b.shopName);
    });
}

export function formatShopVisitCount(visits: number): string {
  return visits === 1 ? '1 visit' : `${visits} visits`;
}
