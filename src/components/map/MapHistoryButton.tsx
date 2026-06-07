import {History} from 'lucide-react-native';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {useThemeColors} from '@/hooks/use-theme-colors';

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
        styles.button,
        {bottom},
        active && [styles.buttonActive, {borderColor: colors.primary}],
      ]}>
      <History size={22} color={colors.primary} strokeWidth={2.25} />
      {eventCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonActive: {
    borderWidth: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
