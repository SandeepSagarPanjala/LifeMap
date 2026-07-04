import {useCallback, useState} from 'react';
import {APP_COPY, errorMessageOr} from '@/lib/app-copy';
import {ActivityIndicator, Alert, Pressable, View} from 'react-native';
import {MapPin} from 'lucide-react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {
  deleteLocationPointDuplicatesAndCreateUniqueIndex,
  getLocationPointDuplicateStats,
  type LocationPointDuplicateStats,
} from '@/db/location-points-dedupe';
import {markMigrationAppliedByTag} from '@/db/migrate';
import {getSqlite} from '@/db/client';
import {useThemeColors} from '@/hooks/use-theme-colors';

function formatStats(stats: LocationPointDuplicateStats): string {
  const lines = [
    `${stats.totalRows.toLocaleString()} GPS rows total`,
    `${stats.duplicateGroups.toLocaleString()} duplicate groups`,
    `${stats.extraRows.toLocaleString()} extra rows to remove`,
    stats.hasUniqueIndex
      ? 'Unique index: installed'
      : 'Unique index: not installed',
  ];
  if (stats.hasNoDeleteTrigger) {
    lines.push('Append-only trigger: active (dropped briefly during delete)');
  }
  return lines.join('\n');
}

export function LocationPointsDedupeDevCard() {
  const colors = useThemeColors();
  const [stats, setStats] = useState<LocationPointDuplicateStats | null>(null);
  const [scanning, setScanning] = useState(false);
  const [working, setWorking] = useState(false);

  const scan = useCallback(async () => {
    setScanning(true);
    try {
      setStats(await getLocationPointDuplicateStats());
    } catch (error) {
      Alert.alert(
        'Scan failed',
        errorMessageOr(error),
      );
    } finally {
      setScanning(false);
    }
  }, []);

  const runCleanup = useCallback(async () => {
    if (stats == null) {
      return;
    }

    const message =
      stats.extraRows > 0
        ? `Remove ${stats.extraRows.toLocaleString()} duplicate GPS rows (keeps the oldest row per timestamp + coordinates), then install the unique index so INSERT OR IGNORE works.`
        : stats.hasUniqueIndex
          ? 'Unique index is already installed.'
          : 'No duplicate rows found. Install the unique index now?';

    Alert.alert(
      stats.extraRows > 0 ? 'Delete duplicates?' : 'Create unique index?',
      message,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: stats.extraRows > 0 ? 'Delete & index' : 'Create index',
          style: stats.extraRows > 0 ? 'destructive' : 'default',
          onPress: () => {
            void (async () => {
              setWorking(true);
              try {
                const result =
                  await deleteLocationPointDuplicatesAndCreateUniqueIndex();
                if (result.indexCreated) {
                  await markMigrationAppliedByTag(
                    await getSqlite(),
                    '0019_location_points_dedupe_unique',
                  );
                }
                const nextStats = await getLocationPointDuplicateStats();
                setStats(nextStats);
                Alert.alert(
                  'Done',
                  [
                    result.deletedRows > 0
                      ? `Removed ${result.deletedRows.toLocaleString()} duplicate rows.`
                      : null,
                    result.indexCreated || nextStats.hasUniqueIndex
                      ? 'Unique index is installed. Future GPS dedupe uses INSERT OR IGNORE.'
                      : null,
                  ]
                    .filter(Boolean)
                    .join('\n'),
                );
              } catch (error) {
                Alert.alert(
                  'Cleanup failed',
                  errorMessageOr(error),
                );
              } finally {
                setWorking(false);
              }
            })();
          },
        },
      ],
    );
  }, [stats]);

  const busy = scanning || working;
  const canCleanup =
    stats != null &&
    !busy &&
    (stats.extraRows > 0 || !stats.hasUniqueIndex);

  return (
    <View className="bg-card border-border rounded-2xl border p-4">
      <View className="flex-row items-center gap-3">
        <Icon as={MapPin} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">GPS duplicate scan</Text>
          <Text variant="muted" className="mt-1">
            Find duplicate location_points rows, remove extras, then install the
            unique index (migration 0019). Run once per device if INSERT OR
            IGNORE dedupe is not working yet.
          </Text>
        </View>
      </View>

      {stats != null ? (
        <Text variant="muted" className="mt-3 whitespace-pre-line text-xs leading-5">
          {formatStats(stats)}
        </Text>
      ) : null}

      <View className="mt-3 flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void scan()}
          className={`border-border flex-1 rounded-full border px-3 py-2 ${
            busy ? 'opacity-50' : ''
          }`}>
          {scanning ? (
            <ActivityIndicator />
          ) : (
            <Text className="text-center text-sm font-medium">
              {stats != null ? 'Rescan' : 'Scan'}
            </Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!canCleanup}
          onPress={() => void runCleanup()}
          className={`flex-1 rounded-full px-3 py-2 ${
            canCleanup ? 'bg-primary' : 'bg-muted opacity-50'
          }`}>
          {working ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-center text-sm font-medium text-white">
              {stats?.extraRows ? 'Delete & index' : 'Create index'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
