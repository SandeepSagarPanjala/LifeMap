import {useEffect, useState} from 'react';
import {Marker} from 'react-native-maps';
import {StyleSheet, Text, View} from 'react-native';

import {DriveEndpointPlaceRow} from '@/components/map/DriveEndpointPlaceRow';
import type {DriveEndpointLabel} from '@/lib/drive-endpoint-label';
import {hasDriveEndpointLabel} from '@/lib/drive-endpoint-label';
import {
  formatDriveVisitLabel,
  isVisitOngoing,
} from '@/lib/trip-format';
import type {DetectedTrip} from '@/lib/trip-detection';
import {HISTORY_COLORS} from '@/lib/history-timeline';

const LIVE_PUCK_ANCHOR = {x: 0.5, y: 1} as const;
const LIVE_PUCK_CENTER_OFFSET = {x: 0, y: -100} as const;
const BUBBLE_DOT_GAP = 4;

type DriveActivityCalloutProps = {
  trip: DetectedTrip;
  startLabel: DriveEndpointLabel;
  endLabel?: DriveEndpointLabel;
  anchorCoordinate?: {latitude: number; longitude: number} | null;
};

export function DriveActivityCallout({
  trip,
  startLabel,
  endLabel,
  anchorCoordinate = null,
}: DriveActivityCalloutProps) {
  const [now, setNow] = useState(() => new Date());
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const ongoing = isVisitOngoing(trip.endAt, now, {
    openThroughNow: trip.openThroughNow,
  });
  const coordinate = anchorCoordinate;
  const drive = formatDriveVisitLabel(
    trip.startAt,
    trip.endAt,
    trip.durationMs,
    {openThroughNow: trip.openThroughNow, now},
  );
  const bubbleCenterOffset =
    bubbleHeight > 0
      ? {
          x: 0,
          y: -(BUBBLE_DOT_GAP + bubbleHeight / 2),
        }
      : LIVE_PUCK_CENTER_OFFSET;

  useEffect(() => {
    if (!ongoing) {
      return;
    }
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [ongoing]);

  if (coordinate == null) {
    return null;
  }

  const showStart = hasDriveEndpointLabel(startLabel);
  const showEnd = endLabel != null && hasDriveEndpointLabel(endLabel);
  const showOpenEndPlaceholder =
    trip.openThroughNow === true && showStart && !showEnd;

  return (
    <Marker
      coordinate={coordinate}
      anchor={LIVE_PUCK_ANCHOR}
      centerOffset={bubbleCenterOffset}
      zIndex={12}
      tracksViewChanges={bubbleHeight === 0}>
      <View
        style={styles.bubble}
        collapsable={false}
        onLayout={event => {
          const nextHeight = event.nativeEvent.layout.height;
          if (nextHeight > 0 && nextHeight !== bubbleHeight) {
            setBubbleHeight(nextHeight);
          }
        }}>
        <View style={styles.body}>
          {showStart ? (
            <DriveEndpointPlaceRow
              label={startLabel}
              iconSize={14}
              textStyle={styles.routeText}
              numberOfLines={1}
            />
          ) : null}
          {showEnd ? (
            <>
              <Text style={styles.routeArrow}>→</Text>
              <DriveEndpointPlaceRow
                label={endLabel!}
                iconSize={14}
                textStyle={styles.routeText}
                numberOfLines={1}
              />
            </>
          ) : showOpenEndPlaceholder ? (
            <>
              <Text style={styles.routeArrow}>→</Text>
              <Text style={styles.routePlaceholder}>---</Text>
            </>
          ) : null}
          <Text style={styles.timeLine} numberOfLines={2}>
            {drive.title}
          </Text>
          <Text style={styles.durationLine}>{drive.subtitle}</Text>
          {drive.statusLine ? (
            <Text style={styles.statusLine}>{drive.statusLine}</Text>
          ) : null}
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: 260,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  body: {
    gap: 2,
  },
  routeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  routePlaceholder: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8E8E93',
  },
  routeArrow: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
    marginVertical: 1,
  },
  timeLine: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 4,
  },
  durationLine: {
    fontSize: 12,
    fontWeight: '500',
    color: '#636366',
  },
  statusLine: {
    fontSize: 11,
    fontWeight: '600',
    color: HISTORY_COLORS.travel,
    marginTop: 2,
  },
});
