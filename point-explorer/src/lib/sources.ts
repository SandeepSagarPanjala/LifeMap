import type {ParsedPoint} from '../types';

/** Common LifeMap location point sources (shown first in the UI). */
export const PLOT_SOURCE_ORDER = [
  'gps',
  'native_queue',
  'motion_departure',
  'native_queue:motionchange',
] as const;

/** Sources merged into the chronological "trip" track (motion_arrival excluded). */
export const TRIP_PLOT_SOURCES = [
  'gps',
  'native_queue',
  'motion_departure',
  'native_queue:motionchange',
] as const;

const SOURCE_LABELS: Record<string, string> = {
  gps: 'gps — live onLocation',
  native_queue: 'native_queue — SDK buffer drain',
  motion_departure: 'motion_departure — started moving',
  'native_queue:motionchange': 'native_queue:motionchange — buffered motion',
  motion_arrival: 'motion_arrival — stopped moving',
  heartbeat_ping: 'heartbeat_ping — stationary ping',
  heartbeat_departure: 'heartbeat_departure — heartbeat wake',
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function normalizeSource(source: string | undefined): string {
  return source?.trim() ? source : '(none)';
}

export function sortSourcesForUi(sources: Iterable<string>): string[] {
  const set = new Set(sources);
  const ordered = PLOT_SOURCE_ORDER.filter(source => set.has(source));
  const rest = [...set]
    .filter(source => !PLOT_SOURCE_ORDER.includes(source as (typeof PLOT_SOURCE_ORDER)[number]))
    .sort();
  return [...ordered, ...rest];
}

export function uniqueSources(points: ParsedPoint[]): string[] {
  return sortSourcesForUi(points.map(point => normalizeSource(point.source)));
}

export function countBySource(points: ParsedPoint[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const point of points) {
    const source = normalizeSource(point.source);
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return counts;
}

export function filterPointsBySources(
  points: ParsedPoint[],
  selectedSources: ReadonlySet<string>,
): ParsedPoint[] {
  if (selectedSources.size === 0) {
    return [];
  }
  return points.filter(point => selectedSources.has(normalizeSource(point.source)));
}
