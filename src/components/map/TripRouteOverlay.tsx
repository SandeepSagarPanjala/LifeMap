import {memo, useMemo} from 'react';
import {Polyline} from 'react-native-maps';

import {DriveEndpointLabels} from '@/components/map/DriveEndpointLabels';
import {TripPlaybackHead} from '@/components/map/TripPlaybackHead';
import type {LocationPointRow} from '@/db/repositories/location-days';
import type {DriveEndpointLabel} from '@/lib/drive-endpoint-label';
import {distanceKm, type MapCoordinate, toMapCoordinates} from '@/lib/location-geo';
import type {DetectedTrip} from '@/lib/trip-detection';
import {isSparseTravelRoute, stayMapMarkerCoordinate} from '@/lib/trip-detection';
import {
  buildDensePlaybackSamples,
  getTripPlaybackFrame,
} from '@/lib/trip-playback';
import {
  ROUTE_PATH_BORDER,
  ROUTE_PATH_BORDER_SOLID,
  ROUTE_PATH_BORDER_WIDTH,
  ROUTE_PATH_FILL,
  ROUTE_PATH_FILL_SOLID,
  ROUTE_PATH_FILL_WIDTH,
} from '@/lib/route-map-style';

type TripRouteOverlayProps = {
  points: LocationPointRow[];
  playbackProgress?: number | null;
  /** History scrub — solid route for the selected drive only. */
  emphasized?: boolean;
  /** Drive start/end times for history endpoint labels. */
  startAt?: Date;
  endAt?: Date;
  startLabel?: DriveEndpointLabel;
  endLabel?: DriveEndpointLabel;
  anchorStartStay?: DetectedTrip | null;
  anchorEndStay?: DetectedTrip | null;
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
}: TripRouteOverlayProps) {
  const coordinates = useMemo(() => toMapCoordinates(points), [points]);
  const sparseRoute = useMemo(() => isSparseTravelRoute(points), [points]);
  const denseSamples = useMemo(() => buildDensePlaybackSamples(points), [points]);

  const frame = useMemo(() => {
    if (playbackProgress == null) {
      return null;
    }
    return getTripPlaybackFrame(points, playbackProgress, denseSamples);
  }, [denseSamples, playbackProgress, points]);

  if (coordinates.length < 1) {
    return null;
  }

  const isPlaying = playbackProgress != null;
  const playedCoordinates = frame?.pathCoordinates ?? [];
  const routeBorder = emphasized ? ROUTE_PATH_BORDER_SOLID : ROUTE_PATH_BORDER;
  const routeFill = emphasized ? ROUTE_PATH_FILL_SOLID : ROUTE_PATH_FILL;
  const showEndpointLabels =
    emphasized &&
    !isPlaying &&
    startAt != null &&
    endAt != null &&
    coordinates.length >= 1;
  const drawRouteLine = coordinates.length > 1 && !sparseRoute;

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
    return coordinates[0] ?? {latitude: 0, longitude: 0};
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
    return coordinates[coordinates.length - 1] ?? {latitude: 0, longitude: 0};
  }, [anchorEndStay, coordinates, endLabel]);

  const routeLineCoordinates = useMemo(() => {
    if (coordinates.length === 0) {
      return [routeStart, routeEnd];
    }
    const line = [...coordinates];
    const first = line[0]!;
    const last = line[line.length - 1]!;
    if (distanceKm(first, routeStart) * 1000 > 8) {
      line.unshift(routeStart);
    }
    if (distanceKm(last, routeEnd) * 1000 > 8) {
      line.push(routeEnd);
    }
    return line;
  }, [coordinates, routeEnd, routeStart]);

  return (
    <>
      {drawRouteLine ? (
        <>
          <Polyline
            coordinates={routeLineCoordinates}
            strokeColor={routeBorder}
            strokeWidth={ROUTE_PATH_BORDER_WIDTH}
            lineCap="round"
            lineJoin="round"
            zIndex={emphasized ? 3 : 1}
          />
          <Polyline
            coordinates={routeLineCoordinates}
            strokeColor={routeFill}
            strokeWidth={ROUTE_PATH_FILL_WIDTH}
            lineCap="round"
            lineJoin="round"
            zIndex={emphasized ? 4 : 2}
          />
        </>
      ) : null}

      {isPlaying && playedCoordinates.length > 0 ? (
        <>
          <Polyline
            coordinates={playedCoordinates}
            strokeColor={ROUTE_PATH_BORDER_SOLID}
            strokeWidth={ROUTE_PATH_BORDER_WIDTH}
            lineCap="round"
            lineJoin="round"
            zIndex={3}
          />
          <Polyline
            coordinates={playedCoordinates}
            strokeColor={ROUTE_PATH_FILL_SOLID}
            strokeWidth={ROUTE_PATH_FILL_WIDTH}
            lineCap="round"
            lineJoin="round"
            zIndex={4}
          />
        </>
      ) : null}

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
