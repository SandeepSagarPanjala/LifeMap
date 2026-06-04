import {Pressable, View} from 'react-native';

import {Route} from 'lucide-react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  TRIP_DWELL_CHOICES,
  TRIP_GAP_CHOICES,
  TRIP_RADIUS_CHOICES,
} from '@/lib/trip-settings';
import {useAppStore} from '@/stores/app-store';

type ChoiceRowProps<T extends number> = {
  label: string;
  choices: readonly T[];
  selected: T;
  format: (value: T) => string;
  onSelect: (value: T) => void;
};

function ChoiceRow<T extends number>({
  label,
  choices,
  selected,
  format,
  onSelect,
}: ChoiceRowProps<T>) {
  return (
    <View className="mt-3">
      <Text variant="muted" className="text-sm">
        {label}
      </Text>
      <View className="mt-2 flex-row flex-wrap gap-2">
        {choices.map(choice => {
          const active = choice === selected;
          return (
            <Pressable
              key={choice}
              accessibilityRole="button"
              onPress={() => onSelect(choice)}
              className={`rounded-full border px-3 py-1.5 ${
                active ? 'border-primary bg-primary/10' : 'border-border'
              }`}>
              <Text className={active ? 'text-primary text-sm font-medium' : 'text-sm'}>
                {format(choice)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function TripSettings() {
  const colors = useThemeColors();
  const tripGapMinutes = useAppStore(state => state.tripGapMinutes);
  const tripDwellMinutes = useAppStore(state => state.tripDwellMinutes);
  const tripDwellRadiusMeters = useAppStore(state => state.tripDwellRadiusMeters);
  const setTripGapMinutes = useAppStore(state => state.setTripGapMinutes);
  const setTripDwellMinutes = useAppStore(state => state.setTripDwellMinutes);
  const setTripDwellRadiusMeters = useAppStore(state => state.setTripDwellRadiusMeters);

  return (
    <View className="bg-card border-border rounded-2xl border p-4">
      <View className="flex-row items-center gap-3">
        <Icon as={Route} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">Trips</Text>
          <Text variant="muted" className="mt-1 text-sm leading-5">
            Split today&apos;s path into drive and stay trips. A gap ends a trip; staying in one
            place for the dwell time creates a stay trip.
          </Text>
        </View>
      </View>

      <ChoiceRow
        label="Gap ends trip"
        choices={TRIP_GAP_CHOICES}
        selected={tripGapMinutes}
        format={m => `${m} min`}
        onSelect={setTripGapMinutes}
      />
      <ChoiceRow
        label="Stay trip after"
        choices={TRIP_DWELL_CHOICES}
        selected={tripDwellMinutes}
        format={m => `${m} min`}
        onSelect={setTripDwellMinutes}
      />
      <ChoiceRow
        label="Same place radius"
        choices={TRIP_RADIUS_CHOICES}
        selected={tripDwellRadiusMeters}
        format={m => `${m} m`}
        onSelect={setTripDwellRadiusMeters}
      />
    </View>
  );
}
