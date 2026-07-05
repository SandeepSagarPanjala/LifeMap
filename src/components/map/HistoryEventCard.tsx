import LottieView from 'lottie-react-native';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';
import {Pencil, Play} from 'lucide-react-native';

import {DriveRouteStrip} from '@/components/map/DriveRouteStrip';
import {SavedPlaceIcon} from '@/components/map/SavedPlaceIcon';
import {MomentCountsRow} from '@/components/moments/MomentCountsRow';
import {Text} from '@/components/ui/text';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {HISTORY_COLORS} from '@/lib/app-constants';
import type {MomentCountType, MomentCounts} from '@/lib/moments/moment-counts';
import {hasMomentCounts} from '@/lib/moments/moment-counts';
import type {DriveEndpointLabel} from '@/lib/drive-endpoint-label';
import {savedPlaceDisplayLabel} from '@/lib/saved-places';
import type {DayTimelineEntry} from '@/lib/trip-detection';
import {
  formatStayVisitLabel,
  formatTimelineStats,
  formatTimelineTitle,
} from '@/lib/trip-format';
import type {DistanceUnit} from '@/lib/location-geo';
import {useThemeColors} from '@/hooks/use-theme-colors';

const VISIT_LOTTIE = require('../../../assets/lottie/visit-relax.json');

type HistoryEventCardProps = {
  entry: DayTimelineEntry | null;
  savedPlace?: SavedPlaceRow | null;
  visitPlaceLabel?: string | null;
  visitPlaceResolving?: boolean;
  onEditVisitPlaceLabel?: () => void;
  driveStartLabel?: DriveEndpointLabel;
  driveEndLabel?: DriveEndpointLabel;
  canEditDriveStartLabel?: boolean;
  canEditDriveEndLabel?: boolean;
  onEditDriveStartLabel?: () => void;
  onEditDriveEndLabel?: () => void;
  momentCounts?: MomentCounts;
  onPressMomentType?: (type: MomentCountType) => void;
  /** Timeline has data but no event is selected yet. */
  scrubOnEmpty?: boolean;
  /** Selected day finished loading with no GPS rows. */
  emptyDayWithoutData?: boolean;
  viewingToday?: boolean;
  distanceUnit: DistanceUnit;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onZoomVisit: () => void;
};

const ACTION_BUTTON_SIZE = 44;
const ACTION_BUTTON_INSET = 16;
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

function driveCardStatsLine(
  entry: DayTimelineEntry,
  distanceUnit: DistanceUnit,
): string {
  return formatTimelineStats(entry, distanceUnit).replace(/^Drive · /, '');
}

export function HistoryEventCard({
  entry,
  savedPlace = null,
  visitPlaceLabel = null,
  visitPlaceResolving = false,
  onEditVisitPlaceLabel,
  driveStartLabel,
  driveEndLabel,
  canEditDriveStartLabel = false,
  canEditDriveEndLabel = false,
  onEditDriveStartLabel,
  onEditDriveEndLabel,
  momentCounts,
  onPressMomentType,
  scrubOnEmpty = false,
  emptyDayWithoutData = false,
  viewingToday = false,
  distanceUnit,
  isPlaying,
  onPlay,
  onStop,
  onZoomVisit,
}: HistoryEventCardProps) {
  const colors = useThemeColors();

  if (entry == null) {
    const title = scrubOnEmpty
      ? 'Select an event'
      : emptyDayWithoutData
        ? 'No location data'
        : 'No history yet';
    const subtitle = scrubOnEmpty
      ? 'Tap a visit or drive on the bar, or use the arrows.'
      : emptyDayWithoutData
        ? 'LifeMap has no saved points for this day. Try another date.'
        : viewingToday
          ? 'Your timeline fills in from install to now as LifeMap saves locations.'
          : 'Your timeline fills in as LifeMap saves locations.';
    return (
      <View style={styles.card}>
        <Text className="font-medium">{title}</Text>
        <Text variant="muted" className="mt-1 text-sm">
          {subtitle}
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
          <MomentCountsRow
            counts={momentCounts!}
            onPressType={onPressMomentType}
            layout="stacked"
          />
          <View style={styles.momentDivider} />
        </View>
      ) : null}
      {!isStay && !isTravel ? (
        <Text variant="muted" className="text-xs uppercase tracking-wide">
          Gap
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
            ) : (
              <View style={styles.visitPlaceRow}>
                {visitPlaceResolving ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : null}
                {visitPlaceLabel ? (
                  <Text
                    className="text-base font-semibold"
                    numberOfLines={1}
                    variant={visitPlaceResolving ? 'muted' : undefined}>
                    {visitPlaceLabel}
                  </Text>
                ) : null}
                {onEditVisitPlaceLabel ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit place label"
                    onPress={onEditVisitPlaceLabel}
                    hitSlop={8}
                    style={styles.visitEditButton}>
                    <Pencil size={14} color={colors.primary} strokeWidth={2.25} />
                  </Pressable>
                ) : null}
              </View>
            )}
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
        <DriveRouteStrip
          startAt={entry.startAt}
          endAt={entry.endAt}
          startLabel={driveStartLabel}
          endLabel={driveEndLabel}
          canEditStartLabel={canEditDriveStartLabel}
          canEditEndLabel={canEditDriveEndLabel}
          onEditStartLabel={onEditDriveStartLabel}
          onEditEndLabel={onEditDriveEndLabel}
          statsLine={driveCardStatsLine(entry, distanceUnit)}
          isPlaying={isPlaying}
          playButtonColor={colors.primary}
          onPlayPress={() => (isPlaying ? onStop() : onPlay())}
        />
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
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    gap: 6,
    marginBottom: 8,
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
    minWidth: 0,
  },
  visitEditButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
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
