/**
 * Heuristics to pick a money amount from OCR text (receipts / bills).
 *
 * Only returns an amount when confidence is decent:
 * - amount sits on a Total / Amount due / Balance due line, or
 * - amount has a currency symbol on the same line.
 * Never falls back to “any large number” (avoids code screenshots, etc.).
 */
export function parseAmountFromOcrText(text: string): number | null {
  const normalized = text.replace(/\u00a0/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  const numberPattern = /(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2}|\d+)/g;
  const totalLinePattern =
    /\b(grand\s*total|amount\s*due|balance\s*due|total\s*due|amount\s*payable|total)\b/i;
  const rejectLinePattern =
    /\b(subtotal|sub\s*total|tax|tip|change|cash|card|qty|quantity)\b/i;
  const currencyPattern = /[$€£₹]/;

  type Candidate = { amount: number; score: number };
  const candidates: Candidate[] = [];

  const lines = normalized.split(/\r?\n/);
  for (const line of lines) {
    const lower = line.toLowerCase();
    const hasTotalKeyword = totalLinePattern.test(lower);
    const hasCurrency = currencyPattern.test(line);
    const isRejectedLine = rejectLinePattern.test(lower) && !hasTotalKeyword;

    if (isRejectedLine) {
      continue;
    }

    // Require Total-line keyword or currency — no bare integer guesses.
    if (!hasTotalKeyword && !hasCurrency) {
      continue;
    }

    numberPattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = numberPattern.exec(line)) != null) {
      const raw = match[1]?.replace(/,/g, '') ?? '';
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        continue;
      }

      let score = 0;
      if (hasTotalKeyword) {
        score += 50;
      }
      if (hasCurrency) {
        score += 20;
      }
      if (/\.\d{2}$/.test(raw)) {
        score += 8;
      }
      score += Math.min(amount / 100, 5);

      candidates.push({ amount, score });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score || b.amount - a.amount);
  const best = candidates[0]!;
  return Math.round(best.amount * 100) / 100;
}
