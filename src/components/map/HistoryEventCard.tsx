import LottieView from 'lottie-react-native';
import {Pressable, StyleSheet, View} from 'react-native';
import {Pause, Play} from 'lucide-react-native';

import {DriveEndpointPlaceRow} from '@/components/map/DriveEndpointPlaceRow';
import {SavedPlaceIcon} from '@/components/map/SavedPlaceIcon';
import {VisitPlaceLabelPager} from '@/components/map/VisitPlaceLabelPager';
import {MomentCountsRow} from '@/components/moments/MomentCountsRow';
import {Text} from '@/components/ui/text';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {HISTORY_COLORS} from '@/lib/history-timeline';
import type {MomentCounts} from '@/lib/moments/moment-counts';
import {hasMomentCounts} from '@/lib/moments/moment-counts';
import type {DriveEndpointLabel} from '@/lib/drive-endpoint-label';
import {savedPlaceDisplayLabel} from '@/lib/saved-places';
import type {VisitPlaceDisplay} from '@/lib/place-lookup-types';
import type {DayTimelineEntry} from '@/lib/trip-detection';
import {
  formatStayVisitLabel,
  formatTimelineStats,
  formatTimelineTitle,
  formatTripClockTime,
} from '@/lib/trip-format';
import type {DistanceUnit} from '@/lib/location-geo';
import {useThemeColors} from '@/hooks/use-theme-colors';

const DRIVE_LOTTIE = require('../../../assets/lottie/drive-car.json');
const VISIT_LOTTIE = require('../../../assets/lottie/visit-relax.json');

type HistoryEventCardProps = {
  entry: DayTimelineEntry | null;
  savedPlace?: SavedPlaceRow | null;
  visitPlaceDisplay?: VisitPlaceDisplay | null;
  onSelectVisitPlaceIndex?: (index: number) => void;
  driveStartLabel?: DriveEndpointLabel;
  driveEndLabel?: DriveEndpointLabel;
  momentCounts?: MomentCounts;
  onPressMomentCounts?: () => void;
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
/** Text starts here — slightly inside clip to skip Lottie right-padding. */
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
    <View style={styles.driveLottieInline}>
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

function DriveEndpointSummary({
  caption,
  time,
  label,
}: {
  caption: 'Start' | 'Finish';
  time: Date;
  label?: DriveEndpointLabel;
}) {
  return (
    <View style={styles.driveEndpoint}>
      <Text style={styles.driveEndpointCaption}>{caption}</Text>
      <Text style={styles.driveEndpointTime}>{formatTripClockTime(time)}</Text>
      {label ? (
        <DriveEndpointPlaceRow
          label={label}
          iconSize={14}
          textStyle={styles.driveEndpointPlace}
        />
      ) : null}
    </View>
  );
}

export function HistoryEventCard({
  entry,
  savedPlace = null,
  visitPlaceDisplay = null,
  onSelectVisitPlaceIndex,
  driveStartLabel,
  driveEndLabel,
  momentCounts,
  onPressMomentCounts,
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
  const showMomentCounts = momentCounts != null && hasMomentCounts(momentCounts);

  return (
    <View style={[styles.card, isGap && styles.cardGap]}>
      {showMomentCounts ? (
        <View style={styles.momentSection}>
          <MomentCountsRow counts={momentCounts!} onPress={onPressMomentCounts} />
          <View style={styles.momentDivider} />
        </View>
      ) : null}
      {!isStay ? (
        <Text variant="muted" className="text-xs uppercase tracking-wide">
          {isGap ? 'Gap' : 'Drive'}
        </Text>
      ) : null}
      {isStay && visitLabel ? (
        <>
          <View style={styles.visitKindRow}>
            <Text variant="muted" className="text-xs uppercase tracking-wide">
              Visit
            </Text>
            {savedPlace ? (
              <View style={styles.visitPlaceRow}>
                <SavedPlaceIcon kind={savedPlace.kind} size={16} />
                <Text className="text-base font-semibold">
                  {savedPlaceDisplayLabel(savedPlace)}
                </Text>
              </View>
            ) : visitPlaceDisplay?.primaryLabel ? (
              <VisitPlaceLabelPager
                display={visitPlaceDisplay}
                onSelectIndex={index => onSelectVisitPlaceIndex?.(index)}
              />
            ) : visitPlaceDisplay?.loading ? (
              <Text variant="muted" className="text-sm">
                Finding nearby place…
              </Text>
            ) : null}
          </View>
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
          <View style={styles.driveBodyRow}>
            <DriveCardIcon />
            <View style={styles.driveContent}>
              <View style={styles.driveEndpointsRow}>
                <DriveEndpointSummary
                  caption="Start"
                  time={entry.startAt}
                  label={driveStartLabel}
                />
                <DriveEndpointSummary
                  caption="Finish"
                  time={entry.endAt}
                  label={driveEndLabel}
                />
              </View>
              <Text variant="muted" className="mt-0.5 text-sm">
                {stats}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Stop playback' : 'Play on map'}
              onPress={() => (isPlaying ? onStop() : onPlay())}
              style={[
                styles.inlineActionButton,
                {backgroundColor: colors.primary},
              ]}>
              {isPlaying ? (
                <Pause size={20} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
              )}
            </Pressable>
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
  momentSection: {
    gap: 8,
    marginBottom: 12,
  },
  momentDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
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
  visitKindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  visitPlaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  driveBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  driveContent: {
    flex: 1,
    minWidth: 0,
  },
  driveLottieInline: {
    flexShrink: 0,
  },
  driveEndpointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  driveEndpoint: {
    flex: 1,
    minWidth: 0,
  },
  driveEndpointCaption: {
    fontSize: 10,
    fontWeight: '700',
    color: HISTORY_COLORS.travel,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  driveEndpointPlace: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  driveEndpointTime: {
    marginTop: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
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
  inlineActionButton: {
    width: ACTION_BUTTON_SIZE,
    height: ACTION_BUTTON_SIZE,
    borderRadius: ACTION_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
