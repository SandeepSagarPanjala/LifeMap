import { format } from 'date-fns';
import { EXPORT_SHARE_DELAY_MS } from '@/lib/app-constants';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Pressable,
  Share,
  View,
} from 'react-native';
import { CalendarDays, Database, Eye, Trash2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { HistoryDatePickerSheet } from '@/components/map/HistoryDatePickerSheet';
import { SettingsStatsRefreshBar } from '@/components/settings/settings-stats-refresh-bar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  fetchDatabaseExportTable,
  fetchDatabaseExportTables,
  type ExportTableStats,
} from '@/db/repositories/database-export';
import { deleteAllTrackingEvents } from '@/db/repositories/tracking-events';
import { vacuumDatabase } from '@/db/repositories/storage-stats';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  ALGORITHM_DATA_EXPORT_TABLE_NAMES,
  buildDatabaseExportJson,
  buildOriginalDataExportJson,
  buildSingleTableExportJson,
  databaseExportFileLabel,
  originalDataExportFileLabel,
  ORIGINAL_DATA_EXPORT_TABLE_NAMES,
  pickOriginalDataExportTables,
  sumExportTableRowCounts,
  sumOriginalDataExportRowCounts,
  sumOriginalDataExportStorageBytes,
  type AlgorithmDataExportTableName,
  type DatabaseExportTableName,
} from '@/lib/database-export';
import { getTodayDateKey, parseDateKey } from '@/lib/day-utils';
import { formatStorageBytes } from '@/lib/format-storage';
import { resolveExportPeriod } from '@/lib/export-period';
import {
  computeAndCacheExportTableStats,
  loadCachedExportTableStats,
} from '@/lib/settings-stats';
import type { RootStackParamList } from '@/navigation/types';

type ExportPickerTarget =
  | DatabaseExportTableName
  | 'all_tables'
  | 'original_data';

type DeletingTarget = 'tracking_events' | null;

export function ExportSettings() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const [calculating, setCalculating] = useState(false);
  const [tableStats, setTableStats] = useState<ExportTableStats | null>(null);
  const [calculatedAt, setCalculatedAt] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deletingTarget, setDeletingTarget] = useState<DeletingTarget>(null);
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

  const shareExport = async (
    target: ExportPickerTarget,
    scope: 'all' | 'day',
    dateKey?: string,
  ) => {
    setExporting(true);
    try {
      const period = resolveExportPeriod(
        scope === 'all' ? 'all' : 'day',
        dateKey,
      );

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
              : `No rows for ${formatDayLabel(
                  period.dateKey ?? getTodayDateKey(),
                )}.`,
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
              : `No original data rows for ${formatDayLabel(
                  period.dateKey ?? getTodayDateKey(),
                )}.`,
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
            : `No ${target} rows for ${formatDayLabel(
                period.dateKey ?? getTodayDateKey(),
              )}.`,
        );
        return;
      }

      await Share.share({
        message: buildSingleTableExportJson(target, period, rows),
        title: databaseExportFileLabel(period, target),
      });
    } catch (error) {
      Alert.alert(APP_COPY.alerts.couldNotExport, errorMessageOr(error));
    } finally {
      setExporting(false);
    }
  };

  const openDayPicker = (target: ExportPickerTarget) => {
    setPickerTarget(target);
    setDayPickerVisible(true);
  };

  const confirmDeleteTable = (tableName: AlgorithmDataExportTableName) => {
    if (tableName !== 'tracking_events') {
      return;
    }
    const rowCount = tableStats?.counts.tracking_events ?? 0;
    Alert.alert(
      'Delete tracking events?',
      deleteTrackingEventsMessage(rowCount),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void runDeleteTrackingEvents();
          },
        },
      ],
    );
  };

  const runDeleteTrackingEvents = async () => {
    setDeletingTarget('tracking_events');
    try {
      const deleted = await deleteAllTrackingEvents();
      let compactMessage = '';
      if (deleted > 0) {
        setCompacting(true);
        const compacted = await vacuumDatabase();
        compactMessage = `\n\nDatabase compacted from ${formatStorageBytes(
          compacted.beforeBytes,
        )} to ${formatStorageBytes(compacted.afterBytes)}.`;
      }
      await calculate();
      Alert.alert(
        'Deleted',
        `Removed ${deleted.toLocaleString()} tracking_events rows.${compactMessage}`,
      );
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotDeleteDiagnostics,
        errorMessageOr(error),
      );
    } finally {
      setDeletingTarget(null);
      setCompacting(false);
    }
  };

  const confirmCompactDatabase = () => {
    const reclaimable = tableStats?.freeDbBytes ?? 0;
    Alert.alert(
      'Compact database?',
      `SQLite keeps empty pages after deletes. This reclaims about ${formatStorageBytes(
        reclaimable,
      )} on disk. Your data is not deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
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
        `Reduced from ${formatStorageBytes(
          result.beforeBytes,
        )} to ${formatStorageBytes(result.afterBytes)}.`,
      );
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotCompactDatabase,
        errorMessageOr(error),
      );
    } finally {
      setCompacting(false);
    }
  };

  const totalRows =
    tableStats != null ? sumExportTableRowCounts(tableStats.counts) : 0;
  const originalDataRows =
    tableStats != null ? sumOriginalDataExportRowCounts(tableStats.counts) : 0;
  const originalDataStorageBytes =
    tableStats != null
      ? sumOriginalDataExportStorageBytes(tableStats.storageBytes)
      : 0;
  const totalDbBytes = tableStats?.totalDbBytes ?? 0;
  const freeDbBytes = tableStats?.freeDbBytes ?? 0;
  const tableActionsDisabled =
    exporting || deletingTarget != null || compacting || calculating;
  const hasTrackingEventRows = (tableStats?.counts.tracking_events ?? 0) > 0;

  return (
    <>
      <View className="bg-card border-border mt-2 rounded-2xl border p-4">
        <View className="flex-row items-center gap-3">
          <Icon as={Database} size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-medium">Export data</Text>
            <Text variant="muted" className="mt-1 text-sm leading-5">
              Export JSON by table, day, or bundle. Tap Calculate to refresh row
              counts and storage estimates.
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
            <ExportSection
              title="Original data"
              description="Raw GPS, places, moments, and settings captured on device."
            >
              {ORIGINAL_DATA_EXPORT_TABLE_NAMES.map(tableName => (
                <ExportDataRow
                  key={tableName}
                  label={formatTableLabel(tableName)}
                  count={tableStats.counts[tableName] ?? 0}
                  storageBytes={tableStats.storageBytes[tableName] ?? 0}
                  disabled={tableActionsDisabled}
                  onPickDay={() => openDayPicker(tableName)}
                  onExportAll={() => void shareExport(tableName, 'all')}
                />
              ))}
            </ExportSection>

            <ExportSection
              title="Algorithm data"
              description="Visits, drives, and seal metadata built from GPS. Raw location points are kept separately under Original data."
            >
              {ALGORITHM_DATA_EXPORT_TABLE_NAMES.map(tableName => (
                <ExportDataRow
                  key={tableName}
                  label={formatTableLabel(tableName)}
                  count={tableStats.counts[tableName] ?? 0}
                  storageBytes={tableStats.storageBytes[tableName] ?? 0}
                  disabled={tableActionsDisabled}
                  deleting={
                    tableName === 'tracking_events'
                      ? deletingTarget === 'tracking_events'
                      : false
                  }
                  showDelete={
                    tableName === 'tracking_events' && hasTrackingEventRows
                  }
                  showView={
                    tableName === 'trips' && (tableStats.counts.trips ?? 0) > 0
                  }
                  onView={() => navigation.navigate('ExportTripDays')}
                  onPickDay={() => openDayPicker(tableName)}
                  onExportAll={() => void shareExport(tableName, 'all')}
                  onDelete={() => confirmDeleteTable(tableName)}
                />
              ))}
            </ExportSection>

            <ExportSection
              title="Full exports"
              description="Bundled JSON for backup, analysis, or Point Explorer."
            >
              <ExportDataRow
                label="All tables"
                count={totalRows}
                storageBytes={totalDbBytes}
                disabled={tableActionsDisabled}
                emphasized
                onPickDay={() => openDayPicker('all_tables')}
                onExportAll={() => void shareExport('all_tables', 'all')}
              />
              <ExportDataRow
                label="Original data export"
                count={originalDataRows}
                storageBytes={originalDataStorageBytes}
                disabled={tableActionsDisabled}
                emphasized
                onPickDay={() => openDayPicker('original_data')}
                onExportAll={() => void shareExport('original_data', 'all')}
              />
            </ExportSection>

            {freeDbBytes > 0 ? (
              <Text variant="muted" className="mt-1 text-xs leading-4">
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
                }`}
              >
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

function ExportSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <View className="mt-5">
      <Text className="text-sm font-semibold">{title}</Text>
      <Text variant="muted" className="mt-1 text-xs leading-4">
        {description}
      </Text>
      <View className="mt-3 gap-2">{children}</View>
    </View>
  );
}

function ExportDataRow({
  label,
  count,
  storageBytes,
  disabled,
  emphasized = false,
  showDelete = false,
  deleteLabel = 'Delete',
  showView = false,
  deleting = false,
  onPickDay,
  onExportAll,
  onView,
  onDelete,
}: {
  label: string;
  count: number;
  storageBytes: number;
  disabled: boolean;
  emphasized?: boolean;
  showDelete?: boolean;
  deleteLabel?: string;
  showView?: boolean;
  deleting?: boolean;
  onPickDay: () => void;
  onExportAll: () => void;
  onView?: () => void;
  onDelete?: () => void;
}) {
  const colors = useThemeColors();

  return (
    <View
      className={`rounded-xl border px-3 py-3 ${
        emphasized
          ? 'border-primary/30 bg-primary/5'
          : 'border-border bg-background'
      }`}
    >
      <Text
        className={`text-sm ${
          emphasized ? 'font-semibold text-primary' : 'font-medium'
        }`}
      >
        {label}
      </Text>
      <Text variant="muted" className="mt-1 text-xs leading-4">
        {count.toLocaleString()} rows · {formatStorageBytes(storageBytes)}
      </Text>
      <View className="mt-3 flex-row flex-wrap gap-2">
        {showView && onView != null ? (
          <ExportActionButton
            label="View"
            icon={Eye}
            iconColor={colors.primary}
            disabled={disabled}
            onPress={onView}
          />
        ) : null}
        <ExportActionButton
          label="Day"
          icon={CalendarDays}
          iconColor={colors.primary}
          disabled={disabled}
          onPress={onPickDay}
        />
        <ExportActionButton
          label="Export all"
          disabled={disabled}
          emphasized={emphasized}
          onPress={onExportAll}
        />
        {showDelete && onDelete != null ? (
          <ExportActionButton
            label={deleteLabel}
            icon={Trash2}
            iconColor="#dc2626"
            disabled={disabled}
            destructive
            loading={deleting}
            onPress={onDelete}
          />
        ) : null}
      </View>
    </View>
  );
}

function ExportActionButton({
  label,
  icon,
  iconColor,
  disabled,
  emphasized = false,
  destructive = false,
  loading = false,
  onPress,
}: {
  label: string;
  icon?: typeof CalendarDays;
  iconColor?: string;
  disabled: boolean;
  emphasized?: boolean;
  destructive?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const borderClass = destructive
    ? 'border-destructive'
    : emphasized
    ? 'border-primary'
    : 'border-border';
  const textClass = destructive
    ? 'text-destructive'
    : emphasized
    ? 'text-primary'
    : '';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${borderClass} ${
        disabled || loading ? 'opacity-40' : ''
      }`}
    >
      {loading ? (
        <ActivityIndicator size="small" />
      ) : icon != null ? (
        <Icon as={icon} size={14} color={iconColor ?? colors.foreground} />
      ) : null}
      <Text className={`text-xs font-medium ${textClass}`}>{label}</Text>
    </Pressable>
  );
}

function deleteTrackingEventsMessage(rowCount: number): string {
  const countLabel =
    rowCount > 0
      ? `This removes ${rowCount.toLocaleString()} debug log rows. `
      : '';
  return `${countLabel}Your map, visits, drives, and GPS points are not affected.`;
}

function formatTableLabel(tableName: DatabaseExportTableName): string {
  return tableName.replaceAll('_', ' ');
}

function formatDayLabel(dateKey: string): string {
  return format(parseDateKey(dateKey), 'MMM d, yyyy');
}
