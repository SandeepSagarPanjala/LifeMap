import {View} from 'react-native';

import {Text} from '@/components/ui/text';

type SettingsSectionProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  isFirst?: boolean;
};

export function SettingsSection({
  title,
  subtitle,
  children,
  isFirst,
}: SettingsSectionProps) {
  return (
    <View className={isFirst ? '' : 'mt-6'}>
      <Text className="text-lg font-semibold">{title}</Text>
      {subtitle ? (
        <Text variant="muted" className="mt-1 text-sm">
          {subtitle}
        </Text>
      ) : null}
      <View className="mt-3 gap-4">{children}</View>
    </View>
  );
}
