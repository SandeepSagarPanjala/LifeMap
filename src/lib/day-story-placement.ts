import type { LocationPointRow } from '@/db/repositories/location-days';
import { bearingDegrees, distanceKm } from '@/lib/location-geo';
import type { DayStoryStop } from '@/lib/day-story-stops';
import type { DayTimelineEntry, DetectedTrip } from '@/lib/trip-detection';

export type DayStoryCardSide = 'top' | 'bottom' | 'left' | 'right';

/** Prefer these among sides that are still free. */
const DEFAULT_SIDE_ORDER: DayStoryCardSide[] = [
  'left',
  'right',
  'bottom',
  'top',
];

/** Opposite side — collision / path helper. */
export function oppositeCardSide(side: DayStoryCardSide): DayStoryCardSide {
  switch (side) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

/**
 * Cardinal side matching travel direction (northbound → top, eastbound → right, …).
 */
export function cardSideFromTravelBearing(bearingDeg: number): DayStoryCardSide {
  const b = ((bearingDeg % 360) + 360) % 360;
  if (b >= 315 || b < 45) {
    return 'top';
  }
  if (b >= 45 && b < 135) {
    return 'right';
  }
  if (b >= 135 && b < 225) {
    return 'bottom';
  }
  return 'left';
}

function angularDistanceDeg(a: number, b: number): number {
  const diff = Math.abs((((a - b) % 360) + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Sides a travel direction occupies. Diagonals (e.g. NE) occupy two sides.
 */
export function sidesForTravelDirection(bearingDeg: number): DayStoryCardSide[] {
  const b = ((bearingDeg % 360) + 360) % 360;
  const sides: DayStoryCardSide[] = [];
  if (angularDistanceDeg(b, 0) <= 55) {
    sides.push('top');
  }
  if (angularDistanceDeg(b, 90) <= 55) {
    sides.push('right');
  }
  if (angularDistanceDeg(b, 180) <= 55) {
    sides.push('bottom');
  }
  if (angularDistanceDeg(b, 270) <= 55) {
    sides.push('left');
  }
  return sides.length > 0 ? sides : [cardSideFromTravelBearing(b)];
}

export function pathSidesComingFrom(bearingDeg: number): DayStoryCardSide[] {
  return sidesForTravelDirection(bearingDeg).map(oppositeCardSide);
}

export function pathSidesGoingTo(bearingDeg: number): DayStoryCardSide[] {
  return sidesForTravelDirection(bearingDeg);
}

export function pathSideComingFrom(bearingDeg: number): DayStoryCardSide {
  return oppositeCardSide(cardSideFromTravelBearing(bearingDeg));
}

export function pathSideGoingTo(bearingDeg: number): DayStoryCardSide {
  return cardSideFromTravelBearing(bearingDeg);
}

function travelEndBearing(travel: DetectedTrip): number | null {
  const points = travel.points;
  if (points.length < 2) {
    return null;
  }
  const end = points[points.length - 1]!;
  const start = points[Math.max(0, points.length - 6)]!;
  return bearingDegrees(
    { lat: start.lat, lng: start.lng },
    { lat: end.lat, lng: end.lng },
  );
}

function travelStartBearing(travel: DetectedTrip): number | null {
  const points = travel.points;
  if (points.length < 2) {
    return null;
  }
  const start = points[0]!;
  const end = points[Math.min(5, points.length - 1)]!;
  return bearingDegrees(
    { lat: start.lat, lng: start.lng },
    { lat: end.lat, lng: end.lng },
  );
}

export function findInboundTravelForStay(
  entries: readonly DayTimelineEntry[],
  stayId: string,
): DetectedTrip | null {
  const stayIndex = entries.findIndex(entry => entry.id === stayId);
  if (stayIndex <= 0) {
    return null;
  }
  for (let i = stayIndex - 1; i >= 0; i -= 1) {
    const entry = entries[i]!;
    if (entry.kind === 'travel') {
      return entry;
    }
    if (entry.kind === 'stay') {
      return null;
    }
  }
  return null;
}

export function findOutboundTravelForStay(
  entries: readonly DayTimelineEntry[],
  stayId: string,
): DetectedTrip | null {
  const stayIndex = entries.findIndex(entry => entry.id === stayId);
  if (stayIndex < 0 || stayIndex >= entries.length - 1) {
    return null;
  }
  for (let i = stayIndex + 1; i < entries.length; i += 1) {
    const entry = entries[i]!;
    if (entry.kind === 'travel') {
      return entry;
    }
    if (entry.kind === 'stay') {
      return null;
    }
  }
  return null;
}

/** Sides blocked by this stop's own inbound/outbound drives. */
export function blockedCardSidesForStop(
  stop: DayStoryStop,
  entries: readonly DayTimelineEntry[],
): Set<DayStoryCardSide> {
  const blocked = new Set<DayStoryCardSide>();
  for (const stay of stop.stays) {
    const inbound = findInboundTravelForStay(entries, stay.id);
    if (inbound != null) {
      const endBearing = travelEndBearing(inbound);
      if (endBearing != null) {
        for (const side of pathSidesComingFrom(endBearing)) {
          blocked.add(side);
        }
      }
    }
    const outbound = findOutboundTravelForStay(entries, stay.id);
    if (outbound != null) {
      const startBearing = travelStartBearing(outbound);
      if (startBearing != null) {
        for (const side of pathSidesGoingTo(startBearing)) {
          blocked.add(side);
        }
      }
    }
  }
  return blocked;
}

/** Push the card further from a nearby pin. */
export function sideAwayFromNeighbor(
  stop: DayStoryStop,
  neighbor: DayStoryStop,
): DayStoryCardSide {
  return oppositeCardSide(sideTowardNeighbor(stop, neighbor));
}

/** Side of `stop` that faces `neighbor` (dominant axis). */
export function sideTowardNeighbor(
  stop: DayStoryStop,
  neighbor: DayStoryStop,
): DayStoryCardSide {
  const dLat = neighbor.coordinate.latitude - stop.coordinate.latitude;
  const dLng = neighbor.coordinate.longitude - stop.coordinate.longitude;
  if (Math.abs(dLng) >= Math.abs(dLat)) {
    return dLng >= 0 ? 'right' : 'left';
  }
  return dLat >= 0 ? 'top' : 'bottom';
}

/**
 * Both cardinal sides toward a neighbor when the offset is clearly diagonal.
 * SE neighbor → right + bottom; NW → left + top; etc.
 */
export function sidesTowardNeighbor(
  stop: DayStoryStop,
  neighbor: DayStoryStop,
): DayStoryCardSide[] {
  const dLat = neighbor.coordinate.latitude - stop.coordinate.latitude;
  const dLng = neighbor.coordinate.longitude - stop.coordinate.longitude;
  const east = dLng >= 0;
  const north = dLat >= 0;
  const absLat = Math.abs(dLat);
  const absLng = Math.abs(dLng);
  if (absLat < 1e-12 && absLng < 1e-12) {
    return [];
  }
  // Nearly axis-aligned → single side.
  if (absLng >= absLat * 2.5) {
    return [east ? 'right' : 'left'];
  }
  if (absLat >= absLng * 2.5) {
    return [north ? 'top' : 'bottom'];
  }
  // Diagonal → both sides (3 SE of 4 → right + bottom).
  return [east ? 'right' : 'left', north ? 'top' : 'bottom'];
}

function stopDistanceMeters(a: DayStoryStop, b: DayStoryStop): number {
  return (
    distanceKm(
      { lat: a.coordinate.latitude, lng: a.coordinate.longitude },
      { lat: b.coordinate.latitude, lng: b.coordinate.longitude },
    ) * 1000
  );
}

/**
 * Hard-eliminated sides for a card:
 * 1) this number's in + out drives
 * 2) sides toward previous / next numbered pins (when nearby)
 * 3) previous number's card side (when nearby — don't stack)
 */
export function eliminatedCardSidesForStop(options: {
  stop: DayStoryStop;
  previous: DayStoryStop | null;
  next: DayStoryStop | null;
  previousSide: DayStoryCardSide | null;
  entries: readonly DayTimelineEntry[];
  neighborRadiusMeters?: number;
}): Set<DayStoryCardSide> {
  const {
    stop,
    previous,
    next,
    previousSide,
    entries,
    neighborRadiusMeters = 700,
  } = options;

  const eliminated = new Set(blockedCardSidesForStop(stop, entries));

  if (
    previous != null &&
    stopDistanceMeters(stop, previous) <= neighborRadiusMeters
  ) {
    for (const side of sidesTowardNeighbor(stop, previous)) {
      eliminated.add(side);
    }
    if (previousSide != null) {
      eliminated.add(previousSide);
    }
  }

  if (next != null && stopDistanceMeters(stop, next) <= neighborRadiusMeters) {
    for (const side of sidesTowardNeighbor(stop, next)) {
      eliminated.add(side);
    }
  }

  return eliminated;
}

export function preferredCardSideForStop(
  stop: DayStoryStop,
  entries: readonly DayTimelineEntry[],
  previous: DayStoryStop | null = null,
  next: DayStoryStop | null = null,
): DayStoryCardSide {
  const eliminated = eliminatedCardSidesForStop({
    stop,
    previous,
    next,
    previousSide: null,
    entries,
  });
  const free = DEFAULT_SIDE_ORDER.filter(side => !eliminated.has(side));
  return free[0] ?? 'top';
}

/**
 * Pick first free side after eliminations.
 * Among free sides, prefer ones that point away from nearby prev/next pins
 * (for a SE neighbor, away = left + top — left wins via DEFAULT_SIDE_ORDER).
 */
export function chooseCardSideForStop(options: {
  stop: DayStoryStop;
  previous: DayStoryStop | null;
  next: DayStoryStop | null;
  previousSide: DayStoryCardSide | null;
  entries: readonly DayTimelineEntry[];
  neighborRadiusMeters?: number;
}): DayStoryCardSide {
  const {
    stop,
    previous,
    next,
    previousSide,
    entries,
    neighborRadiusMeters = 700,
  } = options;

  const eliminated = eliminatedCardSidesForStop({
    stop,
    previous,
    next,
    previousSide,
    entries,
    neighborRadiusMeters,
  });

  const awaySides = new Set<DayStoryCardSide>();
  if (
    previous != null &&
    stopDistanceMeters(stop, previous) <= neighborRadiusMeters
  ) {
    for (const toward of sidesTowardNeighbor(stop, previous)) {
      awaySides.add(oppositeCardSide(toward));
    }
  }
  if (next != null && stopDistanceMeters(stop, next) <= neighborRadiusMeters) {
    for (const toward of sidesTowardNeighbor(stop, next)) {
      awaySides.add(oppositeCardSide(toward));
    }
  }

  const preferred: DayStoryCardSide[] = [
    ...DEFAULT_SIDE_ORDER.filter(side => awaySides.has(side)),
    ...DEFAULT_SIDE_ORDER.filter(side => !awaySides.has(side)),
  ];

  const free = preferred.filter(side => !eliminated.has(side));
  if (free.length > 0) {
    return free[0]!;
  }
  return preferred[0] ?? 'top';
}

/**
 * Assign card sides in visit order.
 * Each card eliminates: own in/out, sides toward prev/next pins, prev card side.
 */
export function assignDayStoryCardSides(
  stops: readonly DayStoryStop[],
  entries: readonly DayTimelineEntry[],
  collisionRadiusMeters = 700,
): Map<string, DayStoryCardSide> {
  const assigned = new Map<string, DayStoryCardSide>();
  if (stops.length === 0) {
    return assigned;
  }

  const ordered = stops
    .slice()
    .sort((a, b) => (a.visitNumbers[0] ?? 0) - (b.visitNumbers[0] ?? 0));

  for (let i = 0; i < ordered.length; i += 1) {
    const stop = ordered[i]!;
    // Home always sits above its badges — skip drive/neighbor placement.
    if (stop.isHome) {
      assigned.set(stop.key, 'top');
      continue;
    }
    const previous = i > 0 ? ordered[i - 1]! : null;
    const next = i < ordered.length - 1 ? ordered[i + 1]! : null;
    const previousSide =
      previous != null ? assigned.get(previous.key) ?? null : null;

    assigned.set(
      stop.key,
      chooseCardSideForStop({
        stop,
        previous,
        next,
        previousSide,
        entries,
        neighborRadiusMeters: collisionRadiusMeters,
      }),
    );
  }

  return assigned;
}

/** @deprecated */
export function pathConstraintsForStop(
  stop: DayStoryStop,
  previous: DayStoryStop | null,
  entries: readonly DayTimelineEntry[],
  includePreviousDrivesWithinMeters = 700,
): {
  hardBlocked: Set<DayStoryCardSide>;
  softBlocked: Set<DayStoryCardSide>;
} {
  const hardBlocked = eliminatedCardSidesForStop({
    stop,
    previous,
    next: null,
    previousSide: null,
    entries,
    neighborRadiusMeters: includePreviousDrivesWithinMeters,
  });
  return { hardBlocked, softBlocked: new Set() };
}

/** @deprecated */
export function blockedCardSidesWithPrevious(
  stop: DayStoryStop,
  previous: DayStoryStop | null,
  entries: readonly DayTimelineEntry[],
  includePreviousDrivesWithinMeters = 700,
): Set<DayStoryCardSide> {
  return eliminatedCardSidesForStop({
    stop,
    previous,
    next: null,
    previousSide: null,
    entries,
    neighborRadiusMeters: includePreviousDrivesWithinMeters,
  });
}

function pathCost(
  side: DayStoryCardSide,
  blocked: ReadonlySet<DayStoryCardSide>,
): number {
  return blocked.has(side) ? 1 : 0;
}

/** @deprecated pair helper kept for tests */
export function bestPairSides(
  a: DayStoryStop,
  b: DayStoryStop,
  blockedA: ReadonlySet<DayStoryCardSide>,
  blockedB: ReadonlySet<DayStoryCardSide>,
): { sideA: DayStoryCardSide; sideB: DayStoryCardSide } {
  const aIsWest = a.coordinate.longitude <= b.coordinate.longitude;
  const aIsSouth = a.coordinate.latitude <= b.coordinate.latitude;
  const eastWestDominant =
    Math.abs(a.coordinate.longitude - b.coordinate.longitude) *
      Math.cos(
        (((a.coordinate.latitude + b.coordinate.latitude) / 2) * Math.PI) /
          180,
      ) >=
    Math.abs(a.coordinate.latitude - b.coordinate.latitude);

  const candidates: Array<{
    sideA: DayStoryCardSide;
    sideB: DayStoryCardSide;
    axisScore: number;
  }> = [];

  const push = (
    sideA: DayStoryCardSide,
    sideB: DayStoryCardSide,
    axisScore: number,
  ) => {
    if (sideA !== sideB) {
      candidates.push({ sideA, sideB, axisScore });
    }
  };

  if (eastWestDominant) {
    push(aIsWest ? 'left' : 'right', aIsWest ? 'right' : 'left', 0);
    push(aIsWest ? 'top' : 'bottom', aIsWest ? 'bottom' : 'top', 1);
    push(aIsWest ? 'bottom' : 'top', aIsWest ? 'top' : 'bottom', 1);
    push(aIsWest ? 'right' : 'left', aIsWest ? 'left' : 'right', 2);
  } else {
    push(aIsSouth ? 'bottom' : 'top', aIsSouth ? 'top' : 'bottom', 0);
    push(aIsSouth ? 'left' : 'right', aIsSouth ? 'right' : 'left', 1);
    push(aIsSouth ? 'right' : 'left', aIsSouth ? 'left' : 'right', 1);
    push(aIsSouth ? 'top' : 'bottom', aIsSouth ? 'bottom' : 'top', 2);
  }

  let best = candidates[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const score =
      candidate.axisScore * 10 +
      pathCost(candidate.sideA, blockedA) * 5 +
      pathCost(candidate.sideB, blockedB) * 5;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return { sideA: best.sideA, sideB: best.sideB };
}

export function dayStoryCardOffset(
  side: DayStoryCardSide,
  cardWidth: number,
  cardHeight: number,
  badgeRadius = 16,
  gap = 8,
): { x: number; y: number } {
  const alongY = badgeRadius + gap + cardHeight / 2;
  const alongX = badgeRadius + gap + cardWidth / 2;
  switch (side) {
    case 'top':
      return { x: 0, y: -alongY };
    case 'bottom':
      return { x: 0, y: alongY };
    case 'left':
      return { x: -alongX, y: 0 };
    case 'right':
      return { x: alongX, y: 0 };
  }
}

/** Map marker placement so the card's near edge clears the number badge. */
export function dayStoryCardMarkerPlacement(
  side: DayStoryCardSide,
  badgeRadius = 16,
  gap = 8,
): {
  anchor: { x: number; y: number };
  centerOffset: { x: number; y: number };
} {
  const clear = badgeRadius + gap;
  switch (side) {
    case 'top':
      return {
        anchor: { x: 0.5, y: 1 },
        centerOffset: { x: 0, y: -clear },
      };
    case 'bottom':
      return {
        anchor: { x: 0.5, y: 0 },
        centerOffset: { x: 0, y: clear },
      };
    case 'left':
      return {
        anchor: { x: 1, y: 0.5 },
        centerOffset: { x: -clear, y: 0 },
      };
    case 'right':
      return {
        anchor: { x: 0, y: 0.5 },
        centerOffset: { x: clear, y: 0 },
      };
  }
}

/** @deprecated prefer dayStoryCardMarkerPlacement — center push ignores card width */
export function dayStoryCardCenterOffset(
  side: DayStoryCardSide,
  distance = 72,
): { x: number; y: number } {
  switch (side) {
    case 'top':
      return { x: 0, y: -distance };
    case 'bottom':
      return { x: 0, y: distance };
    case 'left':
      return { x: -distance, y: 0 };
    case 'right':
      return { x: distance, y: 0 };
  }
}

export function sampleApproachPoints(
  points: readonly LocationPointRow[],
): { from: LocationPointRow; to: LocationPointRow } | null {
  if (points.length < 2) {
    return null;
  }
  return {
    from: points[Math.max(0, points.length - 6)]!,
    to: points[points.length - 1]!,
  };
}

export function cardRectForSide(
  pinEast: number,
  pinNorth: number,
  side: DayStoryCardSide,
  widthM = 95,
  heightM = 44,
  gapM = 28,
): {
  minE: number;
  maxE: number;
  minN: number;
  maxN: number;
} {
  const pad = 18;
  let centerE = pinEast;
  let centerN = pinNorth;
  switch (side) {
    case 'top':
      centerN += gapM + heightM / 2;
      break;
    case 'bottom':
      centerN -= gapM + heightM / 2;
      break;
    case 'left':
      centerE -= gapM + widthM / 2;
      break;
    case 'right':
      centerE += gapM + widthM / 2;
      break;
  }
  return {
    minE: centerE - widthM / 2 - pad,
    maxE: centerE + widthM / 2 + pad,
    minN: centerN - heightM / 2 - pad,
    maxN: centerN + heightM / 2 + pad,
  };
}

export function rectsOverlap(
  a: { minE: number; maxE: number; minN: number; maxN: number },
  b: { minE: number; maxE: number; minN: number; maxN: number },
): boolean {
  return !(
    a.maxE < b.minE ||
    a.minE > b.maxE ||
    a.maxN < b.minN ||
    a.minN > b.maxN
  );
}
