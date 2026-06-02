import {format, parseISO} from 'date-fns';
import {CalendarHeart, MapPin} from 'lucide-react-native';
import {ActivityIndicator, Pressable, ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useMemo} from 'react';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {DaySummaryCard} from '@/components/timeline/DaySummaryCard';
import {useHomeLocationData} from '@/hooks/use-location-days';
import {getOneYearAgoDateKey, getTodayDateKey} from '@/lib/day-utils';
import {calculatePathDistanceKm, formatDistance} from '@/lib/location-geo';
import type {RootStackParamList} from '@/navigation/types';
import {useThemeColors} from '@/hooks/use-theme-colors';

export function HomeScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const today = new Date();
  const formattedDate = format(today, 'EEEE, MMMM d, yyyy');
  const todayKey = getTodayDateKey();
  const oneYearAgoKey = getOneYearAgoDateKey(today);

  const {data: homeData, loading} = useHomeLocationData();
  const {daySummaries, todayPoints, onThisDaySummaries: onThisDay} = homeData;

  const todayDistance = useMemo(
    () => formatDistance(calculatePathDistanceKm(todayPoints)),
    [todayPoints],
  );

  const oneYearAgoSummary = onThisDay.find(day => day.dateKey === oneYearAgoKey) ?? onThisDay[0];
  const recentDays = daySummaries.filter(day => day.dateKey !== todayKey).slice(0, 3);

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
          {loading ? (
            <ActivityIndicator className="mt-4" />
          ) : oneYearAgoSummary ? (
            <View className="mt-3">
              <Text variant="muted" className="leading-6">
                {format(parseISO(oneYearAgoSummary.dateKey), 'MMMM d, yyyy')} —{' '}
                {oneYearAgoSummary.pointCount} points
                {oneYearAgoSummary.distanceKm > 0
                  ? `, ${formatDistance(oneYearAgoSummary.distanceKm)} traveled`
                  : ''}
              </Text>
              <Pressable
                accessibilityRole="button"
                className="mt-4"
                onPress={() =>
                  navigation.navigate('DayDetail', {date: oneYearAgoSummary.dateKey})
                }>
                <Text className="text-primary font-medium">View that day</Text>
              </Pressable>
            </View>
          ) : onThisDay.length > 0 ? (
            <View className="mt-3 gap-3">
              <Text variant="muted" className="leading-6">
                No data from exactly one year ago yet. Here is the same calendar day from another
                year:
              </Text>
              <DaySummaryCard
                summary={onThisDay[0]!}
                compact
                onPress={() =>
                  navigation.navigate('DayDetail', {date: onThisDay[0]!.dateKey})
                }
              />
            </View>
          ) : (
            <Text variant="muted" className="mt-3 leading-6">
              Your life map will appear here once tracking has collected history from past years.
              Keep LifeMap running — day 365 is worth the wait.
            </Text>
          )}
        </View>

        <View className="bg-card border-border mt-4 rounded-2xl border p-5">
          <View className="flex-row items-center gap-2">
            <Icon as={MapPin} size={20} color={colors.primary} />
            <Text className="font-semibold">Today&apos;s path</Text>
          </View>
          {loading ? (
            <ActivityIndicator className="mt-4" />
          ) : todayPoints.length > 0 ? (
            <View className="mt-3">
              <Text variant="muted" className="leading-6">
                {todayPoints.length} point{todayPoints.length === 1 ? '' : 's'}
                {todayDistance !== '0 m' ? ` · ${todayDistance}` : ''}
              </Text>
              <Pressable
                accessibilityRole="button"
                className="mt-4"
                onPress={() => navigation.navigate('DayDetail', {date: todayKey})}>
                <Text className="text-primary font-medium">View today on map</Text>
              </Pressable>
            </View>
          ) : (
            <Text variant="muted" className="mt-3 leading-6">
              No points recorded today yet. Enable tracking in Settings and move around — your route
              will show on the Map tab.
            </Text>
          )}
        </View>

        {recentDays.length > 0 ? (
          <View className="mt-6">
            <Text className="mb-3 font-semibold">Recent days</Text>
            <View className="gap-3">
              {recentDays.map(day => (
                <DaySummaryCard
                  key={day.dateKey}
                  summary={day}
                  compact
                  onPress={() => navigation.navigate('DayDetail', {date: day.dateKey})}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
