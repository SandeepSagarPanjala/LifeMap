export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseRequiredIsoDate(value: unknown, field: string): Date {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    throw new Error(`Invalid date for ${field}`);
  }
  return parsed;
}

export function parseOptionalNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRequiredNumber(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for ${field}`);
  }
  return parsed;
}

export function parseOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? value : null;
}

export function parseRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid string for ${field}`);
  }
  return value;
}

export function pickKnownFields<T extends Record<string, unknown>>(
  row: Record<string, unknown>,
  allowedKeys: readonly (keyof T)[],
): T {
  const picked = {} as T;
  for (const key of allowedKeys) {
    if (key in row) {
      picked[key] = row[key as string] as T[keyof T];
    }
  }
  return picked;
}
