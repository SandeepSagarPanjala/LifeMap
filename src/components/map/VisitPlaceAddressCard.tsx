import {type ReactNode} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';
import {Check, Maximize2, Type} from 'lucide-react-native';

import {Text} from '@/components/ui/text';
import {VisitPlaceLabelPager} from '@/components/map/VisitPlaceLabelPager';
import {useThemeColors} from '@/hooks/use-theme-colors';
import type {VisitPlaceDisplay} from '@/lib/place-lookup-types';
import {PLACE_LOOKUP_MAX_RADIUS_M} from '@/lib/app-constants';
import {nextPlaceLookupRadiusM} from '@/lib/place-lookup-venue';

type VisitPlaceAddressCardProps = {
  display: VisitPlaceDisplay;
  expandingArea?: boolean;
  onSelectPoiId: (poiId: number, poiLabel: string) => void;
  onExpandArea: () => void;
  onRequestCustomLabel: () => void;
  onDone: () => void;
};

export function VisitPlaceAddressCard({
  display,
  expandingArea = false,
  onSelectPoiId,
  onExpandArea,
  onRequestCustomLabel,
  onDone,
}: VisitPlaceAddressCardProps) {
  const colors = useThemeColors();
  const canExpandArea =
    display.cacheId != null &&
    nextPlaceLookupRadiusM(display.venueRadiusMeters) != null;

  const actionButtons = (
    <View style={styles.actionRow}>
      <LabelActionButton
        accessibilityLabel="Increase search area"
        icon={
          expandingArea ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Maximize2 size={14} color={colors.primary} strokeWidth={2.25} />
          )
        }
        label="Increase area"
        disabled={!canExpandArea || expandingArea}
        onPress={onExpandArea}
      />
      <LabelActionButton
        accessibilityLabel="Enter custom place name"
        icon={<Type size={14} color={colors.primary} strokeWidth={2.25} />}
        label="Custom"
        onPress={onRequestCustomLabel}
      />
      <DoneActionButton onPress={onDone} />
    </View>
  );

  if (display.loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.primary} />
        <Text variant="muted" className="mt-2 text-sm">
          Finding nearby places…
        </Text>
      </View>
    );
  }

  if (!display.primaryLabel && display.candidates.length === 0) {
    return (
      <View style={styles.card}>
        <Text className="font-medium">No nearby place found</Text>
        <Text variant="muted" className="mt-1 text-sm">
          Try increasing the search area or enter a custom name.
        </Text>
        {actionButtons}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <VisitPlaceLabelPager
        display={display}
        compact
        onSelectPoiId={onSelectPoiId}
      />
      {actionButtons}
      {display.venueRadiusMeters >= PLACE_LOOKUP_MAX_RADIUS_M ? (
        <Text variant="muted" className="mt-1 text-xs">
          Search area is at maximum ({PLACE_LOOKUP_MAX_RADIUS_M} m).
        </Text>
      ) : null}
    </View>
  );
}

function LabelActionButton({
  icon,
  label,
  accessibilityLabel,
  disabled = false,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={[styles.labelButton, disabled && styles.buttonDisabled]}>
      {icon}
      <Text style={styles.labelButtonText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function DoneActionButton({onPress}: {onPress: () => void}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Done"
      onPress={onPress}
      style={styles.doneButton}>
      <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  labelButton: {
    flex: 1,
    minWidth: 0,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 6,
  },
  labelButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1C1C1E',
    flexShrink: 1,
  },
  doneButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
