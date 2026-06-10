import type {LucideIcon} from 'lucide-react-native';
import {Pressable, StyleSheet, View} from 'react-native';

import {
  CAPTURE_BUTTON_THEMES,
  CAPTURE_ICON_ORB_SIZE,
  CAPTURE_ICON_SIZE,
  type CaptureButtonVariant,
} from './map-capture-button-theme';
import {
  MAP_STACK_BUTTON_RIGHT,
  mapStackButtonStyles,
} from './map-stack-button-styles';

type MapCaptureButtonProps = {
  bottom: number;
  variant: CaptureButtonVariant;
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress: () => void;
};

export function MapCaptureButton({
  bottom,
  variant,
  icon: Icon,
  accessibilityLabel,
  onPress,
}: MapCaptureButtonProps) {
  const theme = CAPTURE_BUTTON_THEMES[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[
        mapStackButtonStyles.button,
        styles.button,
        {
          bottom,
          right: MAP_STACK_BUTTON_RIGHT,
        },
      ]}>
      <View style={[styles.iconOrb, {backgroundColor: theme.badgeBg}]}>
        <Icon size={CAPTURE_ICON_SIZE} color={theme.icon} strokeWidth={2.25} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#FFFFFF',
  },
  iconOrb: {
    width: CAPTURE_ICON_ORB_SIZE,
    height: CAPTURE_ICON_ORB_SIZE,
    borderRadius: CAPTURE_ICON_ORB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
