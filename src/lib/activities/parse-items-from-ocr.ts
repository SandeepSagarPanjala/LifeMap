/**
 * Receipt line-item parser.
 *
 * Grocery OCR usually emits 2–3 lines per product:
 *   01202 FFL Bread Ezeki 24 o
 *   2 @ 7.19 USD
 *   14.38 BF
 *
 * We group those into one tag:
 *   FFL Bread Ezeki 24 o · 2 @ $7.19 = $14.38
 *
 * Price/qty fragments must never become their own tags.
 */

export const ACTIVITY_MAX_LIST_ITEMS = 24;
export const ACTIVITY_MAX_LIST_ITEM_LENGTH = 96;

const SKU_ITEM_LINE = /^\d{4,}\s+[A-Za-z].+/;
const MONEY_TOKEN =
  /([$€£₹]\s*)?(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+\.\d{2})/;

/** "2 @ 7.19 USD", "2.26 lb @ 4.29 USD/lb", "3 x 1.99", optionally + line total */
const QTY_PRICE_LINE =
  /^\s*(\d+(?:\.\d+)?)\s*(lb|kg|oz|g|ct)?\s*(?:@|x|\*|×)\s*[$€£₹]?\s*(\d[\d,]*(?:\.\d{2})?)(?:\s*(?:USD|EUR|GBP|CAD)?\s*(?:\/\s*(lb|kg|oz|g))?)?(?:\s+[$€£₹]?\s*(-?\d+\.\d{2})\s*(?:BF|TX|USD|EUR|GBP|CAD)?)?\s*$/i;

/** "14.38 BF", "9.70", "$5.97", "14.38 USD" — line total, not a product. */
const LINE_TOTAL_LINE =
  /^\s*[$€£₹]?\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+\.\d{2})\s*(?:BF|TX|TXBL|USD|EUR|GBP|CAD|CR|DB)?\s*$/i;

/** Promo / adjustment rows like "NPWR $1.39 Avocados". */
const DISCOUNT_LINE =
  /^\s*(?:NPWR|PROMO|DISC(?:OUNT)?|COUPON|SAVE|ADJ(?:USTMENT)?)\b/i;

/** Delivery-app lines: "1 × Double Egg Chicken Noodles $13.99" */
const DIGITAL_QTY_NAME_PRICE =
  /^\s*(\d+)\s*[×xX*]\s+(.+?)\s+[$€£₹]?\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+\.\d{2})\s*$/;

/** Delivery-app name line without price: "1 × Sambar Rice" */
const DIGITAL_QTY_NAME = /^\s*(\d+)\s*[×xX*]\s+(.+?)\s*$/;

const DIGITAL_FEE_OR_UI =
  /\b(?:sub\s*-?\s*total|delivery\s*fee|service\s*fee|estimated\s*tax|\btax\b|discount|credits?|dasher\s*tip|\btip\b|\btotal\b|apple\s*pay|google\s*pay|order\s*complete|order\s*dropped|add\s*tip|rate\s*(?:dasher|driver)|doordash|uber\s*eats|grubhub)\b/i;

const TOTALS_LINE =
  /\b(?:sub\s*-?\s*total|grand\s*total|amount\s*due|balance\s*due|total\s*due|order\s*total|payment\s*total|delivery\s*fee|service\s*fee|\btotal\b|tax|tip|change|cash|visa|mastercard|discover|amex|debit|credit|approved|auth|chip|contactless|purchase|card)\b/i;

const HEADER_NOISE =
  /\b(?:store|reg(?:ister)?|emp(?:loyee)?|txn|trans(?:action)?|tel|phone|www\.|http|\.com|llc|inc|grocers?|market|pharmacy|cottage|vitamin)\b/i;

const DATE_OR_TIME =
  /\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b|\b\d{1,2}:\d{2}\s*(?:am|pm)\b/i;

const ADDRESS_LINE =
  /,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$|\b(?:st|rd|dr|ave|blvd|ln|ct|hwy)\.?\s*$/i;

type QtyPrice = {
  qty: string;
  unit?: string;
  unitPrice: number;
  priceUnit?: string;
};

type OpenItem = {
  name: string;
  qtyPrice?: QtyPrice;
  lineTotal?: number;
};

function parseMoney(raw: string): number | null {
  const amount = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(amount)) {
    return null;
  }
  return Math.round(amount * 100) / 100;
}

function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toFixed(2);
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function cleanItemName(raw: string): string | null {
  let text = raw.replace(/\u00a0/g, ' ').trim();
  if (!text) {
    return null;
  }

  // Strip leading SKU / PLU ("01202 FFL Bread…") or delivery qty ("1 × …").
  text = text.replace(/^\d{4,}\s+/, '');
  text = text.replace(/^\d+\s*[×xX*]\s+/, '');
  // Drop trailing qty@price / money if OCR glued them onto the name line.
  text = text
    .replace(
      /\s+(\d+(?:\.\d+)?\s*(?:lb|kg|oz|g|ct)?\s*)?(?:@|x|\*|×)\s*[$€£₹]?\s*\d[\d,]*(?:\.\d{2})?(?:\s*(?:USD|EUR)?\s*(?:\/\s*(?:lb|kg|oz|g))?)?\s*$/i,
      '',
    )
    .replace(/\s+[$€£₹]?\s*-?\d[\d,]*(?:\.\d{2})?\s*(?:BF|USD|EUR)?\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Soften truncated "24 o" → keep as-is (OCR of "24 oz").
  if (!text || text.length < 2) {
    return null;
  }
  if (HEADER_NOISE.test(text) || TOTALS_LINE.test(text) || DATE_OR_TIME.test(text)) {
    return null;
  }
  if (QTY_PRICE_LINE.test(text) || LINE_TOTAL_LINE.test(text)) {
    return null;
  }
  if (!/[a-zA-Z]{2,}/.test(text)) {
    return null;
  }
  if (text.length > 64) {
    text = text.slice(0, 64).trim();
  }
  return text;
}

function parseQtyPrice(
  line: string,
): (QtyPrice & { gluedTotal?: number }) | null {
  const match = line.match(QTY_PRICE_LINE);
  if (match == null) {
    return null;
  }
  const unitPrice = parseMoney(match[3] ?? '');
  if (unitPrice == null || unitPrice < 0) {
    return null;
  }
  const qty = match[1]!;
  const unit = match[2]?.toLowerCase();
  const priceUnit = match[4]?.toLowerCase();
  const gluedTotal =
    match[5] != null ? parseMoney(match[5]) ?? undefined : undefined;
  return {
    qty,
    unit: unit || undefined,
    unitPrice,
    priceUnit: priceUnit || unit || undefined,
    gluedTotal,
  };
}

function parseLineTotal(line: string): number | null {
  const match = line.match(LINE_TOTAL_LINE);
  if (match == null) {
    return null;
  }
  return parseMoney(match[1] ?? '');
}

function isNoiseLine(line: string): boolean {
  if (!line) {
    return true;
  }
  if (HEADER_NOISE.test(line) || DATE_OR_TIME.test(line) || ADDRESS_LINE.test(line)) {
    return true;
  }
  // Bare store / phone / register meta without product letters+SKU.
  if (/^\d{5,}$/.test(line) || /^[\d\s\-().]+$/.test(line)) {
    return true;
  }
  return false;
}

function formatItemTag(item: OpenItem): string | null {
  const name = item.name.trim();
  if (!name) {
    return null;
  }

  // Skip pure discount rows unless they have a useful product name and no qty.
  // NPWR / promo lines are adjustments, not purchased items.
  if (DISCOUNT_LINE.test(name) && item.qtyPrice == null) {
    return null;
  }

  let tag = name;

  if (item.qtyPrice) {
    const { qty, unit, unitPrice, priceUnit } = item.qtyPrice;
    const qtyLabel = unit ? `${qty} ${unit}` : qty;
    const priceLabel = priceUnit
      ? `${formatMoney(unitPrice)}/${priceUnit}`
      : formatMoney(unitPrice);
    tag += ` · ${qtyLabel} @ ${priceLabel}`;
  }

  if (item.lineTotal != null && Number.isFinite(item.lineTotal)) {
    // Prefer positive line totals; negative is a discount — skip as product.
    if (item.lineTotal < 0 && item.qtyPrice == null) {
      return null;
    }
    tag += ` = ${formatMoney(item.lineTotal)}`;
  }

  if (tag.length > ACTIVITY_MAX_LIST_ITEM_LENGTH) {
    tag = tag.slice(0, ACTIVITY_MAX_LIST_ITEM_LENGTH).trim();
  }
  return tag;
}

function flushItem(
  item: OpenItem | null,
  out: string[],
  seen: Set<string>,
): void {
  if (item == null) {
    return;
  }
  const tag = formatItemTag(item);
  if (tag == null) {
    return;
  }
  const key = tag.toLowerCase();
  if (seen.has(key)) {
    return;
  }
  // Also dedupe by name alone so "Bread" and "Bread · 2 @ $7.19" don't both appear
  // if OCR is messy — keep the richer tag (already flushed order prefers complete).
  const nameKey = item.name.toLowerCase();
  if (seen.has(nameKey)) {
    return;
  }
  seen.add(key);
  seen.add(nameKey);
  out.push(tag);
}

/**
 * Parse receipt OCR into consolidated item tags (max ACTIVITY_MAX_LIST_ITEMS).
 */
export function parseItemsFromOcrText(text: string): string[] {
  const normalized = text.replace(/\u00a0/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const rawLines = normalized
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const digital = parseDigitalAppItems(rawLines);
  if (digital.length > 0) {
    return digital;
  }

  const items: string[] = [];
  const seen = new Set<string>();
  let open: OpenItem | null = null;
  const hasSkuItems = rawLines.some(line => SKU_ITEM_LINE.test(line));
  let pastHeader = !hasSkuItems;

  const commit = () => {
    flushItem(open, items, seen);
    open = null;
  };

  for (const line of rawLines) {
    if (TOTALS_LINE.test(line) && !SKU_ITEM_LINE.test(line)) {
      // Stop at subtotal / total / payment — don't swallow tender lines as items.
      break;
    }

    if (!pastHeader) {
      if (!SKU_ITEM_LINE.test(line)) {
        continue;
      }
      pastHeader = true;
    }

    // Qty @ price continuation for the open item.
    const qtyPrice = parseQtyPrice(line);
    if (qtyPrice != null) {
      if (open != null) {
        open.qtyPrice = {
          qty: qtyPrice.qty,
          unit: qtyPrice.unit,
          unitPrice: qtyPrice.unitPrice,
          priceUnit: qtyPrice.priceUnit,
        };
        if (qtyPrice.gluedTotal != null) {
          open.lineTotal = qtyPrice.gluedTotal;
          commit();
        }
      }
      continue;
    }

    // Lone line total ("14.38 BF") closes the open item.
    const lineTotal = parseLineTotal(line);
    if (lineTotal != null) {
      if (open != null) {
        open.lineTotal = lineTotal;
        commit();
      }
      continue;
    }

    // Discount / adjustment — skip (not a purchased item).
    if (DISCOUNT_LINE.test(line) || (line.startsWith('-') && MONEY_TOKEN.test(line))) {
      commit();
      continue;
    }

    if (isNoiseLine(line) && !SKU_ITEM_LINE.test(line)) {
      continue;
    }

    // New product name (SKU line or descriptive line).
    if (SKU_ITEM_LINE.test(line) || looksLikeProductName(line)) {
      commit();
      const name = cleanItemName(line);
      if (name != null) {
        open = { name };
        if (items.length + 1 >= ACTIVITY_MAX_LIST_ITEMS) {
          // Leave room; flush later.
        }
      }
      continue;
    }
  }

  commit();
  return items.slice(0, ACTIVITY_MAX_LIST_ITEMS);
}

/**
 * DoorDash / Uber Eats style: "1 × Name $price" (or name then "$price" on next line).
 */
function parseDigitalAppItems(rawLines: string[]): string[] {
  const items: string[] = [];
  const seen = new Set<string>();
  let open: OpenItem | null = null;

  const commit = () => {
    flushItem(open, items, seen);
    open = null;
  };

  for (const line of rawLines) {
    if (DIGITAL_FEE_OR_UI.test(line) || TOTALS_LINE.test(line)) {
      commit();
      // Fees / totals mean we're past the item list.
      if (
        /\b(?:sub\s*-?\s*total|delivery\s*fee|service\s*fee|\btotal\b|estimated\s*tax)\b/i.test(
          line,
        )
      ) {
        break;
      }
      continue;
    }

    const withPrice = line.match(DIGITAL_QTY_NAME_PRICE);
    if (withPrice) {
      commit();
      const qty = withPrice[1];
      const name = cleanItemName(withPrice[2] ?? '');
      const price = parseMoney(withPrice[3] ?? '');
      if (name != null && price != null && price > 0) {
        open = {
          name,
          qtyPrice: { qty, unitPrice: price },
          lineTotal: price,
        };
        commit();
      }
      continue;
    }

    const nameOnly = line.match(DIGITAL_QTY_NAME);
    if (nameOnly) {
      commit();
      const qty = nameOnly[1];
      const name = cleanItemName(nameOnly[2] ?? '');
      if (name != null) {
        open = {
          name,
          qtyPrice: { qty, unitPrice: 0 },
        };
      }
      continue;
    }

    // Price on its own line closes a pending digital item.
    const lonePrice = parseLineTotal(line);
    if (lonePrice != null && open != null && open.qtyPrice != null) {
      open.qtyPrice = { ...open.qtyPrice, unitPrice: lonePrice };
      open.lineTotal = lonePrice;
      commit();
      continue;
    }
  }

  commit();
  return items.slice(0, ACTIVITY_MAX_LIST_ITEMS);
}

function looksLikeProductName(line: string): boolean {
  if (!line || line.length < 3) {
    return false;
  }
  if (
    QTY_PRICE_LINE.test(line) ||
    LINE_TOTAL_LINE.test(line) ||
    TOTALS_LINE.test(line) ||
    HEADER_NOISE.test(line) ||
    DATE_OR_TIME.test(line) ||
    ADDRESS_LINE.test(line) ||
    DISCOUNT_LINE.test(line)
  ) {
    return false;
  }
  // Need real letters; reject "7.19 USD", "14.38 BF".
  if (/^\d/.test(line) && !SKU_ITEM_LINE.test(line)) {
    return false;
  }
  if (/^[$€£₹]/.test(line)) {
    return false;
  }
  return /[a-zA-Z]{2,}/.test(line);
}

/** Split comma-separated user input into list tokens. */
export function parseListItemsFromText(
  text: string,
  max = ACTIVITY_MAX_LIST_ITEMS,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(',')) {
    const trimmed = part.trim().replace(/\s+/g, ' ');
    if (!trimmed) {
      continue;
    }
    const clipped =
      trimmed.length > ACTIVITY_MAX_LIST_ITEM_LENGTH
        ? trimmed.slice(0, ACTIVITY_MAX_LIST_ITEM_LENGTH).trim()
        : trimmed;
    const key = clipped.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(clipped);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

export function sanitizeListItems(
  items: readonly string[],
  max = ACTIVITY_MAX_LIST_ITEMS,
): string[] {
  return parseListItemsFromText(items.join(','), max);
}
