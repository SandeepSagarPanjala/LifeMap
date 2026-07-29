/**
 * Heuristics to pick a money amount from OCR text (receipts / bills).
 *
 * Meaningful rule: **Total** is the final charge; **Subtotal** / **Sub Total**
 * are intermediate — never returned. When both appear, we take the Total that
 * appears *after* the last Subtotal (receipt order).
 */
export function parseAmountFromOcrText(text: string): number | null {
  const normalized = text.replace(/\u00a0/g, ' ').trim();
  if (!normalized) {
    return null;
  }

  // Neutralize subtotal phrases first so "Sub Total $22.48" can never match as Total.
  const scrubbed = normalized.replace(/\bsub\s*-?\s*total\b/gi, 'SUBTOTAL');
  const lastSubtotalIndex = scrubbed.toLowerCase().lastIndexOf('subtotal');

  const moneyCapture =
    '([$€£₹]\\s*)?(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})|\\d+\\.\\d{2})';
  const totalLabel =
    '(?:grand\\s*total|amount\\s*due|balance\\s*due|total\\s*due|amount\\s*payable|order\\s*total|payment\\s*total|total)';
  const billNoiseLabel =
    '(?:subtotal|tax|tip|change|delivery\\s*fee|service\\s*fee|discount|credit|promo|dasher\\s*tip|estimated\\s*tax)';

  const parseMoney = (raw: string): number | null => {
    const amount = Number(raw.replace(/,/g, ''));
    // Allow 0 (complimentary / $0.00 total); reject negatives and absurd values.
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
      return null;
    }
    return Math.round(amount * 100) / 100;
  };

  type Hit = { amount: number; score: number; index: number };
  const hits: Hit[] = [];

  const pushHit = (amount: number, score: number, index: number) => {
    hits.push({ amount, score, index });
  };

  // 1) Label then amount (same-line / concatenated OCR).
  // Allow an optional currency code between label and amount ("TOTAL USD 28.25").
  const labelThenAmount = new RegExp(
    `\\b${totalLabel}\\b[\\s:.\\-]*(?:USD|EUR|GBP|CAD|INR)?[\\s:.\\-]*${moneyCapture}`,
    'gi',
  );
  for (const match of scrubbed.matchAll(labelThenAmount)) {
    const amount = parseMoney(match[2] ?? '');
    if (amount == null) {
      continue;
    }
    const label = match[0].toLowerCase();
    const score = /grand\s*total|amount\s*due|balance\s*due|total\s*due/.test(
      label,
    )
      ? 120
      : 100;
    pushHit(amount, score, match.index ?? 0);
  }

  // 2) Amount then label ("$14.64 Total").
  const amountThenLabel = new RegExp(
    `${moneyCapture}[\\s:.\\-]*(?:USD|EUR|GBP|CAD|INR)?[\\s:.\\-]*\\b${totalLabel}\\b`,
    'gi',
  );
  for (const match of scrubbed.matchAll(amountThenLabel)) {
    const amount = parseMoney(match[2] ?? '');
    if (amount == null) {
      continue;
    }
    pushHit(amount, 95, match.index ?? 0);
  }

  // 3) Line-oriented: "Total" on one line, money on the next (common for Vision).
  // Keep untrimmed lines so hit.index stays in the same coordinate space as
  // lastSubtotalIndex (computed on scrubbed).
  const rawLines = scrubbed.split(/\r?\n/);
  const isTotalLine = (line: string) =>
    new RegExp(`\\b${totalLabel}\\b`, 'i').test(line);
  const isNoiseLine = (line: string) =>
    new RegExp(`\\b(?:${billNoiseLabel})\\b`, 'i').test(line);

  const amountsOn = (line: string): number[] => {
    const found: number[] = [];
    const re = /([$€£₹]\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) != null) {
      const amount = parseMoney(match[2] ?? '');
      if (amount != null) {
        found.push(amount);
      }
    }
    return found;
  };

  let lineOffset = 0;
  for (let i = 0; i < rawLines.length; i += 1) {
    const rawLine = rawLines[i]!;
    const line = rawLine.trim();
    const lineIndex = lineOffset;
    lineOffset += rawLine.length + 1;
    if (!line || !isTotalLine(line)) {
      continue;
    }
    let amounts = amountsOn(line);
    let amountIndex = lineIndex;
    if (amounts.length === 0) {
      // Same-line miss: try the next 1–2 lines (classic receipt).
      for (let look = 1; look <= 2; look += 1) {
        const nextRaw = rawLines[i + look];
        if (nextRaw == null) {
          continue;
        }
        const next = nextRaw.trim();
        if (!next) {
          continue;
        }
        if (isTotalLine(next) || isNoiseLine(next)) {
          break;
        }
        amounts = amountsOn(next);
        if (amounts.length > 0) {
          amountIndex = lineIndex + rawLine.length + 1;
          break;
        }
      }
    }
    // DoorDash-style column OCR: "Total" then a stack of bare money lines
    // (subtotal, fees, …, paid). Prefer the last positive amount in that block.
    if (amounts.length === 1 || amounts.length === 0) {
      const block: number[] = [];
      let blockIndex = amountIndex;
      for (let look = 1; look < rawLines.length - i; look += 1) {
        const nextRaw = rawLines[i + look];
        if (nextRaw == null) {
          break;
        }
        const next = nextRaw.trim();
        if (!next) {
          continue;
        }
        const found = amountsOn(next);
        const withoutMoney = next
          .replace(/[$€£₹]/g, '')
          .replace(/[\d,.\-\s]/g, '');
        if (found.length === 0 || withoutMoney.length > 2) {
          break;
        }
        if (block.length === 0) {
          blockIndex = lineIndex + rawLine.length + 1;
        }
        for (const value of found) {
          if (value > 0) {
            block.push(value);
          }
        }
      }
      if (block.length >= 2) {
        amounts = [block[block.length - 1]!];
        amountIndex = blockIndex;
      }
    }
    // Rightmost amount on a Total row is usually the charge.
    const amount = amounts[amounts.length - 1];
    if (amount != null) {
      pushHit(amount, 110, amountIndex);
    }
  }

  if (hits.length > 0) {
    // Prefer Total that appears after the last Subtotal (final charge on receipt).
    const afterSubtotal =
      lastSubtotalIndex >= 0
        ? hits.filter(hit => hit.index > lastSubtotalIndex)
        : hits;
    const pool = afterSubtotal.length > 0 ? afterSubtotal : hits;
    pool.sort((a, b) => b.score - a.score || b.index - a.index);
    return pool[0]!.amount;
  }

  // No Total label found. If this looks like a bill breakdown, do NOT guess
  // Subtotal / fee lines — better to ask the user.
  const looksLikeBillBreakdown =
    /\bsubtotal\b/i.test(scrubbed) ||
    new RegExp(`\\b(?:${billNoiseLabel})\\b`, 'i').test(scrubbed) ||
    rawLines.filter(line => /[$€£₹]/.test(line)).length >= 3;

  if (looksLikeBillBreakdown) {
    return null;
  }

  // Simple single-amount snippet ("Paid $42.00") — last currency amount.
  const currencyOnly =
    /([$€£₹]\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})/g;
  let last: number | null = null;
  let match: RegExpExecArray | null;
  while ((match = currencyOnly.exec(scrubbed)) != null) {
    const preceding = scrubbed
      .slice(Math.max(0, (match.index ?? 0) - 32), match.index ?? 0)
      .toLowerCase();
    if (/\bsubtotal\b[\s:.\-]*$/i.test(preceding)) {
      continue;
    }
    last = parseMoney(match[2] ?? '');
  }
  return last;
}
