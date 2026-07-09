import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

import { Text } from '@/components/ui/text';
import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';

type VisitPlaceCustomLabelSheetProps = {
  visible: boolean;
  initialValue?: string;
  onClose: () => void;
  onSave: (label: string) => void;
};

export function VisitPlaceCustomLabelSheet({
  visible,
  initialValue = '',
  onClose,
  onSave,
}: VisitPlaceCustomLabelSheetProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [initialValue, visible]);

  return (
    <AppBottomSheet visible={visible} onClose={onClose} enableDynamicSizing>
      <Text className="text-lg font-semibold">Custom place name</Text>
      <Text variant="muted" className="mt-1 text-sm">
        Enter a label if none of the nearby options fit.
      </Text>
      <BottomSheetTextInput
        autoFocus
        value={value}
        onChangeText={setValue}
        placeholder="e.g. Client office"
        placeholderTextColor="#8E8E93"
        style={styles.input}
        returnKeyType="done"
        onSubmitEditing={() => {
          const trimmed = value.trim();
          if (trimmed) {
            onSave(trimmed);
          }
        }}
      />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel custom label"
          onPress={onClose}
          style={[styles.button, styles.cancelButton]}
        >
          <Text className="font-medium">Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save custom label"
          disabled={!value.trim()}
          onPress={() => onSave(value.trim())}
          style={[
            styles.button,
            styles.saveButton,
            !value.trim() && styles.saveButtonDisabled,
          ]}
        >
          <Text className="font-semibold text-white">Save</Text>
        </Pressable>
      </View>
    </AppBottomSheet>
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
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 4,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  saveButton: {
    backgroundColor: '#6B4EFF',
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
});
