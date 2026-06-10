import {memo} from 'react';
import {Marker} from 'react-native-maps';
import {StyleSheet, Text, View} from 'react-native';

import {CheckeredFlagIcon} from '@/components/map/CheckeredFlagIcon';
import {DriveEndpointPlaceRow} from '@/components/map/DriveEndpointPlaceRow';
import {SavedPlaceIcon} from '@/components/map/SavedPlaceIcon';
import type {DriveEndpointLabel} from '@/lib/drive-endpoint-label';
import type {MapCoordinate} from '@/lib/location-geo';
import {SAVED_PLACE_MAP_STYLE} from '@/lib/saved-places-map';
import {formatTripClockTime} from '@/lib/trip-format';

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
  startLabel?: DriveEndpointLabel;
  endLabel?: DriveEndpointLabel;
};

type EndpointChipProps = {
  caption: 'Start' | 'Finish';
  time: Date;
  label?: DriveEndpointLabel;
};

function EndpointChip({caption, time, label}: EndpointChipProps) {
  return (
    <View style={styles.chip}>
      <Text style={styles.caption}>{caption}</Text>
      <Text style={styles.timeText}>{formatTripClockTime(time)}</Text>
      {label ? (
        <DriveEndpointPlaceRow
          label={label}
          iconSize={12}
          textStyle={styles.placeName}
          numberOfLines={2}
        />
      ) : null}
    </View>
  );
}

type StartMarkerProps = {
  coordinate: MapCoordinate;
  time: Date;
  label?: DriveEndpointLabel;
};

function StartMarker({coordinate, time, label}: StartMarkerProps) {
  const savedPlace = label?.savedPlace ?? null;
  const placeAccent = savedPlace
    ? SAVED_PLACE_MAP_STYLE[savedPlace.kind]
    : null;

  return (
    <>
      <Marker
        coordinate={coordinate}
        anchor={MARKER_ANCHOR}
        zIndex={14}
        tracksViewChanges={false}>
        {savedPlace && placeAccent ? (
          <View
            style={[
              styles.savedPlaceBadge,
              {
                backgroundColor: placeAccent.badgeBg,
                borderColor: placeAccent.icon,
              },
            ]}>
            <SavedPlaceIcon
              kind={savedPlace.kind}
              size={FLAG_SIZE}
              color={placeAccent.icon}
            />
          </View>
        ) : (
          <View style={styles.dotWrap}>
            <View style={styles.dotRing} />
            <View style={styles.dotCore} />
          </View>
        )}
      </Marker>
      <Marker
        coordinate={coordinate}
        anchor={MARKER_ANCHOR}
        centerOffset={{x: 0, y: -40}}
        zIndex={13}
        tracksViewChanges={false}>
        <EndpointChip caption="Start" time={time} label={label} />
      </Marker>
    </>
  );
}

function FinishMarker({
  coordinate,
  time,
  label,
}: {
  coordinate: MapCoordinate;
  time: Date;
  label?: DriveEndpointLabel;
}) {
  const savedPlace = label?.savedPlace ?? null;
  const placeAccent = savedPlace
    ? SAVED_PLACE_MAP_STYLE[savedPlace.kind]
    : null;

  return (
    <>
      <Marker
        coordinate={coordinate}
        anchor={MARKER_ANCHOR}
        zIndex={14}
        tracksViewChanges={false}>
        {savedPlace && placeAccent ? (
          <View
            style={[
              styles.savedPlaceBadge,
              {
                backgroundColor: placeAccent.badgeBg,
                borderColor: placeAccent.icon,
              },
            ]}>
            <SavedPlaceIcon
              kind={savedPlace.kind}
              size={FLAG_SIZE}
              color={placeAccent.icon}
            />
          </View>
        ) : (
          <View style={styles.finishBadge}>
            <CheckeredFlagIcon size={FLAG_SIZE} />
          </View>
        )}
      </Marker>
      <Marker
        coordinate={coordinate}
        anchor={MARKER_ANCHOR}
        centerOffset={{x: 0, y: 44}}
        zIndex={13}
        tracksViewChanges={false}>
        <EndpointChip caption="Finish" time={time} label={label} />
      </Marker>
    </>
  );
}

export const DriveEndpointLabels = memo(function DriveEndpointLabels({
  startCoordinate,
  endCoordinate,
  startAt,
  endAt,
  startLabel,
  endLabel,
}: DriveEndpointLabelsProps) {
  return (
    <>
      <StartMarker
        coordinate={startCoordinate}
        time={startAt}
        label={startLabel}
      />
      <FinishMarker
        coordinate={endCoordinate}
        time={endAt}
        label={endLabel}
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
  savedPlaceBadge: {
    width: FINISH_BADGE_SIZE,
    height: FINISH_BADGE_SIZE,
    borderRadius: FINISH_BADGE_SIZE / 2,
    borderWidth: 2.5,
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
    maxWidth: 200,
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
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    maxWidth: '100%',
  },
  placeName: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 2,
  },
});
