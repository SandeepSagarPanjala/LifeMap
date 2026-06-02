import {FlashList} from '@shopify/flash-list';
import {ActivityIndicator, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {DaySummaryCard} from '@/components/timeline/DaySummaryCard';
import type {DaySummary} from '@/db/repositories/location-days';
import {useDaySummaries} from '@/hooks/use-location-days';
import type {RootStackParamList} from '@/navigation/types';
import {Text} from '@/components/ui/text';

export function TimelineScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {data: summaries, loading} = useDaySummaries();

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <View className="flex-1 px-5 pt-4">
        <Text variant="h3" className="text-left">
          Timeline
        </Text>
        <Text variant="muted" className="mt-1">
          Every day LifeMap has recorded
        </Text>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : summaries.length === 0 ? (
          <View className="bg-card border-border mt-6 flex-1 items-center justify-center rounded-2xl border px-6">
            <Text variant="muted" className="text-center leading-6">
              Your timeline will fill in as location points are saved. Enable tracking in Settings
              and take a walk.
            </Text>
          </View>
        ) : (
          <View className="mt-4 min-h-[200px] flex-1">
            <FlashList
              data={summaries}
              keyExtractor={(item: DaySummary) => item.dateKey}
              ItemSeparatorComponent={() => <View className="h-3" />}
              renderItem={({item}) => (
                <DaySummaryCard
                  summary={item}
                  onPress={() => navigation.navigate('DayDetail', {date: item.dateKey})}
                />
              )}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
