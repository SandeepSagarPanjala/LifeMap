import {useEffect, useState} from 'react';
import {Marker} from 'react-native-maps';
import {Armchair} from 'lucide-react-native';
import {StyleSheet, Text, View} from 'react-native';

import {SavedPlaceIcon} from '@/components/map/SavedPlaceIcon';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {formatStayVisitLabel, isVisitOngoing} from '@/lib/trip-format';
import type {DetectedTrip} from '@/lib/trip-detection';
import {stayTripMarkerCoordinate} from '@/lib/trip-detection';
import {savedPlaceDisplayLabel} from '@/lib/saved-places';
import {HISTORY_COLORS} from '@/lib/history-timeline';
const DOT_SIZE = 18;
const DOT_RING_SIZE = 28;
const MARKER_ANCHOR = {x: 0.5, y: 0.5} as const;
const BUBBLE_OFFSET_Y = -(DOT_RING_SIZE / 2 + 44);

type StayDurationCalloutProps = {
  trip: DetectedTrip;
  savedPlace?: SavedPlaceRow | null;
  /** History scrub — orange visit pin. Live map keeps the system blue user puck. */
  showVisitPin?: boolean;
  /** Anchor the label (e.g. live GPS while the blue puck is shown). */
  anchorCoordinate?: {latitude: number; longitude: number} | null;
};

const LIVE_PUCK_BUBBLE_OFFSET_Y = -58;

export function StayDurationCallout({
  trip,
  savedPlace = null,
  showVisitPin = true,
  anchorCoordinate = null,
}: StayDurationCalloutProps) {
  const [now, setNow] = useState(() => new Date());
  const ongoing = isVisitOngoing(trip.endAt, now, {
    openThroughNow: trip.openThroughNow,
  });
  const visitCoordinate = stayTripMarkerCoordinate(trip, {ongoing});
  const coordinate = anchorCoordinate ?? visitCoordinate;
  const bubbleOffsetY = showVisitPin
    ? BUBBLE_OFFSET_Y
    : LIVE_PUCK_BUBBLE_OFFSET_Y;

  useEffect(() => {
    if (!ongoing) {
      return;
    }
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [ongoing]);

  const durationMs = ongoing
    ? now.getTime() - trip.startAt.getTime()
    : trip.durationMs;
  const visit = formatStayVisitLabel(trip.startAt, trip.endAt, durationMs, {
    openThroughNow: trip.openThroughNow,
    now,
  });

  return (
    <>
      {showVisitPin ? (
        <Marker
          coordinate={visitCoordinate}
          anchor={MARKER_ANCHOR}
          zIndex={13}
          tracksViewChanges={false}>
          <View style={styles.dotWrap}>
            <View style={styles.dotRing} />
            <View style={styles.dotCore} />
          </View>
        </Marker>
      ) : null}

      <Marker
        coordinate={coordinate}
        anchor={MARKER_ANCHOR}
        centerOffset={{x: 0, y: bubbleOffsetY}}
        zIndex={12}
        tracksViewChanges={false}>
        <View style={styles.bubble}>
          {savedPlace ? (
            <SavedPlaceIcon kind={savedPlace.kind} size={16} />
          ) : (
            <Armchair size={14} color={HISTORY_COLORS.stay} strokeWidth={2.25} />
          )}
          <View style={styles.bubbleText}>
            {savedPlace ? (
              <Text style={styles.placeLabel} numberOfLines={1}>
                {savedPlaceDisplayLabel(savedPlace)}
              </Text>
            ) : null}
            <Text style={styles.mapLabel} numberOfLines={2}>
              {visit.title}
            </Text>
            <Text style={styles.durationLine}>{visit.subtitle}</Text>
            {visit.statusLine ? (
              <Text style={styles.statusLine}>{visit.statusLine}</Text>
            ) : null}
          </View>
        </View>
      </Marker>
    </>
  );
}

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
    backgroundColor: `${HISTORY_COLORS.stay}40`,
  },
  dotCore: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: HISTORY_COLORS.stay,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  bubbleText: {
    flexShrink: 1,
  },
  placeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  mapLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  durationLine: {
    fontSize: 12,
    fontWeight: '500',
    color: '#636366',
    marginTop: 2,
  },
  statusLine: {
    fontSize: 11,
    fontWeight: '600',
    color: HISTORY_COLORS.stay,
    marginTop: 2,
  },
});
