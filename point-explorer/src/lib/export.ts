import type {
  DatabaseExport,
  LocationExport,
  LocationPointRow,
  ParsedPoint,
  SavedPlaceRow,
  UploadDataKind,
  UploadMode,
} from '../types';

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function dateKeyForTimestamp(iso: string): string {
  return DATE_KEY_FORMATTER.format(new Date(iso));
}

export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(new Date(iso));
}

export function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function extractLocationRows(raw: unknown): LocationPointRow[] | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const locationExport = raw as LocationExport;
  if (Array.isArray(locationExport.rows)) {
    return locationExport.rows;
  }

  const databaseExport = raw as DatabaseExport;
  const rows = databaseExport.tables?.location_points;
  if (Array.isArray(rows)) {
    return rows;
  }

  return null;
}

export function parseExport(raw: unknown): ParsedPoint[] {
  const rows = extractLocationRows(raw);
  if (!rows) {
    throw new Error(
      'Invalid export: expected { rows: [...] } or { tables: { location_points: [...] } }',
    );
  }

  const points: ParsedPoint[] = [];
  for (const row of rows) {
    if (
      typeof row.lat !== 'number' ||
      typeof row.lng !== 'number' ||
      !row.timestamp
    ) {
      continue;
    }
    points.push({
      ...row,
      at: new Date(row.timestamp),
      dateKey: dateKeyForTimestamp(row.timestamp),
    });
  }

  points.sort((a, b) => a.at.getTime() - b.at.getTime());
  return points;
}

export function parseSavedPlaces(raw: unknown): SavedPlaceRow[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }
  const rows = (raw as DatabaseExport).tables?.saved_places;
  if (!Array.isArray(rows)) {
    return [];
  }
  const places: SavedPlaceRow[] = [];
  for (const row of rows) {
    if (
      typeof row.id !== 'number' ||
      typeof row.label !== 'string' ||
      typeof row.lat !== 'number' ||
      typeof row.lng !== 'number' ||
      typeof row.radiusMeters !== 'number'
    ) {
      continue;
    }
    places.push({
      id: row.id,
      kind: row.kind,
      label: row.label,
      lat: row.lat,
      lng: row.lng,
      radiusMeters: row.radiusMeters,
      createdAt: row.createdAt,
    });
  }
  return places;
}

export function uniqueDateKeys(points: ParsedPoint[]): string[] {
  const keys = new Set(points.map(p => p.dateKey));
  return [...keys].sort();
}

export function dateKeyForDate(date: Date): string {
  return DATE_KEY_FORMATTER.format(date);
}

/** First instant of a calendar day in America/Chicago. */
export function chicagoDayStart(dayKey: string): Date {
  let lo = Date.parse(`${dayKey}T00:00:00Z`) - 36 * 3_600_000;
  let hi = Date.parse(`${dayKey}T00:00:00Z`) + 12 * 3_600_000;

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const key = dateKeyForTimestamp(new Date(mid).toISOString());
    if (key < dayKey) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return new Date(lo);
}

/** First instant of the next calendar day in America/Chicago. */
export function chicagoDayEnd(dayKey: string): Date {
  const start = chicagoDayStart(dayKey);
  const shifted = new Date(start.getTime() + 86_400_000);
  return chicagoDayStart(dateKeyForTimestamp(shifted.toISOString()));
}

export function addDaysToDateKey(dayKey: string, delta: number): string {
  if (delta === 0) {
    return dayKey;
  }
  const start = chicagoDayStart(dayKey);
  const shifted = new Date(start.getTime() + delta * 86_400_000);
  return dateKeyForTimestamp(shifted.toISOString());
}

function hasLocationPointRows(raw: Record<string, unknown>): boolean {
  if (Array.isArray(raw.rows) && raw.rows.length > 0) {
    return true;
  }
  const tables = raw.tables as Record<string, unknown> | undefined;
  return (
    Array.isArray(tables?.location_points) && tables.location_points.length > 0
  );
}

function hasStoredTripRows(raw: Record<string, unknown>): boolean {
  const tables = raw.tables as Record<string, unknown> | undefined;
  if (Array.isArray(tables?.trips) && tables.trips.length > 0) {
    return true;
  }
  if (Array.isArray(raw.trips) && raw.trips.length > 0) {
    return true;
  }
  return Array.isArray(raw.segments) && raw.segments.length > 0;
}

export function detectUploadDataKind(raw: unknown): UploadDataKind {
  if (!raw || typeof raw !== 'object') {
    return 'unknown';
  }
  const record = raw as Record<string, unknown>;
  if (hasStoredTripRows(record)) {
    return 'stored_trips';
  }
  if (hasLocationPointRows(record)) {
    return 'location_points';
  }
  return 'unknown';
}

export function inferDefaultUploadMode(raw: unknown): UploadMode {
  const kind = detectUploadDataKind(raw);
  return kind === 'stored_trips' ? 'plot' : 'detect';
}
