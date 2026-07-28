import { useEffect, useState, type ComponentRef, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Check, X } from 'lucide-react-native';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MAP_STACK_BUTTON_SIZE,
  MAX_SAVED_PLACE_LABEL_LENGTH,
} from '@/lib/app-constants';
import { useThemeColors } from '@/hooks/use-theme-colors';

type EditFavoriteLabelPanelProps = {
  initialValue?: string;
  inputRef?: RefObject<ComponentRef<typeof BottomSheetTextInput> | null>;
  onClose: () => void;
  onSave: (label: string) => void;
};

export function EditFavoriteLabelPanel({
  initialValue = '',
  inputRef,
  onClose,
  onSave,
}: EditFavoriteLabelPanelProps) {
  const colors = useThemeColors();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const trimmed = value.trim();
  const canSave =
    trimmed.length > 0 &&
    trimmed.length <= MAX_SAVED_PLACE_LABEL_LENGTH &&
    trimmed !== initialValue.trim();

  return (
    <View accessibilityLabel="Rename favorite">
      <Text className="text-lg font-semibold">Rename favorite</Text>
      <Text variant="muted" className="mt-1 text-sm">
        Map pins and visit labels use this name.
      </Text>
      <BottomSheetTextInput
        ref={inputRef}
        value={value}
        onChangeText={setValue}
        placeholder="Favorite name"
        placeholderTextColor="#8E8E93"
        style={styles.input}
        returnKeyType="done"
        maxLength={MAX_SAVED_PLACE_LABEL_LENGTH}
        accessibilityLabel="Renamed favorite name"
        onSubmitEditing={() => {
          if (canSave) {
            onSave(trimmed);
          }
        }}
      />

      <View
        pointerEvents="box-none"
        style={[styles.barWrap, { paddingBottom: MAP_MOMENTS_BAR_GAP }]}
      >
        <View style={styles.barRow}>
          <View style={styles.shadowWrap}>
            <AdaptiveGlassSurface style={styles.pill}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save favorite name"
                disabled={!canSave}
                onPress={() => onSave(trimmed)}
                style={[
                  styles.savePressable,
                  !canSave ? styles.savePressableDisabled : null,
                ]}
              >
                <Check size={16} color={colors.primary} strokeWidth={2.5} />
                <Text style={[styles.saveLabel, { color: colors.primary }]}>
                  Save
                </Text>
              </Pressable>
            </AdaptiveGlassSurface>
          </View>

          <MapGlassCircleButton
            accessibilityLabel="Close"
            onPress={onClose}
            style={styles.closeButton}
          >
            <X size={20} color={colors.primary} strokeWidth={2.25} />
          </MapGlassCircleButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  barWrap: {
    marginTop: 20,
    alignItems: 'center',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MAP_MOMENTS_SIDE_BTN_GAP,
  },
  shadowWrap: {
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
    }),
  },
  pill: {
    height: MAP_MOMENTS_BAR_HEIGHT,
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  savePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: MAP_MOMENTS_BAR_HEIGHT,
    paddingHorizontal: 18,
  },
  savePressableDisabled: {
    opacity: 0.4,
  },
  saveLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  closeButton: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
  },
});
