import {MapPin} from 'lucide-react-native';
import {View} from 'react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {
  DEFAULT_TRIP_DWELL_MINUTES,
  HISTORY_SAME_PLACE_RADIUS_METERS,
  MIN_TRIP_STOP_MINUTES,
  SAVED_PLACE_MIN_DWELL_MINUTES,
} from '@/lib/trip-settings';
import {useThemeColors} from '@/hooks/use-theme-colors';

function ReadOnlyRow({label, value}: {label: string; value: string}) {
  return (
    <View className="border-border mt-3 flex-row items-center justify-between border-t pt-3">
      <Text variant="muted" className="text-sm">
        {label}
      </Text>
      <Text className="text-sm font-semibold">{value}</Text>
    </View>
  );
}

export function HistoryDetectionSettings() {
  const colors = useThemeColors();

  return (
    <View className="bg-card border-border rounded-2xl border p-4">
      <View className="flex-row items-center gap-3">
        <Icon as={MapPin} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">History & visits</Text>
          <Text variant="muted" className="mt-1 text-sm leading-5">
            How LifeMap groups your day into orange visits and blue drives on the map.
          </Text>
        </View>
      </View>

      <ReadOnlyRow
        label="Saved place visit"
        value={`${SAVED_PLACE_MIN_DWELL_MINUTES} min`}
      />
      <ReadOnlyRow
        label="Other place visit"
        value={`${DEFAULT_TRIP_DWELL_MINUTES} min`}
      />
      <ReadOnlyRow
        label="Same place radius"
        value={`${HISTORY_SAME_PLACE_RADIUS_METERS} m`}
      />
      <ReadOnlyRow
        label="Short stop on a drive"
        value={`${MIN_TRIP_STOP_MINUTES} min`}
      />

      <Text variant="muted" className="mt-3 text-xs leading-4">
        Saved places (Home, Work, favorites) count as a visit from{' '}
        {SAVED_PLACE_MIN_DWELL_MINUTES} minute. Other places need at least{' '}
        {DEFAULT_TRIP_DWELL_MINUTES} minutes within {HISTORY_SAME_PLACE_RADIUS_METERS}{' '}
        m. Shorter stops during a drive (food, charger) can count from{' '}
        {MIN_TRIP_STOP_MINUTES} minutes. Trips are the path between visits.
      </Text>
    </View>
  );
}
