import LottieView from 'lottie-react-native';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { Pause, Play } from 'lucide-react-native';

import { DriveEndpointPlaceRow } from '@/components/map/DriveEndpointPlaceRow';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { DriveEndpointLabel } from '@/lib/drive-endpoint-label';
import { hasDriveEndpointLabel } from '@/lib/drive-endpoint-label';
import { formatTripTimeRange } from '@/lib/trip-format';

const DRIVE_LOTTIE = require('../../../assets/lottie/drive-car.json');

const PLAY_BUTTON_SIZE = 44;
const CAR_CLIP_WIDTH = 72;
const CAR_CLIP_HEIGHT = 44;
const CAR_RENDER_WIDTH = 210;
const CAR_RENDER_HEIGHT = 120;

type DriveRouteStripProps = {
  startAt: Date;
  endAt: Date;
  startLabel?: DriveEndpointLabel;
  endLabel?: DriveEndpointLabel;
  canEditStartLabel?: boolean;
  canEditEndLabel?: boolean;
  onEditStartLabel?: () => void;
  onEditEndLabel?: () => void;
  statsLine: string;
  isPlaying: boolean;
  playButtonColor: string;
  onPlayPress: () => void;
};

function DriveCarLottie() {
  return (
    <View style={styles.carClip}>
      <LottieView
        source={DRIVE_LOTTIE}
        autoPlay
        loop
        style={styles.carLottie}
      />
    </View>
  );
}

function TimeRangeLine({ startAt, endAt }: { startAt: Date; endAt: Date }) {
  return (
    <Text style={styles.timeRange}>{formatTripTimeRange(startAt, endAt)}</Text>
  );
}

function DriveRouteEndpoint({
  label,
  canEdit,
  onEdit,
}: {
  label?: DriveEndpointLabel;
  canEdit?: boolean;
  onEdit?: () => void;
}) {
  const colors = useThemeColors();
  const hasText = label != null && hasDriveEndpointLabel(label);
  const editable = Boolean(canEdit && onEdit);
  if (!hasText && !editable) {
    return null;
  }

  const textStyle = editable
    ? [styles.routeText, { color: colors.primary }]
    : styles.routeText;

  const content = hasText ? (
    <DriveEndpointPlaceRow
      label={label!}
      iconSize={14}
      textStyle={textStyle}
      numberOfLines={1}
      ellipsizeMode="tail"
    />
  ) : (
    <RNText style={textStyle} numberOfLines={1}>
      Add label
    </RNText>
  );

  if (editable) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit place label"
        onPress={onEdit}
        hitSlop={8}
        style={styles.routeEndpoint}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={styles.routeEndpoint}>{content}</View>;
}

function DriveRouteLine({
  startLabel,
  endLabel,
  canEditStartLabel,
  canEditEndLabel,
  onEditStartLabel,
  onEditEndLabel,
}: {
  startLabel?: DriveEndpointLabel;
  endLabel?: DriveEndpointLabel;
  canEditStartLabel?: boolean;
  canEditEndLabel?: boolean;
  onEditStartLabel?: () => void;
  onEditEndLabel?: () => void;
}) {
  const hasStart =
    (startLabel != null && hasDriveEndpointLabel(startLabel)) ||
    canEditStartLabel;
  const hasEnd =
    (endLabel != null && hasDriveEndpointLabel(endLabel)) || canEditEndLabel;

  if (!hasStart && !hasEnd) {
    return null;
  }

  return (
    <View style={styles.routeRow}>
      {hasStart ? (
        <DriveRouteEndpoint
          label={startLabel}
          canEdit={canEditStartLabel}
          onEdit={onEditStartLabel}
        />
      ) : null}
      {hasStart && hasEnd ? (
        <RNText style={styles.routeArrow} accessibilityLabel="to">
          →
        </RNText>
      ) : null}
      {hasEnd ? (
        <DriveRouteEndpoint
          label={endLabel}
          canEdit={canEditEndLabel}
          onEdit={onEditEndLabel}
        />
      ) : null}
    </View>
  );
}

export function DriveRouteStrip({
  startAt,
  endAt,
  startLabel,
  endLabel,
  canEditStartLabel = false,
  canEditEndLabel = false,
  onEditStartLabel,
  onEditEndLabel,
  statsLine,
  isPlaying,
  playButtonColor,
  onPlayPress,
}: DriveRouteStripProps) {
  const hasLabels =
    (startLabel != null && hasDriveEndpointLabel(startLabel)) ||
    (endLabel != null && hasDriveEndpointLabel(endLabel));
  const showRouteRow = hasLabels || canEditStartLabel || canEditEndLabel;

  return (
    <View style={styles.wrap}>
      {showRouteRow ? (
        <DriveRouteLine
          startLabel={startLabel}
          endLabel={endLabel}
          canEditStartLabel={canEditStartLabel}
          canEditEndLabel={canEditEndLabel}
          onEditStartLabel={onEditStartLabel}
          onEditEndLabel={onEditEndLabel}
        />
      ) : (
        <RNText style={styles.routeFallback} numberOfLines={1}>
          {formatTripTimeRange(startAt, endAt)}
        </RNText>
      )}

      <View style={styles.footerRow}>
        <View style={styles.carColumn}>
          <DriveCarLottie />
        </View>

        <View style={styles.detailsColumn}>
          <TimeRangeLine startAt={startAt} endAt={endAt} />
          <Text variant="muted" className="text-center text-sm">
            {statsLine}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Stop playback' : 'Play on map'}
          onPress={onPlayPress}
          style={[styles.playButton, { backgroundColor: playButtonColor }]}
        >
          {isPlaying ? (
            <Pause size={20} color="#FFFFFF" fill="#FFFFFF" />
          ) : (
            <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 4,
    minHeight: 68,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minWidth: 0,
    gap: 10,
  },
  routeEndpoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '46%',
  },
  routeText: {
    fontSize: 15,
    fontWeight: '600',
  },
  routeArrow: {
    flexShrink: 0,
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 2,
  },
  routeFallback: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    width: '100%',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  carColumn: {
    width: CAR_CLIP_WIDTH,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carClip: {
    width: CAR_CLIP_WIDTH,
    height: CAR_CLIP_HEIGHT,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  carLottie: {
    width: CAR_RENDER_WIDTH,
    height: CAR_RENDER_HEIGHT,
    marginTop: -38,
    transform: [{ scaleX: -1 }],
  },
  detailsColumn: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRange: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  playButton: {
    width: PLAY_BUTTON_SIZE,
    height: PLAY_BUTTON_SIZE,
    borderRadius: PLAY_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
