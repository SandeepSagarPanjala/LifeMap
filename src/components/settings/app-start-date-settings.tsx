import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { CalendarRange } from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import { format } from 'date-fns';
import { parseDateKey } from '@/lib/day-utils';
import { setAppStartDateFromEarliestLocationPoints } from '@/lib/history-calendar-bounds';
import { useThemeColors } from '@/hooks/use-theme-colors';

/**
 * Developer: set calendar floor (app start date) from earliest GPS day.
 */
export function AppStartDateSettings() {
  const colors = useThemeColors();
  const [busy, setBusy] = useState(false);

  const runSet = useCallback(async () => {
    setBusy(true);
    try {
      const result = await setAppStartDateFromEarliestLocationPoints();
      const label = format(parseDateKey(result.dateKey), 'MMM d, yyyy');
      Alert.alert(
        'App start date saved',
        result.fromGps
          ? `Calendar now starts on ${label} (earliest location_points day). Dates before that are disabled.`
          : `No GPS rows found — calendar start set to today (${label}).`,
      );
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotSaveAppStartDate,
        errorMessageOr(error),
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const confirm = () => {
    Alert.alert(
      'Set app start date from GPS?',
      'Saves the earliest day in location_points as the app start date. The map calendar will disable every day before that.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => {
            void runSet();
          },
        },
      ],
    );
  };

  return (
    <View className="bg-card border-border mt-2 rounded-xl border px-4 py-4">
      <View className="flex-row items-center gap-3">
        <Icon as={CalendarRange} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">App start date</Text>
          <Text variant="muted" className="mt-1 text-sm leading-5">
            Set calendar floor from the first GPS day in location_points.
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={confirm}
        className={`bg-primary mt-4 items-center rounded-full px-4 py-3 ${
          busy ? 'opacity-50' : ''
        }`}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-primary-foreground font-medium">
            Save start date from GPS
          </Text>
        )}
      </Pressable>
    </View>
  );
}
