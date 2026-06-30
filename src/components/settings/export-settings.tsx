import {format} from 'date-fns';
import {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, InteractionManager, Pressable, Share, View} from 'react-native';
import {CalendarDays, Database} from 'lucide-react-native';

import {HistoryDatePickerSheet} from '@/components/map/HistoryDatePickerSheet';
import {SettingsStatsRefreshBar} from '@/components/settings/settings-stats-refresh-bar';
import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {
  fetchDatabaseExportTable,
  fetchDatabaseExportTables,
  type ExportTableStats,
} from '@/db/repositories/database-export';
import {deleteAllTrackingEvents} from '@/db/repositories/tracking-events';
import {vacuumDatabase} from '@/db/repositories/storage-stats';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  buildDatabaseExportJson,
  buildOriginalDataExportJson,
  buildSingleTableExportJson,
  DATABASE_EXPORT_TABLE_NAMES,
  databaseExportFileLabel,
  originalDataExportFileLabel,
  pickOriginalDataExportTables,
  sumExportTableRowCounts,
  sumOriginalDataExportRowCounts,
  sumOriginalDataExportStorageBytes,
  type DatabaseExportTableName,
} from '@/lib/database-export';
import {getTodayDateKey, parseDateKey} from '@/lib/day-utils';
import {formatStorageBytes} from '@/lib/format-storage';
import {resolveExportPeriod} from '@/lib/export-period';
import {
  computeAndCacheExportTableStats,
  loadCachedExportTableStats,
} from '@/lib/settings-stats';
import {
  getTrackingDiagnosticsEnabled,
  setTrackingDiagnosticsEnabled,
} from '@/lib/tracking-diagnostics';

type ExportPickerTarget =
  | DatabaseExportTableName
  | 'all_tables'
  | 'original_data';

/** Wait for the date picker modal to finish closing before opening the share sheet. */
const EXPORT_SHARE_DELAY_MS = 360;

export function ExportSettings() {
  const colors = useThemeColors();
  const [calculating, setCalculating] = useState(false);
  const [tableStats, setTableStats] = useState<ExportTableStats | null>(null);
  const [calculatedAt, setCalculatedAt] = useState<Date | null>(null);
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingDiagnostics, setDeletingDiagnostics] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<ExportPickerTarget | null>(
    null,
  );
  const [selectedDayKey, setSelectedDayKey] = useState(getTodayDateKey());

  const loadCache = useCallback(async () => {
    try {
      const cached = await loadCachedExportTableStats();
      if (cached == null) {
        setTableStats(null);
        setCalculatedAt(null);
        return;
      }
      setTableStats(cached.payload);
      setCalculatedAt(cached.calculatedAt);
    } catch {
      setTableStats(null);
      setCalculatedAt(null);
    }
  }, []);

  const calculate = useCallback(async () => {
    setCalculating(true);
    try {
      const result = await computeAndCacheExportTableStats();
      setTableStats(result.payload);
      setCalculatedAt(result.calculatedAt);
    } finally {
      setCalculating(false);
    }
  }, []);

  useEffect(() => {
    void loadCache();
  }, [loadCache]);

  useEffect(() => {
    void getTrackingDiagnosticsEnabled()
      .then(setDiagnosticsEnabled)
      .catch(() => undefined);
  }, []);

  const shareExport = async (
    target: ExportPickerTarget,
    scope: 'all' | 'day',
    dateKey?: string,
  ) => {
    setExporting(true);
    try {
      const period = resolveExportPeriod(scope === 'all' ? 'all' : 'day', dateKey);

      if (target === 'all_tables') {
        const tables = await fetchDatabaseExportTables(period);
        const totalRows = Object.values(tables).reduce(
          (sum, rows) => sum + rows.length,
          0,
        );
        if (totalRows === 0) {
          Alert.alert(
            'Nothing to export',
            scope === 'all'
              ? 'No rows in the database yet.'
              : `No rows for ${formatDayLabel(period.dateKey ?? getTodayDateKey())}.`,
          );
          return;
        }
        await Share.share({
          message: buildDatabaseExportJson(period, tables),
          title: databaseExportFileLabel(period),
        });
        return;
      }

      if (target === 'original_data') {
        const tables = pickOriginalDataExportTables(
          await fetchDatabaseExportTables(period),
        );
        const totalRows = Object.values(tables).reduce(
          (sum, rows) => sum + rows.length,
          0,
        );
        if (totalRows === 0) {
          Alert.alert(
            'Nothing to export',
            scope === 'all'
              ? 'No original data rows in the database yet.'
              : `No original data rows for ${formatDayLabel(period.dateKey ?? getTodayDateKey())}.`,
          );
          return;
        }
        await Share.share({
          message: buildOriginalDataExportJson(period, tables),
          title: originalDataExportFileLabel(period),
        });
        return;
      }

      const rows = await fetchDatabaseExportTable(target, period);
      if (rows.length === 0) {
        Alert.alert(
          'Nothing to export',
          scope === 'all'
            ? `No rows in ${target} yet.`
            : `No ${target} rows for ${formatDayLabel(period.dateKey ?? getTodayDateKey())}.`,
        );
        return;
      }

      await Share.share({
        message: buildSingleTableExportJson(target, period, rows),
        title: databaseExportFileLabel(period, target),
      });
    } catch (error) {
      Alert.alert(
        'Could not export',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setExporting(false);
    }
  };

  const openDayPicker = (target: ExportPickerTarget) => {
    setPickerTarget(target);
    setDayPickerVisible(true);
  };

  const toggleDiagnostics = async () => {
    const next = !diagnosticsEnabled;
    setDiagnosticsEnabled(next);
    await setTrackingDiagnosticsEnabled(next);
  };

  const confirmDeleteDiagnostics = () => {
    const rowCount = tableStats?.counts.tracking_events ?? 0;
    Alert.alert(
      'Delete tracking diagnostics?',
      rowCount > 0
        ? `This removes ${rowCount.toLocaleString()} debug log rows from tracking_events. Your map, visits, drives, and GPS points are not affected.`
        : 'This removes debug log rows from tracking_events. Your map, visits, drives, and GPS points are not affected.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void runDeleteDiagnostics();
          },
        },
      ],
    );
  };

  const runDeleteDiagnostics = async () => {
    setDeletingDiagnostics(true);
    try {
      const deleted = await deleteAllTrackingEvents();
      let compactMessage = '';
      if (deleted > 0) {
        setCompacting(true);
        const compacted = await vacuumDatabase();
        compactMessage = `\n\nDatabase compacted from ${formatStorageBytes(compacted.beforeBytes)} to ${formatStorageBytes(compacted.afterBytes)}.`;
      }
      await calculate();
      Alert.alert(
        'Diagnostics deleted',
        `Removed ${deleted.toLocaleString()} tracking_events rows.${compactMessage}`,
      );
    } catch (error) {
      Alert.alert(
        'Could not delete diagnostics',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setDeletingDiagnostics(false);
      setCompacting(false);
    }
  };

  const confirmCompactDatabase = () => {
    const reclaimable = tableStats?.freeDbBytes ?? 0;
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
      await calculate();
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

  const totalRows =
    tableStats != null ? sumExportTableRowCounts(tableStats.counts) : 0;
  const originalDataRows =
    tableStats != null
      ? sumOriginalDataExportRowCounts(tableStats.counts)
      : 0;
  const originalDataStorageBytes =
    tableStats != null
      ? sumOriginalDataExportStorageBytes(tableStats.storageBytes)
      : 0;
  const trackingEventsCount = tableStats?.counts.tracking_events ?? 0;
  const totalDbBytes = tableStats?.totalDbBytes ?? 0;
  const freeDbBytes = tableStats?.freeDbBytes ?? 0;
  const tableActionsDisabled =
    exporting || deletingDiagnostics || compacting || calculating;

  return (
    <>
      <View className="bg-card border-border mt-2 rounded-2xl border p-4">
        <View className="flex-row items-center gap-3">
          <Icon as={Database} size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-medium">Export data</Text>
            <Text variant="muted" className="mt-1 text-sm leading-5">
              Export one table or everything as JSON. Row counts and storage
              estimates are saved after you calculate.
            </Text>
          </View>
        </View>

        <SettingsStatsRefreshBar
          calculatedAt={calculatedAt}
          calculating={calculating}
          onCalculate={() => void calculate()}
        />

        {tableStats != null ? (
          <>
            <View className="border-border mt-4 overflow-hidden rounded-xl border">
              <ExportTableHeader />
              {DATABASE_EXPORT_TABLE_NAMES.map(tableName => (
                <ExportTableRow
                  key={tableName}
                  tableName={tableName}
                  count={tableStats.counts[tableName] ?? 0}
                  storageBytes={tableStats.storageBytes[tableName] ?? 0}
                  disabled={tableActionsDisabled}
                  onPickDay={() => openDayPicker(tableName)}
                  onExportAll={() => void shareExport(tableName, 'all')}
                />
              ))}
              <ExportTableRow
                tableName="all_tables"
                count={totalRows}
                storageBytes={totalDbBytes}
                disabled={tableActionsDisabled}
                emphasized
                onPickDay={() => openDayPicker('all_tables')}
                onExportAll={() => void shareExport('all_tables', 'all')}
              />
              <ExportTableRow
                tableName="original_data"
                count={originalDataRows}
                storageBytes={originalDataStorageBytes}
                disabled={tableActionsDisabled}
                emphasized
                onPickDay={() => openDayPicker('original_data')}
                onExportAll={() => void shareExport('original_data', 'all')}
              />
            </View>

            {freeDbBytes > 0 ? (
              <Text variant="muted" className="mt-3 text-xs leading-4">
                {formatStorageBytes(freeDbBytes)} of the DB file is empty space
                from deleted rows. Compact to reclaim it on disk.
              </Text>
            ) : null}

            {freeDbBytes > 0 ? (
              <Pressable
                accessibilityRole="button"
                disabled={tableActionsDisabled}
                onPress={confirmCompactDatabase}
                className={`border-border mt-3 self-start rounded-full border px-3 py-2 ${
                  tableActionsDisabled ? 'opacity-50' : ''
                }`}>
                {compacting ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="text-sm font-medium">Compact database</Text>
                )}
              </Pressable>
            ) : null}

            <View className="border-border mt-4 border-t pt-4">
              <View className="flex-row items-center gap-3">
                <Text className="text-sm font-medium">Tracking diagnostics</Text>
                <View className="flex-1" />
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{checked: diagnosticsEnabled}}
                  onPress={() => void toggleDiagnostics()}
                  className={`h-6 w-11 rounded-full px-0.5 ${
                    diagnosticsEnabled ? 'bg-primary' : 'bg-muted'
                  }`}>
                  <View
                    className={`mt-0.5 h-5 w-5 rounded-full bg-white ${
                      diagnosticsEnabled ? 'ml-auto' : 'ml-0'
                    }`}
                  />
                </Pressable>
              </View>

              <Text variant="muted" className="mt-2 text-xs leading-4">
                Debug only — not used for your map or timeline. Turn on briefly
                when investigating a tracking gap, export tracking_events from
                the table above if needed, then turn off and delete. With
                maximum reliability on, this table grows very fast.
              </Text>

              {trackingEventsCount > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={exporting || deletingDiagnostics || compacting}
                  onPress={confirmDeleteDiagnostics}
                  className={`border-destructive mt-3 self-start rounded-full border px-3 py-2 ${
                    exporting || deletingDiagnostics ? 'opacity-50' : ''
                  }`}>
                  {deletingDiagnostics ? (
                    <ActivityIndicator />
                  ) : (
                    <Text className="text-destructive text-sm font-medium">
                      Delete diagnostics
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
      </View>

      <HistoryDatePickerSheet
        visible={dayPickerVisible}
        selectedDateKey={selectedDayKey}
        onSelectDate={dateKey => {
          setSelectedDayKey(dateKey);
          const target = pickerTarget;
          setPickerTarget(null);
          if (target == null) {
            return;
          }
          const exportTarget = target;
          setTimeout(() => {
            InteractionManager.runAfterInteractions(() => {
              void shareExport(exportTarget, 'day', dateKey);
            });
          }, EXPORT_SHARE_DELAY_MS);
        }}
        onClose={() => {
          setDayPickerVisible(false);
          setPickerTarget(null);
        }}
      />
    </>
  );
}

function ExportTableHeader() {
  return (
    <View className="bg-muted/40 border-border flex-row items-center border-b px-2 py-2">
      <Text variant="muted" className="min-w-0 flex-1 text-[10px] font-semibold uppercase">
        Table
      </Text>
      <Text
        variant="muted"
        className="w-11 text-right text-[10px] font-semibold uppercase">
        Count
      </Text>
      <Text
        variant="muted"
        className="w-14 text-right text-[10px] font-semibold uppercase">
        Storage
      </Text>
      <Text
        variant="muted"
        className="w-10 text-center text-[10px] font-semibold uppercase">
        Day
      </Text>
      <Text
        variant="muted"
        className="w-14 text-center text-[10px] font-semibold uppercase">
        All days
      </Text>
    </View>
  );
}

function ExportTableRow({
  tableName,
  count,
  storageBytes,
  disabled,
  emphasized = false,
  onPickDay,
  onExportAll,
}: {
  tableName: ExportPickerTarget;
  count: number;
  storageBytes: number;
  disabled: boolean;
  emphasized?: boolean;
  onPickDay: () => void;
  onExportAll: () => void;
}) {
  const colors = useThemeColors();
  const label =
    tableName === 'all_tables'
      ? 'all tables'
      : tableName === 'original_data'
        ? 'original data export'
        : tableName;

  return (
    <View
      className={`border-border flex-row items-center border-b px-2 py-2.5 ${
        emphasized ? 'bg-primary/5' : ''
      }`}>
      <Text
        className={`min-w-0 flex-1 text-xs ${emphasized ? 'font-semibold' : ''}`}
        numberOfLines={2}>
        {label}
      </Text>
      <Text className="w-11 text-right text-xs font-medium">
        {(count ?? 0).toLocaleString()}
      </Text>
      <Text
        className={`w-14 text-right text-[10px] font-medium ${
          emphasized ? 'font-semibold' : ''
        }`}>
        {formatStorageBytes(storageBytes)}
      </Text>
      <View className="w-10 items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Export ${label} for selected day`}
          disabled={disabled}
          onPress={onPickDay}
          className={`rounded-full p-1.5 ${disabled ? 'opacity-40' : ''}`}>
          <Icon as={CalendarDays} size={16} color={colors.primary} />
        </Pressable>
      </View>
      <View className="w-14 items-center">
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onExportAll}
          className={`rounded-full border px-2 py-1 ${
            emphasized ? 'border-primary' : 'border-border'
          } ${disabled ? 'opacity-40' : ''}`}>
          <Text
            className={`text-[10px] font-medium ${
              emphasized ? 'text-primary' : ''
            }`}>
            Export
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatDayLabel(dateKey: string): string {
  return format(parseDateKey(dateKey), 'MMM d, yyyy');
}
