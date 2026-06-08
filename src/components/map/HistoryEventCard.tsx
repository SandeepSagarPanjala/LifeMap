import LottieView from 'lottie-react-native';
import {Pressable, StyleSheet, View} from 'react-native';
import {Pause, Play} from 'lucide-react-native';

import {Text} from '@/components/ui/text';
import {HISTORY_COLORS} from '@/lib/history-timeline';
import type {DayTimelineEntry} from '@/lib/trip-detection';
import {
  formatStayVisitLabel,
  formatTimelineStats,
  formatTimelineTitle,
} from '@/lib/trip-format';
import type {DistanceUnit} from '@/lib/location-geo';
import {useThemeColors} from '@/hooks/use-theme-colors';

const DRIVE_LOTTIE = require('../../../assets/lottie/drive-car.json');
const VISIT_LOTTIE = require('../../../assets/lottie/visit-relax.json');

type HistoryEventCardProps = {
  entry: DayTimelineEntry | null;
  /** Timeline has data but no event is selected yet. */
  scrubOnEmpty?: boolean;
  distanceUnit: DistanceUnit;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onZoomVisit: () => void;
};

const ACTION_BUTTON_SIZE = 44;
const ACTION_BUTTON_INSET = 16;
const DRIVE_LOTTIE_CLIP_WIDTH = 96;
const DRIVE_LOTTIE_CLIP_HEIGHT = ACTION_BUTTON_SIZE;
const DRIVE_LOTTIE_LEFT = ACTION_BUTTON_INSET - 4;
/** Text starts here — slightly inside clip to skip Lottie right-padding. */
const DRIVE_CAR_VISUAL_WIDTH = 84;
const DRIVE_LOTTIE_RENDER_WIDTH = 280;
const DRIVE_LOTTIE_RENDER_HEIGHT = 160;
const VISIT_LOTTIE_CLIP_WIDTH = 70;
const VISIT_LOTTIE_CLIP_HEIGHT = ACTION_BUTTON_SIZE;
const VISIT_LOTTIE_LEFT = ACTION_BUTTON_INSET - 4;
const VISIT_VISUAL_WIDTH = 60;
/** visit-relax.json canvas is 1080×1080. */
const VISIT_LOTTIE_RENDER_WIDTH = 60;
const VISIT_LOTTIE_RENDER_HEIGHT = 230;

function VisitCardIcon() {
  return (
    <View style={styles.visitLottieAnchor}>
      <View style={styles.visitLottieClip}>
        <LottieView
          source={VISIT_LOTTIE}
          autoPlay
          loop
          style={styles.visitLottie}
        />
      </View>
    </View>
  );
}

function DriveCardIcon() {
  return (
    <View style={styles.driveLottieAnchor}>
      <View style={styles.driveLottieClip}>
        <LottieView
          source={DRIVE_LOTTIE}
          autoPlay
          loop
          style={styles.driveLottie}
        />
      </View>
    </View>
  );
}

export function HistoryEventCard({
  entry,
  scrubOnEmpty = false,
  distanceUnit,
  isPlaying,
  onPlay,
  onStop,
  onZoomVisit,
}: HistoryEventCardProps) {
  const colors = useThemeColors();

  if (entry == null) {
    return (
      <View style={styles.card}>
        <Text className="font-medium">
          {scrubOnEmpty ? 'Select an event' : 'No history yet'}
        </Text>
        <Text variant="muted" className="mt-1 text-sm">
          {scrubOnEmpty
            ? 'Tap a visit or drive on the bar, or use the arrows.'
            : 'Your timeline fills in from install to now as LifeMap saves locations.'}
        </Text>
      </View>
    );
  }

  const showPlay = entry.kind === 'travel';
  const showZoom = entry.kind === 'stay';
  const isGap = entry.kind === 'gap';
  const isStay = entry.kind === 'stay';
  const isTravel = entry.kind === 'travel';
  const visitLabel = isStay
    ? formatStayVisitLabel(entry.startAt, entry.endAt, entry.durationMs, {
        openThroughNow: entry.openThroughNow,
        now: new Date(),
      })
    : null;
  const title = isStay ? visitLabel!.title : formatTimelineTitle(entry);
  const stats = formatTimelineStats(entry, distanceUnit);

  return (
    <View style={[styles.card, isGap && styles.cardGap]}>
      <Text variant="muted" className="text-xs uppercase tracking-wide">
        {isGap ? 'Gap' : isStay ? 'Visit' : 'Drive'}
      </Text>
      {isStay && visitLabel ? (
        <>
          <VisitCardIcon />
          <View
            style={[
              styles.eventTitleRow,
              showZoom && styles.eventTitleRowWithRightAction,
              styles.visitTitleRow,
            ]}>
            <View className="flex-1">
              <Text className="text-lg font-semibold">{visitLabel.title}</Text>
              <Text variant="muted" className="mt-0.5 text-sm">
                {visitLabel.subtitle}
              </Text>
            </View>
          </View>
        </>
      ) : isTravel ? (
        <>
          <DriveCardIcon />
          <View
            style={[
              styles.eventTitleRow,
              showPlay && styles.eventTitleRowWithRightAction,
              styles.driveTitleRow,
            ]}>
            <View className="flex-1">
              <Text className="text-lg font-semibold">{title}</Text>
              <Text variant="muted" className="mt-0.5 text-sm">
                {stats}
              </Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <Text className="mt-1 text-lg font-semibold">{title}</Text>
          <Text variant="muted" className="mt-1 text-sm">
            {stats}
          </Text>
        </>
      )}

      {showPlay ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Stop playback' : 'Play on map'}
          onPress={() => (isPlaying ? onStop() : onPlay())}
          style={[styles.actionButton, {backgroundColor: colors.primary}]}>
          {isPlaying ? (
            <Pause size={20} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
          )}
        </Pressable>
      ) : null}
      {showZoom ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom to visit on map"
          onPress={onZoomVisit}
          style={[
            styles.actionButton,
            {backgroundColor: HISTORY_COLORS.stay},
          ]}>
          <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
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
    overflow: 'visible',
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
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  eventTitleRowWithRightAction: {
    paddingRight: ACTION_BUTTON_SIZE + ACTION_BUTTON_INSET,
  },
  visitTitleRow: {
    paddingLeft: VISIT_LOTTIE_LEFT + VISIT_VISUAL_WIDTH,
  },
  driveTitleRow: {
    paddingLeft: DRIVE_LOTTIE_LEFT + DRIVE_CAR_VISUAL_WIDTH,
  },
  visitLottieAnchor: {
    position: 'absolute',
    left: VISIT_LOTTIE_LEFT,
    bottom: ACTION_BUTTON_INSET,
    zIndex: 2,
  },
  visitLottieClip: {
    width: VISIT_LOTTIE_CLIP_WIDTH,
    height: VISIT_LOTTIE_CLIP_HEIGHT,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  visitLottie: {
    width: VISIT_LOTTIE_RENDER_WIDTH,
    height: VISIT_LOTTIE_RENDER_HEIGHT,
    marginTop: -96,
    transform: [{scaleX: -1}],
  },
  driveLottieAnchor: {
    position: 'absolute',
    left: DRIVE_LOTTIE_LEFT,
    bottom: ACTION_BUTTON_INSET,
    zIndex: 2,
  },
  driveLottieClip: {
    width: DRIVE_LOTTIE_CLIP_WIDTH,
    height: DRIVE_LOTTIE_CLIP_HEIGHT,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  driveLottie: {
    width: DRIVE_LOTTIE_RENDER_WIDTH,
    height: DRIVE_LOTTIE_RENDER_HEIGHT,
    marginTop: -52,
    transform: [{scaleX: -1}],
  },
  actionButton: {
    position: 'absolute',
    right: ACTION_BUTTON_INSET,
    bottom: ACTION_BUTTON_INSET,
    width: ACTION_BUTTON_SIZE,
    height: ACTION_BUTTON_SIZE,
    borderRadius: ACTION_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
