import {useMemo} from 'react';
import {Polyline} from 'react-native-maps';

import {TripPlaybackHead} from '@/components/map/TripPlaybackHead';
import type {LocationPointRow} from '@/db/repositories/location-days';
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
};

export function TripRouteOverlay({
  points,
  playbackProgress = null,
  emphasized = false,
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
    </>
  );
}
