import {format} from 'date-fns';
import {CalendarHeart, MapPin} from 'lucide-react-native';
import {ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';

export function HomeScreen() {
  const colors = useThemeColors();
  const today = new Date();
  const formattedDate = format(today, 'EEEE, MMMM d, yyyy');

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <Text variant="muted" className="text-sm uppercase tracking-wide">
          On this day
        </Text>
        <Text variant="h3" className="mt-1 text-left">
          {formattedDate}
        </Text>

        <View className="bg-card border-border mt-6 rounded-2xl border p-5">
          <View className="flex-row items-center gap-2">
            <Icon as={CalendarHeart} size={20} color={colors.primary} />
            <Text className="font-semibold">One year ago today</Text>
          </View>
          <Text variant="muted" className="mt-3 leading-6">
            Your life map will appear here once tracking has collected enough history. Keep LifeMap
            running — day 365 is worth the wait.
          </Text>
        </View>

        <View className="bg-card border-border mt-4 rounded-2xl border p-5">
          <View className="flex-row items-center gap-2">
            <Icon as={MapPin} size={20} color={colors.primary} />
            <Text className="font-semibold">Today&apos;s path</Text>
          </View>
          <Text variant="muted" className="mt-3 leading-6">
            Map and timeline views will show your route once background tracking is enabled in Phase
            2.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
