import {format, parseISO} from 'date-fns';
import {Calendar} from 'lucide-react-native';
import {View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import type {RootStackScreenProps} from '@/navigation/types';

export function DayDetailScreen({route}: RootStackScreenProps<'DayDetail'>) {
  const date = parseISO(route.params.date);
  const formattedDate = format(date, 'EEEE, MMMM d, yyyy');

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <View className="flex-1 items-center justify-center px-8">
        <View className="bg-muted mb-4 h-16 w-16 items-center justify-center rounded-full">
          <Icon as={Calendar} size={32} color="hsl(16 65% 45%)" />
        </View>
        <Text variant="h4">{formattedDate}</Text>
        <Text variant="muted" className="mt-2 text-center leading-6">
          Day map and timeline entries will render here in Phase 3.
        </Text>
      </View>
    </SafeAreaView>
  );
}
