import {memo} from 'react';
import {Marker} from 'react-native-maps';
import {format} from 'date-fns';
import {StyleSheet, Text, View} from 'react-native';

import {CheckeredFlagIcon} from '@/components/map/CheckeredFlagIcon';
import type {MapCoordinate} from '@/lib/location-geo';

const MARKER_ANCHOR = {x: 0.5, y: 0.5} as const;
const DOT_SIZE = 16;
const DOT_RING_SIZE = 24;
const FINISH_BADGE_SIZE = 24;
const FLAG_SIZE = 13;
const DRIVE_BLUE = '#007AFF';

type DriveEndpointLabelsProps = {
  startCoordinate: MapCoordinate;
  endCoordinate: MapCoordinate;
  startAt: Date;
  endAt: Date;
};

type StartMarkerProps = {
  coordinate: MapCoordinate;
  time: Date;
};

function StartMarker({coordinate, time}: StartMarkerProps) {
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
        centerOffset={{x: 0, y: -40}}
        zIndex={13}
        tracksViewChanges={false}>
        <View style={styles.chip}>
          <Text style={styles.caption}>Start</Text>
          <Text style={styles.timeText}>{format(time, 'h:mm a')}</Text>
        </View>
      </Marker>
    </>
  );
}

function FinishMarker({
  coordinate,
  time,
}: {
  coordinate: MapCoordinate;
  time: Date;
}) {
  return (
    <>
      <Marker
        coordinate={coordinate}
        anchor={MARKER_ANCHOR}
        zIndex={14}
        tracksViewChanges={false}>
        <View style={styles.finishBadge}>
          <CheckeredFlagIcon size={FLAG_SIZE} />
        </View>
      </Marker>
      <Marker
        coordinate={coordinate}
        anchor={MARKER_ANCHOR}
        centerOffset={{x: 0, y: 44}}
        zIndex={13}
        tracksViewChanges={false}>
        <View style={styles.chip}>
          <Text style={styles.caption}>Finish</Text>
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
      <StartMarker coordinate={startCoordinate} time={startAt} />
      <FinishMarker coordinate={endCoordinate} time={endAt} />
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
    backgroundColor: DRIVE_BLUE,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  finishBadge: {
    width: FINISH_BADGE_SIZE,
    height: FINISH_BADGE_SIZE,
    borderRadius: 7,
    backgroundColor: DRIVE_BLUE,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: DRIVE_BLUE,
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
