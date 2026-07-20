import type { LocationPointRow } from '@/db/repositories/location-days';
import type { MomentRow } from '@/db/repositories/moments';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import { HISTORY_COLORS } from '@/lib/app-constants';
import {
  dayStoryCardFill,
  dayStoryColorForVisit,
} from '@/lib/day-story-colors';
import {
  assignDayStoryCardSides,
  dayStoryCardOffset,
  type DayStoryCardSide,
} from '@/lib/day-story-placement';
import type { DayStoryStop } from '@/lib/day-story-stops';
import { momentCountsForDayStoryStop } from '@/lib/day-story-moments';
import {
  emptyMomentCounts,
  hasMomentCounts,
  type MomentCountType,
  type MomentCounts,
} from '@/lib/moments/moment-counts';
import type { DayTimelineEntry, DetectedTrip } from '@/lib/trip-detection';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Marker } from 'react-native-maps';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SavedPlaceIcon } from '@/components/map/SavedPlaceIcon';
import { VisitPlaceKindIcon } from '@/components/map/VisitPlaceKindIcon';
import { MomentCountsRow } from '@/components/moments/MomentCountsRow';
import { useMarkerTracksViewChanges } from '@/hooks/use-marker-tracks-view-changes';
import { SAVED_PLACE_MAP_STYLE } from '@/lib/saved-places-map';

const NUMBER_BADGE_SIZE = 28;
const MULTI_BADGE_SIZE = 22;
const LABEL_MAX_WIDTH = 100;

type DayStoryStopsOverlayProps = {
  /** Prebuilt by the map controller — avoid rebuilding on every overlay mount. */
  stops: readonly DayStoryStop[];
  savedPlaces?: readonly SavedPlaceRow[];
  dayMoments?: readonly MomentRow[];
  historyPoints?: readonly LocationPointRow[];
  historyEntries?: readonly DayTimelineEntry[];
  dwellRadiusMeters?: number;
  hideSavedPlaceId?: number | null;
  onPressMomentType?: (stop: DayStoryStop, type: MomentCountType) => void;
  /** Open History to this stay (e.g. tap visit number 3 → Flower Child). */
  onPressStay?: (stay: DetectedTrip) => void;
};

function VisitNumberBadges({
  numbers,
  onPressNumber,
}: {
  numbers: readonly number[];
  onPressNumber?: (visitNumber: number) => void;
}) {
  if (numbers.length === 1) {
    const n = numbers[0]!;
    return (
      <View
        style={[
          styles.numberBadge,
          { backgroundColor: dayStoryColorForVisit(n) },
        ]}
      >
        <Text style={styles.numberText}>{n}</Text>
      </View>
    );
  }
  return (
    <View style={styles.multiBadgeRow}>
      {numbers.map((n, index) => {
        const badge = (
          <View
            style={[
              styles.multiBadge,
              { backgroundColor: dayStoryColorForVisit(n) },
              index > 0 && styles.multiBadgeOverlap,
            ]}
          >
            <Text style={styles.multiBadgeText}>{n}</Text>
          </View>
        );
        if (onPressNumber == null) {
          return <View key={n}>{badge}</View>;
        }
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`Open visit ${n} in history`}
            hitSlop={6}
            onPress={() => onPressNumber(n)}
          >
            {badge}
          </Pressable>
        );
      })}
    </View>
  );
}

function PlaceLabelRow({ stop }: { stop: DayStoryStop }) {
  const savedKind = stop.savedPlaceKind;
  return (
    <View style={styles.labelRow}>
      {savedKind != null ? (
        <SavedPlaceIcon
          kind={savedKind}
          size={11}
          color={SAVED_PLACE_MAP_STYLE[savedKind].icon}
        />
      ) : (
        <VisitPlaceKindIcon
          pinned={stop.poiId != null}
          category={stop.poiCategory}
          size={11}
          color="#8E8E93"
        />
      )}
      <Text style={styles.labelText} numberOfLines={1} ellipsizeMode="tail">
        {stop.label}
      </Text>
    </View>
  );
}

const DayStoryStopMarker = memo(function DayStoryStopMarker({
  stop,
  momentCounts,
  cardSide,
  onPressMomentType,
  onPressStay,
}: {
  stop: DayStoryStop;
  momentCounts: MomentCounts;
  cardSide: DayStoryCardSide;
  onPressMomentType?: (type: MomentCountType) => void;
  onPressStay?: (stay: DetectedTrip) => void;
}) {
  const showMoments = hasMomentCounts(momentCounts);
  const visitColor = dayStoryColorForVisit(stop.visitNumbers[0] ?? 1);
  const labelBackground = dayStoryCardFill(visitColor, 0.14);
  const [cardSize, setCardSize] = useState({ w: 0, h: 0 });
  // Fallback until onLayout — rough pill size so first paint isn't on the badge.
  const measuredW = cardSize.w > 0 ? cardSize.w : 72;
  const measuredH = cardSize.h > 0 ? cardSize.h : showMoments ? 44 : 22;
  const badgeRadius = stop.visitNumbers.length > 1 ? 18 : NUMBER_BADGE_SIZE / 2;
  const cardOffset = dayStoryCardOffset(
    cardSide,
    measuredW,
    measuredH,
    badgeRadius,
    8,
  );
  const badgeSignature = [stop.key, 'badge', stop.visitNumbers.join(',')].join(
    '|',
  );
  const cardSignature = [
    stop.key,
    'card',
    cardSide,
    stop.label,
    visitColor,
    showMoments ? 1 : 0,
    momentCounts.photo,
    momentCounts.video,
    momentCounts.voice,
    momentCounts.note,
    momentCounts.activity,
    Math.round(cardSize.w),
    Math.round(cardSize.h),
  ].join('|');
  const badgeTracks = useMarkerTracksViewChanges(badgeSignature);
  const cardTracks = useMarkerTracksViewChanges(cardSignature);

  const handlePressVisitNumber = useCallback(
    (visitNumber: number) => {
      const index = stop.visitNumbers.indexOf(visitNumber);
      if (index < 0) {
        return;
      }
      const stay = stop.stays[index];
      if (stay != null) {
        onPressStay?.(stay);
      }
    },
    [onPressStay, stop.stays, stop.visitNumbers],
  );

  const handlePressStop = useCallback(() => {
    const stay = stop.stays[0];
    if (stay != null) {
      onPressStay?.(stay);
    }
  }, [onPressStay, stop.stays]);

  // History opens from the label Pressable only — not Marker.onPress.
  // Moments share this Marker; Marker.onPress would also fire on cam taps.
  const labelCard =
    onPressStay != null ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${stop.label} in history`}
        onPress={handlePressStop}
        style={[styles.labelCard, { backgroundColor: labelBackground }]}
        collapsable={false}
      >
        <PlaceLabelRow stop={stop} />
      </Pressable>
    ) : (
      <View
        style={[styles.labelCard, { backgroundColor: labelBackground }]}
        collapsable={false}
      >
        <PlaceLabelRow stop={stop} />
      </View>
    );

  const momentsCard = showMoments ? (
    <View style={styles.momentsCard} collapsable={false}>
      <MomentCountsRow
        counts={momentCounts}
        layout="inline"
        compact
        dense
        iconSize={12}
        onPressType={onPressMomentType}
      />
    </View>
  ) : null;

  return (
    <>
      <Marker
        coordinate={stop.coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        zIndex={stop.isHome ? 12 : 10}
        tracksViewChanges={badgeTracks.tracksViewChanges}
        onPress={
          onPressStay != null && stop.visitNumbers.length === 1
            ? handlePressStop
            : undefined
        }
      >
        <View collapsable={false} onLayout={badgeTracks.onLayout}>
          <VisitNumberBadges
            numbers={stop.visitNumbers}
            onPressNumber={
              onPressStay != null ? handlePressVisitNumber : undefined
            }
          />
        </View>
      </Marker>
      <Marker
        coordinate={stop.coordinate}
        anchor={{ x: 0.5, y: 0.5 }}
        centerOffset={cardOffset}
        zIndex={stop.isHome ? 11 : 9}
        tracksViewChanges={cardTracks.tracksViewChanges}
      >
        <View
          style={styles.cardStack}
          collapsable={false}
          onLayout={event => {
            const { width, height } = event.nativeEvent.layout;
            if (
              width > 0 &&
              height > 0 &&
              (Math.abs(width - cardSize.w) > 0.5 ||
                Math.abs(height - cardSize.h) > 0.5)
            ) {
              setCardSize({ w: width, h: height });
            }
            cardTracks.onLayout();
          }}
        >
          {momentsCard}
          {labelCard}
        </View>
      </Marker>
    </>
  );
});

/** Numbered day-story stops for History-closed map browse. */
export const DayStoryStopsOverlay = memo(function DayStoryStopsOverlay({
  stops,
  savedPlaces = [],
  dayMoments = [],
  historyPoints = [],
  historyEntries = [],
  dwellRadiusMeters = 150,
  hideSavedPlaceId = null,
  onPressMomentType,
  onPressStay,
}: DayStoryStopsOverlayProps) {
  const onPressMomentTypeRef = useRef(onPressMomentType);
  onPressMomentTypeRef.current = onPressMomentType;
  const onPressStayRef = useRef(onPressStay);
  onPressStayRef.current = onPressStay;

  const cardSides = useMemo(
    () => assignDayStoryCardSides(stops, historyEntries, 700),
    [stops, historyEntries],
  );

  const momentCountsByStopKey = useMemo(() => {
    const map = new Map<string, MomentCounts>();
    for (const stop of stops) {
      map.set(
        stop.key,
        momentCountsForDayStoryStop(
          stop,
          dayMoments,
          savedPlaces,
          historyPoints,
          historyEntries,
          dwellRadiusMeters,
        ),
      );
    }
    return map;
  }, [
    stops,
    dayMoments,
    savedPlaces,
    historyPoints,
    historyEntries,
    dwellRadiusMeters,
  ]);

  const momentTypeHandlers = useMemo(() => {
    const map = new Map<string, (type: MomentCountType) => void>();
    for (const stop of stops) {
      map.set(stop.key, type => onPressMomentTypeRef.current?.(stop, type));
    }
    return map;
  }, [stops]);

  const handlePressStay = useCallback((stay: DetectedTrip) => {
    onPressStayRef.current?.(stay);
  }, []);

  if (stops.length === 0) {
    return null;
  }

  return (
    <>
      {stops.map(stop => {
        const hiddenByLiveCallout =
          stop.savedPlaceId != null && stop.savedPlaceId === hideSavedPlaceId;
        if (hiddenByLiveCallout) {
          return null;
        }

        return (
          <DayStoryStopMarker
            key={stop.key}
            stop={stop}
            momentCounts={
              momentCountsByStopKey.get(stop.key) ?? emptyMomentCounts()
            }
            cardSide={stop.isHome ? 'top' : cardSides.get(stop.key) ?? 'top'}
            onPressMomentType={
              onPressMomentType != null
                ? momentTypeHandlers.get(stop.key)
                : undefined
            }
            onPressStay={onPressStay != null ? handlePressStay : undefined}
          />
        );
      })}
    </>
  );
});

const styles = StyleSheet.create({
  cardStack: {
    alignItems: 'center',
    gap: 4,
    maxWidth: LABEL_MAX_WIDTH + 24,
  },
  momentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  labelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: LABEL_MAX_WIDTH + 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 4,
  },
  numberBadge: {
    width: NUMBER_BADGE_SIZE,
    height: NUMBER_BADGE_SIZE,
    borderRadius: NUMBER_BADGE_SIZE / 2,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 3,
  },
  multiBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  multiBadge: {
    width: MULTI_BADGE_SIZE,
    height: MULTI_BADGE_SIZE,
    borderRadius: MULTI_BADGE_SIZE / 2,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 2,
    elevation: 3,
  },
  multiBadgeOverlap: {
    marginLeft: -7,
  },
  numberText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  multiBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
    color: HISTORY_COLORS.playhead,
    maxWidth: LABEL_MAX_WIDTH - 20,
  },
});
