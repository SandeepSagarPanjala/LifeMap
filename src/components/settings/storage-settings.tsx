import {useCallback, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {HardDrive} from 'lucide-react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {
  getAppStorageBreakdown,
  vacuumDatabase,
} from '@/db/repositories/storage-stats';
import {formatStorageBytes} from '@/lib/format-storage';
import type {StorageBreakdownItem} from '@/lib/app-storage-breakdown';
import {useThemeColors} from '@/hooks/use-theme-colors';

export function StorageSettings() {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [compacting, setCompacting] = useState(false);
  const [breakdown, setBreakdown] = useState<Awaited<
    ReturnType<typeof getAppStorageBreakdown>
  > | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setBreakdown(await getAppStorageBreakdown());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const confirmCompactDatabase = () => {
    const reclaimable = breakdown?.databaseFreeBytes ?? 0;
    Alert.alert(
      'Compact database?',
      `SQLite keeps empty pages after deletes. This reclaims about ${formatStorageBytes(reclaimable)} on disk. Your data is not deleted.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Compact',
          onPress: () => {
            void runCompactDatabase();
          },
        },
      ],
    );
  };

  const runCompactDatabase = async () => {
    setCompacting(true);
    try {
      const result = await vacuumDatabase();
      await refresh();
      Alert.alert(
        'Database compacted',
        `Reduced from ${formatStorageBytes(result.beforeBytes)} to ${formatStorageBytes(result.afterBytes)}.`,
      );
    } catch (error) {
      Alert.alert(
        'Could not compact database',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setCompacting(false);
    }
  };

  return (
    <View className="bg-card border-border rounded-2xl border p-4">
      <View className="flex-row items-center gap-3">
        <Icon as={HardDrive} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">Storage</Text>
          <Text variant="muted" className="mt-1 text-sm leading-5">
            Where space is used on this device. DB is the encrypted database
            file; moments are photo, voice, and note files on disk.
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-4" />
      ) : breakdown ? (
        <>
          <View className="border-border mt-4 overflow-hidden rounded-xl border">
            <StorageTableHeader />
            {breakdown.items.map(item => (
              <StorageTableRow
                key={item.key}
                item={item}
                emphasized={item.category === 'total'}
              />
            ))}
          </View>

          {breakdown.databaseFreeBytes > 0 ? (
            <Text variant="muted" className="mt-3 text-xs leading-4">
              {formatStorageBytes(breakdown.databaseFreeBytes)} of the DB file
              is empty space from deleted rows. Compact to shrink it on disk.
            </Text>
          ) : null}

          {breakdown.databaseFreeBytes > 0 ? (
            <Pressable
              accessibilityRole="button"
              disabled={compacting}
              onPress={confirmCompactDatabase}
              className={`border-border mt-3 self-start rounded-full border px-3 py-2 ${
                compacting ? 'opacity-50' : ''
              }`}>
              {compacting ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-sm font-medium">Compact database</Text>
              )}
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function StorageTableHeader() {
  return (
    <View className="bg-muted/40 border-border flex-row items-center border-b px-2 py-2">
      <Text variant="muted" className="flex-[1.4] text-[10px] font-semibold uppercase">
        Item
      </Text>
      <Text
        variant="muted"
        className="w-14 text-right text-[10px] font-semibold uppercase">
        Count
      </Text>
      <Text
        variant="muted"
        className="w-20 text-right text-[10px] font-semibold uppercase">
        Size
      </Text>
    </View>
  );
}

function formatStorageCount(count: number | null): string {
  if (count == null) {
    return '—';
  }
  return count.toLocaleString();
}

function StorageTableRow({
  item,
  emphasized = false,
}: {
  item: StorageBreakdownItem;
  emphasized?: boolean;
}) {
  return (
    <View
      className={`border-border flex-row items-center border-b px-2 py-2.5 ${
        emphasized ? 'bg-primary/5' : ''
      }`}>
      <Text
        className={`flex-[1.4] text-xs ${emphasized ? 'font-semibold' : ''}`}
        numberOfLines={2}>
        {item.label}
      </Text>
      <Text
        className={`w-14 text-right text-xs font-medium ${
          emphasized ? 'font-semibold' : ''
        }`}>
        {formatStorageCount(item.count)}
      </Text>
      <Text
        className={`w-20 text-right text-xs font-medium ${
          emphasized ? 'font-semibold' : ''
        }`}>
        {formatStorageBytes(item.bytes)}
      </Text>
    </View>
  );
}
