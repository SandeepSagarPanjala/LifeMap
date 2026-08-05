/**
 * Heuristics to pick a shop / restaurant name from OCR receipt text.
 * Prefers the first prominent title-like line near the top of the bill.
 */

export const ACTIVITY_MAX_SHOP_NAME_LENGTH = 80;

const NOISE_LINE =
  /\b(?:receipt|invoice|order\s*#|order\s*no|ticket|guest\s*check|thank\s*you|welcome|tel\.?|phone|fax|www\.|https?:\/\/|cashier|server|table\s*#|check\s*#|store\s*#|tax\s*id|gst|vat|abn|ein|sub\s*-?\s*total|grand\s*total|amount\s*due|balance\s*due|total\s*due|\btotal\b|tax|tip|change|cash|visa|mastercard|discover|amex|debit|credit|approved|auth|chip|contactless|purchase|card|qty|quantity|item|description|price|amount)\b/i;

const ADDRESS_OR_META =
  /(?:\d{1,5}\s+\w)|(?:\b(?:st|street|ave|avenue|rd|road|blvd|lane|ln|dr|drive|suite|ste|apt|unit)\b)|(?:\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b)|(?:\(\d{3}\)|\d{3}[-.\s]\d{3}[-.\s]\d{4})|(?:\b\d{1,2}[:/.-]\d{2}\b)|(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b.*\d{1,2})/i;

const MOSTLY_DIGITS = /^[\d\s#$€£¥₹.,:@%*\-/\\]+$/;
const ALL_PUNCTUATION = /^[\W_]+$/;

function scrubLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function looksLikeShopName(line: string): boolean {
  if (line.length < 2 || line.length > ACTIVITY_MAX_SHOP_NAME_LENGTH) {
    return false;
  }
  if (MOSTLY_DIGITS.test(line) || ALL_PUNCTUATION.test(line)) {
    return false;
  }
  if (NOISE_LINE.test(line) || ADDRESS_OR_META.test(line)) {
    return false;
  }
  // Need at least one letter.
  if (!/[A-Za-z]/.test(line)) {
    return false;
  }
  return true;
}

function scoreShopCandidate(line: string, lineIndex: number): number {
  let score = 40 - lineIndex * 4;
  const letters = line.replace(/[^A-Za-z]/g, '');
  const upperRatio =
    letters.length === 0
      ? 0
      : letters.replace(/[^A-Z]/g, '').length / letters.length;
  // Big title lines are often ALL CAPS or Title Case near the top.
  if (upperRatio >= 0.85 && letters.length >= 3) {
    score += 25;
  } else if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(line)) {
    score += 18;
  }
  if (line.length >= 4 && line.length <= 40) {
    score += 8;
  }
  if (/\b(?:inc|llc|ltd|co\.?|corp\.?)\b/i.test(line)) {
    score += 6;
  }
  return score;
}

/**
 * Pick the first big title from receipt OCR (shop / restaurant / merchant).
 * Returns null when nothing plausible is found.
 */
export function parseShopNameFromOcrText(text: string): string | null {
  const scrubbed = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!scrubbed) {
    return null;
  }

  const lines = scrubbed
    .split('\n')
    .map(scrubLine)
    .filter(Boolean)
    // Only consider the header region of the bill.
    .slice(0, 12);

  type Hit = { name: string; score: number };
  const hits: Hit[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (!looksLikeShopName(line)) {
      continue;
    }
    hits.push({ name: line, score: scoreShopCandidate(line, index) });
  }

  if (hits.length === 0) {
    return null;
  }

  hits.sort((a, b) => b.score - a.score || a.name.length - b.name.length);
  const best = hits[0]!.name;
  if (best.length > ACTIVITY_MAX_SHOP_NAME_LENGTH) {
    return best.slice(0, ACTIVITY_MAX_SHOP_NAME_LENGTH).trim();
  }
  return best;
}
