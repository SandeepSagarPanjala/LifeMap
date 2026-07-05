import {Pressable, StyleSheet, View} from 'react-native';
import {X} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';

type ProgressStripProps = {
  message: string;
  onDismiss?: () => void;
};

export function ProgressStrip({message, onDismiss}: ProgressStripProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, {paddingBottom: Math.max(insets.bottom, 8)}]}>
      <View
        style={[
          styles.strip,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}>
        <Text className="flex-1 text-sm" numberOfLines={1}>
          {message}
        </Text>
        {onDismiss ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop"
            hitSlop={8}
            onPress={onDismiss}
            style={styles.dismiss}>
            <X size={16} color={colors.mutedForeground} strokeWidth={2.25} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    zIndex: 50,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: -2},
    elevation: 4,
  },
  dismiss: {
    padding: 2,
  },
});
