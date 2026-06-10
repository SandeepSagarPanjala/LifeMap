import type {DatabaseExport, LocationExport, LocationPointRow, ParsedPoint} from '../types';

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

export function uniqueDateKeys(points: ParsedPoint[]): string[] {
  const keys = new Set(points.map(p => p.dateKey));
  return [...keys].sort();
}
