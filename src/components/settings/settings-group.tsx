import {Check, ChevronRight} from 'lucide-react-native';
import type {ReactNode} from 'react';
import {Pressable, Switch, View} from 'react-native';

import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {cn} from '@/lib/utils';

type SettingsGroupLabelProps = {
  title: string;
  subtitle?: string;
  isFirst?: boolean;
};

export function SettingsGroupLabel({
  title,
  subtitle,
  isFirst,
}: SettingsGroupLabelProps) {
  return (
    <View className={cn('px-1', isFirst ? 'mt-0' : 'mt-6')}>
      <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="muted" className="mt-1 text-sm">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

type SettingsGroupProps = {
  children: ReactNode;
  className?: string;
};

export function SettingsGroup({children, className}: SettingsGroupProps) {
  return (
    <View
      className={cn(
        'bg-card border-border mt-2 overflow-hidden rounded-xl border',
        className,
      )}>
      {children}
    </View>
  );
}

export function SettingsGroupDivider() {
  return <View className="bg-border ml-4 h-px" />;
}

type SettingsLinkRowProps = {
  label: string;
  value?: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

export function SettingsLinkRow({
  label,
  value,
  onPress,
  accessibilityLabel,
}: SettingsLinkRowProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      className="min-h-[44px] flex-row items-center px-4 py-3 active:opacity-70">
      <Text className="flex-1 text-base">{label}</Text>
      <View className="max-w-[55%] flex-row items-center gap-1">
        {value ? (
          <Text variant="muted" className="text-base" numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        <ChevronRight size={18} color={colors.mutedForeground} strokeWidth={2.25} />
      </View>
    </Pressable>
  );
}

type SettingsIosToggleProps = {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  footer?: string;
};

/** iOS-style toggle: white row card, description in footnote below the card. */
export function SettingsIosToggle({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  loading = false,
  footer,
}: SettingsIosToggleProps) {
  const colors = useThemeColors();

  return (
    <View className="mt-2">
      <View className="bg-card border-border flex-row items-center rounded-xl border px-4 py-3">
        <Text className="flex-1 text-base">{label}</Text>
        <Switch
          accessibilityRole="switch"
          value={value}
          disabled={disabled || loading}
          onValueChange={onValueChange}
          trackColor={{false: '#E5E5EA', true: colors.primary}}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#E5E5EA"
        />
      </View>
      <Text variant="muted" className="mt-2 px-1 text-sm leading-5">
        {description}
      </Text>
      {footer ? (
        <Text variant="muted" className="mt-1 px-1 text-xs leading-4">
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

type SettingsToggleRowProps = {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  footer?: string;
};

export function SettingsToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  loading = false,
  footer,
}: SettingsToggleRowProps) {
  const colors = useThemeColors();

  return (
    <View className="px-4 py-3">
      <View className="flex-row items-center gap-3">
        <Text className="flex-1 text-base font-medium">{label}</Text>
        <Switch
          accessibilityRole="switch"
          value={value}
          disabled={disabled || loading}
          onValueChange={onValueChange}
          trackColor={{false: '#E5E5EA', true: colors.primary}}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#E5E5EA"
        />
      </View>
      <Text variant="muted" className="mt-2 text-sm leading-5">
        {description}
      </Text>
      {footer ? (
        <Text variant="muted" className="mt-2 text-xs leading-4">
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

type SettingsCheckRowProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  hint?: string;
};

export function SettingsCheckRow({
  label,
  selected,
  onPress,
  hint,
}: SettingsCheckRowProps) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{selected}}
      onPress={onPress}
      className="min-h-[44px] flex-row items-center px-4 py-3 active:opacity-70">
      <View className="flex-1">
        <Text className="text-base">{label}</Text>
        {hint ? (
          <Text variant="muted" className="mt-0.5 text-sm">
            {hint}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <Check size={20} color={colors.primary} strokeWidth={2.5} />
      ) : (
        <View className="h-5 w-5" />
      )}
    </Pressable>
  );
}
