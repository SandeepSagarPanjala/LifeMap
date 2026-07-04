import type {
  LocationPointRow,
  MomentRow,
  ParsedPoint,
  PlaceLookupRow,
  SavedPlaceRow,
  UploadDataKind,
  UploadMode,
} from '../types';
import type {
  PlaceLookupCandidate,
  PlaceLookupStatus,
} from '@lifemap/segmentation';
import {rawRowsToParsedPoints} from '@lifemap/segmentation';
import {APP_TIMEZONE} from '@lifemap/constants';

const DATE_KEY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function dateKeyForTimestamp(iso: string): string {
  return DATE_KEY_FORMATTER.format(new Date(iso));
}

export function formatTimestamp(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(date);
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

function normalizeExportPayload(raw: unknown): Record<string, unknown> | null {
  let value: unknown = raw;

  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        return null;
      }
      continue;
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, unknown>;
    if (
      record.tables != null ||
      Array.isArray(record.rows) ||
      record.trips != null ||
      record.segments != null ||
      record.location_points != null
    ) {
      return record;
    }

    let unwrapped: unknown = null;
    for (const key of ['data', 'payload', 'export', 'body', 'message']) {
      const nested = record[key];
      if (nested != null && typeof nested === 'object') {
        unwrapped = nested;
        break;
      }
    }

    if (unwrapped == null) {
      return record;
    }
    value = unwrapped;
  }

  return null;
}

function getExportTables(
  raw: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const tables = raw.tables;
  return tables != null && typeof tables === 'object' && !Array.isArray(tables)
    ? (tables as Record<string, unknown>)
    : undefined;
}

function getExportRowCounts(
  raw: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const rowCounts = raw.rowCounts;
  return rowCounts != null &&
    typeof rowCounts === 'object' &&
    !Array.isArray(rowCounts)
    ? (rowCounts as Record<string, unknown>)
    : undefined;
}

function extractLocationRows(raw: unknown): LocationPointRow[] | null {
  const record = normalizeExportPayload(raw);
  if (record == null) {
    return null;
  }

  if (Array.isArray(record.rows)) {
    return record.rows as LocationPointRow[];
  }

  const tables = getExportTables(record);
  const fromTables = tables?.location_points;
  if (Array.isArray(fromTables)) {
    return fromTables as LocationPointRow[];
  }

  const topLevel = record.location_points;
  if (Array.isArray(topLevel)) {
    return topLevel as LocationPointRow[];
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

  const parsed = rawRowsToParsedPoints(
    rows.filter(
      row =>
        typeof row.lat === 'number' &&
        typeof row.lng === 'number' &&
        Boolean(row.timestamp),
    ),
  );
  parsed.sort((a, b) => a.at.getTime() - b.at.getTime());
  return parsed;
}

export function parseSavedPlaces(raw: unknown): SavedPlaceRow[] {
  const record = normalizeExportPayload(raw);
  if (record == null) {
    return [];
  }
  const rows = getExportTables(record)?.saved_places;
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

export function parseMoments(raw: unknown): MomentRow[] {
  const record = normalizeExportPayload(raw);
  if (record == null) {
    return [];
  }
  const rows = getExportTables(record)?.moments;
  if (!Array.isArray(rows)) {
    return [];
  }
  const moments: MomentRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const entry = row as Record<string, unknown>;
    if (typeof entry.id !== 'number' || typeof entry.timestamp !== 'string') {
      continue;
    }
    const type = entry.type;
    moments.push({
      id: entry.id,
      type:
        type === 'photo' ||
        type === 'video' ||
        type === 'voice' ||
        type === 'note' ||
        type === 'activity'
          ? type
          : undefined,
      timestamp: entry.timestamp,
      lat: typeof entry.lat === 'number' ? entry.lat : null,
      lng: typeof entry.lng === 'number' ? entry.lng : null,
    });
  }
  return moments;
}

function parsePlaceLookupCandidates(raw: unknown): PlaceLookupCandidate[] {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const candidates: PlaceLookupCandidate[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item == null) {
      continue;
    }
    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!id || !name) {
      continue;
    }
    const kind = entry.kind === 'address' ? 'address' : 'poi';
    candidates.push({
      id,
      name,
      kind,
      distanceM: typeof entry.distanceM === 'number' ? entry.distanceM : 0,
    });
  }
  return candidates;
}

function parsePlaceLookupStatus(raw: unknown): PlaceLookupStatus {
  if (raw === 'pending' || raw === 'complete' || raw === 'failed') {
    return raw;
  }
  return 'pending';
}

export function parsePlaceLookupCache(raw: unknown): PlaceLookupRow[] {
  const record = normalizeExportPayload(raw);
  if (record == null) {
    return [];
  }
  const rows = getExportTables(record)?.place_lookup_cache;
  if (!Array.isArray(rows)) {
    return [];
  }
  const cache: PlaceLookupRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const entry = row as Record<string, unknown>;
    if (
      typeof entry.id !== 'number' ||
      typeof entry.anchorLat !== 'number' ||
      typeof entry.anchorLng !== 'number' ||
      typeof entry.venueRadiusMeters !== 'number'
    ) {
      continue;
    }
    const candidates = parsePlaceLookupCandidates(
      entry.candidatesJson ?? entry.candidates,
    );
    cache.push({
      id: entry.id,
      anchorLat: entry.anchorLat,
      anchorLng: entry.anchorLng,
      venueRadiusMeters: entry.venueRadiusMeters,
      addressLine:
        typeof entry.addressLine === 'string' ? entry.addressLine : null,
      candidates,
      selectedCandidateIndex:
        typeof entry.selectedCandidateIndex === 'number'
          ? entry.selectedCandidateIndex
          : null,
      lookupStatus: parsePlaceLookupStatus(entry.lookupStatus),
      fetchedAt:
        typeof entry.fetchedAt === 'string' ? entry.fetchedAt : null,
    });
  }
  return cache;
}

export function uniqueDateKeys(points: ParsedPoint[]): string[] {
  const keys = new Set(points.map(p => p.dateKey));
  return [...keys].sort();
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

  const tables = getExportTables(raw);
  if (
    Array.isArray(tables?.location_points) &&
    tables.location_points.length > 0
  ) {
    return true;
  }

  if (Array.isArray(raw.location_points) && raw.location_points.length > 0) {
    return true;
  }

  const rowCounts = getExportRowCounts(raw);
  const count = rowCounts?.location_points;
  if (typeof count === 'number' && count > 0) {
    return Array.isArray(tables?.location_points) || Array.isArray(raw.location_points);
  }

  if (raw.exportKind === 'original_data') {
    return Array.isArray(tables?.location_points);
  }

  return false;
}

function hasStoredTripRows(raw: Record<string, unknown>): boolean {
  const tables = getExportTables(raw);
  if (Array.isArray(tables?.trips) && tables.trips.length > 0) {
    return true;
  }
  if (Array.isArray(raw.trips) && raw.trips.length > 0) {
    return true;
  }
  return Array.isArray(raw.segments) && raw.segments.length > 0;
}

export function detectUploadDataKind(raw: unknown): UploadDataKind {
  const record = normalizeExportPayload(raw);
  if (record == null) {
    return 'unknown';
  }
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

export function describeExportPayload(raw: unknown): string {
  const record = normalizeExportPayload(raw);
  if (record == null) {
    return 'unrecognized JSON';
  }
  const tables = getExportTables(record);
  const tableKeys = tables != null ? Object.keys(tables) : [];
  const exportKind =
    typeof record.exportKind === 'string' ? record.exportKind : null;
  const parts = [
    exportKind != null ? `exportKind=${exportKind}` : null,
    tableKeys.length > 0 ? `tables: ${tableKeys.join(', ')}` : null,
    Array.isArray(record.rows) ? `rows: ${record.rows.length}` : null,
  ].filter((part): part is string => part != null);
  return parts.length > 0 ? parts.join(' · ') : 'no tables or rows found';
}
