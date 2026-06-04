import type {LocationExport, ParsedPoint} from '../types';

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

export function parseExport(raw: unknown): ParsedPoint[] {
  const data = raw as LocationExport;
  if (!data || !Array.isArray(data.rows)) {
    throw new Error('Invalid export: expected { rows: [...] }');
  }

  const points: ParsedPoint[] = [];
  for (const row of data.rows) {
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
