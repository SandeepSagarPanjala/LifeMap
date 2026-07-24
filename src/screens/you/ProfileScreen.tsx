import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfileAvatarPickerSheet } from '@/components/you/ProfileAvatarPickerSheet';
import { ProfileEditSheet } from '@/components/you/ProfileEditSheet';
import { Text } from '@/components/ui/text';
import { useProfile } from '@/hooks/use-profile';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { getAvatar } from '@/lib/profile/avatar-catalog';
import { formatFriendCode } from '@/lib/profile/friend-code';
import { PROFILE_GENDER_ICONS } from '@/lib/profile/gender-icons';
import { type ProfileGender } from '@/lib/profile/types';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';

const AVATAR_SIZE = 120;

export function ProfileScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { profile, loading, updateProfile } = useProfile();
  const [editOpen, setEditOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const bottomPad =
    Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) + MAP_MOMENTS_BAR_HEIGHT + 24;

  const avatar = getAvatar(profile?.avatarId);
  const AvatarIcon = avatar.Icon;
  const genderMeta = profile?.gender
    ? PROFILE_GENDER_ICONS[profile.gender]
    : null;
  const GenderIcon = genderMeta?.Icon;
  const nameLocked = Boolean(profile?.displayName);
  const genderLocked = Boolean(profile?.gender);
  const identityLocked = nameLocked && genderLocked;

  const onSaveEdit = useCallback(
    async (next: {
      displayName: string | null;
      gender: ProfileGender | null;
    }) => {
      await updateProfile({
        displayName: next.displayName,
        gender: next.gender,
      });
      setEditOpen(false);
    },
    [updateProfile],
  );

  const onSelectAvatar = useCallback(
    async (avatarId: string) => {
      await updateProfile({ avatarId });
      setAvatarOpen(false);
    },
    [updateProfile],
  );

  const onPressName = useCallback(() => {
    if (identityLocked) {
      Alert.alert(
        'Can’t change this',
        'Your first name or nickname and gender are already set and can’t be changed.',
      );
      return;
    }
    setEditOpen(true);
  }, [identityLocked]);

  if (loading && !profile) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 28,
          paddingBottom: bottomPad,
        },
      ]}
    >
      <View style={styles.hero}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change avatar"
          onPress={() => setAvatarOpen(true)}
          style={[
            styles.avatarRing,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        >
          <AvatarIcon size={56} color={colors.primary} weight="duotone" />
        </Pressable>

        <View style={styles.identityBlock}>
          {profile?.friendCode ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Friend code ${profile.friendCode}`}
              onPress={() => {
                Alert.alert(
                  'Your code',
                  `${formatFriendCode(profile.friendCode)}\n\nShare this 8-digit code so friends can find you later. Your private ID stays on this device.`,
                );
              }}
              hitSlop={8}
            >
              <Text
                style={[styles.friendCode, { color: colors.mutedForeground }]}
              >
                {formatFriendCode(profile.friendCode)}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              identityLocked ? 'Name and gender are locked' : 'Edit profile'
            }
            onPress={onPressName}
            hitSlop={8}
            style={styles.nameHit}
          >
            <View style={styles.nameRow}>
              {GenderIcon ? (
                <GenderIcon
                  size={22}
                  color={colors.primary}
                  weight="duotone"
                />
              ) : null}
              <Text
                style={[
                  styles.name,
                  {
                    color: profile?.displayName
                      ? colors.foreground
                      : colors.mutedForeground,
                  },
                ]}
              >
                {profile?.displayName
                  ? profile.displayName.toUpperCase()
                  : 'Add Name'}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <ProfileEditSheet
        visible={editOpen}
        initialName={profile?.displayName ?? ''}
        initialGender={profile?.gender ?? null}
        nameLocked={nameLocked}
        genderLocked={genderLocked}
        onClose={() => setEditOpen(false)}
        onSave={next => {
          void onSaveEdit(next);
        }}
      />
      <ProfileAvatarPickerSheet
        visible={avatarOpen}
        selectedId={profile?.avatarId ?? avatar.id}
        onClose={() => setAvatarOpen(false)}
        onSelect={id => {
          void onSelectAvatar(id);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: 12,
  },
  identityBlock: {
    alignItems: 'center',
    gap: 4,
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendCode: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  nameHit: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
    includeFontPadding: false,
  },
});
