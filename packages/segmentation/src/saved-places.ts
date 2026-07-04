import type {Stop} from './stops';
import type {ParsedPoint, SavedPlaceRow} from './types';

const KIND_PRIORITY: Record<SavedPlaceRow['kind'], number> = {
  home: 0,
  work: 1,
  favorite: 2,
};

const EARTH_RADIUS_KM = 6371;

function distanceKm(
  a: {lat: number; lng: number},
  b: {lat: number; lng: number},
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function matchSavedPlaceForPoint(
  point: {lat: number; lng: number},
  places: SavedPlaceRow[],
): SavedPlaceRow | null {
  let match: SavedPlaceRow | null = null;
  let matchPriority = Number.POSITIVE_INFINITY;
  let matchDistanceM = Number.POSITIVE_INFINITY;

  for (const place of places) {
    const distanceM = distanceKm(point, place) * 1000;
    if (distanceM > place.radiusMeters) {
      continue;
    }

    const priority = KIND_PRIORITY[place.kind];
    if (
      priority < matchPriority ||
      (priority === matchPriority && distanceM < matchDistanceM)
    ) {
      match = place;
      matchPriority = priority;
      matchDistanceM = distanceM;
    }
  }

  return match;
}

/** Match a stay to a saved place — centroid first, then member points. */
export function matchSavedPlaceForStop(
  stop: Stop,
  points: ParsedPoint[],
  places: SavedPlaceRow[],
): SavedPlaceRow | null {
  if (places.length === 0) {
    return null;
  }

  const centroidMatch = matchSavedPlaceForPoint(
    {lat: stop.lat, lng: stop.lng},
    places,
  );
  if (centroidMatch != null) {
    return centroidMatch;
  }

  for (const point of points) {
    const match = matchSavedPlaceForPoint(point, places);
    if (match != null) {
      return match;
    }
  }

  return null;
}

/** Drive start — endpoint GPS first, then the previous stay's saved place. */
export function matchDriveStartSavedPlace(
  drive: {points: ParsedPoint[]; fromStop: Stop | null},
  previousSegment:
    | {
        kind: string;
        stop?: Stop;
        points?: ParsedPoint[];
        placeId?: number;
        placeKind?: 'saved' | 'cache';
      }
    | undefined,
  places: SavedPlaceRow[],
): SavedPlaceRow | null {
  if (drive.points.length > 0) {
    const fromEndpoint = matchSavedPlaceForPoint(drive.points[0]!, places);
    if (fromEndpoint != null) {
      return fromEndpoint;
    }
  }
  if (drive.fromStop != null) {
    const fromStop = matchSavedPlaceForPoint(
      {lat: drive.fromStop.lat, lng: drive.fromStop.lng},
      places,
    );
    if (fromStop != null) {
      return fromStop;
    }
  }
  if (
    previousSegment?.kind === 'stay' &&
    previousSegment.placeKind === 'saved' &&
    previousSegment.placeId != null
  ) {
    return places.find(place => place.id === previousSegment.placeId) ?? null;
  }
  if (
    previousSegment?.kind === 'stay' &&
    previousSegment.stop != null &&
    previousSegment.points != null
  ) {
    return matchSavedPlaceForStop(
      previousSegment.stop,
      previousSegment.points,
      places,
    );
  }
  return null;
}

/** Drive end — endpoint GPS first, then the next stay's saved place. */
export function matchDriveEndSavedPlace(
  drive: {points: ParsedPoint[]; toStop: Stop | null},
  nextSegment:
    | {
        kind: string;
        stop?: Stop;
        points?: ParsedPoint[];
        placeId?: number;
        placeKind?: 'saved' | 'cache';
      }
    | undefined,
  places: SavedPlaceRow[],
): SavedPlaceRow | null {
  if (drive.points.length > 0) {
    const toEndpoint = matchSavedPlaceForPoint(
      drive.points[drive.points.length - 1]!,
      places,
    );
    if (toEndpoint != null) {
      return toEndpoint;
    }
  }
  if (drive.toStop != null) {
    const toStop = matchSavedPlaceForPoint(
      {lat: drive.toStop.lat, lng: drive.toStop.lng},
      places,
    );
    if (toStop != null) {
      return toStop;
    }
  }
  if (
    nextSegment?.kind === 'stay' &&
    nextSegment.placeKind === 'saved' &&
    nextSegment.placeId != null
  ) {
    return places.find(place => place.id === nextSegment.placeId) ?? null;
  }
  if (
    nextSegment?.kind === 'stay' &&
    nextSegment.stop != null &&
    nextSegment.points != null
  ) {
    return matchSavedPlaceForStop(
      nextSegment.stop,
      nextSegment.points,
      places,
    );
  }
  return null;
}

export function driveSavedPlaceLabel(
  fromLabel?: string,
  toLabel?: string,
): string {
  if (fromLabel && toLabel) {
    return `Drive · ${fromLabel} → ${toLabel}`;
  }
  if (fromLabel) {
    return `Drive · ${fromLabel} →`;
  }
  if (toLabel) {
    return `Drive · → ${toLabel}`;
  }
  return 'Drive';
}
