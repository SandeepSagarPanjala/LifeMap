import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { HealthSyncProgressModal } from '@/components/healthkit/HealthSyncProgressModal';
import { SettingsScreenLayout } from '@/components/settings/SettingsScreenLayout';
import {
  SettingsGroupLabel,
  SettingsIosToggle,
  SettingsLinkRow,
} from '@/components/settings/settings-group';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  ensureHealthKitPermission,
  isHealthDataAvailableSafe,
  isHealthKitSupported,
} from '@/lib/healthkit/permissions';
import {
  getHealthKitActivityEnabled,
  getHealthKitMasterEnabled,
  getHealthKitSleepEnabled,
  getHealthKitStepsEnabled,
  setHealthKitActivityEnabled,
  setHealthKitMasterEnabled,
  setHealthKitSleepEnabled,
  setHealthKitStepsEnabled,
} from '@/lib/healthkit/settings';
import {
  syncHealthKit,
  type HealthSyncProgress,
} from '@/lib/healthkit/sync';
import { cn } from '@/lib/utils';

const DONE_HOLD_MS = 700;

export function HealthSettingsScreen() {
  const colors = useThemeColors();
  const [master, setMaster] = useState(false);
  const [sleepOn, setSleepOn] = useState(true);
  const [activityOn, setActivityOn] = useState(true);
  const [stepsOn, setStepsOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [syncVisible, setSyncVisible] = useState(false);
  const [syncProgress, setSyncProgress] = useState<HealthSyncProgress | null>(
    null,
  );
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [m, s, a, st, avail] = await Promise.all([
          getHealthKitMasterEnabled(),
          getHealthKitSleepEnabled(),
          getHealthKitActivityEnabled(),
          getHealthKitStepsEnabled(),
          isHealthDataAvailableSafe(),
        ]);
        if (!cancelled) {
          setMaster(m);
          setSleepOn(s);
          setActivityOn(a);
          setStepsOn(st);
          setAvailable(avail);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSyncWithProgress = useCallback(async () => {
    setSyncing(true);
    setSyncVisible(true);
    setSyncProgress({
      phase: 'preparing',
      message: 'Preparing Apple Health import…',
      percent: 0,
    });
    try {
      await syncHealthKit({
        onProgress: next => {
          setSyncProgress(next);
        },
      });
      await new Promise<void>(resolve => {
        setTimeout(resolve, DONE_HOLD_MS);
      });
    } finally {
      setSyncVisible(false);
      setSyncProgress(null);
      setSyncing(false);
    }
  }, []);

  const handleMasterChange = useCallback(
    async (next: boolean) => {
      if (syncing) {
        return;
      }
      if (next) {
        if (!isHealthKitSupported()) {
          Alert.alert('Apple Health', 'Apple Health is only available on iOS.');
          setMaster(false);
          return;
        }
        const ok = await ensureHealthKitPermission();
        if (!ok) {
          Alert.alert(
            'Apple Health',
            'Allow LifeMap to read Sleep, Workouts, and Steps in the Health permission sheet (or Settings → Health → Data Access).',
          );
          setMaster(false);
          return;
        }
      }
      setMaster(next);
      await setHealthKitMasterEnabled(next);
      if (next) {
        await runSyncWithProgress();
      }
    },
    [runSyncWithProgress, syncing],
  );

  const handleCategoryChange = useCallback(
    async (
      kind: 'sleep' | 'activity' | 'steps',
      next: boolean,
    ) => {
      if (syncing) {
        return;
      }
      if (kind === 'sleep') {
        setSleepOn(next);
        await setHealthKitSleepEnabled(next);
      } else if (kind === 'activity') {
        setActivityOn(next);
        await setHealthKitActivityEnabled(next);
      } else {
        setStepsOn(next);
        await setHealthKitStepsEnabled(next);
      }
      if (next) {
        await runSyncWithProgress();
      }
    },
    [runSyncWithProgress, syncing],
  );

  if (!isHealthKitSupported()) {
    return (
      <SettingsScreenLayout>
        <Text variant="muted" className="mt-4 text-sm">
          Apple Health is available on iPhone only.
        </Text>
      </SettingsScreenLayout>
    );
  }

  return (
    <SettingsScreenLayout>
      <SettingsIosToggle
        label="Apple Health"
        description="Optional. Adds sleep, workouts, and steps from Apple Watch / Health onto your day map. Data stays on this device."
        value={master}
        onValueChange={value => {
          void handleMasterChange(value);
        }}
        loading={loading}
        disabled={loading || syncing || (!available && !master)}
      />

      {!available && Platform.OS === 'ios' ? (
        <Text
          variant="muted"
          className={cn('mt-2 text-sm')}
          style={{ color: colors.mutedForeground }}
        >
          Health data is not available on this device (simulator may lack
          HealthKit).
        </Text>
      ) : null}

      {master ? (
        <>
          <SettingsGroupLabel title="Read from Health" />
          <SettingsIosToggle
            label="Sleep"
            description="Show sleep on overnight visits (nested inside the Home stay)."
            value={sleepOn}
            disabled={syncing}
            onValueChange={value => {
              void handleCategoryChange('sleep', value);
            }}
          />
          <SettingsIosToggle
            label="Activity"
            description="Auto-log Watch workouts as LifeMap activity moments."
            value={activityOn}
            disabled={syncing}
            onValueChange={value => {
              void handleCategoryChange('activity', value);
            }}
          />
          <SettingsIosToggle
            label="Steps"
            description="Show daily step totals on the day story."
            value={stepsOn}
            disabled={syncing}
            onValueChange={value => {
              void handleCategoryChange('steps', value);
            }}
          />

          {/* TEMP: remove after dogfooding the first-enable 30-day backfill. */}
          {__DEV__ ? (
            <>
              <SettingsGroupLabel title="Dev" />
              <SettingsLinkRow
                label="Sync last 30 days"
                value={syncing ? 'Working…' : undefined}
                accessibilityLabel="Sync last 30 days from Apple Health"
                onPress={() => {
                  if (!syncing) {
                    void runSyncWithProgress();
                  }
                }}
              />
              <Text
                variant="muted"
                className={cn('mt-1 text-sm')}
                style={{ color: colors.mutedForeground }}
              >
                Temporary. Same import as turning Apple Health on for the first
                time. Safe to run again — won’t duplicate workouts.
              </Text>
            </>
          ) : null}
        </>
      ) : (
        <Text
          variant="muted"
          className={cn('mt-4 text-sm')}
          style={{ color: colors.mutedForeground }}
        >
          Turn on Apple Health to enrich your map with sleep, workouts, and
          steps. Existing tracking stays the same either way.
        </Text>
      )}

      <HealthSyncProgressModal visible={syncVisible} progress={syncProgress} />
    </SettingsScreenLayout>
  );
}
