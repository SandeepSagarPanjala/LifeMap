import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import {
  SettingsGroup,
  SettingsGroupDivider,
  SettingsGroupLabel,
  SettingsIosToggle,
} from '@/components/settings/settings-group';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  cancelAllActivityReminders,
  resyncAllActivityReminders,
} from '@/lib/notifications/activity-reminders';
import { ensureNotificationPermission } from '@/lib/notifications/permissions';
import {
  getActivityNotificationsEnabled,
  getNotificationsMasterEnabled,
  getPlaceNotifyMode,
  setActivityNotificationsEnabled,
  setNotificationsMasterEnabled,
  setPlaceNotifyMode,
} from '@/lib/notifications/settings';
import type { PlaceNotifyMode } from '@/lib/notifications/types';
import { cn } from '@/lib/utils';

function PlaceModeRow({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="min-h-[44px] flex-row items-start gap-3 px-4 py-3 active:opacity-70"
    >
      <View className="flex-1">
        <Text className="text-base">{label}</Text>
        <Text variant="muted" className="mt-0.5 text-sm">
          {description}
        </Text>
      </View>
      {selected ? (
        <Check size={20} color={colors.primary} strokeWidth={2.5} />
      ) : (
        <View className="h-5 w-5" />
      )}
    </Pressable>
  );
}

export function NotificationsSettingsScreen() {
  const colors = useThemeColors();
  const [master, setMaster] = useState(false);
  const [placeMode, setPlaceMode] = useState<PlaceNotifyMode>('unique_place');
  const [activityOn, setActivityOn] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [m, p, a] = await Promise.all([
          getNotificationsMasterEnabled(),
          getPlaceNotifyMode(),
          getActivityNotificationsEnabled(),
        ]);
        if (!cancelled) {
          setMaster(m);
          setPlaceMode(p);
          setActivityOn(a);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMasterChange = useCallback(async (next: boolean) => {
    if (next) {
      const ok = await ensureNotificationPermission();
      if (!ok) {
        Alert.alert(
          'Notifications disabled',
          'Enable notifications for LifeMap in system Settings to continue.',
        );
        setMaster(false);
        return;
      }
    }
    setMaster(next);
    await setNotificationsMasterEnabled(next);
    if (!next) {
      await cancelAllActivityReminders();
      return;
    }
    await resyncAllActivityReminders();
  }, []);

  const handlePlaceMode = useCallback(async (mode: PlaceNotifyMode) => {
    setPlaceMode(mode);
    await setPlaceNotifyMode(mode);
  }, []);

  const handleActivityChange = useCallback(async (next: boolean) => {
    setActivityOn(next);
    await setActivityNotificationsEnabled(next);
    if (!next) {
      await cancelAllActivityReminders();
      return;
    }
    await resyncAllActivityReminders();
  }, []);

  return (
    <SettingsScreenLayout>
      <SettingsIosToggle
        label="Notifications"
        description="Master switch for place prompts and activity reminders."
        value={master}
        onValueChange={value => {
          void handleMasterChange(value);
        }}
        loading={loading}
        disabled={loading}
      />

      {master ? (
        <>
          <SettingsGroupLabel title="Place" />
          <SettingsGroup>
            <PlaceModeRow
              label="New place"
              description="Notify when you arrive at a new place (not Home)."
              selected={placeMode === 'new_place'}
              onPress={() => {
                void handlePlaceMode('new_place');
              }}
            />
            <SettingsGroupDivider />
            <PlaceModeRow
              label="New unique place"
              description="Only the first time you visit a place."
              selected={placeMode === 'unique_place'}
              onPress={() => {
                void handlePlaceMode('unique_place');
              }}
            />
          </SettingsGroup>

          <SettingsGroupLabel title="Activities" />
          <SettingsIosToggle
            label="Activity notifications"
            description="Allow per-activity Notify me reminders (max 5)."
            value={activityOn}
            onValueChange={value => {
              void handleActivityChange(value);
            }}
          />
        </>
      ) : (
        <Text
          variant="muted"
          className={cn('mt-4 text-sm')}
          style={{ color: colors.mutedForeground }}
        >
          Turn on notifications to configure place prompts and activity
          reminders.
        </Text>
      )}
    </SettingsScreenLayout>
  );
}
