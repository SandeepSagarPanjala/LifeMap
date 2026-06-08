import {memo, useMemo} from 'react';
import {Polyline} from 'react-native-maps';

import {DriveEndpointLabels} from '@/components/map/DriveEndpointLabels';
import {TripPlaybackHead} from '@/components/map/TripPlaybackHead';
import type {LocationPointRow} from '@/db/repositories/location-days';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {toMapCoordinates} from '@/lib/location-geo';
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
  startSavedPlace?: SavedPlaceRow | null;
  endSavedPlace?: SavedPlaceRow | null;
};

export const TripRouteOverlay = memo(function TripRouteOverlay({
  points,
  playbackProgress = null,
  emphasized = false,
  startAt,
  endAt,
  startSavedPlace = null,
  endSavedPlace = null,
}: TripRouteOverlayProps) {
  const coordinates = useMemo(() => toMapCoordinates(points), [points]);
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
    coordinates.length >= 2;
  const routeStart = startSavedPlace
    ? {latitude: startSavedPlace.lat, longitude: startSavedPlace.lng}
    : coordinates[0]!;
  const routeEnd = endSavedPlace
    ? {latitude: endSavedPlace.lat, longitude: endSavedPlace.lng}
    : coordinates[coordinates.length - 1]!;

  return (
    <>
      {coordinates.length > 1 ? (
        <>
          <Polyline
            coordinates={coordinates}
            strokeColor={routeBorder}
            strokeWidth={ROUTE_PATH_BORDER_WIDTH}
            lineCap="round"
            lineJoin="round"
            zIndex={emphasized ? 3 : 1}
          />
          <Polyline
            coordinates={coordinates}
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
          startSavedPlace={startSavedPlace}
          endSavedPlace={endSavedPlace}
        />
      ) : null}
    </>
  );
});
