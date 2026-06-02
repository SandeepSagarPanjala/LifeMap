import {MapPinned, Ruler} from 'lucide-react-native';
import {Platform, Pressable, View} from 'react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {useAppStore, type DistanceUnit, type PreferredMapApp} from '@/stores/app-store';

type Choice<T extends string> = {
  id: T;
  label: string;
};

const DISTANCE_CHOICES: Choice<DistanceUnit>[] = [
  {id: 'km', label: 'Kilometers'},
  {id: 'mi', label: 'Miles'},
];

const MAP_APP_CHOICES: Choice<PreferredMapApp>[] = [
  {id: 'apple', label: 'Apple Maps'},
  {id: 'google', label: 'Google Maps'},
];

type SegmentedProps<T extends string> = {
  choices: Choice<T>[];
  selected: T;
  onSelect: (value: T) => void;
};

function Segmented<T extends string>({choices, selected, onSelect}: SegmentedProps<T>) {
  return (
    <View className="bg-muted mt-3 flex-row rounded-xl p-1">
      {choices.map(choice => {
        const active = choice.id === selected;
        return (
          <Pressable
            key={choice.id}
            accessibilityRole="button"
            onPress={() => onSelect(choice.id)}
            className={`flex-1 rounded-lg px-3 py-2 ${active ? 'bg-card border-border border' : ''}`}>
            <Text className={`text-center text-sm ${active ? 'font-semibold' : 'text-muted-foreground'}`}>
              {choice.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PreferencesSettings() {
  const colors = useThemeColors();
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const preferredMapApp = useAppStore(state => state.preferredMapApp);
  const setDistanceUnit = useAppStore(state => state.setDistanceUnit);
  const setPreferredMapApp = useAppStore(state => state.setPreferredMapApp);

  return (
    <View className="bg-card border-border rounded-2xl border p-4">
      <Text className="font-medium">Display & map preferences</Text>

      <View className="mt-4">
        <View className="flex-row items-center gap-2">
          <Icon as={Ruler} size={18} color={colors.primary} />
          <Text className="font-medium">Distance unit</Text>
        </View>
        <Segmented choices={DISTANCE_CHOICES} selected={distanceUnit} onSelect={setDistanceUnit} />
      </View>

      <View className="mt-5">
        <View className="flex-row items-center gap-2">
          <Icon as={MapPinned} size={18} color={colors.primary} />
          <Text className="font-medium">Preferred maps app</Text>
        </View>
        <Segmented choices={MAP_APP_CHOICES} selected={preferredMapApp} onSelect={setPreferredMapApp} />
        {Platform.OS === 'ios' ? (
          <Text variant="muted" className="mt-2 text-xs leading-4">
            In-app map view uses Apple Maps on iOS for now.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
