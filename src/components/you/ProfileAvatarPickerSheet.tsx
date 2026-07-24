import { Pressable, StyleSheet, View } from 'react-native';

import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { AVATAR_CATALOG } from '@/lib/profile/avatar-catalog';

type ProfileAvatarPickerSheetProps = {
  visible: boolean;
  selectedId: string;
  onClose: () => void;
  onSelect: (avatarId: string) => void;
};

export function ProfileAvatarPickerSheet({
  visible,
  selectedId,
  onClose,
  onSelect,
}: ProfileAvatarPickerSheetProps) {
  const colors = useThemeColors();

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      scrollable
      snapPoints={['55%']}
    >
      <Text className="text-lg font-semibold">Choose avatar</Text>
      <Text variant="muted" className="mt-1 mb-4 text-sm">
        More styles coming later — pick one for now.
      </Text>
      <View style={styles.grid}>
        {AVATAR_CATALOG.map(entry => {
          const selected = entry.id === selectedId;
          const Icon = entry.Icon;
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={entry.label}
              onPress={() => onSelect(entry.id)}
              style={[
                styles.cell,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.accent : colors.card,
                },
              ]}
            >
              <Icon
                size={28}
                color={selected ? colors.primary : colors.foreground}
                weight={selected ? 'duotone' : 'regular'}
              />
            </Pressable>
          );
        })}
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
