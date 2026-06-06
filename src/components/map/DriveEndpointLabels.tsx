import {memo} from 'react';
import {Marker} from 'react-native-maps';
import {format} from 'date-fns';
import {StyleSheet, Text, View} from 'react-native';

import type {MapCoordinate} from '@/lib/location-geo';

const MARKER_ANCHOR = {x: 0.5, y: 0.5} as const;
const DOT_SIZE = 16;
const DOT_RING_SIZE = 24;

type DriveEndpointLabelsProps = {
  startCoordinate: MapCoordinate;
  endCoordinate: MapCoordinate;
  startAt: Date;
  endAt: Date;
};

type EndpointMarkerProps = {
  coordinate: MapCoordinate;
  time: Date;
  centerOffset: {x: number; y: number};
  caption: string;
};

function EndpointMarker({
  coordinate,
  time,
  centerOffset,
  caption,
}: EndpointMarkerProps) {
  return (
    <>
      <Marker
        coordinate={coordinate}
        anchor={MARKER_ANCHOR}
        zIndex={14}
        tracksViewChanges={false}>
        <View style={styles.dotWrap}>
          <View style={styles.dotRing} />
          <View style={styles.dotCore} />
        </View>
      </Marker>
      <Marker
        coordinate={coordinate}
        anchor={MARKER_ANCHOR}
        centerOffset={centerOffset}
        zIndex={13}
        tracksViewChanges={false}>
        <View style={styles.chip}>
          <Text style={styles.caption}>{caption}</Text>
          <Text style={styles.timeText}>{format(time, 'h:mm a')}</Text>
        </View>
      </Marker>
    </>
  );
}

export const DriveEndpointLabels = memo(function DriveEndpointLabels({
  startCoordinate,
  endCoordinate,
  startAt,
  endAt,
}: DriveEndpointLabelsProps) {
  return (
    <>
      <EndpointMarker
        coordinate={startCoordinate}
        time={startAt}
        caption="Start"
        centerOffset={{x: 0, y: -40}}
      />
      <EndpointMarker
        coordinate={endCoordinate}
        time={endAt}
        caption="End"
        centerOffset={{x: 0, y: 40}}
      />
    </>
  );
});

const styles = StyleSheet.create({
  dotWrap: {
    width: DOT_RING_SIZE,
    height: DOT_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRing: {
    position: 'absolute',
    width: DOT_RING_SIZE,
    height: DOT_RING_SIZE,
    borderRadius: DOT_RING_SIZE / 2,
    backgroundColor: 'rgba(0, 122, 255, 0.25)',
  },
  dotCore: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: '#007AFF',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 4,
  },
  caption: {
    fontSize: 10,
    fontWeight: '700',
    color: '#007AFF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 1,
  },
});
