import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { PROFILE_GENDER_ICONS } from '@/lib/profile/gender-icons';
import {
  sanitizeDisplayNameInput,
  isValidDisplayName,
} from '@/lib/profile/display-name';
import {
  PROFILE_GENDER_OPTIONS,
  type ProfileGender,
} from '@/lib/profile/types';

type ProfileEditSheetProps = {
  visible: boolean;
  initialName: string;
  initialGender: ProfileGender | null;
  /** Once set, name cannot be edited again. */
  nameLocked: boolean;
  /** Once set, gender cannot be edited again. */
  genderLocked: boolean;
  onClose: () => void;
  onSave: (next: {
    displayName: string | null;
    gender: ProfileGender | null;
  }) => void;
};

export function ProfileEditSheet({
  visible,
  initialName,
  initialGender,
  nameLocked,
  genderLocked,
  onClose,
  onSave,
}: ProfileEditSheetProps) {
  const colors = useThemeColors();
  const [name, setName] = useState(initialName);
  const [gender, setGender] = useState<ProfileGender | null>(initialGender);

  useEffect(() => {
    if (visible) {
      setName(sanitizeDisplayNameInput(initialName));
      setGender(initialGender);
    }
  }, [initialGender, initialName, visible]);

  const confirmAndSave = () => {
    const cleaned = sanitizeDisplayNameInput(name);
    const nextName = nameLocked
      ? sanitizeDisplayNameInput(initialName) || null
      : cleaned.length > 0
        ? cleaned
        : null;
    const nextGender = genderLocked ? initialGender : gender;

    if (!nameLocked && (!nextName || !isValidDisplayName(nextName))) {
      Alert.alert(
        'Add a name',
        'Use 1–12 letters only — no spaces, numbers, or emoji.',
      );
      return;
    }
    if (!genderLocked && !nextGender) {
      Alert.alert('Choose a gender', 'Pick a gender icon before saving.');
      return;
    }

    Alert.alert(
      'Save for good?',
      'Your first name or nickname and gender can only be set once. After you save, they can’t be changed — double-check they’re right.',
      [
        { text: 'Go back', style: 'cancel' },
        {
          text: 'Save',
          style: 'destructive',
          onPress: () => {
            onSave({
              displayName: nextName,
              gender: nextGender,
            });
          },
        },
      ],
    );
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose} enableDynamicSizing>
      <Text className="text-lg font-semibold">Edit profile</Text>
      <Text variant="muted" className="mt-1 text-sm">
        {nameLocked && genderLocked
          ? 'Name and gender are locked.'
          : 'Name and gender can only be set once.'}
      </Text>

      <Text className="mt-4 text-sm font-medium">First name or nickname</Text>
      <BottomSheetTextInput
        autoFocus={!nameLocked}
        editable={!nameLocked}
        value={name}
        onChangeText={text => setName(sanitizeDisplayNameInput(text))}
        placeholder="Letters only, max 12"
        placeholderTextColor={colors.mutedForeground}
        maxLength={12}
        autoCapitalize="words"
        autoCorrect={false}
        style={[
          styles.input,
          {
            color: colors.foreground,
            borderColor: colors.border,
            backgroundColor: colors.card,
            opacity: nameLocked ? 0.55 : 1,
          },
        ]}
        returnKeyType="done"
      />
      {nameLocked ? (
        <Text variant="muted" className="mt-1 text-xs">
          Name is locked and can’t be changed.
        </Text>
      ) : (
        <Text variant="muted" className="mt-1 text-xs">
          Letters only — no spaces, numbers, or emoji ({name.length}/12)
        </Text>
      )}

      <Text className="mt-4 text-sm font-medium">Gender</Text>
      <View style={styles.chips}>
        {PROFILE_GENDER_OPTIONS.map(option => {
          const selected = gender === option.value;
          const { Icon, label } = PROFILE_GENDER_ICONS[option.value];
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: genderLocked }}
              accessibilityLabel={label}
              disabled={genderLocked}
              onPress={() => {
                if (genderLocked) {
                  return;
                }
                setGender(current =>
                  current === option.value ? null : option.value,
                );
              }}
              style={[
                styles.chip,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.accent : colors.card,
                  opacity: genderLocked && !selected ? 0.4 : 1,
                },
              ]}
            >
              <Icon
                size={22}
                color={selected ? colors.primary : colors.foreground}
                weight="duotone"
              />
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  fontWeight: selected ? '600' : '500',
                  color: selected ? colors.primary : colors.mutedForeground,
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {genderLocked ? (
        <Text variant="muted" className="mt-1 text-xs">
          Gender is locked and can’t be changed.
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onClose}
          style={[styles.button, { backgroundColor: colors.card }]}
        >
          <Text className="font-medium">Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save profile"
          disabled={nameLocked && genderLocked}
          onPress={confirmAndSave}
          style={[
            styles.button,
            {
              backgroundColor: colors.primary,
              opacity: nameLocked && genderLocked ? 0.45 : 1,
            },
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
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  chips: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
  },
});
