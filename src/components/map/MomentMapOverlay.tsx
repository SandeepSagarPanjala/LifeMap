import { memo, useCallback, useMemo } from 'react';
import { AudioLines, Camera, NotebookPen } from 'lucide-react-native';
import { Marker } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';

import type { MomentRow } from '@/db/repositories/moments';
import type { LocationPointRow } from '@/db/repositories/location-days';
import {
  CAPTURE_BUTTON_THEMES,
  CAPTURE_ICON_SIZE,
  type CaptureButtonVariant,
} from '@/components/map/map-capture-button-theme';
import { MomentCountsRow } from '@/components/moments/MomentCountsRow';
import { countMoments, type MomentCounts } from '@/lib/moments/moment-counts';
import {
  findContainingTimelineEntry,
  resolveMomentPinCoordinate,
} from '@/lib/moments/moment-timeline';
import type { DayTimelineEntry } from '@/lib/trip-detection';
import { isMaterializedEntry, momentsForTripRefs } from '@/lib/moment-refs';

const MARKER_ANCHOR = { x: 0.5, y: 0.5 } as const;

export type MomentMapPin = {
  moment: MomentRow;
  coordinate: { latitude: number; longitude: number };
  /** Co-located moments merged for day-journey map display. */
  groupedMoments?: MomentRow[];
};

function momentCaptureVariant(type: MomentRow['type']): CaptureButtonVariant {
  if (type === 'voice') {
    return 'voice';
  }
  if (type === 'note') {
    return 'note';
  }
  if (type === 'activity') {
    return 'activity';
  }
  return 'camera';
}

function allMomentsForPin(pin: MomentMapPin): MomentRow[] {
  return pin.groupedMoments != null
    ? [pin.moment, ...pin.groupedMoments]
    : [pin.moment];
}

function countsForPin(pin: MomentMapPin): MomentCounts {
  return countMoments(allMomentsForPin(pin));
}

export function buildMomentMapPins(
  moments: MomentRow[],
  points: LocationPointRow[],
  entries: DayTimelineEntry[],
  now: Date = new Date(),
): MomentMapPin[] {
  return moments
    .map(moment => {
      const containingEntry = findContainingTimelineEntry(
        moment.timestamp,
        entries,
        now,
      );
      const coordinate = resolveMomentPinCoordinate(
        moment,
        points,
        containingEntry,
      );
      if (!coordinate) {
        return null;
      }
      return {
        moment,
        coordinate: { latitude: coordinate.lat, longitude: coordinate.lng },
      };
    })
    .filter((pin): pin is MomentMapPin => pin != null);
}

function materializedMomentMapPins(
  entry: Extract<DayTimelineEntry, { kind: 'stay' | 'travel' }>,
  materializedMoments: MomentRow[],
): MomentMapPin[] {
  if (
    entry.routeMomentAnchors == null ||
    entry.routeMomentAnchors.length === 0
  ) {
    return [];
  }
  const byId = new Map(materializedMoments.map(moment => [moment.id, moment]));
  return entry.routeMomentAnchors
    .map(anchor => {
      const moment = byId.get(anchor.momentId);
      if (moment == null) {
        return null;
      }
      return {
        moment,
        coordinate: { latitude: anchor.lat, longitude: anchor.lng },
      };
    })
    .filter((pin): pin is MomentMapPin => pin != null);
}

/** History scrub pins — materialized anchors on sealed segments; stays use callout only. */
export function buildHistoryMomentMapPins(
  entry: DayTimelineEntry,
  dayMoments: MomentRow[],
  points: LocationPointRow[],
  now: Date = new Date(),
): MomentMapPin[] {
  if (entry.kind === 'gap' || entry.kind === 'stay') {
    return [];
  }

  const materializedMoments = isMaterializedEntry(entry)
    ? momentsForTripRefs(dayMoments, entry.momentRefs ?? [])
    : filterMomentsForTimelineEntry(dayMoments, entry, now);

  if (isMaterializedEntry(entry)) {
    const anchored = materializedMomentMapPins(entry, materializedMoments);
    if (anchored.length > 0) {
      return anchored;
    }
  }

  return buildMomentMapPins(materializedMoments, points, [entry], now);
}

function filterMomentsForTimelineEntry(
  moments: MomentRow[],
  entry: Extract<DayTimelineEntry, { kind: 'stay' | 'travel' }>,
  now: Date,
): MomentRow[] {
  return moments.filter(moment => {
    const timestampMs = moment.timestamp.getTime();
    const endMs =
      entry.openThroughNow === true ? now.getTime() : entry.endAt.getTime();
    return timestampMs >= entry.startAt.getTime() && timestampMs <= endMs;
  });
}

type MomentMapOverlayProps = {
  pins: MomentMapPin[];
  onPressPin?: (pin: MomentMapPin) => void;
};

type MomentMapMarkerProps = {
  pin: MomentMapPin;
  onPressPin?: (pin: MomentMapPin) => void;
};

/** Memoized leaf so a single pin change / re-render doesn't re-render all pins. */
const MomentMapMarker = memo(function MomentMapMarker({
  pin,
  onPressPin,
}: MomentMapMarkerProps) {
  const { moment, coordinate, groupedMoments } = pin;
  const grouped = groupedMoments != null && groupedMoments.length > 0;
  const variant = momentCaptureVariant(moment.type);
  const theme = CAPTURE_BUTTON_THEMES[variant];
  const Icon =
    variant === 'voice'
      ? AudioLines
      : variant === 'note'
      ? NotebookPen
      : Camera;
  const activityEmoji =
    moment.type === 'activity' ? moment.activityEmoji?.trim() : null;

  const counts = useMemo(() => (grouped ? countsForPin(pin) : null), [
    grouped,
    pin,
  ]);
  const badgeStyle = useMemo(
    () => [styles.badge, { backgroundColor: theme.badgeBg }],
    [theme.badgeBg],
  );
  const handlePress = useCallback(() => {
    onPressPin?.(pin);
  }, [onPressPin, pin]);

  return (
    <Marker
      coordinate={coordinate}
      anchor={MARKER_ANCHOR}
      zIndex={7}
      tracksViewChanges={false}
      onPress={onPressPin != null ? handlePress : undefined}
    >
      {grouped && counts != null ? (
        <View style={styles.clusterColumn}>
          <View style={styles.clusterBubble}>
            <MomentCountsRow counts={counts} layout="stacked" dense />
          </View>
        </View>
      ) : (
        <View style={badgeStyle}>
          {activityEmoji ? (
            <Text style={styles.activityEmoji}>{activityEmoji}</Text>
          ) : (
            <Icon
              size={CAPTURE_ICON_SIZE}
              color={theme.icon}
              strokeWidth={2.25}
            />
          )}
        </View>
      )}
    </Marker>
  );
});

function momentPinKey(pin: MomentMapPin): string {
  const { moment, groupedMoments } = pin;
  return groupedMoments != null && groupedMoments.length > 0
    ? `moment-cluster-${[
        moment.id,
        ...groupedMoments.map(row => row.id),
      ].join('-')}`
    : `moment-${moment.id}`;
}

function MomentMapOverlayComponent({
  pins,
  onPressPin,
}: MomentMapOverlayProps) {
  if (pins.length === 0) {
    return null;
  }

  return (
    <>
      {pins.map(pin => (
        <MomentMapMarker
          key={momentPinKey(pin)}
          pin={pin}
          onPressPin={onPressPin}
        />
      ))}
    </>
  );
}

export const MomentMapOverlay = memo(MomentMapOverlayComponent);

const styles = StyleSheet.create({
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 4,
  },
  clusterColumn: {
    alignItems: 'center',
  },
  clusterBubble: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 4,
  },
  activityEmoji: {
    fontSize: 18,
    lineHeight: 20,
    textAlign: 'center',
  },
});
