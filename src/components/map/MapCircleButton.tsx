import type {ReactNode} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {MAP_STACK_BUTTON_SIZE} from '@/screens/map/map-screen-constants';
import {CAPTURE_BUTTON_THEMES} from '@/components/map/map-capture-button-theme';

const MAP_SOFT_RED_CLOSE_BG = '#FFE8E6';
const MAP_SOFT_RED_CLOSE_PRESSED = '#FFD4CF';
const CAPTURE_THEME = CAPTURE_BUTTON_THEMES.camera;
const CAPTURE_PRESSED_BG = '#E3EEFC';

type MapCircleButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
  variant?: 'white' | 'softRed' | 'capture';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function MapCircleButton({
  accessibilityLabel,
  onPress,
  disabled = false,
  size = MAP_STACK_BUTTON_SIZE,
  variant = 'white',
  style,
  children,
}: MapCircleButtonProps) {
  const isSoftRed = variant === 'softRed';
  const isCapture = variant === 'capture';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}>
      {({pressed}) => (
        <View
          style={[
            styles.circle,
            isCapture && styles.captureCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: isSoftRed
                ? pressed
                  ? MAP_SOFT_RED_CLOSE_PRESSED
                  : MAP_SOFT_RED_CLOSE_BG
                : isCapture
                  ? pressed
                    ? CAPTURE_PRESSED_BG
                    : CAPTURE_THEME.badgeBg
                  : pressed
                    ? '#F2F2F7'
                    : '#FFFFFF',
              borderColor: isSoftRed
                ? '#FFCCC7'
                : isCapture
                  ? CAPTURE_THEME.badgeBg
                  : '#E5E5EA',
              opacity: disabled ? 0.5 : 1,
            },
            style,
          ]}>
          {children}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  captureCircle: {
    borderWidth: 0,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
});
