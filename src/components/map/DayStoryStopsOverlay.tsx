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
import { momentCountsAndPreviewsForDayStoryStop } from '@/lib/day-story-moments';
import {
  EMPTY_MOMENT_COUNTS,
  EMPTY_MOMENT_COUNT_PREVIEWS,
  hasMomentCounts,
  momentCountPreviewsSignature,
  type MomentCountPreviews,
  type MomentCountType,
  type MomentCounts,
} from '@/lib/moments/moment-counts';
import type { DayTimelineEntry, DetectedTrip } from '@/lib/trip-detection';
import {
  formatTripClockTime,
} from '@/lib/trip-format';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Marker } from 'react-native-maps';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { SavedPlaceIcon } from '@/components/map/SavedPlaceIcon';
import { VisitPlaceKindIcon } from '@/components/map/VisitPlaceKindIcon';
import { MomentCountsRow } from '@/components/moments/MomentCountsRow';
import { useMarkerTracksViewChanges } from '@/hooks/use-marker-tracks-view-changes';
import { SAVED_PLACE_MAP_STYLE } from '@/lib/saved-places-map';

const NUMBER_BADGE_SIZE = 28;
const MULTI_BADGE_SIZE = 22;
const LABEL_MAX_WIDTH = 100;
const MARKER_ANCHOR = { x: 0.5, y: 0.5 } as const;

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
      {numbers.map((n, index) => (
        <VisitNumberBadge
          key={n}
          visitNumber={n}
          index={index}
          onPressNumber={onPressNumber}
        />
      ))}
    </View>
  );
}

const VisitNumberBadge = memo(function VisitNumberBadge({
  visitNumber,
  index,
  onPressNumber,
}: {
  visitNumber: number;
  index: number;
  onPressNumber?: (visitNumber: number) => void;
}) {
  const handlePress = useCallback(() => {
    onPressNumber?.(visitNumber);
  }, [onPressNumber, visitNumber]);

  const badge = (
    <View
      style={[
        styles.multiBadge,
        { backgroundColor: dayStoryColorForVisit(visitNumber) },
        index > 0 && styles.multiBadgeOverlap,
      ]}
    >
      <Text style={styles.multiBadgeText}>{visitNumber}</Text>
    </View>
  );

  if (onPressNumber == null) {
    return <View>{badge}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open visit ${visitNumber} in history`}
      hitSlop={6}
      onPress={handlePress}
    >
      {badge}
    </Pressable>
  );
});

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

type VisitTimeLine = {
  visitNumber: number;
  label: string;
};

function visitTimeLinesForStop(stop: DayStoryStop): VisitTimeLine[] {
  const lines: VisitTimeLine[] = [];
  for (let index = 0; index < stop.visitNumbers.length; index += 1) {
    const visitNumber = stop.visitNumbers[index];
    const stay = stop.stays[index];
    if (visitNumber == null || stay?.startAt == null || stay.endAt == null) {
      continue;
    }
    lines.push({
      visitNumber,
      label: `${formatTripClockTime(stay.startAt)} - ${formatTripClockTime(stay.endAt)}`,
    });
  }
  return lines;
}

function PlaceVisitTimes({ lines }: { lines: readonly VisitTimeLine[] }) {
  if (lines.length === 0) {
    return null;
  }
  return (
    <View style={styles.reachedTimesRow}>
      {lines.map(line => {
        const tint = dayStoryCardFill(
          dayStoryColorForVisit(line.visitNumber),
          0.22,
        );
        return (
          <View
            key={`${line.visitNumber}-${line.label}`}
            style={styles.timeCardShadow}
            collapsable={false}
          >
            <AdaptiveGlassSurface
              effect="regular"
              tintColor={tint}
              style={styles.timeCard}
            >
              <Text
                style={styles.reachedTimeText}
                numberOfLines={1}
                accessibilityLabel={line.label}
              >
                {line.label}
              </Text>
            </AdaptiveGlassSurface>
          </View>
        );
      })}
    </View>
  );
}

const DayStoryStopMarker = memo(function DayStoryStopMarker({
  stop,
  momentCounts,
  momentPreviews,
  cardSide,
  onPressMomentType,
  onPressStay,
}: {
  stop: DayStoryStop;
  momentCounts: MomentCounts;
  momentPreviews: MomentCountPreviews;
  cardSide: DayStoryCardSide;
  onPressMomentType?: (type: MomentCountType) => void;
  onPressStay?: (stay: DetectedTrip) => void;
}) {
  const showMoments = hasMomentCounts(momentCounts);
  const visitColor = dayStoryColorForVisit(stop.visitNumbers[0] ?? 1);
  // Soft pastel tint — full visit colors read too dark on Liquid Glass.
  const labelTint = dayStoryCardFill(visitColor, 0.22);
  const visitTimes = useMemo(() => visitTimeLinesForStop(stop), [stop]);
  const visitTimesSignature = visitTimes
    .map(line => `${line.visitNumber}:${line.label}`)
    .join(',');
  const [cardSize, setCardSize] = useState({ w: 0, h: 0 });
  // Fallback until onLayout — rough pill size so first paint isn't on the badge.
  const measuredW = cardSize.w > 0 ? cardSize.w : 72;
  const measuredH =
    cardSize.h > 0
      ? cardSize.h
      : (showMoments ? 30 : 22) + (visitTimes.length > 0 ? 4 + 20 : 0);
  const badgeRadius = stop.visitNumbers.length > 1 ? 18 : NUMBER_BADGE_SIZE / 2;
  const cardOffset = useMemo(
    () =>
      dayStoryCardOffset(cardSide, measuredW, measuredH, badgeRadius, 8),
    [cardSide, measuredW, measuredH, badgeRadius],
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
    visitTimesSignature,
    showMoments ? 1 : 0,
    momentCounts.photo,
    momentCounts.video,
    momentCounts.voice,
    momentCounts.note,
    momentCounts.activity,
    momentCounts.mood,
    momentCountPreviewsSignature(momentPreviews),
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

  // History opens from the place-name Pressable only — not from times or
  // Marker.onPress (moments share this Marker; Marker.onPress would also fire
  // on cam taps). Number badges keep their own onPressStay wiring.
  const labelInner = (
    <AdaptiveGlassSurface
      effect="regular"
      tintColor={labelTint}
      style={styles.labelCard}
    >
      {onPressStay != null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${stop.label} in history`}
          onPress={handlePressStop}
        >
          <PlaceLabelRow stop={stop} />
        </Pressable>
      ) : (
        <PlaceLabelRow stop={stop} />
      )}
    </AdaptiveGlassSurface>
  );

  const labelCard = (
    <View style={styles.labelCardShadow} collapsable={false}>
      {labelInner}
    </View>
  );

  const timesCard =
    visitTimes.length > 0 ? <PlaceVisitTimes lines={visitTimes} /> : null;

  const momentsCard = showMoments ? (
    <View style={styles.momentsCardShadow} collapsable={false}>
      <AdaptiveGlassSurface effect="regular" style={styles.momentsCard}>
        <View style={styles.momentsRowClip}>
          <MomentCountsRow
            counts={momentCounts}
            previews={momentPreviews}
            layout="inline"
            compact
            dense
            iconSize={12}
            onPressType={onPressMomentType}
          />
        </View>
      </AdaptiveGlassSurface>
    </View>
  ) : null;

  return (
    <>
      <Marker
        coordinate={stop.coordinate}
        anchor={MARKER_ANCHOR}
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
        anchor={MARKER_ANCHOR}
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
          {timesCard}
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

  const momentDataByStopKey = useMemo(() => {
    const map = new Map<
      string,
      { counts: MomentCounts; previews: MomentCountPreviews }
    >();
    for (const stop of stops) {
      map.set(
        stop.key,
        momentCountsAndPreviewsForDayStoryStop(
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

        const momentData = momentDataByStopKey.get(stop.key);

        return (
          <DayStoryStopMarker
            key={stop.key}
            stop={stop}
            momentCounts={momentData?.counts ?? EMPTY_MOMENT_COUNTS}
            momentPreviews={momentData?.previews ?? EMPTY_MOMENT_COUNT_PREVIEWS}
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
    maxWidth: LABEL_MAX_WIDTH + 80,
  },
  momentsCardShadow: {
    borderRadius: 8,
    maxWidth: LABEL_MAX_WIDTH + 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  momentsCard: {
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: LABEL_MAX_WIDTH + 48,
  },
  momentsRowClip: {
    maxHeight: 22,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  labelCardShadow: {
    borderRadius: 10,
    maxWidth: LABEL_MAX_WIDTH + 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 4,
  },
  labelCard: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: LABEL_MAX_WIDTH + 16,
  },
  timeCardShadow: {
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  timeCard: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
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
  reachedTimesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 4,
    maxWidth: LABEL_MAX_WIDTH + 72,
  },
  reachedTimeText: {
    fontSize: 10,
    fontWeight: '600',
    color: HISTORY_COLORS.playhead,
    textAlign: 'center',
  },
});
