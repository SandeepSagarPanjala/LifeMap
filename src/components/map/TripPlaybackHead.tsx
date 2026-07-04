import {useEffect, useRef} from 'react';
import {Marker} from 'react-native-maps';
import type {MapMarker} from 'react-native-maps';
import {StyleSheet, Text, View} from 'react-native';
import {format} from 'date-fns';

import type {MapCoordinate} from '@/lib/location-geo';
import {PLAYBACK_MARKER_FRAME_MS} from '@/lib/app-constants';
import {
  getPlaybackLabelCenterOffset,
  type PlaybackLabelPlacement,
} from '@/lib/trip-playback';

type TripPlaybackHeadProps = {
  coordinate: MapCoordinate;
  timestamp: Date;
  labelPlacement: PlaybackLabelPlacement;
};

const MARKER_ANCHOR = {x: 0.5, y: 0.5} as const;

export function TripPlaybackHead({
  coordinate,
  timestamp,
  labelPlacement,
}: TripPlaybackHeadProps) {
  const labelOffset = getPlaybackLabelCenterOffset(labelPlacement);
  const dotMarkerRef = useRef<MapMarker>(null);
  const labelMarkerRef = useRef<MapMarker>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    dotMarkerRef.current?.animateMarkerToCoordinate(
      coordinate,
      PLAYBACK_MARKER_FRAME_MS,
    );
    labelMarkerRef.current?.animateMarkerToCoordinate(
      coordinate,
      PLAYBACK_MARKER_FRAME_MS,
    );
  }, [coordinate]);

  return (
    <>
      <Marker
        ref={dotMarkerRef}
        coordinate={coordinate}
        anchor={MARKER_ANCHOR}
        zIndex={11}
        tracksViewChanges={false}>
        <View style={styles.dot}>
          <View style={styles.ring} />
          <View style={styles.core} />
        </View>
      </Marker>

      <Marker
        ref={labelMarkerRef}
        coordinate={coordinate}
        anchor={MARKER_ANCHOR}
        centerOffset={labelOffset}
        zIndex={10}
        tracksViewChanges={false}>
        <View style={styles.timeChip}>
          <Text style={styles.timeText}>{format(timestamp, 'h:mm:ss a')}</Text>
        </View>
      </Marker>
    </>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.25)',
  },
  core: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#007AFF',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
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
