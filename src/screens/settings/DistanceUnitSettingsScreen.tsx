import { View } from 'react-native';

import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import {
  SettingsCheckRow,
  SettingsGroup,
  SettingsGroupDivider,
} from '@/components/settings/settings-group';
import { Text } from '@/components/ui/text';
import { DISTANCE_UNIT_LABELS } from '@/navigation/settings-sub-screen-options';
import { useAppStore } from '@/stores/app-store';

export function DistanceUnitSettingsScreen() {
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const setDistanceUnit = useAppStore(state => state.setDistanceUnit);

  return (
    <SettingsScreenLayout>
      <Text variant="muted" className="text-sm leading-5">
        Used for drive distances and trip summaries across the app.
      </Text>
      <SettingsGroup className="mt-3">
        {(['km', 'mi'] as const).map((unit, index) => (
          <View key={unit}>
            {index > 0 ? <SettingsGroupDivider /> : null}
            <SettingsCheckRow
              label={DISTANCE_UNIT_LABELS[unit]}
              selected={distanceUnit === unit}
              onPress={() => setDistanceUnit(unit)}
            />
          </View>
        ))}
      </SettingsGroup>
    </SettingsScreenLayout>
  );
}
