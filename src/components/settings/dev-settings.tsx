import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BookOpen,
  CloudDownload,
  FlaskConical,
  Image as ImageIcon,
  Tags,
  type LucideIcon,
} from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { RootStackParamList } from '@/navigation/types';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { backfillMomentPhotoTags } from '@/lib/moments/backfill-moment-tags';
import { backfillMomentThumbnails } from '@/lib/moments/backfill-moment-thumbnails';
import { useAppStore } from '@/stores/app-store';
import { countMomentsMissingThumbnails } from '@/db/repositories/moments';

function DevToggle({
  icon,
  title,
  description,
  enabled,
  onToggle,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      onPress={onToggle}
      className="bg-card border-border rounded-2xl border p-4"
    >
      <View className="flex-row items-center gap-3">
        <Icon as={icon} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">{title}</Text>
          <Text variant="muted" className="mt-1">
            {description}
          </Text>
        </View>
        <View
          className={`h-6 w-11 rounded-full px-0.5 ${
            enabled ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <View
            className={`mt-0.5 h-5 w-5 rounded-full bg-white ${
              enabled ? 'ml-auto' : 'ml-0'
            }`}
          />
        </View>
      </View>
    </Pressable>
  );
}

export function DevSettings() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const devShowOnboarding = useAppStore(state => state.devShowOnboarding);
  const setDevShowOnboarding = useAppStore(state => state.setDevShowOnboarding);
  const [thumbBackfillBusy, setThumbBackfillBusy] = useState(false);
  const [thumbBackfillLabel, setThumbBackfillLabel] = useState<string | null>(
    null,
  );
  const [tagBackfillBusy, setTagBackfillBusy] = useState(false);
  const [tagBackfillLabel, setTagBackfillLabel] = useState<string | null>(null);

  const runThumbnailBackfill = useCallback(async () => {
    if (thumbBackfillBusy || tagBackfillBusy) {
      return;
    }
    setThumbBackfillBusy(true);
    setThumbBackfillLabel('Checking…');
    try {
      const missing = await countMomentsMissingThumbnails();
      // Always regenerate — clears existing so quality bumps take effect.
      const result = await backfillMomentThumbnails(progress => {
        setThumbBackfillLabel(
          `${progress.done + progress.failed}/${progress.total || missing}`,
        );
      });
      if (result.total === 0 && result.done === 0) {
        Alert.alert('Thumbnails', 'No photo or video moments to process.');
        return;
      }
      Alert.alert(
        'Thumbnail backfill done',
        `Generated ${result.done} of ${result.total}` +
          (result.failed > 0 ? ` (${result.failed} failed)` : ''),
      );
    } catch (error) {
      Alert.alert(
        'Thumbnail backfill failed',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setThumbBackfillBusy(false);
      setThumbBackfillLabel(null);
    }
  }, [tagBackfillBusy, thumbBackfillBusy]);

  const runTagBackfill = useCallback(async () => {
    if (tagBackfillBusy || thumbBackfillBusy) {
      return;
    }
    setTagBackfillBusy(true);
    setTagBackfillLabel('Checking…');
    try {
      const result = await backfillMomentPhotoTags(progress => {
        setTagBackfillLabel(
          `${progress.done + progress.failed + progress.skipped}/${progress.total}`,
        );
      });
      if (result.total === 0) {
        Alert.alert(
          'Photo & video tags',
          'All photo and video moments already have tags.',
        );
        return;
      }
      Alert.alert(
        'Tag backfill done',
        `Tagged ${result.done} of ${result.total}` +
          (result.skipped > 0 ? `, skipped ${result.skipped}` : '') +
          (result.failed > 0 ? `, failed ${result.failed}` : ''),
      );
    } catch (error) {
      Alert.alert(
        'Tag backfill failed',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setTagBackfillBusy(false);
      setTagBackfillLabel(null);
    }
  }, [tagBackfillBusy, thumbBackfillBusy]);

  if (!__DEV__) {
    return null;
  }

  return (
    <View className="mt-4 gap-4">
      <DevToggle
        icon={BookOpen}
        title="Show onboarding every launch"
        description="After splash, onboarding appears each launch for review. Get Started still opens the main app."
        enabled={devShowOnboarding}
        onToggle={() => setDevShowOnboarding(!devShowOnboarding)}
      />
      <Pressable
        accessibilityRole="button"
        disabled={thumbBackfillBusy || tagBackfillBusy}
        onPress={() => {
          void runThumbnailBackfill();
        }}
        className="bg-card border-border rounded-2xl border p-4"
      >
        <View className="flex-row items-center gap-3">
          <Icon as={ImageIcon} size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-medium">Backfill gallery thumbnails</Text>
            <Text variant="muted" className="mt-1">
              Regenerates ~512px thumbs for photo/video moments. Run again after
              raising thumbnail quality so existing tiles sharpen up.
            </Text>
            {thumbBackfillLabel ? (
              <Text variant="muted" className="mt-2">
                Progress: {thumbBackfillLabel}
              </Text>
            ) : null}
          </View>
          {thumbBackfillBusy ? (
            <ActivityIndicator color={colors.primary} />
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={tagBackfillBusy || thumbBackfillBusy}
        onPress={() => {
          void runTagBackfill();
        }}
        className="bg-card border-border rounded-2xl border p-4"
      >
        <View className="flex-row items-center gap-3">
          <Icon as={Tags} size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-medium">Backfill photo & video tags</Text>
            <Text variant="muted" className="mt-1">
              On-device labels for photo/video moments that still have no tags
              (videos sample 3 frames; top 8 by confidence). Keep the app open
              while it runs.
            </Text>
            {tagBackfillLabel ? (
              <Text variant="muted" className="mt-2">
                Progress: {tagBackfillLabel}
              </Text>
            ) : null}
          </View>
          {tagBackfillBusy ? (
            <ActivityIndicator color={colors.primary} />
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('Benchmark')}
        className="bg-card border-border rounded-2xl border p-4"
      >
        <View className="flex-row items-center gap-3">
          <Icon as={FlaskConical} size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-medium">Benchmark</Text>
            <Text variant="muted" className="mt-1">
              Run Stops, Trips, and Power detection on device GPS — same batch
              algorithm as Points Explorer.
            </Text>
          </View>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          navigation.navigate('RestoreBackup', {
            source: 'install',
            preview: true,
          })
        }
        className="bg-card border-border rounded-2xl border p-4"
      >
        <View className="flex-row items-center gap-3">
          <Icon as={CloudDownload} size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-medium">Preview restore screen</Text>
            <Text variant="muted" className="mt-1">
              Temporary dev shortcut to design the iCloud restore flow. Remove
              before release.
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
