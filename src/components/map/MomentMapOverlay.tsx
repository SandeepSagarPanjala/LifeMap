import {AudioLines, Camera, NotebookPen} from 'lucide-react-native';
import {Marker} from 'react-native-maps';
import {StyleSheet, Text, View} from 'react-native';

import type {MomentRow} from '@/db/repositories/moments';
import type {LocationPointRow} from '@/db/repositories/location-days';
import {
  CAPTURE_BUTTON_THEMES,
  CAPTURE_ICON_SIZE,
  type CaptureButtonVariant,
} from '@/components/map/map-capture-button-theme';
import {
  findContainingTimelineEntry,
  resolveMomentCoordinate,
} from '@/lib/moments/moment-timeline';
import type {DayTimelineEntry} from '@/lib/trip-detection';
import {isMaterializedEntry, momentsForTripRefs} from '@/lib/moment-refs';

const MARKER_ANCHOR = {x: 0.5, y: 0.5} as const;

export type MomentMapPin = {
  moment: MomentRow;
  coordinate: {latitude: number; longitude: number};
};

function momentCaptureVariant(
  type: MomentRow['type'],
): CaptureButtonVariant {
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
      const coordinate = resolveMomentCoordinate(
        moment.timestamp,
        points,
        containingEntry,
      );
      if (!coordinate) {
        return null;
      }
      return {
        moment,
        coordinate: {latitude: coordinate.lat, longitude: coordinate.lng},
      };
    })
    .filter((pin): pin is MomentMapPin => pin != null);
}

/** History scrub pins — uses materialized anchors on sealed drives when available. */
export function buildHistoryMomentMapPins(
  entry: DayTimelineEntry,
  dayMoments: MomentRow[],
  points: LocationPointRow[],
  now: Date = new Date(),
): MomentMapPin[] {
  if (entry.kind === 'gap') {
    return [];
  }

  const materializedMoments = isMaterializedEntry(entry)
    ? momentsForTripRefs(dayMoments, entry.momentRefs ?? [])
    : filterMomentsForTimelineEntry(dayMoments, entry, now);

  if (
    isMaterializedEntry(entry) &&
    entry.kind === 'travel' &&
    entry.routeMomentAnchors != null &&
    entry.routeMomentAnchors.length > 0
  ) {
    const byId = new Map(materializedMoments.map(moment => [moment.id, moment]));
    return entry.routeMomentAnchors
      .map(anchor => {
        const moment = byId.get(anchor.momentId);
        if (moment == null) {
          return null;
        }
        return {
          moment,
          coordinate: {latitude: anchor.lat, longitude: anchor.lng},
        };
      })
      .filter((pin): pin is MomentMapPin => pin != null);
  }

  return buildMomentMapPins(materializedMoments, points, [entry], now);
}

function filterMomentsForTimelineEntry(
  moments: MomentRow[],
  entry: Extract<DayTimelineEntry, {kind: 'stay' | 'travel'}>,
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

export function MomentMapOverlay({pins, onPressPin}: MomentMapOverlayProps) {
  if (pins.length === 0) {
    return null;
  }

  return (
    <>
      {pins.map(pin => {
        const {moment, coordinate} = pin;
        const variant = momentCaptureVariant(moment.type);
        const theme = CAPTURE_BUTTON_THEMES[variant];
        const Icon =
          variant === 'voice'
            ? AudioLines
            : variant === 'note'
              ? NotebookPen
              : Camera;
        const tappable = onPressPin != null;
        const activityEmoji =
          moment.type === 'activity' ? moment.activityEmoji?.trim() : null;

        return (
          <Marker
            key={`moment-${moment.id}`}
            coordinate={coordinate}
            anchor={MARKER_ANCHOR}
            zIndex={7}
            tracksViewChanges={false}
            onPress={tappable ? () => onPressPin(pin) : undefined}>
            <View style={[styles.badge, {backgroundColor: theme.badgeBg}]}>
              {activityEmoji ? (
                <Text style={styles.activityEmoji}>{activityEmoji}</Text>
              ) : (
                <Icon size={CAPTURE_ICON_SIZE} color={theme.icon} strokeWidth={2.25} />
              )}
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
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
