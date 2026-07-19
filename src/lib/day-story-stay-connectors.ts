import type { DayTimelineEntry, DetectedTrip } from '@/lib/trip-detection';
import {
  stayMapMarkerCoordinate,
  visitCorePoints,
} from '@/lib/trip-detection';
import { distanceKm, type MapCoordinate } from '@/lib/location-geo';
import { dayStoryColorForVisit } from '@/lib/day-story-colors';
import {
  chronologicalStayVisitNumbers,
  type DayStoryStop,
} from '@/lib/day-story-stops';

const MIN_CONNECTOR_M = 18;

export type DayStoryStayConnector = {
  key: string;
  coordinates: [MapCoordinate, MapCoordinate];
  color: string;
};

function toCoord(lat: number, lng: number): MapCoordinate {
  return { latitude: lat, longitude: lng };
}

function farEnough(a: MapCoordinate, b: MapCoordinate): boolean {
  return (
    distanceKm(
      { lat: a.latitude, lng: a.longitude },
      { lat: b.latitude, lng: b.longitude },
    ) *
      1000 >=
    MIN_CONNECTOR_M
  );
}

/**
 * Dashed pin connectors for day browse.
 * Start/end = History `visitCorePoints` edges; pin = stay marker.
 */
export function buildDayStoryStayConnectors(
  stops: readonly DayStoryStop[],
  historyEntries: readonly DayTimelineEntry[] = [],
): DayStoryStayConnector[] {
  const stays =
    historyEntries.filter((e): e is DetectedTrip => e.kind === 'stay').length >
    0
      ? historyEntries.filter((e): e is DetectedTrip => e.kind === 'stay')
      : stops.flatMap(s => s.stays).sort(
          (a, b) => a.startAt.getTime() - b.startAt.getTime(),
        );

  const visitByStayId = chronologicalStayVisitNumbers(stays);
  const connectors: DayStoryStayConnector[] = [];

  for (let i = 0; i < stays.length; i += 1) {
    const stay = stays[i]!;
    const visitNumber = visitByStayId.get(stay.id) ?? i + 1;
    const core = visitCorePoints(stay);
    if (core.length === 0) {
      continue;
    }
    const marker = stayMapMarkerCoordinate(stay);
    const start = toCoord(core[0]!.lat, core[0]!.lng);
    const end = toCoord(
      core[core.length - 1]!.lat,
      core[core.length - 1]!.lng,
    );
    const prev = i > 0 ? stays[i - 1]! : null;
    const prevVisit = prev != null ? visitByStayId.get(prev.id) : null;

    if (prevVisit != null && farEnough(start, marker)) {
      connectors.push({
        key: `arrival-${stay.id}`,
        coordinates: [start, marker],
        color: dayStoryColorForVisit(prevVisit),
      });
    }
    if (farEnough(marker, end)) {
      connectors.push({
        key: `departure-${stay.id}`,
        coordinates: [marker, end],
        color: dayStoryColorForVisit(visitNumber),
      });
    }
  }

  return connectors;
}
