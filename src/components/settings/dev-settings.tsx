import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BookOpen,
  CloudDownload,
  FlaskConical,
  type LucideIcon,
} from 'lucide-react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { RootStackParamList } from '@/navigation/types';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useAppStore } from '@/stores/app-store';
import { LocationPointsDedupeDevCard } from '@/components/settings/location-points-dedupe-dev-card';

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
      <LocationPointsDedupeDevCard />
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
