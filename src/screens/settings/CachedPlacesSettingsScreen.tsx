import {ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {CachedPlacesSettings} from '@/components/settings/cached-places-settings';
import {Text} from '@/components/ui/text';

export function CachedPlacesSettingsScreen() {
  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <Text variant="muted" className="text-sm leading-5">
          Reverse-geocoded addresses and nearby POIs stored on this device. These
          are reused when labeling visits and saved places.
        </Text>
        <CachedPlacesSettings />
      </ScrollView>
    </SafeAreaView>
  );
}
