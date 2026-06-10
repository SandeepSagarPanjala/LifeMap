import LottieView from 'lottie-react-native';
import {Pressable, StyleSheet, Text as RNText, View} from 'react-native';
import {Pause, Play} from 'lucide-react-native';

import {DriveEndpointPlaceRow} from '@/components/map/DriveEndpointPlaceRow';
import {Text} from '@/components/ui/text';
import type {DriveEndpointLabel} from '@/lib/drive-endpoint-label';
import {hasDriveEndpointLabel} from '@/lib/drive-endpoint-label';
import {HISTORY_COLORS} from '@/lib/history-timeline';
import {formatTripClockTime, formatTripTimeRange} from '@/lib/trip-format';

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

function TimeColumn({
  caption,
  time,
}: {
  caption: 'Start' | 'Finish';
  time: Date;
}) {
  return (
    <View style={styles.timeColumn}>
      <Text style={styles.timeCaption}>{caption}</Text>
      <Text style={styles.timeValue}>{formatTripClockTime(time)}</Text>
    </View>
  );
}

function DriveRouteLine({
  startLabel,
  endLabel,
}: {
  startLabel?: DriveEndpointLabel;
  endLabel?: DriveEndpointLabel;
}) {
  const hasStart = startLabel != null && hasDriveEndpointLabel(startLabel);
  const hasEnd = endLabel != null && hasDriveEndpointLabel(endLabel);

  if (!hasStart && !hasEnd) {
    return null;
  }

  return (
    <View style={styles.routeRow}>
      {hasStart ? (
        <View style={styles.routeEndpoint}>
          <DriveEndpointPlaceRow
            label={startLabel!}
            iconSize={14}
            textStyle={styles.routeText}
            numberOfLines={1}
            ellipsizeMode="tail"
          />
        </View>
      ) : null}
      {hasStart && hasEnd ? (
        <RNText style={styles.routeArrow} accessibilityLabel="to">
          →
        </RNText>
      ) : null}
      {hasEnd ? (
        <View style={styles.routeEndpoint}>
          <DriveEndpointPlaceRow
            label={endLabel!}
            iconSize={14}
            textStyle={styles.routeText}
            numberOfLines={1}
            ellipsizeMode="tail"
          />
        </View>
      ) : null}
    </View>
  );
}

export function DriveRouteStrip({
  startAt,
  endAt,
  startLabel,
  endLabel,
  statsLine,
  isPlaying,
  playButtonColor,
  onPlayPress,
}: DriveRouteStripProps) {
  const hasLabels =
    (startLabel != null && hasDriveEndpointLabel(startLabel)) ||
    (endLabel != null && hasDriveEndpointLabel(endLabel));

  return (
    <View style={styles.wrap}>
      {hasLabels ? (
        <DriveRouteLine startLabel={startLabel} endLabel={endLabel} />
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
          <View style={styles.timesRow}>
            <TimeColumn caption="Start" time={startAt} />
            <View style={styles.timeDivider} />
            <TimeColumn caption="Finish" time={endAt} />
          </View>
          <Text variant="muted" className="text-center text-sm">
            {statsLine}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Stop playback' : 'Play on map'}
          onPress={onPlayPress}
          style={[styles.playButton, {backgroundColor: playButtonColor}]}>
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
    gap: 8,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minWidth: 0,
    gap: 8,
  },
  routeEndpoint: {
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
    transform: [{scaleX: -1}],
  },
  detailsColumn: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 16,
  },
  timeColumn: {
    minWidth: 0,
    alignItems: 'center',
  },
  timeCaption: {
    fontSize: 10,
    fontWeight: '700',
    color: HISTORY_COLORS.travel,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timeValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  timeDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: '#E5E5EA',
    marginVertical: 2,
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
