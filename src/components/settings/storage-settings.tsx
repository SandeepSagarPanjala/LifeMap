import {useCallback, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {HardDrive} from 'lucide-react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {getAppStorageBreakdown} from '@/db/repositories/storage-stats';
import {formatStorageBytes} from '@/lib/format-storage';
import type {StorageBreakdownItem} from '@/lib/app-storage-breakdown';
import {useThemeColors} from '@/hooks/use-theme-colors';

export function StorageSettings() {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
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
