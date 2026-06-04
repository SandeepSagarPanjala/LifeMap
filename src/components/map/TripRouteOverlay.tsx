import {useMemo} from 'react';
import {Marker, Polyline} from 'react-native-maps';
import {StyleSheet, Text, View} from 'react-native';
import {format} from 'date-fns';

import {TripPlaybackMarker} from '@/components/map/TripPlaybackMarker';
import type {LocationPointRow} from '@/db/repositories/location-days';
import {bearingDegrees, toMapCoordinates} from '@/lib/location-geo';
import {
  getPlaybackCoordinates,
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
};

export function TripRouteOverlay({points, playbackProgress = null}: TripRouteOverlayProps) {
  const coordinates = useMemo(() => toMapCoordinates(points), [points]);

  const frame = useMemo(() => {
    if (playbackProgress == null) {
      return null;
    }
    return getTripPlaybackFrame(points, playbackProgress);
  }, [points, playbackProgress]);

  const playedCoordinates = useMemo(() => {
    if (playbackProgress == null) {
      return [];
    }
    return getPlaybackCoordinates(points, playbackProgress);
  }, [points, playbackProgress]);

  const heading = useMemo(() => {
    if (!frame || frame.pointIndex >= points.length - 1) {
      return 0;
    }
    const a = points[frame.pointIndex]!;
    const b = points[frame.pointIndex + 1] ?? a;
    return bearingDegrees(a, b);
  }, [frame, points]);

  if (coordinates.length < 1) {
    return null;
  }

  const isPlaying = playbackProgress != null;

  return (
    <>
      {coordinates.length > 1 ? (
        <>
          <Polyline
            coordinates={coordinates}
            strokeColor={ROUTE_PATH_BORDER}
            strokeWidth={ROUTE_PATH_BORDER_WIDTH}
            lineCap="round"
            lineJoin="round"
            zIndex={1}
          />
          <Polyline
            coordinates={coordinates}
            strokeColor={ROUTE_PATH_FILL}
            strokeWidth={ROUTE_PATH_FILL_WIDTH}
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
        </>
      ) : null}

      {isPlaying && playedCoordinates.length > 1 ? (
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
        <>
          <TripPlaybackMarker coordinate={frame.coordinate} heading={heading} />
          <Marker coordinate={frame.coordinate} anchor={{x: 0.5, y: 1.35}} tracksViewChanges={false}>
            <View style={styles.timeChip}>
              <Text style={styles.timeText}>{format(frame.point.timestamp, 'h:mm a')}</Text>
            </View>
          </Marker>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  timeChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
  },
});
