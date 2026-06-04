import {Pressable, StyleSheet, View} from 'react-native';
import {Crosshair, Pause, Play} from 'lucide-react-native';

import {Text} from '@/components/ui/text';
import type {DayTimelineEntry} from '@/lib/trip-detection';
import {
  formatStayVisitLabel,
  formatTimelineStats,
  formatTimelineTitle,
} from '@/lib/trip-format';
import type {DistanceUnit} from '@/lib/location-geo';
import {useThemeColors} from '@/hooks/use-theme-colors';

type HistoryEventCardProps = {
  entry: DayTimelineEntry | null;
  /** Timeline has data but scrub is on empty bar (no visit/drive/gap). */
  scrubOnEmpty?: boolean;
  distanceUnit: DistanceUnit;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
};

export function HistoryEventCard({
  entry,
  scrubOnEmpty = false,
  distanceUnit,
  isPlaying,
  onPlay,
  onStop,
}: HistoryEventCardProps) {
  const colors = useThemeColors();

  if (entry == null) {
    return (
      <View style={styles.card}>
        <Text className="font-medium">
          {scrubOnEmpty ? 'No event at this time' : 'No history yet'}
        </Text>
        <Text variant="muted" className="mt-1 text-sm">
          {scrubOnEmpty
            ? 'Drag the scrubber onto an orange visit or blue drive.'
            : 'Your timeline fills in from install to now as LifeMap saves locations.'}
        </Text>
      </View>
    );
  }

  const showPlay = entry.kind === 'travel';
  const isGap = entry.kind === 'gap';
  const isStay = entry.kind === 'stay';
  const visitLabel = isStay
    ? formatStayVisitLabel(entry.startAt, entry.endAt, entry.durationMs, {
        openThroughNow: entry.openThroughNow,
        now: new Date(),
      })
    : null;
  const title = isStay ? visitLabel!.title : formatTimelineTitle(entry);

  return (
    <View style={[styles.card, isGap && styles.cardGap]}>
      <Text variant="muted" className="text-xs uppercase tracking-wide">
        {isGap ? 'Gap' : isStay ? 'Visit' : 'Drive'}
      </Text>
      {isStay && visitLabel ? (
        <View style={styles.visitTitleRow}>
          <Crosshair size={20} color={colors.primary} strokeWidth={2.25} />
          <View className="flex-1">
            <Text className="text-lg font-semibold">{visitLabel.title}</Text>
            <Text variant="muted" className="mt-0.5 text-sm">
              {visitLabel.subtitle}
            </Text>
          </View>
        </View>
      ) : (
        <Text className="mt-1 text-lg font-semibold">{title}</Text>
      )}
      {!isStay ? (
        <Text variant="muted" className="mt-1 text-sm">
          {formatTimelineStats(entry, distanceUnit)}
        </Text>
      ) : null}

      {showPlay ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Stop playback' : 'Play on map'}
          onPress={() => (isPlaying ? onStop() : onPlay())}
          style={[styles.playButton, {backgroundColor: colors.primary}]}>
          {isPlaying ? (
            <Pause size={20} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    minHeight: 88,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardGap: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
  },
  visitTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingRight: 52,
  },
  playButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
