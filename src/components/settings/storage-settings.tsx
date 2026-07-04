import {useCallback, useEffect, useState} from 'react';
import {APP_COPY, errorMessageOr} from '@/lib/app-copy';
import {View} from 'react-native';

import {SettingsStatsRefreshBar} from '@/components/settings/settings-stats-refresh-bar';
import {Text} from '@/components/ui/text';
import type {AppStorageBreakdown} from '@/db/repositories/storage-stats';
import {formatStorageBytes} from '@/lib/format-storage';
import type {StorageBreakdownItem} from '@/lib/app-storage-breakdown';
import {
  computeAndCacheStorageBreakdown,
  loadCachedStorageBreakdown,
} from '@/lib/settings-stats';

export function StorageSettings() {
  const [calculating, setCalculating] = useState(false);
  const [breakdown, setBreakdown] = useState<AppStorageBreakdown | null>(null);
  const [calculatedAt, setCalculatedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCache = useCallback(async () => {
    setErrorMessage(null);
    try {
      const cached = await loadCachedStorageBreakdown();
      if (cached == null) {
        setBreakdown(null);
        setCalculatedAt(null);
        return;
      }
      setBreakdown(cached.payload);
      setCalculatedAt(cached.calculatedAt);
    } catch (error) {
      setBreakdown(null);
      setCalculatedAt(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : APP_COPY.alerts.couldNotLoadStorageStats,
      );
    }
  }, []);

  const calculate = useCallback(async () => {
    setCalculating(true);
    setErrorMessage(null);
    try {
      const result = await computeAndCacheStorageBreakdown();
      setBreakdown(result.payload);
      setCalculatedAt(result.calculatedAt);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : APP_COPY.alerts.couldNotCalculateStorage,
      );
    } finally {
      setCalculating(false);
    }
  }, []);

  useEffect(() => {
    void loadCache();
  }, [loadCache]);

  return (
    <View className="mt-4">
      <SettingsStatsRefreshBar
        calculatedAt={calculatedAt}
        calculating={calculating}
        onCalculate={() => void calculate()}
      />

      {errorMessage ? (
        <Text variant="muted" className="mt-3 text-sm leading-5">
          {errorMessage}
        </Text>
      ) : null}

      {breakdown != null ? (
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
