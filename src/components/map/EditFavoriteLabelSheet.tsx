import {useEffect, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {BottomSheetTextInput} from '@gorhom/bottom-sheet';

import {Text} from '@/components/ui/text';
import {MAX_SAVED_PLACE_LABEL_LENGTH} from '@/lib/saved-places';

type EditFavoriteLabelPanelProps = {
  initialValue?: string;
  onClose: () => void;
  onSave: (label: string) => void;
};

export function EditFavoriteLabelPanel({
  initialValue = '',
  onClose,
  onSave,
}: EditFavoriteLabelPanelProps) {
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
    <View>
      <Text className="text-lg font-semibold">Rename favorite</Text>
      <Text variant="muted" className="mt-1 text-sm">
        Map pins and visit labels use this name.
      </Text>
      <BottomSheetTextInput
        autoFocus
        value={value}
        onChangeText={setValue}
        placeholder="Favorite name"
        placeholderTextColor="#8E8E93"
        style={styles.input}
        returnKeyType="done"
        maxLength={MAX_SAVED_PLACE_LABEL_LENGTH}
        onSubmitEditing={() => {
          if (canSave) {
            onSave(trimmed);
          }
        }}
      />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel rename"
          onPress={onClose}
          style={[styles.button, styles.cancelButton]}>
          <Text className="font-medium">Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save favorite name"
          disabled={!canSave}
          onPress={() => onSave(trimmed)}
          style={[
            styles.button,
            styles.saveButton,
            !canSave && styles.saveButtonDisabled,
          ]}>
          <Text className="font-semibold text-white">Save</Text>
        </Pressable>
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
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
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
