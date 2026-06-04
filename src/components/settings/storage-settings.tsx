import {useCallback, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {HardDrive} from 'lucide-react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {getDatabaseStorageStats} from '@/db/repositories/storage-stats';
import {formatStorageBytes} from '@/lib/format-storage';
import {useThemeColors} from '@/hooks/use-theme-colors';

function StatRow({label, value}: {label: string; value: string}) {
  return (
    <View className="border-border mt-3 flex-row items-center justify-between border-t pt-3">
      <Text variant="muted" className="text-sm">
        {label}
      </Text>
      <Text className="text-sm font-semibold">{value}</Text>
    </View>
  );
}

export function StorageSettings() {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getDatabaseStorageStats>
  > | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getDatabaseStorageStats());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <View className="bg-card border-border rounded-2xl border p-4">
      <View className="flex-row items-center gap-3">
        <Icon as={HardDrive} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">Storage</Text>
          <Text variant="muted" className="mt-1 text-sm leading-5">
            Encrypted database size on this device. Use this to track daily
            growth and plan optimizations later.
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-4" />
      ) : stats ? (
        <>
          <StatRow
            label="Total database"
            value={formatStorageBytes(stats.totalBytes)}
          />
          <StatRow
            label="Today (estimate)"
            value={formatStorageBytes(stats.todayBytesEstimate)}
          />
          <Text variant="muted" className="mt-3 text-xs leading-4">
            {stats.totalLocationRows.toLocaleString()} location rows
            {stats.todayLocationRows > 0
              ? ` · ${stats.todayLocationRows.toLocaleString()} added today`
              : ''}
            . Today's size is estimated from today's share of rows in the
            database file.
          </Text>
        </>
      ) : null}
    </View>
  );
}
