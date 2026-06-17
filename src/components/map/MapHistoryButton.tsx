import {History} from 'lucide-react-native';
import {Pressable, Text, View} from 'react-native';

import {useThemeColors} from '@/hooks/use-theme-colors';

import {
  MAP_STACK_BUTTON_LEFT,
  mapStackButtonStyles,
} from './map-stack-button-styles';

type MapHistoryButtonProps = {
  bottom: number;
  active: boolean;
  eventCount: number;
  onPress: () => void;
};

export function MapHistoryButton({
  bottom,
  active,
  eventCount,
  onPress,
}: MapHistoryButtonProps) {
  const colors = useThemeColors();
  const badgeLabel = eventCount > 99 ? '99+' : String(eventCount);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        eventCount > 0 ? `Show ${eventCount} history events` : 'Show history'
      }
      onPress={onPress}
      style={[
        mapStackButtonStyles.button,
        {bottom, left: MAP_STACK_BUTTON_LEFT},
        active && mapStackButtonStyles.buttonSoftBlue,
      ]}>
      <History size={22} color={colors.primary} strokeWidth={2.25} />
      {eventCount > 0 ? (
        <View style={mapStackButtonStyles.badge}>
          <Text style={mapStackButtonStyles.badgeText}>{badgeLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
