import {format} from 'date-fns';
import {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, Share, View} from 'react-native';
import {Database} from 'lucide-react-native';

import {HistoryDatePickerSheet} from '@/components/map/HistoryDatePickerSheet';
import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {fetchDatabaseExportTables} from '@/db/repositories/database-export';
import {countLocationPoints} from '@/db/repositories/location-points';
import {getLocationPointsForDay} from '@/db/repositories/location-days';
import {
  countTrackingEvents,
  getAllTrackingEvents,
} from '@/db/repositories/tracking-events';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  buildDatabaseExportJson,
  databaseExportFileLabel,
} from '@/lib/database-export';
import {getTodayDateKey, parseDateKey} from '@/lib/day-utils';
import {
  resolveExportPeriod,
  type ExportPeriodScope,
} from '@/lib/export-period';
import {
  diagnosticsExportFileLabel,
  buildTrackingDiagnosticsJson,
} from '@/lib/tracking-diagnostics-export';
import {
  getTrackingDiagnosticsEnabled,
  setTrackingDiagnosticsEnabled,
} from '@/lib/tracking-diagnostics';

export function ExportSettings() {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [diagnosticsCount, setDiagnosticsCount] = useState(0);
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState(getTodayDateKey());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const todayKey = getTodayDateKey();
      const [total, todayPoints, diagnostics] = await Promise.all([
        countLocationPoints(),
        getLocationPointsForDay(todayKey),
        countTrackingEvents(),
      ]);
      setTotalCount(total);
      setTodayCount(todayPoints.length);
      setDiagnosticsCount(diagnostics);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void getTrackingDiagnosticsEnabled()
      .then(setDiagnosticsEnabled)
      .catch(() => undefined);
  }, []);

  const shareDatabaseExport = async (
    scope: ExportPeriodScope,
    dateKey?: string,
  ) => {
    setExporting(true);
    try {
      const period = resolveExportPeriod(scope, dateKey);
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
    } finally {
      setExporting(false);
    }
  };

  const shareDiagnosticsExport = async () => {
    setExporting(true);
    try {
      const events = await getAllTrackingEvents();
      if (events.length === 0) {
        Alert.alert(
          'No diagnostics yet',
          'Tracking diagnostics have not recorded any events yet.',
        );
        return;
      }
      await Share.share({
        message: buildTrackingDiagnosticsJson(events),
        title: diagnosticsExportFileLabel(),
      });
    } finally {
      setExporting(false);
    }
  };

  const toggleDiagnostics = async () => {
    const next = !diagnosticsEnabled;
    setDiagnosticsEnabled(next);
    await setTrackingDiagnosticsEnabled(next);
    await refresh();
  };

  return (
    <>
      <View className="bg-card border-border rounded-2xl border p-4">
        <View className="flex-row items-center gap-3">
          <Icon as={Database} size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-medium">Export data</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator className="mt-4" />
        ) : (
          <>
            <Text variant="muted" className="mt-3 text-sm">
              {totalCount.toLocaleString()} location rows
              {todayCount > 0 ? ` · ${todayCount.toLocaleString()} today` : ''}
            </Text>

            <View className="mt-4">
              <Text className="text-sm font-medium">All tables</Text>
              <Text variant="muted" className="mt-1 text-xs">
                Location points, trips, visits, settings, and more
              </Text>
              <View className="mt-2 gap-2">
                <ExportRow label="Today">
                  <ExportButton
                    label="Export JSON"
                    disabled={exporting}
                    primary
                    onPress={() => void shareDatabaseExport('today')}
                  />
                </ExportRow>
                <ExportRow label="All saved">
                  <ExportButton
                    label="Export JSON"
                    disabled={exporting}
                    primary
                    onPress={() => void shareDatabaseExport('all')}
                  />
                </ExportRow>
                <ExportRow label="Pick a day">
                  <ExportButton
                    label="Export JSON"
                    disabled={exporting}
                    primary
                    onPress={() => setDayPickerVisible(true)}
                  />
                </ExportRow>
              </View>
            </View>

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
                Records tracking lifecycle events locally. Turn on during dogfood,
                then export JSON if you see a large gap.
              </Text>

              {diagnosticsCount > 0 ? (
                <View className="mt-3">
                  <Text variant="muted" className="text-xs">
                    {diagnosticsCount.toLocaleString()} events recorded
                  </Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    <ExportButton
                      label="Export JSON"
                      disabled={exporting}
                      onPress={() => void shareDiagnosticsExport()}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          </>
        )}
      </View>

      <HistoryDatePickerSheet
        visible={dayPickerVisible}
        selectedDateKey={selectedDayKey}
        onSelectDate={dateKey => {
          setSelectedDayKey(dateKey);
          setDayPickerVisible(false);
          void shareDatabaseExport('day', dateKey);
        }}
        onClose={() => setDayPickerVisible(false)}
      />
    </>
  );
}

function ExportRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Text variant="muted" className="w-20 text-xs">
        {label}
      </Text>
      <View className="flex-1 flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

function ExportButton({
  label,
  primary,
  disabled,
  onPress,
}: {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`rounded-full border px-3 py-2 ${
        primary ? 'border-primary' : 'border-border'
      } ${disabled ? 'opacity-50' : ''}`}>
      <Text className={`text-sm font-medium ${primary ? 'text-primary' : ''}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatDayLabel(dateKey: string): string {
  return format(parseDateKey(dateKey), 'MMM d, yyyy');
}
