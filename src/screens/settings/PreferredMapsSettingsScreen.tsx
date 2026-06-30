import {Platform, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {
  SettingsCheckRow,
  SettingsGroup,
  SettingsGroupDivider,
} from '@/components/settings/settings-group';
import {Text} from '@/components/ui/text';
import {PREFERRED_MAP_APP_LABELS} from '@/navigation/settings-sub-screen-options';
import {useAppStore, type PreferredMapApp} from '@/stores/app-store';

const IOS_MAP_APPS: PreferredMapApp[] = ['apple', 'google'];
const ANDROID_MAP_APPS: PreferredMapApp[] = ['google'];

export function PreferredMapsSettingsScreen() {
  const preferredMapApp = useAppStore(state => state.preferredMapApp);
  const setPreferredMapApp = useAppStore(state => state.setPreferredMapApp);
  const availableApps =
    Platform.OS === 'ios' ? IOS_MAP_APPS : ANDROID_MAP_APPS;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      <Text variant="muted" className="px-5 pt-4 text-sm leading-5">
        Opens when you tap directions or an external map link from a visit or place.
      </Text>
      {Platform.OS === 'ios' ? (
        <Text variant="muted" className="mt-2 px-5 text-sm leading-5">
          The in-app map view always uses Apple Maps on iOS.
        </Text>
      ) : null}
      <SettingsGroup className="mx-5 mt-3">
        {availableApps.map((app, index) => (
          <View key={app}>
            {index > 0 ? <SettingsGroupDivider /> : null}
            <SettingsCheckRow
              label={PREFERRED_MAP_APP_LABELS[app]}
              selected={preferredMapApp === app}
              onPress={() => setPreferredMapApp(app)}
            />
          </View>
        ))}
      </SettingsGroup>
    </SafeAreaView>
  );
}
