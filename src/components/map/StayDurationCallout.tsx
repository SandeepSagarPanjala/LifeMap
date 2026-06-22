import { useEffect, useState } from 'react';
import { Marker } from 'react-native-maps';
import { Armchair, MapPin } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { SavedPlaceIcon } from '@/components/map/SavedPlaceIcon';
import { MomentCountsRow } from '@/components/moments/MomentCountsRow';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import type { MomentCountType, MomentCounts } from '@/lib/moments/moment-counts';
import { hasMomentCounts } from '@/lib/moments/moment-counts';
import {
  formatStayVisitLabel,
  formatVisitDateLine,
  isVisitOngoing,
} from '@/lib/trip-format';
import type { DetectedTrip } from '@/lib/trip-detection';
import { stayMapMarkerCoordinate } from '@/lib/trip-detection';
import { savedPlaceDisplayLabel } from '@/lib/saved-places';
import { HISTORY_COLORS } from '@/lib/history-timeline';

const DOT_SIZE = 18;
const DOT_RING_SIZE = 28;
const MARKER_ANCHOR = { x: 0.5, y: 0.5 } as const;
const LIVE_PUCK_ANCHOR = { x: 0.5, y: 1 } as const;
/** Lift label above the system user-location puck (bottom-anchored). */
const LIVE_PUCK_CENTER_OFFSET = { x: 0, y: -100 } as const;
const BUBBLE_OFFSET_Y = -(DOT_RING_SIZE / 2 + 60);

type StayDurationCalloutProps = {
  trip: DetectedTrip;
  savedPlace?: SavedPlaceRow | null;
  nearbyPlaceLabel?: string | null;
  nearbyPlacePinned?: boolean;
  momentCounts?: MomentCounts;
  /** History scrub — orange visit pin. Live map keeps the system blue user puck. */
  showVisitPin?: boolean;
  /** Anchor the label (e.g. live GPS while the blue puck is shown). */
  anchorCoordinate?: { latitude: number; longitude: number } | null;
  onPressMomentType?: (type: MomentCountType) => void;
};

export function StayDurationCallout({
  trip,
  savedPlace = null,
  nearbyPlaceLabel = null,
  nearbyPlacePinned = false,
  momentCounts,
  showVisitPin = true,
  anchorCoordinate = null,
  onPressMomentType,
}: StayDurationCalloutProps) {
  const [now, setNow] = useState(() => new Date());
  const ongoing = isVisitOngoing(trip.endAt, now, {
    openThroughNow: trip.openThroughNow,
  });
  const visitCoordinate = stayMapMarkerCoordinate(trip, { ongoing });
  const coordinate = anchorCoordinate ?? visitCoordinate;
  const counts = momentCounts;
  const showMomentCounts = counts != null && hasMomentCounts(counts);
  const livePuckLabel = !showVisitPin;
  const bubbleAnchor = livePuckLabel ? LIVE_PUCK_ANCHOR : MARKER_ANCHOR;
  const bubbleCenterOffset = livePuckLabel
    ? LIVE_PUCK_CENTER_OFFSET
    : { x: 0, y: BUBBLE_OFFSET_Y };

  useEffect(() => {
    if (!ongoing) {
      return;
    }
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [ongoing]);

  const durationMs = trip.durationMs;
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
          tracksViewChanges={false}
        >
          <View style={styles.dotWrap}>
            <View style={styles.dotRing} />
            <View style={styles.dotCore} />
          </View>
        </Marker>
      ) : null}

      <Marker
        coordinate={coordinate}
        anchor={bubbleAnchor}
        centerOffset={bubbleCenterOffset}
        zIndex={12}
        tracksViewChanges={false}>
        <View style={styles.bubble} collapsable={false}>
          {showMomentCounts ? (
            <>
              <MomentCountsRow
                counts={counts!}
                onPressType={onPressMomentType}
                layout="stacked"
              />
              <View style={styles.divider} />
            </>
          ) : null}

          <View style={styles.body}>
            {savedPlace ? (
              <View style={styles.placeRow}>
                <SavedPlaceIcon kind={savedPlace.kind} size={16} />
                <Text style={styles.placeLabel} numberOfLines={1}>
                  {savedPlaceDisplayLabel(savedPlace)}
                </Text>
              </View>
            ) : nearbyPlaceLabel ? (
              <View style={styles.placeRow}>
                {nearbyPlacePinned ? (
                  <MapPin
                    size={12}
                    color="#8E8E93"
                    fill="#C7C7CC"
                    strokeWidth={2}
                  />
                ) : (
                  <Armchair
                    size={14}
                    color={HISTORY_COLORS.stay}
                    strokeWidth={2.25}
                  />
                )}
                <Text style={styles.placeLabel} numberOfLines={1}>
                  {nearbyPlaceLabel}
                </Text>
              </View>
            ) : null}

            <Text style={styles.dateLine}>
              {formatVisitDateLine(trip.startAt, now)}
            </Text>
            <Text style={styles.timeLine} numberOfLines={2}>
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
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
    gap: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
  },
  body: {
    gap: 2,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  placeLabel: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  dateLine: {
    fontSize: 13,
    fontWeight: '600',
    color: '#636366',
  },
  timeLine: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  durationLine: {
    fontSize: 12,
    fontWeight: '500',
    color: '#636366',
  },
  statusLine: {
    fontSize: 11,
    fontWeight: '600',
    color: HISTORY_COLORS.stay,
    marginTop: 2,
  },
});
