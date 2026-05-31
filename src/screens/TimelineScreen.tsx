import {Clock} from 'lucide-react-native';
import {View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';

export function TimelineScreen() {
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <View className="flex-1 items-center justify-center px-8">
        <View className="bg-muted mb-4 h-16 w-16 items-center justify-center rounded-full">
          <Icon as={Clock} size={32} color="hsl(16 65% 45%)" />
        </View>
        <Text variant="h4">Timeline</Text>
        <Text variant="muted" className="mt-2 text-center leading-6">
          Scroll through every day of your life. FlashList timeline + date scrubber coming in Phase
          3.
        </Text>
      </View>
    </SafeAreaView>
  );
}
