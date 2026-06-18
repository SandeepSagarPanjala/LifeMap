import {useEffect, useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {Text} from '@/components/ui/text';

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
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
    }
  }, [initialValue, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={insets.top}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              {paddingBottom: insets.bottom + 16},
            ]}
            bounces={false}>
            <Pressable
              style={styles.sheet}
              onPress={event => event.stopPropagation()}>
              <Text className="text-lg font-semibold">Custom place name</Text>
              <Text variant="muted" className="mt-1 text-sm">
                Enter a label if none of the nearby options fit.
              </Text>
              <TextInput
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
                  style={[styles.button, styles.cancelButton]}>
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
                  ]}>
                  <Text className="font-semibold text-white">Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </ScrollView>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
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
