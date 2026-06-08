import {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, Share, View} from 'react-native';
import {Database} from 'lucide-react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {countLocationPoints} from '@/db/repositories/location-points';
import {
  countTrackingEvents,
  getAllTrackingEvents,
} from '@/db/repositories/tracking-events';
import {
  getAllLocationPoints,
  getLocationPointsForDay,
} from '@/db/repositories/location-days';
import {getTodayDateKey} from '@/lib/day-utils';
import {
  buildRawLocationExportCsv,
  buildRawLocationExportJson,
  exportFileLabel,
  type LocationExportScope,
} from '@/lib/location-export';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  diagnosticsExportFileLabel,
  buildTrackingDiagnosticsJson,
} from '@/lib/tracking-diagnostics-export';
import {
  getTrackingDiagnosticsEnabled,
  setTrackingDiagnosticsEnabled,
} from '@/lib/tracking-diagnostics';

type ExportFormat = 'json' | 'csv';

export function LocationDataSettings() {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [diagnosticsCount, setDiagnosticsCount] = useState(0);
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const shareExport = async (format: ExportFormat, scope: LocationExportScope) => {
    setExporting(true);
    try {
      const todayKey = getTodayDateKey();
      const points =
        scope === 'today'
          ? await getLocationPointsForDay(todayKey)
          : await getAllLocationPoints();

      if (points.length === 0) {
        Alert.alert(
          'Nothing to export',
          scope === 'today'
            ? 'No location rows saved for today yet.'
            : 'No location rows in the database yet.',
        );
        return;
      }

      const body =
        format === 'json'
          ? buildRawLocationExportJson(points, {
              scope,
              dateKey: scope === 'today' ? todayKey : undefined,
            })
          : buildRawLocationExportCsv(points);

      await Share.share({
        message: body,
        title: exportFileLabel(format, scope, todayKey),
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
    <View className="bg-card border-border rounded-2xl border p-4">
      <View className="flex-row items-center gap-3">
        <Icon as={Database} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">Export location data</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator className="mt-4" />
      ) : (
        <>
          <Text variant="muted" className="mt-3 text-sm">
            {totalCount.toLocaleString()} rows in database
            {todayCount > 0 ? ` · ${todayCount.toLocaleString()} today` : ''}
          </Text>

          <Text className="mt-4 text-sm font-medium">Today</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            <ExportButton
              label="JSON"
              disabled={exporting}
              primary
              onPress={() => void shareExport('json', 'today')}
            />
            <ExportButton
              label="CSV"
              disabled={exporting}
              onPress={() => void shareExport('csv', 'today')}
            />
          </View>

          <Text className="mt-4 text-sm font-medium">All saved data</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            <ExportButton
              label="JSON"
              disabled={exporting}
              primary
              onPress={() => void shareExport('json', 'all')}
            />
            <ExportButton
              label="CSV"
              disabled={exporting}
              onPress={() => void shareExport('csv', 'all')}
            />
          </View>

          <View className="mt-4">
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
              Records tracking lifecycle events locally on this device. Turn on
              during dogfood observation, then export JSON if you see a large gap.
            </Text>

            {diagnosticsCount > 0 ? (
            <>
                <Text className="mt-4 text-sm font-medium">
                  Diagnostics events ({diagnosticsCount.toLocaleString()})
                </Text>
                <View className="mt-2 flex-row flex-wrap gap-2">
                  <ExportButton
                    label="Export JSON"
                    disabled={exporting}
                    onPress={() => void shareDiagnosticsExport()}
                  />
                </View>
            </>
            ) : null}
          </View>
        </>
      )}
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
      <Text
        className={`text-sm font-medium ${primary ? 'text-primary' : ''}`}>
        {label}
      </Text>
    </Pressable>
  );
}
