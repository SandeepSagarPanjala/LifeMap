import {Map} from 'lucide-react-native';
import {View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';

export function MapScreen() {
  const colors = useThemeColors();

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <View className="flex-1 items-center justify-center px-8">
        <View className="bg-muted mb-4 h-16 w-16 items-center justify-center rounded-full">
          <Icon as={Map} size={32} color={colors.primary} />
        </View>
        <Text variant="h4">Map view</Text>
        <Text variant="muted" className="mt-2 text-center leading-6">
          Day polylines, photo pins, and location points will render here in Phase 3.
        </Text>
      </View>
    </SafeAreaView>
  );
}
