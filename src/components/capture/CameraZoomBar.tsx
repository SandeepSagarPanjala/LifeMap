import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';

import {
  activeZoomPreset,
  DISPLAY_ZOOM_STEP,
  formatZoomLabel,
  type CameraZoomRange,
} from '@/lib/moments/camera-zoom';

const ACTIVE_COLOR = '#FFD60A';

type CameraZoomBarProps = {
  zoomRange: CameraZoomRange;
  /** Live native zoom factor, driven by the pinch gesture on the UI thread. */
  zoom: SharedValue<number>;
  onSelect: (displayZoom: number) => void;
  disabled?: boolean;
};

export const CameraZoomBar = memo(function CameraZoomBar({
  zoomRange,
  zoom,
  onSelect,
  disabled = false,
}: CameraZoomBarProps) {
  const { presets, baseZoom } = zoomRange;
  const [displayZoom, setDisplayZoom] = useState(1);

  // The readout is the only part of the UI that follows the pinch, and it is
  // kept in this component so zooming never re-renders the capture screen.
  useAnimatedReaction(
    () => {
      'worklet';
      return Math.round(zoom.get() / baseZoom / DISPLAY_ZOOM_STEP);
    },
    (step, previousStep) => {
      'worklet';
      if (step !== previousStep) {
        runOnJS(setDisplayZoom)(step * DISPLAY_ZOOM_STEP);
      }
    },
  );

  if (presets.length < 2) {
    return null;
  }
  const active = activeZoomPreset(displayZoom, presets);

  return (
    <View style={styles.row}>
      {presets.map(preset => {
        const isActive = preset === active;
        return (
          <Pressable
            key={preset}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Zoom to ${formatZoomLabel(preset)}`}
            disabled={disabled}
            onPress={() => onSelect(preset)}
            style={[
              styles.chip,
              isActive ? styles.chipActive : null,
              disabled ? styles.disabled : null,
            ]}
          >
            <Text
              style={[styles.label, isActive ? styles.labelActive : null]}
              numberOfLines={1}
            >
              {/* The active chip doubles as the live readout while pinching. */}
              {isActive ? formatZoomLabel(displayZoom) : formatZoomLabel(preset)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    padding: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  chip: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chipActive: {
    minWidth: 46,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  label: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  labelActive: {
    color: ACTIVE_COLOR,
    fontSize: 13,
  },
  disabled: {
    opacity: 0.5,
  },
});
