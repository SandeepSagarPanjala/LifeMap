import { NativeModules, Platform } from 'react-native';

import { parseAmountFromOcrText } from '@/lib/activities/parse-amount-from-ocr';
import {
  ACTIVITY_MAX_LIST_ITEM_LENGTH,
  ACTIVITY_MAX_LIST_ITEMS,
  parseItemsFromOcrText,
} from '@/lib/activities/parse-items-from-ocr';
import {
  ACTIVITY_MAX_SHOP_NAME_LENGTH,
  parseShopNameFromOcrText,
} from '@/lib/activities/parse-shop-name-from-ocr';
import { recognizeImageText } from '@/lib/activities/text-recognize-native';

type BillParseNativeModule = {
  isAvailable(): Promise<boolean>;
  supportsImageParse(): Promise<boolean>;
  parseReceiptText(text: string): Promise<BillParseNativeResult | null>;
  parseReceiptImage(uri: string): Promise<BillParseNativeResult | null>;
};

export type BillLineItemNative = {
  name?: string;
  quantity?: string;
  unitPrice?: number;
  lineTotal?: number;
  /** Positive dollars saved (promo / NPWR / coupon) for this line. */
  discount?: number;
};

export type BillParseNativeResult = {
  total?: number | null;
  items?: BillLineItemNative[];
  /** Shop / restaurant / merchant name printed on the bill. */
  shopName?: string | null;
  source?: string;
};

export type BillParseResult = {
  amount: number | null;
  items: string[];
  shopName: string | null;
  /** Where the structured parse came from. */
  source:
    | 'foundation_models_image'
    | 'foundation_models_text'
    | 'foundation_models'
    | 'heuristics';
};

const nativeModule = NativeModules.BillParseModule as
  | BillParseNativeModule
  | undefined;

function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toFixed(2);
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

/** Turn a structured line item into a single list token. */
export function formatBillItemTag(item: BillLineItemNative): string | null {
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!name) {
    return null;
  }

  let tag = name;
  const quantity =
    typeof item.quantity === 'string' ? item.quantity.trim() : '';
  const unitPrice =
    typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice)
      ? item.unitPrice
      : null;
  const lineTotal =
    typeof item.lineTotal === 'number' && Number.isFinite(item.lineTotal)
      ? item.lineTotal
      : null;

  const discount =
    typeof item.discount === 'number' &&
    Number.isFinite(item.discount) &&
    item.discount > 0
      ? item.discount
      : null;

  if (quantity && unitPrice != null && unitPrice > 0) {
    tag += ` · ${quantity} @ ${formatMoney(unitPrice)}`;
  } else if (quantity) {
    tag += ` · ${quantity}`;
  } else if (unitPrice != null && unitPrice > 0) {
    tag += ` · ${formatMoney(unitPrice)}`;
  }

  if (lineTotal != null && lineTotal !== 0) {
    tag += ` = ${formatMoney(lineTotal)}`;
  }

  if (discount != null) {
    tag += ` (−${formatMoney(discount)})`;
  }

  if (tag.length > ACTIVITY_MAX_LIST_ITEM_LENGTH) {
    tag = tag.slice(0, ACTIVITY_MAX_LIST_ITEM_LENGTH).trim();
  }
  return tag;
}

function normalizeNativeResult(
  raw: BillParseNativeResult | null | undefined,
): BillParseResult | null {
  if (raw == null || typeof raw !== 'object') {
    return null;
  }

  let amount: number | null = null;
  if (typeof raw.total === 'number' && Number.isFinite(raw.total)) {
    if (raw.total >= 0 && raw.total <= 1_000_000) {
      amount = Math.round(raw.total * 100) / 100;
    }
  }

  let shopName: string | null = null;
  if (typeof raw.shopName === 'string') {
    const trimmed = raw.shopName.trim().replace(/\s+/g, ' ');
    if (trimmed) {
      shopName =
        trimmed.length > ACTIVITY_MAX_SHOP_NAME_LENGTH
          ? trimmed.slice(0, ACTIVITY_MAX_SHOP_NAME_LENGTH).trim()
          : trimmed;
    }
  }

  const items: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.items)) {
    for (const entry of raw.items) {
      if (items.length >= ACTIVITY_MAX_LIST_ITEMS) {
        break;
      }
      if (entry == null || typeof entry !== 'object') {
        continue;
      }
      const tag = formatBillItemTag(entry);
      if (tag == null) {
        continue;
      }
      const key = tag.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push(tag);
    }
  }

  // Treat empty AI output as a miss so heuristics can try.
  if (amount == null && items.length === 0 && shopName == null) {
    return null;
  }

  const sourceRaw = typeof raw.source === 'string' ? raw.source : '';
  const source: BillParseResult['source'] =
    sourceRaw === 'foundation_models_image'
      ? 'foundation_models_image'
      : sourceRaw === 'foundation_models_text'
        ? 'foundation_models_text'
        : 'foundation_models';

  return {
    amount,
    items,
    shopName,
    source,
  };
}

function toFilePath(uri: string): string {
  if (!uri.startsWith('file://')) {
    return uri;
  }
  const withoutScheme = uri.slice('file://'.length);
  try {
    return decodeURIComponent(withoutScheme);
  } catch {
    return withoutScheme;
  }
}

/** True when Apple Foundation Models text parse can run (iOS 26+). */
export async function isOnDeviceBillAiAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !nativeModule?.isAvailable) {
    return false;
  }
  try {
    return (await nativeModule.isAvailable()) === true;
  } catch {
    return false;
  }
}

/** True when multimodal image parse can run (iOS 27+). */
export async function isOnDeviceBillImageAiAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !nativeModule?.supportsImageParse) {
    return false;
  }
  try {
    return (await nativeModule.supportsImageParse()) === true;
  } catch {
    return false;
  }
}

export type BillExtractOptions = {
  /** Extract paid total when an Amount/money field is linked. */
  wantAmount?: boolean;
  /** Extract line items when an Items/list field is linked. */
  wantItems?: boolean;
  /** Extract shop / restaurant name when a Shop name text field is linked. */
  wantShopName?: boolean;
};

function hasWantedAmount(
  result: BillParseResult | null,
  wantAmount: boolean,
): boolean {
  return !wantAmount || (result != null && result.amount != null);
}

function hasWantedItems(
  result: BillParseResult | null,
  wantItems: boolean,
): boolean {
  return !wantItems || (result != null && result.items.length > 0);
}

function hasWantedShopName(
  result: BillParseResult | null,
  wantShopName: boolean,
): boolean {
  return !wantShopName || (result != null && result.shopName != null);
}

function trimToWanted(
  result: BillParseResult,
  wantAmount: boolean,
  wantItems: boolean,
  wantShopName: boolean,
): BillParseResult {
  return {
    amount: wantAmount ? result.amount : null,
    items: wantItems ? result.items : [],
    shopName: wantShopName ? result.shopName : null,
    source: result.source,
  };
}

/**
 * Prefer on-device Foundation Models; fall back to OCR heuristics.
 *
 * Ladder:
 * 1) iOS 27 image → FM
 * 2) OCR → iOS 26 text FM
 * 3) OCR heuristics
 *
 * Only runs amount / items / shop-name extraction when the linked fields still exist.
 */
export async function extractBillFieldsFromImage(
  imageUri: string,
  options: BillExtractOptions = {},
): Promise<BillParseResult> {
  const wantAmount = options.wantAmount === true;
  const wantItems = options.wantItems === true;
  const wantShopName = options.wantShopName === true;
  if (!wantAmount && !wantItems && !wantShopName) {
    return { amount: null, items: [], shopName: null, source: 'heuristics' };
  }

  let best: BillParseResult | null = null;

  // 1) Multimodal (iOS 27+) — no OCR required for the AI path.
  if (Platform.OS === 'ios' && nativeModule?.parseReceiptImage) {
    try {
      const imageAi = await isOnDeviceBillImageAiAvailable();
      if (imageAi) {
        const native = await nativeModule.parseReceiptImage(
          toFilePath(imageUri),
        );
        const parsed = normalizeNativeResult(native);
        if (parsed != null) {
          if (__DEV__) {
            console.log('[OCR bill] foundation_models_image:', parsed);
          }
          best = parsed;
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.log('[OCR bill] foundation_models_image error:', error);
      }
    }
  }

  const needsOcr =
    best == null ||
    !hasWantedAmount(best, wantAmount) ||
    !hasWantedItems(best, wantItems) ||
    !hasWantedShopName(best, wantShopName);
  const text = needsOcr ? await recognizeImageText(imageUri) : '';
  if (__DEV__ && text) {
    console.log('[OCR bill] raw text:\n', text);
  }

  // 2) Text FM (iOS 26+) when image AI missed or unavailable.
  if (
    (!hasWantedItems(best, wantItems) ||
      !hasWantedAmount(best, wantAmount) ||
      !hasWantedShopName(best, wantShopName)) &&
    text.trim() &&
    Platform.OS === 'ios' &&
    nativeModule?.parseReceiptText
  ) {
    try {
      const available = await isOnDeviceBillAiAvailable();
      if (available) {
        const native = await nativeModule.parseReceiptText(text);
        const parsed = normalizeNativeResult(native);
        if (parsed != null) {
          if (__DEV__) {
            console.log('[OCR bill] foundation_models_text:', parsed);
          }
          best = mergeBillParse(best, parsed);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.log('[OCR bill] foundation_models_text error:', error);
      }
    }
  }

  // 3) Heuristics fill any remaining gaps (DoorDash "1 x Name" / "$price" lines).
  if (
    text.trim() &&
    (!hasWantedAmount(best, wantAmount) ||
      !hasWantedItems(best, wantItems) ||
      !hasWantedShopName(best, wantShopName))
  ) {
    const amount =
      wantAmount && !hasWantedAmount(best, wantAmount)
        ? parseAmountFromOcrText(text)
        : null;
    const items =
      wantItems && !hasWantedItems(best, wantItems)
        ? parseItemsFromOcrText(text)
        : [];
    const shopName =
      wantShopName && !hasWantedShopName(best, wantShopName)
        ? parseShopNameFromOcrText(text)
        : null;
    if (__DEV__) {
      console.log(
        '[OCR bill] heuristics amount:',
        amount,
        'items:',
        items,
        'shopName:',
        shopName,
      );
    }
    best = mergeBillParse(best, {
      amount,
      items,
      shopName,
      source: 'heuristics',
    });
  }

  const resolved =
    best ?? { amount: null, items: [], shopName: null, source: 'heuristics' };
  return trimToWanted(resolved, wantAmount, wantItems, wantShopName);
}

function mergeBillParse(
  primary: BillParseResult | null,
  fallback: BillParseResult,
): BillParseResult {
  if (primary == null) {
    return fallback;
  }
  const amount = primary.amount ?? fallback.amount;
  const items =
    primary.items.length > 0 ? primary.items : fallback.items;
  const shopName = primary.shopName ?? fallback.shopName;
  const source =
    primary.items.length > 0 ||
    primary.amount != null ||
    primary.shopName != null
      ? primary.source
      : fallback.source;
  return { amount, items, shopName, source };
}
