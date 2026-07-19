import { memo, useMemo } from 'react';

import { DriveEndpointLabels } from '@/components/map/DriveEndpointLabels';
import { TravelModePolylines } from '@/components/map/TravelModePolylines';
import { TripPlaybackHead } from '@/components/map/TripPlaybackHead';
import type { LocationPointRow } from '@/db/repositories/location-days';
import type { DriveEndpointLabel } from '@/lib/drive-endpoint-label';
import {
  MAX_EMPHASIZED_TRIP_POLYLINE_POINTS,
  MAX_MAP_POLYLINE_POINTS,
  ROUTE_PATH_BORDER,
  ROUTE_PATH_BORDER_WIDTH,
  ROUTE_PATH_FILL,
  ROUTE_PATH_FILL_WIDTH,
  ROUTE_PATH_STORY_BORDER,
  ROUTE_PATH_STORY_FILL,
} from '@/lib/app-constants';
import {
  distanceKm,
  type MapCoordinate,
  toDisplayMapCoordinates,
} from '@/lib/location-geo';
import type { DetectedTrip } from '@/lib/trip-detection';
import {
  isSparseTravelRoute,
  stayMapMarkerCoordinate,
} from '@/lib/trip-detection';
import {
  buildDensePlaybackSamples,
  getTripPlaybackFrame,
} from '@/lib/trip-playback';
import { buildTravelModeLegs } from '@/lib/travel-mode-legs';

type TripRouteOverlayProps = {
  points: LocationPointRow[];
  playbackProgress?: number | null;
  /** History scrub — selected drive uses the same soft path as day browse. */
  emphasized?: boolean;
  /** Drive start/end times for history endpoint labels. */
  startAt?: Date;
  endAt?: Date;
  startLabel?: DriveEndpointLabel;
  endLabel?: DriveEndpointLabel;
  anchorStartStay?: DetectedTrip | null;
  anchorEndStay?: DetectedTrip | null;
  /** Zoom-gated direction chevrons along the emphasized trip path. */
  showDirectionArrows?: boolean;
  mapLatitudeDelta?: number;
};

export const TripRouteOverlay = memo(function TripRouteOverlay({
  points,
  playbackProgress = null,
  emphasized = false,
  startAt,
  endAt,
  startLabel,
  endLabel,
  anchorStartStay = null,
  anchorEndStay = null,
  showDirectionArrows = false,
  mapLatitudeDelta,
}: TripRouteOverlayProps) {
  const polylineCap = emphasized
    ? MAX_EMPHASIZED_TRIP_POLYLINE_POINTS
    : MAX_MAP_POLYLINE_POINTS;
  const coordinates = useMemo(
    () => toDisplayMapCoordinates(points, polylineCap),
    [points, polylineCap],
  );
  const sparseRoute = useMemo(() => isSparseTravelRoute(points), [points]);
  const denseSamples = useMemo(() => {
    if (playbackProgress == null) {
      return null;
    }
    return buildDensePlaybackSamples(points);
  }, [playbackProgress, points]);

  const frame = useMemo(() => {
    if (playbackProgress == null || denseSamples == null) {
      return null;
    }
    return getTripPlaybackFrame(points, playbackProgress, denseSamples);
  }, [denseSamples, playbackProgress, points]);

  const routeStart = useMemo((): MapCoordinate => {
    if (startLabel?.savedPlace) {
      return {
        latitude: startLabel.savedPlace.lat,
        longitude: startLabel.savedPlace.lng,
      };
    }
    if (anchorStartStay) {
      return stayMapMarkerCoordinate(anchorStartStay);
    }
    return coordinates[0] ?? { latitude: 0, longitude: 0 };
  }, [anchorStartStay, coordinates, startLabel]);

  const routeEnd = useMemo((): MapCoordinate => {
    if (endLabel?.savedPlace) {
      return {
        latitude: endLabel.savedPlace.lat,
        longitude: endLabel.savedPlace.lng,
      };
    }
    if (anchorEndStay) {
      return stayMapMarkerCoordinate(anchorEndStay);
    }
    return coordinates[coordinates.length - 1] ?? { latitude: 0, longitude: 0 };
  }, [anchorEndStay, coordinates, endLabel]);

  const modeLegs = useMemo(() => {
    const legs = buildTravelModeLegs(points).map(leg => ({
      style: leg.style,
      coordinates: [...leg.coordinates],
    }));
    if (legs.length === 0) {
      return legs;
    }
    const first = legs[0]!;
    const last = legs[legs.length - 1]!;
    const firstCoord = first.coordinates[0]!;
    const lastCoord = last.coordinates[last.coordinates.length - 1]!;
    if (
      distanceKm(
        { lat: firstCoord.latitude, lng: firstCoord.longitude },
        { lat: routeStart.latitude, lng: routeStart.longitude },
      ) *
        1000 >
      8
    ) {
      first.coordinates = [routeStart, ...first.coordinates];
    }
    if (
      distanceKm(
        { lat: lastCoord.latitude, lng: lastCoord.longitude },
        { lat: routeEnd.latitude, lng: routeEnd.longitude },
      ) *
        1000 >
      8
    ) {
      last.coordinates = [...last.coordinates, routeEnd];
    }
    return legs;
  }, [points, routeEnd, routeStart]);

  if (coordinates.length < 1) {
    return null;
  }

  const isPlaying = playbackProgress != null;
  // Match day-browse soft path so direction chevrons stay crisp (solid blue
  // washes out the thin black arrows).
  const routeBorder = emphasized ? ROUTE_PATH_STORY_BORDER : ROUTE_PATH_BORDER;
  const routeFill = emphasized ? ROUTE_PATH_STORY_FILL : ROUTE_PATH_FILL;
  const showEndpointLabels =
    emphasized &&
    !isPlaying &&
    startAt != null &&
    endAt != null &&
    coordinates.length >= 1;
  const drawRouteLine = coordinates.length > 1 && !sparseRoute;

  return (
    <>
      {drawRouteLine ? (
        <TravelModePolylines
          legs={modeLegs}
          fill={routeFill}
          border={routeBorder}
          fillWidth={ROUTE_PATH_FILL_WIDTH}
          borderWidth={ROUTE_PATH_BORDER_WIDTH}
          zBase={emphasized ? 3 : 1}
          maxPoints={polylineCap}
          showDirectionArrows={showDirectionArrows && emphasized && !isPlaying}
          mapLatitudeDelta={mapLatitudeDelta}
        />
      ) : null}

      {/* Full route stays stable; a growing solid overlay over dashes strobes on MapKit. */}

      {isPlaying && frame ? (
        <TripPlaybackHead
          coordinate={frame.coordinate}
          timestamp={frame.interpolatedAt}
          labelPlacement={frame.labelPlacement}
        />
      ) : null}

      {showEndpointLabels ? (
        <DriveEndpointLabels
          startCoordinate={routeStart}
          endCoordinate={routeEnd}
          startAt={startAt}
          endAt={endAt}
          startLabel={startLabel}
          endLabel={endLabel}
        />
      ) : null}
    </>
  );
});
