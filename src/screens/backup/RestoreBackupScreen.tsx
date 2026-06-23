import {useCallback, useEffect, useMemo, useState} from 'react';
import {format} from 'date-fns';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {SplashBackground} from '@/components/splash/SplashBackground';
import {Button} from '@/components/ui/button';
import {Text} from '@/components/ui/text';
import type {RootStackScreenProps} from '@/navigation/types';
import type {RestoreConflict, RestoreConflictChoice} from '@/lib/backup/backup-conflicts';
import type {CloudBackupMetadata} from '@/lib/backup/backup-types';
import {
  dismissInstallRestoreOffer,
  loadRestoreOfferMetadata,
  markInstallRestorePresented,
  markRestoreCompleted,
  type InstallCloudBackupSnapshot,
} from '@/lib/backup/backup-install-state';
import {
  executeMergeRestore,
  prepareMergeRestore,
  type MergeRestorePlan,
} from '@/lib/backup/backup-merge';
import type {BackupProgress} from '@/lib/backup/backup-types';
import {formatStorageBytes} from '@/lib/format-storage';
import {clearHistoryDataCache} from '@/lib/history-data-cache';

type ScreenPhase = 'loading' | 'offer' | 'conflicts' | 'restoring' | 'error';

const TREE_LOTTIE = require('../../../assets/lottie/tree.json');

export function RestoreBackupScreen({
  navigation,
  route,
}: RootStackScreenProps<'RestoreBackup'>) {
  const {width, height} = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const source = route.params?.source ?? 'install';
  const isDevPreview = __DEV__ && route.params?.preview === true;
  const lottieSize = Math.min(width * 0.72, height * 0.32, 300);

  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [metadata, setMetadata] = useState<
    InstallCloudBackupSnapshot | CloudBackupMetadata | null
  >(null);
  const [plan, setPlan] = useState<MergeRestorePlan | null>(null);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [choices, setChoices] = useState<
    Record<string, RestoreConflictChoice | undefined>
  >({});

  const loadOffer = useCallback(async () => {
    setPhase('loading');
    setErrorMessage(null);
    setPlan(null);
    try {
      if (isDevPreview) {
        setPhase('offer');
        return;
      }

      const offerMetadata = await loadRestoreOfferMetadata();
      if (!offerMetadata?.exportedAt) {
        throw new Error('No iCloud backup found.');
      }
      setMetadata(offerMetadata);
      setPhase('offer');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not load your backup.',
      );
      setPhase('error');
    }
  }, [isDevPreview]);

  useEffect(() => {
    void markInstallRestorePresented();
    void loadOffer();
  }, [loadOffer]);

  const backupLabel = useMemo(() => {
    const exportedAt = metadata?.exportedAt ?? plan?.manifestExportedAt;
    if (!exportedAt) {
      return 'your iCloud backup';
    }
    return format(new Date(exportedAt), "MMM d, yyyy 'at' h:mm a");
  }, [metadata?.exportedAt, plan?.manifestExportedAt]);

  const backupSize = metadata?.totalBytes ?? 0;

  const handleStartFresh = useCallback(async () => {
    await dismissInstallRestoreOffer();
    navigation.goBack();
  }, [navigation]);

  const downloadPlan = useCallback(async () => {
    setPhase('loading');
    setErrorMessage(null);
    try {
      const mergePlan = await prepareMergeRestore(setProgress);
      setPlan(mergePlan);
      setChoices(
        Object.fromEntries(
          mergePlan.conflicts.map(conflict => [conflict.id, 'local']),
        ),
      );
      return mergePlan;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not load your backup.',
      );
      setPhase('error');
      return null;
    } finally {
      setProgress(null);
    }
  }, []);

  const runRestore = useCallback(async () => {
    if (isDevPreview) {
      navigation.goBack();
      return;
    }

    let activePlan = plan;
    if (!activePlan) {
      activePlan = await downloadPlan();
      if (!activePlan) {
        return;
      }
      if (activePlan.conflicts.length > 0) {
        setPhase('conflicts');
        return;
      }
    }

    setPhase('restoring');
    setProgress({phase: 'importing', message: 'Merging your data…'});
    try {
      await executeMergeRestore({
        plan: activePlan,
        conflictChoices: choices,
        onProgress: setProgress,
      });
      clearHistoryDataCache();
      await markRestoreCompleted();
      navigation.goBack();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Restore failed.',
      );
      setPhase('error');
    } finally {
      setProgress(null);
    }
  }, [choices, downloadPlan, isDevPreview, navigation, plan]);

  const setChoice = (conflictId: string, choice: RestoreConflictChoice) => {
    setChoices(current => ({...current, [conflictId]: choice}));
  };

  const title =
    phase === 'conflicts'
      ? 'Merge your data'
      : phase === 'error'
        ? 'Could not restore'
        : phase === 'loading' || phase === 'restoring'
          ? phase === 'loading'
            ? 'Finding your backup'
            : 'Restoring LifeMap'
          : source === 'install'
            ? isDevPreview
              ? 'Restore preview'
              : 'Welcome back'
            : 'Restore from iCloud';

  const subtitle =
    phase === 'conflicts'
      ? `LifeMap found cloud backup from ${backupLabel} and new data on this device. Choose what to keep for overlaps.`
      : phase === 'error'
        ? (errorMessage ?? 'Something went wrong.')
        : phase === 'loading' || phase === 'restoring'
          ? (progress?.message ?? 'Working…')
          : isDevPreview
            ? 'Design preview only. Open Settings → Restore from iCloud to see your real backup size and date.'
            : `We found your LifeMap backup from ${backupLabel}${
                backupSize > 0 ? ` (${formatStorageBytes(backupSize)})` : ''
              }. Your map, visits, and memories can be brought back to this phone.`;

  return (
    <View className="flex-1">
      <SplashBackground width={width} height={height} isDark={isDark} />

      <SafeAreaView className="flex-1">
        <View className="flex-row items-center justify-end px-6 pt-2">
          {source === 'install' && (phase === 'offer' || phase === 'conflicts') ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleStartFresh()}
              hitSlop={12}>
              <Text className="text-muted-foreground text-sm font-medium">
                Start fresh
              </Text>
            </Pressable>
          ) : source === 'settings' && phase !== 'loading' && phase !== 'restoring' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.goBack()}
              hitSlop={12}>
              <Text className="text-muted-foreground text-sm font-medium">
                Cancel
              </Text>
            </Pressable>
          ) : (
            <View className="h-5" />
          )}
        </View>

        <View className="flex-1 justify-end px-6 pb-3">
          <View className="items-center">
            <LottieView
              source={TREE_LOTTIE}
              autoPlay
              loop
              style={{width: lottieSize, height: lottieSize}}
            />
          </View>

          <View className="mt-5">
            <Text variant="h2" className="text-foreground border-0 pb-0 text-center">
              {title}
            </Text>
            <Text
              variant="muted"
              className="text-muted-foreground mt-3 text-center text-lg leading-7">
              {subtitle}
            </Text>
          </View>

          {phase === 'loading' || phase === 'restoring' ? (
            <View className="mt-8 items-center">
              <ActivityIndicator size="large" />
            </View>
          ) : null}

          {phase === 'conflicts' && plan ? (
            <ScrollView
              className="mt-6 max-h-56"
              showsVerticalScrollIndicator={false}>
              <View className="gap-3">
                {plan.conflicts.map(conflict => (
                  <ConflictCard
                    key={conflict.id}
                    conflict={conflict}
                    choice={choices[conflict.id] ?? 'local'}
                    onChoose={setChoice}
                  />
                ))}
              </View>
            </ScrollView>
          ) : null}
        </View>

        <View className="px-6 pb-16 pt-2">
          {phase === 'offer' || phase === 'conflicts' ? (
            <Button className="w-full" onPress={() => void runRestore()}>
              <Text>
                {phase === 'conflicts' ? 'Merge and restore' : 'Restore my LifeMap'}
              </Text>
            </Button>
          ) : null}

          {phase === 'error' ? (
            <View className="gap-3">
              <Button className="w-full" onPress={() => void loadOffer()}>
                <Text>Try again</Text>
              </Button>
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleStartFresh()}
                className="py-2">
                <Text className="text-muted-foreground text-center text-sm font-medium">
                  Continue without restore
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function ConflictCard({
  conflict,
  choice,
  onChoose,
}: {
  conflict: RestoreConflict;
  choice: RestoreConflictChoice;
  onChoose: (id: string, choice: RestoreConflictChoice) => void;
}) {
  return (
    <View className="bg-card/80 border-border rounded-2xl border p-4">
      <Text className="font-medium">{conflict.title}</Text>
      <Text variant="muted" className="text-muted-foreground mt-2 text-xs leading-4">
        iCloud: {conflict.backupDetail}
      </Text>
      <Text variant="muted" className="text-muted-foreground mt-1 text-xs leading-4">
        This device: {conflict.localDetail}
      </Text>
      <View className="mt-3 flex-row gap-2">
        <ChoiceButton
          label="Keep iCloud"
          selected={choice === 'backup'}
          onPress={() => onChoose(conflict.id, 'backup')}
        />
        <ChoiceButton
          label="Keep this device"
          selected={choice === 'local'}
          onPress={() => onChoose(conflict.id, 'local')}
        />
      </View>
    </View>
  );
}

function ChoiceButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-1 rounded-xl border px-3 py-2 ${
        selected ? 'bg-primary border-primary' : 'border-border bg-card/60'
      }`}>
      <Text
        className={`text-center text-sm font-medium ${
          selected ? 'text-primary-foreground' : 'text-foreground'
        }`}>
        {label}
      </Text>
    </Pressable>
  );
}
