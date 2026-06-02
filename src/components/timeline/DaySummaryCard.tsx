import {format, parseISO} from 'date-fns';
import {ChevronRight} from 'lucide-react-native';
import {Pressable, View} from 'react-native';

import type {DaySummary} from '@/db/repositories/location-days';
import {formatDistance} from '@/lib/location-geo';
import {useAppStore} from '@/stores/app-store';
import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';

type DaySummaryCardProps = {
  summary: DaySummary;
  onPress: () => void;
  compact?: boolean;
};

export function DaySummaryCard({summary, onPress, compact = false}: DaySummaryCardProps) {
  const colors = useThemeColors();
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const date = parseISO(summary.dateKey);

  const timeRange =
    summary.firstAt && summary.lastAt
      ? `${format(summary.firstAt, 'h:mm a')} – ${format(summary.lastAt, 'h:mm a')}`
      : 'No times recorded';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="bg-card border-border rounded-2xl border p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className={compact ? 'font-semibold' : 'text-lg font-semibold'}>
            {format(date, compact ? 'MMM d, yyyy' : 'EEEE, MMM d')}
          </Text>
          <Text variant="muted" className="mt-1 text-sm">
            {summary.pointCount} point{summary.pointCount === 1 ? '' : 's'}
            {summary.distanceKm > 0 ? ` · ${formatDistance(summary.distanceKm, distanceUnit)}` : ''}
          </Text>
          {!compact ? (
            <Text variant="muted" className="mt-1 text-sm">
              {timeRange}
            </Text>
          ) : null}
        </View>
        <Icon as={ChevronRight} size={20} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}
