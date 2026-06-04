import {MapPin} from 'lucide-react-native';
import {Pressable, View} from 'react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {
  formatTripDwellLabel,
  formatTripRadiusLabel,
  TRIP_DWELL_CHOICES,
  TRIP_RADIUS_CHOICES,
  type TripDwellMinutes,
  type TripRadiusMeters,
} from '@/lib/trip-settings';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {useAppStore} from '@/stores/app-store';

type ChoiceRowProps<T extends number> = {
  label: string;
  choices: readonly T[];
  selected: T;
  formatChoice: (value: T) => string;
  onSelect: (value: T) => void;
};

function ChoiceRow<T extends number>({
  label,
  choices,
  selected,
  formatChoice,
  onSelect,
}: ChoiceRowProps<T>) {
  return (
    <View className="mt-4">
      <Text className="font-medium">{label}</Text>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {choices.map(choice => {
          const active = choice === selected;
          return (
            <Pressable
              key={choice}
              accessibilityRole="button"
              accessibilityState={{selected: active}}
              onPress={() => onSelect(choice)}
              className={`rounded-full border px-3 py-2 ${
                active ? 'border-primary bg-primary/10' : 'border-border'
              }`}>
              <Text
                className={`text-sm ${active ? 'text-primary font-semibold' : 'font-medium'}`}>
                {formatChoice(choice)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function HistoryDetectionSettings() {
  const colors = useThemeColors();
  const tripDwellMinutes = useAppStore(state => state.tripDwellMinutes);
  const tripDwellRadiusMeters = useAppStore(state => state.tripDwellRadiusMeters);
  const setTripDwellMinutes = useAppStore(state => state.setTripDwellMinutes);
  const setTripDwellRadiusMeters = useAppStore(state => state.setTripDwellRadiusMeters);

  return (
    <View className="bg-card border-border rounded-2xl border p-4">
      <View className="flex-row items-center gap-3">
        <Icon as={MapPin} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">History & visits</Text>
          <Text variant="muted" className="mt-1 text-sm leading-5">
            Controls how LifeMap groups your day into visits (orange) and trips (blue) on the map
            history bar.
          </Text>
        </View>
      </View>

      <ChoiceRow<TripDwellMinutes>
        label="Visit duration (same place)"
        choices={TRIP_DWELL_CHOICES}
        selected={tripDwellMinutes}
        formatChoice={formatTripDwellLabel}
        onSelect={setTripDwellMinutes}
      />

      <ChoiceRow<TripRadiusMeters>
        label="Same place radius"
        choices={TRIP_RADIUS_CHOICES}
        selected={tripDwellRadiusMeters}
        formatChoice={formatTripRadiusLabel}
        onSelect={setTripDwellRadiusMeters}
      />

      <Text variant="muted" className="mt-4 text-xs leading-4">
        A visit needs at least this long at one place. Trips are the saves from when you leave
        until the next visit starts. Time gaps at the same place still count as one visit.
      </Text>
    </View>
  );
}
